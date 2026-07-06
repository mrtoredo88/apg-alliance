import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

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
  return now.toLocaleDateString('sv');
}

function monthKeyFromToday(key) {
  return key.slice(0, 7);
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

async function writeQrLog(db, data) {
  await db.collection('qrLogs').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

async function loadSubject(db, subjectType, subjectId) {
  const collectionName = subjectType === 'expert' ? 'experts' : 'partners';
  const ref = db.collection(collectionName).doc(subjectId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data(), collectionName };
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

async function validateScannerForOneTime(db, subject, scannerUserId) {
  const scannerId = normalizeId(scannerUserId);
  if (!scannerId) return { ok: false, code: 'NO_SCANNER', message: 'Не удалось определить сканирующего пользователя' };

  const scannerSnap = await db.collection('users').doc(scannerId).get();
  const scanner = scannerSnap.exists ? scannerSnap.data() : null;
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

async function resolveLegacyQr(db, qrValue, scannerUserId) {
  const raw = normalizeId(qrValue);
  if (!raw) return null;

  if (raw.startsWith('expert_')) {
    const subjectId = raw.slice(7);
    const subject = await loadSubject(db, 'expert', subjectId);
    if (!subject) return null;
    return {
      source: 'legacy_service_expert',
      userId: normalizeId(scannerUserId),
      subjectType: 'expert',
      subjectId,
      subject,
    };
  }

  const subject = await loadSubject(db, 'partner', raw);
  if (!subject) return null;
  return {
    source: 'legacy_service_partner',
    userId: normalizeId(scannerUserId),
    subjectType: 'partner',
    subjectId: raw,
    subject,
  };
}

export async function createVisitQrToken(db, { userId, subjectType, subjectId, requestedBy }) {
  const cleanUserId = normalizeId(userId);
  const cleanSubjectId = normalizeId(subjectId);
  const cleanType = subjectType === 'expert' ? 'expert' : 'partner';

  if (!cleanUserId || !cleanSubjectId) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'Не хватает пользователя или партнёра' };
  }

  const subject = await loadSubject(db, cleanType, cleanSubjectId);
  if (!subject) {
    await writeQrLog(db, { event: 'qr_create_rejected', reason: 'subject_not_found', userId: cleanUserId, subjectType: cleanType, subjectId: cleanSubjectId, requestedBy: normalizeId(requestedBy) });
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

  await db.collection('visitTokens').doc(payload.nonce).set({
    ...payload,
    used: false,
    requestedBy: normalizeId(requestedBy) || cleanUserId,
    qrType: `service_${cleanType}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeQrLog(db, {
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

async function awardVisitTransaction(db, context) {
  const now = new Date();
  const dateKey = todayKey(now);
  const userRef = db.collection('users').doc(context.userId);
  const globalRef = db.collection('stats').doc('global');
  const scanRef = context.subjectType === 'partner'
    ? db.collection('scans').doc()
    : db.collection('expertScans').doc();
  const activityRef = db.collection('users').doc(context.userId).collection('activity').doc();

  return db.runTransaction(async tx => {
    const [userSnap, tokenSnap] = await Promise.all([
      tx.get(userRef),
      context.tokenRef ? tx.get(context.tokenRef) : Promise.resolve(null),
    ]);

    if (!userSnap.exists) {
      const err = new Error('Пользователь не найден');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (context.tokenRef) {
      const token = tokenSnap?.data();
      if (!token || token.used) {
        const err = new Error('QR уже использован');
        err.code = 'TOKEN_USED';
        throw err;
      }
      if (Number(token.expiresAtMs) < Date.now()) {
        const err = new Error('QR истёк');
        err.code = 'TOKEN_EXPIRED';
        throw err;
      }
    }

    const user = userSnap.data();
    const subject = context.subject.data;
    const prevCounts = user.visitCounts ?? {};
    const scannedPartners = user.scannedPartners ?? {};
    const scannedExperts = user.scannedExperts ?? {};
    const prevCount = Number(context.subjectType === 'expert' ? scannedExperts[context.subjectId] : prevCounts[context.subjectId]) || 0;
    const alreadyAwarded = context.subjectType === 'expert'
      ? prevCount > 0
      : Boolean(scannedPartners[context.subjectId]);
    const yesterdayKey = new Date(Date.now() - 86_400_000).toLocaleDateString('sv');
    const lastScanDate = user.lastScanDate ?? '';
    const alreadyToday = lastScanDate === dateKey;
    const newStreak = alreadyToday ? (user.streak ?? 0) : (lastScanDate === yesterdayKey ? (user.streak ?? 0) + 1 : 1);
    const previousDates = Array.isArray(user.scanDates) ? user.scanDates : [];
    const scanDates = previousDates.includes(dateKey) ? previousDates : [...previousDates.slice(-89), dateKey];
    const keyBonus = alreadyAwarded ? 0 : (context.subjectType === 'expert' ? Number(subject.keys ?? 1) : (subject.featured || subject.partnerOfMonth ? 2 : 1));
    const newCount = prevCount + 1;

    const userUpdate = {
      lastScanDate: dateKey,
      streak: newStreak,
      scanDates,
      [`visitCounts.${context.subjectId}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (context.subjectType === 'expert') {
      userUpdate[`scannedExperts.${context.subjectId}`] = FieldValue.increment(1);
    } else if (!alreadyAwarded) {
      userUpdate[`scannedPartners.${context.subjectId}`] = true;
    }
    if (keyBonus > 0) userUpdate.keys = FieldValue.increment(keyBonus);

    tx.update(userRef, userUpdate);
    tx.update(context.subject.ref, { totalVisits: FieldValue.increment(1) });
    tx.set(globalRef, { totalScans: FieldValue.increment(1) }, { merge: true });
    tx.set(scanRef, {
      userId: context.userId,
      subjectType: context.subjectType,
      partnerId: context.subjectType === 'partner' ? context.subjectId : null,
      expertId: context.subjectType === 'expert' ? context.subjectId : null,
      source: context.source,
      isNew: !alreadyAwarded,
      keysAwarded: keyBonus,
      monthKey: monthKeyFromToday(dateKey),
      scannedBy: context.scannerUserId,
      scannedAt: FieldValue.serverTimestamp(),
    });
    tx.set(activityRef, {
      type: context.subjectType === 'expert' ? 'expert_scan' : 'scan',
      icon: keyBonus > 1 ? '⭐' : keyBonus > 0 ? '🔑' : '🔥',
      text: keyBonus > 0
        ? `Посещён: ${subject.name ?? 'АПГ'}${keyBonus > 1 ? ' (бонус × 2)' : ''}`
        : `Визит отмечен: ${subject.name ?? 'АПГ'}`,
      ts: FieldValue.serverTimestamp(),
    });
    if (context.tokenRef) {
      tx.update(context.tokenRef, {
        used: true,
        usedAt: FieldValue.serverTimestamp(),
        usedBy: context.scannerUserId,
        keysAwarded: keyBonus,
      });
    }

    return {
      awardedKeys: keyBonus,
      alreadyAwarded,
      streak: newStreak,
      scanDates,
      visitCount: newCount,
      subjectName: subject.name ?? '',
      subjectType: context.subjectType,
      subjectId: context.subjectId,
    };
  });
}

export async function awardVisit(db, { qrValue, scannerUserId }) {
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
        await writeQrLog(db, { event: 'qr_rejected', reason: 'expired', scannerUserId: scannerId, userId: parsed.userId, subjectType: parsed.subjectType, subjectId: parsed.subjectId, nonce: parsed.nonce });
        return { ok: false, status: 410, code: 'TOKEN_EXPIRED', message: 'QR истёк. Сгенерируйте новый.' };
      }
      const subject = await loadSubject(db, parsed.subjectType, parsed.subjectId);
      if (!subject) return { ok: false, status: 404, code: 'SUBJECT_NOT_FOUND', message: 'Партнёр или эксперт не найден' };
      const scannerCheck = await validateScannerForOneTime(db, subject.data, scannerId);
      if (!scannerCheck.ok) {
        await writeQrLog(db, { event: 'qr_rejected', reason: scannerCheck.code, scannerUserId: scannerId, userId: parsed.userId, subjectType: parsed.subjectType, subjectId: parsed.subjectId, nonce: parsed.nonce });
        return { ok: false, status: 403, code: scannerCheck.code, message: scannerCheck.message };
      }
      context = {
        source: 'one_time_qr',
        userId: parsed.userId,
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        scannerUserId: scannerId,
        tokenRef: db.collection('visitTokens').doc(parsed.nonce),
        subject,
      };
    }
  } catch (e) {
    await writeQrLog(db, { event: 'qr_rejected', reason: e.code ?? 'bad_token', scannerUserId: scannerId, error: e.message });
    return { ok: false, status: 400, code: e.code ?? 'BAD_TOKEN', message: 'QR не прошёл проверку безопасности' };
  }

  if (!context) {
    const legacy = await resolveLegacyQr(db, qrValue, scannerId);
    if (!legacy) {
      await writeQrLog(db, { event: 'qr_rejected', reason: 'unknown_qr', scannerUserId: scannerId, raw: normalizeId(qrValue).slice(0, 120) });
      return { ok: false, status: 404, code: 'UNKNOWN_QR', message: 'QR-код не распознан' };
    }
    context = {
      ...legacy,
      scannerUserId: scannerId,
      tokenRef: null,
    };
  }

  try {
    const result = await awardVisitTransaction(db, context);
    await writeQrLog(db, {
      event: result.awardedKeys > 0 ? 'reward_awarded' : 'visit_recorded',
      source: context.source,
      scannerUserId: scannerId,
      userId: context.userId,
      subjectType: context.subjectType,
      subjectId: context.subjectId,
      keysAwarded: result.awardedKeys,
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
    await writeQrLog(db, {
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
