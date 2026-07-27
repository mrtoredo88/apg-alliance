import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ECONOMY_VERSION, getEconomyReward } from './economy-engine.js';

const TOKEN_PREFIX = 'apg:visit:v1:';
const TOKEN_TTL_MS = 60_000;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getSecret() {
  return process.env.QR_TOKEN_SECRET
    || process.env.EMAIL_SECRET
    || process.env.RAFFLE_SECRET
    || process.env.CRON_SECRET
    || 'apg-local-dev-secret';
}

function signPayload(encodedPayload) {
  return createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function monthKeyFromToday(key) {
  return key.slice(0, 7);
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

async function writeQrLog(store, data) {
  await store.addDocument('qrLogs', {
    ...data,
    createdAt: new Date().toISOString(),
  }).catch(() => {});
}

async function loadSubject(store, subjectType, subjectId) {
  const collectionName = subjectType === 'expert' ? 'experts' : 'partners';
  const data = await store.getDocument(collectionName, subjectId);
  if (!data) return null;
  return { data, collectionName, id: subjectId };
}

function ownerValues(subject) {
  return [
    subject.ownerUserId,
    subject.ownerId,
    subject.vkOwnerId,
    subject.ownerVkId,
    subject.managerUserId,
    ...(Array.isArray(subject.managerUserIds) ? subject.managerUserIds : []),
  ].map(normalizeId).filter(Boolean);
}

function isPrivilegedUser(user) {
  const role = String(user?.role ?? '').toLowerCase();
  return Boolean(user?.isAdmin || user?.admin || role === 'admin' || role === 'owner');
}

async function validateScannerForOneTime(accountCore, subject, scannerUserId) {
  const scannerId = normalizeId(scannerUserId);
  if (!scannerId) return { ok: false, code: 'NO_SCANNER', message: 'Не удалось определить сканирующего пользователя' };

  const scanner = await accountCore?.getProfile(scannerId);
  if (isPrivilegedUser(scanner)) return { ok: true, role: 'admin' };

  const owners = ownerValues(subject);
  if (!owners.length) return { ok: true, role: 'unverified_staff', warning: 'subject_owner_not_configured' };
  if (owners.includes(scannerId)) return { ok: true, role: 'owner' };

  return { ok: false, code: 'SCANNER_NOT_ALLOWED', message: 'Этот QR должен подтвердить партнёр или эксперт' };
}

function parseSignedVisitToken(qrValue) {
  const raw = normalizeId(qrValue);
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const token = raw.slice(TOKEN_PREFIX.length);
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    const err = new Error('Некорректный QR-токен');
    err.code = 'BAD_TOKEN';
    throw err;
  }
  const expected = signPayload(encodedPayload);
  if (!safeEqual(signature, expected)) {
    const err = new Error('Подпись QR-токена не совпадает');
    err.code = 'BAD_SIGNATURE';
    throw err;
  }
  const payload = JSON.parse(fromBase64url(encodedPayload));
  return {
    userId: normalizeId(payload.userId),
    subjectType: payload.subjectType === 'expert' ? 'expert' : 'partner',
    subjectId: normalizeId(payload.subjectId),
    nonce: normalizeId(payload.nonce),
    iat: Number(payload.iat),
    exp: Number(payload.exp),
  };
}

async function resolveLegacyQr(store, qrValue, scannerUserId) {
  const raw = normalizeId(qrValue);
  if (!raw) return null;

  if (raw.startsWith('expert_')) {
    const subjectId = raw.slice(7);
    const subject = await loadSubject(store, 'expert', subjectId);
    if (!subject) return null;
    return {
      source: 'legacy_service_expert',
      userId: normalizeId(scannerUserId),
      subjectType: 'expert',
      subjectId,
      subject,
    };
  }

  const subject = await loadSubject(store, 'partner', raw);
  if (!subject) return null;
  return {
    source: 'legacy_service_partner',
    userId: normalizeId(scannerUserId),
    subjectType: 'partner',
    subjectId: raw,
    subject,
  };
}

export async function createVisitQrToken(store, { userId, subjectType, subjectId, requestedBy }) {
  const cleanUserId = normalizeId(userId);
  const cleanSubjectId = normalizeId(subjectId);
  const cleanType = subjectType === 'expert' ? 'expert' : 'partner';

  if (!cleanUserId || !cleanSubjectId) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'Не хватает пользователя или партнёра' };
  }

  const subject = await loadSubject(store, cleanType, cleanSubjectId);
  if (!subject) {
    await writeQrLog(store, { event: 'qr_create_rejected', reason: 'subject_not_found', userId: cleanUserId, subjectType: cleanType, subjectId: cleanSubjectId, requestedBy: normalizeId(requestedBy) });
    return { ok: false, status: 404, code: 'SUBJECT_NOT_FOUND', message: cleanType === 'expert' ? 'Эксперт не найден' : 'Партнёр не найден' };
  }

  const now = Date.now();
  const payload = {
    userId: cleanUserId,
    subjectType: cleanType,
    subjectId: cleanSubjectId,
    nonce: randomBytes(18).toString('base64url'),
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const qrValue = `${TOKEN_PREFIX}${encodedPayload}.${signPayload(encodedPayload)}`;

  await store.setDocument('visitTokens', payload.nonce, {
    ...payload,
    used: false,
    requestedBy: normalizeId(requestedBy) || cleanUserId,
    qrType: `service_${cleanType}`,
    createdAt: new Date().toISOString(),
  }, { merge: false });

  await writeQrLog(store, {
    event: 'qr_created',
    qrType: `service_${cleanType}`,
    userId: cleanUserId,
    subjectType: cleanType,
    subjectId: cleanSubjectId,
    nonce: payload.nonce,
    requestedBy: normalizeId(requestedBy) || cleanUserId,
    expiresAtMs: payload.exp,
  });

  return { ok: true, qrValue, expiresAt: payload.exp, ttlMs: TOKEN_TTL_MS };
}

