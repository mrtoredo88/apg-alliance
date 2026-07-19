import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { APP_URL } from '../lib/config.js';
import { getDb } from '../lib/firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveFirebaseIdentity } from '../lib/identityCore.js';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import { recordReferralClientEventsAsync, recordReferralEventAsync, referralContextFromBody } from '../lib/referralEvents.js';
import { resolveReferralSessionReferrer } from '../lib/referralSessions.js';
import { serverFoundation } from '../apg/index.js';

const FROM = 'noreply@myapg.ru';

let _ses = null;
function getSes() {
  if (_ses) return _ses;
  _ses = new SESv2Client({
    endpoint: 'https://postbox.cloud.yandex.net',
    region: 'ru-central1',
    credentials: {
      accessKeyId: process.env.POSTBOX_KEY_ID,
      secretAccessKey: process.env.POSTBOX_SECRET,
    },
  });
  return _ses;
}

async function sendEmail(to, subject, text) {
  const source = `АПГ <${FROM}>`;
  const endpoint = 'https://postbox.cloud.yandex.net';
  console.log('[EMAIL] Отправка:', { to, from: source, endpoint });
  await getSes().send(new SendEmailCommand({
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
  }));
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearerToken(req) {
  const direct = String(req.headers['x-firebase-auth'] || req.headers['x-apg-auth'] || '').trim();
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function normalizeTgId(value) {
  const raw = safeString(value, 80);
  if (!raw) return '';
  return raw.startsWith('tg_') ? raw : `tg_${raw}`;
}

async function attachPendingPartnerInvites(db, email, userId) {
  const normalizedEmail = safeString(email, 200).toLowerCase();
  if (!normalizedEmail || !userId) return;
  const snap = await db.collection('partnerInvites').where('email', '==', normalizedEmail).limit(10).get().catch(() => null);
  if (!snap || snap.empty) return;
  const pending = snap.docs.filter(doc => ['sent', 'prepared'].includes(String(doc.data()?.status || '')));
  await Promise.all(pending.map(async inviteDoc => {
    const invite = inviteDoc.data() || {};
    const partnerId = safeString(invite.partnerId, 160);
    if (!partnerId) return;
    await db.collection('partners').doc(partnerId).set({
      ownerId: userId,
      ownerEmail: normalizedEmail,
      connectionEmail: normalizedEmail,
      partnerCabinetEnabled: true,
      connectionStatus: 'registration_completed',
      connectionStatusLabel: 'Регистрация завершена',
      lifecycleStatus: 'card_setup',
      lifecycleStatusLabel: 'Карточка оформляется',
      partnerConnectionEvents: FieldValue.arrayUnion({
        type: 'registration_completed',
        label: `Партнёр зарегистрировался по приглашению: ${normalizedEmail}`,
        at: new Date().toISOString(),
        actorUid: userId,
        actorId: userId,
        actorName: normalizedEmail,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(userId).set({
      partnerId,
      partnerCabinetIds: FieldValue.arrayUnion(partnerId),
      partnerCabinetEnabled: true,
      role: 'partner',
      linkedPartnerAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await inviteDoc.ref.set({ status: 'accepted', acceptedBy: userId, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('partnerConnectionEvents').add({
      partnerId,
      type: 'registration_completed',
      label: `Партнёр зарегистрировался по приглашению: ${normalizedEmail}`,
      email: normalizedEmail,
      userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }));
}

async function getActor(request, db) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error('Требуется авторизация.');
    error.statusCode = 401;
    throw error;
  }
  const decoded = await serverFoundation.identity.verifySession({ token });
  const uid = decoded.uid;
  const identity = await resolveFirebaseIdentity(db, uid).catch(() => null);
  if (identity?.userId) return identity;
  const direct = await db.collection('users').doc(uid).get().catch(() => null);
  if (direct?.exists) return { uid, userId: uid, user: direct.data() || {}, source: 'users.uid' };
  const map = await db.collection('auth_map').doc(uid).get().catch(() => null);
  const mappedUserId = map?.exists ? safeString(map.data()?.userId || map.data()?.vkId, 180) : '';
  if (mappedUserId) {
    const mapped = await db.collection('users').doc(mappedUserId).get().catch(() => null);
    return { uid, userId: mappedUserId, user: mapped?.data?.() || {}, source: 'auth_map' };
  }
  return { uid, userId: uid, user: {}, source: 'token' };
}

async function auditAccountLink(db, request, payload) {
  await db.collection('accountLinkAudit').add({
    ...payload,
    userAgent: safeString(request.headers['user-agent'], 300),
    appVersion: safeString(request.headers['x-apg-version'], 80),
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

async function createFirebaseToken(userId, user = {}) {
  return serverFoundation.identityV2.createCustomToken(userId, user);
}

function createEmailLoginTrace(request) {
  const requestId = String(request.headers['x-request-id'] || '').trim() || `email_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    requestId,
    startedAt: Date.now(),
    timeline: [],
    mark(stage, status = 'START', detail = {}) {
      const now = Date.now();
      const row = {
        stage,
        status,
        at: new Date(now).toISOString(),
        durationMs: now - this.startedAt,
        detail,
      };
      this.timeline.push(row);
      request.log.info({ requestId, stage, status, durationMs: row.durationMs, ...detail }, 'email-login-forensic');
      return row;
    },
  };
}

function classifyEmailLoginError(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || error?.error || '');
  if (code === 'EMAIL_STAGE_TIMEOUT') return { code, statusCode: 504 };
  if (code.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded')) {
    return { code: 'EMAIL_FIRESTORE_QUOTA', statusCode: 503 };
  }
  if (code.includes('auth/') || message.includes('createCustomToken') || message.includes('custom token')) {
    return { code: 'CUSTOM_TOKEN_FAILED', statusCode: 502 };
  }
  if (code === 'INVALID_EMAIL') return { code: 'INVALID_EMAIL', statusCode: 400 };
  return { code: code || 'EMAIL_LOGIN_FAILED', statusCode: Number(error?.statusCode || 500) };
}

async function withEmailLoginStage(trace, stage, fn, timeoutMs = 8000) {
  trace.mark(stage, 'START');
  const startedAt = Date.now();
  let timer = null;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${stage} timed out after ${timeoutMs}ms`);
        error.code = 'EMAIL_STAGE_TIMEOUT';
        error.failedStage = stage;
        error.statusCode = 504;
        reject(error);
      }, timeoutMs);
    });
    const result = await Promise.race([fn(), timeout]);
    trace.mark(stage, 'END', { stageDurationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    trace.mark(stage, 'FAILED', {
      stageDurationMs: Date.now() - startedAt,
      code: error?.code || null,
      message: String(error?.message || error).slice(0, 300),
    });
    if (!error.failedStage) error.failedStage = stage;
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sendVerificationEmail(db, email, userId, appUrl) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  await db.collection('emailVerifyTokens').doc(token).set({
    email, userId,
    expiresAt: Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp(),
  });
  const verifyUrl = `${appUrl}/?verify_email=${token}`;
  await sendEmail(
    email,
    'Подтвердите адрес электронной почты — АПГ',
    [
      'Добро пожаловать в АПГ Зеленоград!',
      '',
      'Нажмите на ссылку, чтобы подтвердить адрес электронной почты:',
      '',
      verifyUrl,
      '',
      'Ссылка действительна 48 часов.',
      'Если вы не регистрировались в приложении АПГ — просто проигнорируйте это письмо.',
      '',
      'С уважением, команда АПГ',
      'myapg.ru',
    ].join('\n'),
  );
}

async function resolveEmailUser(db, email, ref) {
  const identity = await serverFoundation.identityV2.resolveEmailIdentity({ email, ref, createIfMissing: true });
  const userId = identity.userId;
  db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
  attachPendingPartnerInvites(db, email, userId).catch(() => {});
  return identity;
}

async function getEmailOtp(codeRef, email) {
  try {
    return { source: 'identity_v2', data: await serverFoundation.identityV2.getEmailOtp(email) };
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    const snap = await codeRef.get();
    return { source: 'firestore_fallback', data: snap.exists ? snap.data() : null };
  }
}

async function setEmailOtp(codeRef, email, code) {
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  try {
    await serverFoundation.identityV2.putEmailOtp({ email, code, expiresAt });
    return 'identity_v2';
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    await codeRef.set({
      code,
      expiresAt: Timestamp.fromMillis(expiresAt.getTime()),
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    return 'firestore_fallback';
  }
}

async function deleteEmailOtp(codeRef, email) {
  try {
    await serverFoundation.identityV2.deleteEmailOtp(email);
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    await codeRef.delete();
  }
}

async function incrementEmailOtpAttempts(codeRef, email) {
  try {
    await serverFoundation.identityV2.incrementEmailOtpAttempts(email);
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    await codeRef.update({ attempts: FieldValue.increment(1) });
  }
}

function otpCreatedMs(data) {
  if (!data) return 0;
  if (data.createdAt?.toMillis) return data.createdAt.toMillis();
  if (data.createdAt) return new Date(data.createdAt).getTime();
  return 0;
}

function otpExpiresMs(data) {
  if (!data) return 0;
  if (data.expiresAt?.toMillis) return data.expiresAt.toMillis();
  if (data.expiresAt) return new Date(data.expiresAt).getTime();
  return 0;
}

export default async function emailAuthRoutes(fastify) {
  fastify.post('/api/email-auth', async (request, reply) => {
    const { action, email: rawEmail, code } = request.body ?? {};

    const NO_EMAIL_ACTIONS = ['verify-email', 'link-telegram', 'grant-referral', 'resend-verification'];
    if (!NO_EMAIL_ACTIONS.includes(action)) {
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rawEmail))) {
        return reply.code(400).send({ ok: false, error: 'invalid_email', message: 'Неверный формат email' });
      }
    }

    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : '';
    const db    = getDb();
    const rawRef = request.body?.ref || request.body?.referrerId || request.body?.referralCode || '';
    const sessionResolution = await resolveReferralSessionReferrer(db, request.body?.referralSessionId || request.body?.sessionId || '', { markMissing: true, source: 'email-auth' }).catch(() => ({ referrerId: '', session: null }));
    const ref = rawRef || sessionResolution.referrerId || '';
    const referralContext = referralContextFromBody(request.body || {}, { referralCode: ref || '', referralFlowId: sessionResolution.session?.data?.flowId || '' });
    if (action === 'login' || action === 'verify') {
      recordReferralClientEventsAsync(db, request.body?.referralClientEvents, {
        ...referralContext,
        referralCode: ref || referralContext.referralCode,
        source: 'email-auth:client',
        metadata: { action, email },
      });
      if (ref || referralContext.referralFlowId) {
        recordReferralEventAsync(db, {
          ...referralContext,
          referralCode: ref || referralContext.referralCode,
          referrerId: ref || referralContext.referralCode,
          type: REFERRAL_EVENT_TYPES.AUTH_STARTED,
          status: 'started',
          source: 'email-auth',
          metadata: { action, email },
        });
        if (request.body?.referralSessionId || request.body?.sessionId) {
          recordReferralEventAsync(db, {
            ...referralContext,
            referralCode: ref || referralContext.referralCode,
            referrerId: ref || referralContext.referralCode,
            type: REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED,
            status: 'started',
            source: 'email-auth',
            metadata: { action, email },
          });
        }
      }
    }
    const codeRef = email ? db.collection('emailAuthCodes').doc(email) : null;

    // ── SEND ────────────────────────────────────────────────────────────────────
    if (action === 'send') {
      const existing = await getEmailOtp(codeRef, email);
      if (existing.data) {
        const created = otpCreatedMs(existing.data);
        if (Date.now() - created < 60_000) {
          return reply.code(429).send({ ok: false, error: 'rate_limited', message: 'Подождите минуту перед повторным запросом' });
        }
      }

      const newCode = generateCode();
      await setEmailOtp(codeRef, email, newCode);

      try {
        await sendEmail(
          email,
          'Ваш код входа в АПГ',
          [
            'Привет!',
            '',
            `Ваш код для входа в АПГ: ${newCode}`,
            '',
            'Код действителен 10 минут.',
            'Если вы не запрашивали код — просто игнорируйте это письмо.',
            '',
            'С уважением, команда АПГ',
            'myapg.ru',
          ].join('\n'),
        );
      } catch (e) {
        await deleteEmailOtp(codeRef, email).catch(() => {});
        request.log.warn({ name: e.name, message: e.message, metadata: e.$metadata || {}, responseBody: e.$response?.body || '' }, 'Postbox send failed');
        return reply.code(500).send({ ok: false, error: 'email_error', message: 'Не удалось отправить письмо. Проверьте адрес или попробуйте позже.' });
      }

      return { ok: true };
    }

    // ── VERIFY ──────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!code || !/^\d{6}$/.test(String(code))) {
        return reply.code(400).send({ ok: false, error: 'invalid_code', message: 'Введите 6-значный код' });
      }

      const otp = await getEmailOtp(codeRef, email);
      if (!otp.data) {
        return reply.code(400).send({ ok: false, error: 'code_not_found', message: 'Код не найден. Запросите новый' });
      }

      const data = otp.data;

      if (otpExpiresMs(data) < Date.now()) {
        await deleteEmailOtp(codeRef, email).catch(() => {});
        return reply.code(400).send({ ok: false, error: 'code_expired', message: 'Код истёк. Запросите новый' });
      }

      if ((data.attempts ?? 0) >= 5) {
        return reply.code(429).send({ ok: false, error: 'too_many_attempts', message: 'Слишком много попыток. Запросите новый код' });
      }

      if (data.code !== String(code)) {
        await incrementEmailOtpAttempts(codeRef, email);
        const left = 4 - (data.attempts ?? 0);
        return reply.code(400).send({ ok: false, error: 'wrong_code', message: `Неверный код. Осталось попыток: ${left}` });
      }

      await deleteEmailOtp(codeRef, email);

      const identity = await resolveEmailUser(db, email, ref ?? null);
      const userId = identity.userId;
      const ud = identity.user ?? {};
      if (ref || referralContext.referralFlowId) {
        recordReferralEventAsync(db, {
          ...referralContext,
          referralCode: ref || referralContext.referralCode,
          referrerId: ref || referralContext.referralCode,
          referredUserId: userId,
          type: REFERRAL_EVENT_TYPES.AUTH_COMPLETED,
          status: 'completed',
          source: 'email-auth:verify',
          metadata: { email },
        });
      }

      const token = await createFirebaseToken(userId, ud);
      return {
        ok: true,
        token,
        canonicalUserId: userId,
        user: {
          id: userId,
          canonicalUserId: userId,
          first_name: ud.firstName ?? email.split('@')[0],
          last_name: ud.lastName ?? '',
          photo_200: ud.photo ?? null,
          email,
          role: ud.role ?? null,
          roles: Array.isArray(ud.roles) ? ud.roles : null,
        },
      };
    }

    // ── LINK TELEGRAM ────────────────────────────────────────────────────────────
    if (action === 'link-telegram') {
      const { userId, tgId, firstName, lastName, username, photo } = request.body ?? {};
      const normalizedTgId = normalizeTgId(tgId);
      if (!userId || !normalizedTgId) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const actor = await getActor(request, db);
      if (String(actor.userId) !== String(userId)) {
        await auditAccountLink(db, request, { action: 'link-telegram', result: 'blocked_owner_mismatch', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), telegramId: normalizedTgId });
        return reply.code(403).send({ ok: false, error: 'owner_mismatch', message: 'Нельзя привязать Telegram к другому аккаунту.' });
      }

      try {
        await serverFoundation.identityV2.linkTelegram({
          telegramId: normalizedTgId,
          userId: String(userId),
          firebaseUid: actor.uid,
          telegram: { firstName: firstName ?? null, lastName: lastName ?? null, username: username ?? null, photo: photo ?? null },
        });
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ ok: false, error: e.statusCode === 409 ? 'already_linked' : 'link_failed', message: e.message || 'Не удалось привязать Telegram.' });
      }
      await auditAccountLink(db, request, { action: 'link-telegram', result: 'success', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), telegramId: normalizedTgId });

      return { ok: true };
    }

    // ── LINK EMAIL ───────────────────────────────────────────────────────────────
    if (action === 'link-email') {
      const { userId } = request.body ?? {};
      if (!userId || !email) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const actor = await getActor(request, db);
      if (String(actor.userId) !== String(userId)) {
        await auditAccountLink(db, request, { action: 'link-email', result: 'blocked_owner_mismatch', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), email });
        return reply.code(403).send({ ok: false, error: 'owner_mismatch', message: 'Нельзя привязать email к другому аккаунту.' });
      }

      try {
        await serverFoundation.identityV2.linkEmail({ email, userId: String(userId), firebaseUid: actor.uid });
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ ok: false, error: e.statusCode === 409 ? 'already_used' : 'link_failed', message: e.message || 'Не удалось привязать email.' });
      }
      await auditAccountLink(db, request, { action: 'link-email', result: 'success', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), email });
      return { ok: true };
    }

    // ── GRANT REFERRAL ───────────────────────────────────────────────────────────
    if (action === 'grant-referral') {
      const { referrerId, newUserId } = request.body ?? {};
      if (!referrerId || !newUserId) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const newUserSnap = await db.collection('users').doc(newUserId).get();
      if (!newUserSnap.exists) return reply.code(404).send({ ok: false, error: 'user_not_found' });
      const newUserData = newUserSnap.data();
      if (newUserData.referredBy !== referrerId) return reply.code(403).send({ ok: false, error: 'ref_mismatch' });
      if (newUserData.referralBonusGranted) return reply.code(409).send({ ok: false, error: 'already_granted' });

      await db.collection('users').doc(referrerId).update({
        keys: FieldValue.increment(2),
        referralCount: FieldValue.increment(1),
      }).catch(() => {});
      await db.collection('users').doc(newUserId).update({ referralBonusGranted: true });

      return { ok: true };
    }

    // ── LOGIN ────────────────────────────────────────────────────────────────────
    if (action === 'login') {
      const trace = createEmailLoginTrace(request);
      try {
        trace.mark('request', 'START', { action, emailDomain: email.split('@')[1] || '' });
        const { ref } = request.body ?? {};
        const identity = await withEmailLoginStage(trace, 'resolve_email_user', () => resolveEmailUser(db, email, ref ?? null), 9000);
        const userId = identity.userId;
        const ud = await withEmailLoginStage(trace, 'load_user_profile', async () => identity.user || await serverFoundation.identityV2.getUser(userId), 7000) || {};
        if (ref || referralContext.referralFlowId) {
          recordReferralEventAsync(db, {
            ...referralContext,
            referralCode: ref || referralContext.referralCode,
            referrerId: ref || referralContext.referralCode,
            referredUserId: userId,
            type: REFERRAL_EVENT_TYPES.AUTH_COMPLETED,
            status: 'completed',
            source: 'email-auth:login',
            metadata: { email },
          });
        }
        if (ud.emailVerified === false) {
          sendVerificationEmail(db, email, userId, APP_URL).catch((e) => {
            request.log.warn({ name: e.name, message: e.message, metadata: e.$metadata || {}, responseBody: e.$response?.body || '' }, 'Postbox verification email failed');
          });
        }
        const token = await withEmailLoginStage(trace, 'create_custom_token', () => createFirebaseToken(userId, ud), 5000);
        trace.mark('request', 'END', { userId, totalMs: Date.now() - trace.startedAt });
        return {
          ok: true,
          token,
          canonicalUserId: userId,
          diagnostics: {
            requestId: trace.requestId,
            identity: serverFoundation.identityV2.snapshot(),
            timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
          },
          user: {
            id: userId,
            canonicalUserId: userId,
            first_name: ud.firstName ?? email.split('@')[0],
            last_name:  ud.lastName  ?? '',
            photo_200:  ud.photo     ?? null,
            email,
            emailVerified: ud.emailVerified ?? null,
            role: ud.role ?? null,
            roles: Array.isArray(ud.roles) ? ud.roles : null,
          },
        };
      } catch (error) {
        const classified = classifyEmailLoginError(error);
        const failedStage = error?.failedStage || trace.timeline.findLast?.(item => item.status === 'FAILED')?.stage || 'unknown';
        trace.mark('request', 'FAILED', {
          failedStage,
          code: classified.code,
          message: String(error?.message || error).slice(0, 300),
          totalMs: Date.now() - trace.startedAt,
        });
        request.log.error({
          requestId: trace.requestId,
          failedStage,
          code: classified.code,
          message: error?.message || String(error),
          stack: String(error?.stack || '').slice(0, 1800),
          timeline: trace.timeline,
        }, 'email-login failed');
        return reply.code(classified.statusCode).send({
          ok: false,
          error: classified.code,
          message: 'Ошибка входа. Попробуйте снова.',
          diagnostics: {
            requestId: trace.requestId,
            failedStage,
            statusCode: classified.statusCode,
            error: classified.code,
            identity: serverFoundation.identityV2.snapshot(),
            timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
          },
        });
      }
    }

    // ── VERIFY EMAIL ─────────────────────────────────────────────────────────────
    if (action === 'verify-email') {
      const { token } = request.body ?? {};
      if (!token) return reply.code(400).send({ ok: false, error: 'missing_token' });
      const tokenSnap = await db.collection('emailVerifyTokens').doc(String(token)).get();
      if (!tokenSnap.exists) return reply.code(404).send({ ok: false, error: 'invalid_token' });
      const { userId, expiresAt } = tokenSnap.data();
      await db.collection('emailVerifyTokens').doc(String(token)).delete();
      if (expiresAt.toMillis() < Date.now()) {
        return reply.code(400).send({ ok: false, error: 'token_expired' });
      }
      await db.collection('users').doc(userId).update({ emailVerified: true }).catch(() => {});
      return { ok: true, userId };
    }

    // ── RESEND VERIFICATION ──────────────────────────────────────────────────────
    if (action === 'resend-verification') {
      const { userId } = request.body ?? {};
      if (!userId) return reply.code(400).send({ ok: false, error: 'missing_fields' });
      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) return reply.code(404).send({ ok: false, error: 'user_not_found' });
      const ud = userSnap.data();
      if (ud.emailVerified) return { ok: true, alreadyVerified: true };
      const userEmail = ud.email ?? email;
      if (!userEmail) return reply.code(400).send({ ok: false, error: 'no_email' });
      await sendVerificationEmail(db, userEmail, userId, APP_URL);
      return { ok: true };
    }

    return reply.code(400).send({ ok: false, error: 'invalid_action' });
  });
}