async function incrementDocument(store, collectionName, id, field, amount = 1) {
  const current = await store.getDocument(collectionName, id);
  if (!current) return null;
  return store.updateDocument(collectionName, id, { [field]: Number(current[field] || 0) + amount });
}

async function awardVisitTransaction(store, accountCore, context) {
  const now = new Date();
  const dateKey = todayKey(now);
  if (!accountCore?.awardVisit) throw Object.assign(new Error('PostgreSQL Economy недоступна'), { code: 'ECONOMY_NOT_CONFIGURED' });

  if (context.tokenId) {
    const token = await store.getDocument('visitTokens', context.tokenId);
    if (!token || token.used) throw Object.assign(new Error('QR уже использован'), { code: 'TOKEN_USED' });
    if (Number(token.expiresAtMs) < Date.now()) throw Object.assign(new Error('QR истёк'), { code: 'TOKEN_EXPIRED' });
  }

  const subject = context.subject.data;
  const baseReward = getEconomyReward(context.subjectType === 'expert' ? 'expert_visit' : 'partner_visit');
  const partnerBoost = Math.max(1, Math.min(5, Number(subject.keyMultiplier || subject.keysMultiplier || (subject.featured || subject.partnerOfMonth ? 2 : 1)) || 1));
  const configuredKeys = Number(subject.keys || subject.visitKeys || 0);
  const requestedKeys = Math.max(0, configuredKeys || Math.round(baseReward.keys * partnerBoost));
  const idempotencyKey = context.nonce
    ? `qr:${context.nonce}`
    : `legacy-visit:${context.userId}:${context.subjectType}:${context.subjectId}`;
  const awarded = await accountCore.awardVisit({
    userId: context.userId,
    subjectType: context.subjectType,
    subjectId: context.subjectId,
    subjectLabel: subject.name || 'АПГ',
    idempotencyKey,
    requestedKeys,
    reputation: baseReward.reputation,
    dateKey,
    scanDate: dateKey,
  });
  const keyBonus = awarded.replayed ? 0 : awarded.operation.delta;
  const reputationBonus = awarded.alreadyAwarded || awarded.replayed ? 0 : baseReward.reputation;

  await Promise.all([
    incrementDocument(store, context.subject.collectionName, context.subjectId, 'totalVisits', 1),
    incrementDocument(store, 'stats', 'global', 'totalScans', 1),
    store.addDocument(context.subjectType === 'partner' ? 'scans' : 'expertScans', {
      userId: context.userId,
      subjectType: context.subjectType,
      partnerId: context.subjectType === 'partner' ? context.subjectId : null,
      expertId: context.subjectType === 'expert' ? context.subjectId : null,
      source: context.source,
	      isNew: !alreadyAwarded,
	      keysAwarded: keyBonus,
	      reputationAwarded: reputationBonus,
	      economyVersion: ECONOMY_VERSION,
	      monthKey: monthKeyFromToday(dateKey),
      scannedBy: context.scannerUserId,
      scannedAt: new Date().toISOString(),
    }),
    context.tokenId ? store.updateDocument('visitTokens', context.tokenId, {
        used: true,
        usedAt: new Date().toISOString(),
	        usedBy: context.scannerUserId,
	        keysAwarded: keyBonus,
	        reputationAwarded: reputationBonus,
    }) : Promise.resolve(),
  ]);

  return {
      awardedKeys: keyBonus,
      awardedReputation: reputationBonus,
      targetUserId: context.userId,
      balanceAfter: awarded.operation.balanceAfter,
      alreadyAwarded: awarded.alreadyAwarded || awarded.replayed,
      streak: awarded.streak,
      scanDates: awarded.scanDates,
      visitCount: awarded.visitCount,
      subjectName: subject.name ?? '',
      subjectType: context.subjectType,
      subjectId: context.subjectId,
  };
}

export async function awardVisit(store, { qrValue, scannerUserId, accountCore }) {
  const scannerId = normalizeId(scannerUserId);
  if (!scannerId) {
    return { ok: false, status: 400, code: 'NO_SCANNER', message: 'Не удалось определить пользователя' };
  }

  let context = null;
  try {
    const parsed = parseSignedVisitToken(qrValue);
    if (parsed) {
      if (!parsed.userId || !parsed.subjectId || !parsed.nonce) {
        return { ok: false, status: 400, code: 'BAD_TOKEN', message: 'QR повреждён' };
      }
      if (parsed.exp < Date.now()) {
      await writeQrLog(store, { event: 'qr_rejected', reason: 'expired', scannerUserId: scannerId, userId: parsed.userId, subjectType: parsed.subjectType, subjectId: parsed.subjectId, nonce: parsed.nonce });
        return { ok: false, status: 410, code: 'TOKEN_EXPIRED', message: 'QR истёк. Сгенерируйте новый.' };
      }
      const subject = await loadSubject(store, parsed.subjectType, parsed.subjectId);
      if (!subject) return { ok: false, status: 404, code: 'SUBJECT_NOT_FOUND', message: 'Партнёр или эксперт не найден' };
      const scannerCheck = await validateScannerForOneTime(accountCore, subject.data, scannerId);
      if (!scannerCheck.ok) {
        await writeQrLog(store, { event: 'qr_rejected', reason: scannerCheck.code, scannerUserId: scannerId, userId: parsed.userId, subjectType: parsed.subjectType, subjectId: parsed.subjectId, nonce: parsed.nonce });
        return { ok: false, status: 403, code: scannerCheck.code, message: scannerCheck.message };
      }
      context = {
        source: 'one_time_qr',
        userId: parsed.userId,
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        scannerUserId: scannerId,
        tokenId: parsed.nonce,
        nonce: parsed.nonce,
        subject,
      };
    }
  } catch (e) {
    await writeQrLog(store, { event: 'qr_rejected', reason: e.code ?? 'bad_token', scannerUserId: scannerId, error: e.message });
    return { ok: false, status: 400, code: e.code ?? 'BAD_TOKEN', message: 'QR не прошёл проверку безопасности' };
  }

  if (!context) {
    const legacy = await resolveLegacyQr(store, qrValue, scannerId);
    if (!legacy) {
      await writeQrLog(store, { event: 'qr_rejected', reason: 'unknown_qr', scannerUserId: scannerId, raw: normalizeId(qrValue).slice(0, 120) });
      return { ok: false, status: 404, code: 'UNKNOWN_QR', message: 'QR-код не распознан' };
    }
    context = {
      ...legacy,
      scannerUserId: scannerId,
      tokenId: null,
    };
  }

  try {
    const result = await awardVisitTransaction(store, accountCore, context);
    await writeQrLog(store, {
      event: result.awardedKeys > 0 ? 'reward_awarded' : 'visit_recorded',
      source: context.source,
      scannerUserId: scannerId,
      userId: context.userId,
      subjectType: context.subjectType,
      subjectId: context.subjectId,
	      keysAwarded: result.awardedKeys,
	      reputationAwarded: result.awardedReputation,
	      economyVersion: ECONOMY_VERSION,
	      alreadyAwarded: result.alreadyAwarded,
    });
    return {
      ok: true,
      ...result,
      message: result.awardedKeys > 0
        ? `+${result.awardedKeys} ключ — ${result.subjectName}!`
        : `Визит отмечен — ${result.subjectName}`,
    };
  } catch (e) {
    await writeQrLog(store, {
      event: 'reward_rejected',
      reason: e.code ?? 'award_error',
      source: context.source,
      scannerUserId: scannerId,
      userId: context.userId,
      subjectType: context.subjectType,
      subjectId: context.subjectId,
      error: e.message,
    });
    const status = e.code === 'TOKEN_USED' ? 409 : e.code === 'TOKEN_EXPIRED' ? 410 : e.code === 'USER_NOT_FOUND' ? 404 : 500;
    return { ok: false, status, code: e.code ?? 'AWARD_ERROR', message: e.message || 'Не удалось начислить ключи' };
  }
}

export async function awardReferral() {
  throw new Error('awardReferral is not implemented in V2.9 local backend yet');
}

export async function awardDailyLogin() {
  throw new Error('awardDailyLogin is not implemented in V2.9 local backend yet');
}

export async function awardTaskReward() {
  throw new Error('awardTaskReward is not implemented in V2.9 local backend yet');
}

export async function awardAchievement() {
  throw new Error('awardAchievement is not implemented in V2.9 local backend yet');
}

export async function awardPartnerDay() {
  throw new Error('awardPartnerDay is not implemented in V2.9 local backend yet');
}

export async function awardLotteryReward() {
  throw new Error('awardLotteryReward is not implemented in V2.9 local backend yet');
}
