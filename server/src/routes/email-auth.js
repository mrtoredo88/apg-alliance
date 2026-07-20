import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import crypto from 'node:crypto';
import { APP_URL } from '../lib/config.js';
import { getDb } from '../lib/firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveFirebaseIdentity } from '../lib/identityCore.js';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import { recordReferralClientEventsAsync, recordReferralEventAsync, referralContextFromBody } from '../lib/referralEvents.js';
import { resolveReferralSessionReferrer } from '../lib/referralSessions.js';
import { serverFoundation } from '../apg/index.js';

const FROM = 'noreply@myapg.ru';
const EMAIL_AUDIT_COLLECTION = 'emailAuthAttempts';
const EMAIL_AUTH_AUDIT_TTL_DAYS = 30;
const EMAIL_AUTH_AUDIT_WINDOW_MS = 60_000;
const EMAIL_AUTH_AUDIT_RATE_LIMIT = 240;
const EMAIL_AUTH_AUDIT_ALLOWED_STAGES = new Set([
  'email_auth_started',
  'otp_send_started',
  'otp_send_succeeded',
  'otp_send_failed',
  'otp_verify_started',
  'otp_verify_succeeded',
  'otp_verify_failed',
  'identity_resolve_started',
  'identity_resolve_succeeded',
  'identity_resolve_failed',
  'identity_resolve_completed',
  'email_identity_found',
  'email_identity_created',
  'custom_token_started',
  'custom_token_issued',
  'custom_token_created',
  'custom_token_failed',
  'email_code_verified',
  'email_code_consumed',
  'attempt_completed',
  'email_auth_completed',
  'email_auth_failed',
  'frontend_token_received',
  'firebase_signin_started',
  'firebase_signin_succeeded',
  'firebase_signin_failed',
  'auth_state_changed',
  'profile_load_started',
  'profile_load_succeeded',
  'profile_load_failed',
  'home_render',
  'guest_rollback',
  'client_closed',
  'network_interrupted',
]);
const EMAIL_AUTH_AUDIT_ALLOWED_FIELDS = new Set([
  'authAttemptId',
  'requestId',
  'loginSessionId',
  'stage',
  'status',
  'timestamp',
  'durationMs',
  'publicErrorCode',
  'internalErrorCode',
  'frontendVersion',
  'backendRevision',
  'identityPath',
  'identityResolved',
  'customTokenIssued',
  'expectedUidHash',
  'actualUidHash',
  'apgUserIdHash',
  'emailHash',
  'deviceIdHash',
  'platform',
  'appMode',
  'finalResult',
  'failureCategory',
  'failedStage',
]);
const EMAIL_AUTH_AUDIT_FORBIDDEN_KEYS = new Set([
  'otp',
  'token',
  'customtoken',
  'custom_token',
  'tokenHash',
  'email',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'providerpayload',
  'rawproviderpayload',
]);
const AUDIT_RATE_LIMIT_STORE = new Map();
const EMAIL_AUTH_BACKEND_REVISION = safeString(
  process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.APP_VERSION
  || process.env.GIT_COMMIT_SHA
  || process.env.BUILD_REVISION
  || '',
  80,
) || 'local';

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
  console.log('[EMAIL] Отправка:', { emailHash: emailHash(to), from: source, endpoint });
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

function normalizeAuditField(value, max = 260) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).slice(0, max);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

function sanitizeEmailAuthAuditPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  const normalized = Object.fromEntries(
    Object.entries(payload).filter(([rawKey]) => {
      const key = String(rawKey ?? '').trim();
      if (!key) return false;
      if (EMAIL_AUTH_AUDIT_FORBIDDEN_KEYS.has(key.toLowerCase())) return false;
      return EMAIL_AUTH_AUDIT_ALLOWED_FIELDS.has(key);
    }).map(([key, value]) => [
      key,
      key === 'durationMs'
        ? (Number.isFinite(Number(value)) ? Number(value) : null)
        : normalizeAuditField(value),
    ]),
  );
  if (normalized.identityResolved != null) normalized.identityResolved = String(normalized.identityResolved) === 'true';
  if (normalized.customTokenIssued != null) normalized.customTokenIssued = String(normalized.customTokenIssued) === 'true';
  return normalized;
}

function isEmailAuthAuditRateLimited(key, now = Date.now()) {
  const bucketKey = safeString(key, 220) || 'global';
  const bucket = AUDIT_RATE_LIMIT_STORE.get(bucketKey) || [];
  const active = bucket.filter(ts => now - Number(ts || 0) < EMAIL_AUTH_AUDIT_WINDOW_MS);
  if (active.length >= EMAIL_AUTH_AUDIT_RATE_LIMIT) {
    AUDIT_RATE_LIMIT_STORE.set(bucketKey, active);
    return true;
  }
  active.push(now);
  AUDIT_RATE_LIMIT_STORE.set(bucketKey, active);
  return false;
}

function buildAuditTimelineDocId(stage) {
  return `st_${safeString(String(stage || 'unknown'), 120).toLowerCase().replace(/[^a-z0-9._-]+/g, '_').slice(0, 80)}`;
}

function buildEmailAuthAuditExpiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + EMAIL_AUTH_AUDIT_TTL_DAYS * 24 * 60 * 60 * 1000));
}

function buildTraceId(prefix, fallback = 'trace') {
  return `${prefix || fallback}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashValue(value, max = 32) {
  const normalized = safeString(value, 200);
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex').slice(0, max) : '';
}

function emailHash(value) {
  const normalized = safeString(value, 220).toLowerCase();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16) : '';
}

function getEmailAuthAttemptContext(request) {
  const body = request?.body || {};
  const fallbackRequestId = safeString(body?.requestId || request.headers['x-request-id'] || '', 120)
    || `email_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    requestId: fallbackRequestId,
    loginSessionId: safeString(
      body?.loginSessionId
      || request.headers['x-login-session-id']
      || `ls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      120,
    ),
    authAttemptId: safeString(
      body?.authAttemptId
      || request.headers['x-auth-attempt-id']
      || buildTraceId('attempt', `attempt_${fallbackRequestId}`),
      120,
    ),
    appMode: safeString(body?.appMode || request.headers['x-app-mode'] || 'browser', 40),
    platform: safeString(body?.platform || body?.platformHint || request.headers['x-platform'] || '', 120),
    frontendVersion: safeString(body?.frontendVersion || request.headers['x-apg-version'] || request.headers['x-apg-build'] || '', 80),
    deviceIdHash: hashValue(safeString(body?.deviceId || request.headers['x-device-id'] || request.ip, 200), 32),
  };
}

function buildEmailAuthAttemptSummary(context, options = {}) {
  return {
    provider: 'email',
    authAttemptId: context.authAttemptId || '',
    requestId: context.requestId || '',
    loginSessionId: context.loginSessionId || '',
    appMode: context.appMode || 'browser',
    platform: context.platform || '',
    frontendVersion: context.frontendVersion || '',
    backendRevision: EMAIL_AUTH_BACKEND_REVISION,
    identityPath: options.identityPath || 'identity_v2',
    identityResolved: Boolean(options.identityResolved),
    customTokenIssued: Boolean(options.customTokenIssued),
    expectedUidHash: safeString(options.expectedUidHash, 64),
    actualUidHash: safeString(options.actualUidHash, 64),
    apgUserIdHash: safeString(options.apgUserIdHash, 64),
    deviceIdHash: context.deviceIdHash || '',
    emailHash: safeString(options.emailHash, 16),
    finalResult: safeString(options.finalResult, 30) || 'unknown',
    failureCategory: safeString(options.failureCategory, 80) || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: buildEmailAuthAuditExpiresAt(),
  };
}

function classifyFailureCategory(stage, code, internalCode) {
  if (code === 'EMAIL_CODE_INVALID') return 'OTP_INVALID';
  if (code === 'EMAIL_CODE_EXPIRED') return 'OTP_EXPIRED';
  if (code === 'IDENTITY_RESOLVE_FAILED') return 'IDENTITY_RESOLVE_FAILED';
  if (String(stage || '').includes('identity') && String(code || '').includes('IDENTITY')) return 'IDENTITY_RESOLVE_FAILED';
  if (code === 'CUSTOM_TOKEN_FAILED' || String(internalCode || '').includes('CUSTOM_TOKEN') || String(stage || '').includes('custom_token')) return 'CUSTOM_TOKEN_FAILED';
  if (String(stage || '').includes('verify_timeout') || String(code || '').includes('TIMEOUT')) return 'OTP_VERIFY_TIMEOUT';
  if (String(code || '').includes('OTP') && String(stage || '').includes('send')) return 'NETWORK_INTERRUPTED';
  if (String(stage || '').includes('network') || String(internalCode || '').includes('NETWORK')) return 'NETWORK_INTERRUPTED';
  if (String(code || '').includes('EXPIRED')) return 'OTP_EXPIRED';
  if (String(code || '').includes('INVALID')) return 'OTP_INVALID';
  return 'UNKNOWN_INCOMPLETE';
}

async function appendEmailAuthAuditEvent(request, attemptContext, event) {
  if (!attemptContext?.authAttemptId || !event?.stage) return;
  const db = getDb();
  const stage = safeString(event.stage, 120);
  const normalizedStage = stage.toLowerCase();
  if (!EMAIL_AUTH_AUDIT_ALLOWED_STAGES.has(normalizedStage)) return;
  const status = safeString(event.status, 30) || 'OK';
  const rawDetail = sanitizeEmailAuthAuditPayload({
    ...event.payload,
    stage,
    status,
    requestId: event.requestId,
    loginSessionId: event.loginSessionId,
    authAttemptId: event.authAttemptId,
    timestamp: safeString(event.timestamp, 60) || new Date().toISOString(),
    durationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
    frontendVersion: safeString(event.frontendVersion, 80),
    backendRevision: safeString(event.backendRevision, 80),
    identityPath: safeString(event.identityPath, 80),
    identityResolved: safeString(event.identityResolved, 5),
    customTokenIssued: safeString(event.customTokenIssued, 5),
    expectedUidHash: safeString(event.expectedUidHash, 64),
    actualUidHash: safeString(event.actualUidHash, 64),
    apgUserIdHash: safeString(event.apgUserIdHash, 64),
    emailHash: safeString(event.emailHash, 16),
    deviceIdHash: safeString(event.deviceIdHash, 32),
    platform: safeString(event.platform, 120),
    appMode: safeString(event.appMode, 40),
    publicErrorCode: safeString(event.publicErrorCode, 80),
    internalErrorCode: safeString(event.internalErrorCode, 80),
    finalResult: safeString(event.finalResult, 30),
    failureCategory: safeString(event.failureCategory, 80),
    failedStage: safeString(event.failedStage, 120),
  });
  const detail = Object.fromEntries(
    Object.entries(rawDetail).filter(([key]) => EMAIL_AUTH_AUDIT_ALLOWED_FIELDS.has(key)),
  );
  const row = {
    stage,
    status,
    timestamp: safeString(detail.timestamp, 60) || new Date().toISOString(),
    durationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
    publicErrorCode: safeString(detail.publicErrorCode, 80) || null,
    internalErrorCode: safeString(detail.internalErrorCode, 80) || null,
    identityResolved: detail.identityResolved === true || detail.identityResolved === 'true',
    customTokenIssued: detail.customTokenIssued === true || detail.customTokenIssued === 'true',
    expectedUidHash: safeString(detail.expectedUidHash, 64),
    actualUidHash: safeString(detail.actualUidHash, 64),
    apgUserIdHash: safeString(detail.apgUserIdHash, 64),
    ...detail,
  };
  try {
    const attemptRef = db.collection(EMAIL_AUDIT_COLLECTION).doc(attemptContext.authAttemptId);
    await attemptRef.set({
      ...buildEmailAuthAttemptSummary(attemptContext, {
        identityPath: detail.identityPath || 'identity_v2',
        identityResolved: row.identityResolved,
        customTokenIssued: row.customTokenIssued,
        expectedUidHash: row.expectedUidHash,
        actualUidHash: row.actualUidHash,
        apgUserIdHash: row.apgUserIdHash,
        emailHash: safeString(detail.emailHash || detail.email || '', 16),
      }),
      updatedAt: FieldValue.serverTimestamp(),
      requestIp: safeString(request.ip || '', 120),
      lastStage: stage,
      lastStatus: status,
      lastStageAt: new Date().toISOString(),
      lastDurationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
      emailHash: safeString(detail.emailHash || detail.email || '', 16),
      }, { merge: true });
    await attemptRef.collection('timeline').doc(buildAuditTimelineDocId(normalizedStage)).set({
      ...row,
      requestId: attemptContext.requestId || '',
      loginSessionId: attemptContext.loginSessionId || '',
      authAttemptId: attemptContext.authAttemptId,
      backendRevision: EMAIL_AUTH_BACKEND_REVISION,
      appMode: safeString(attemptContext.appMode || 'browser', 40),
      platform: safeString(attemptContext.platform || '', 120),
      userAgent: safeString(request.headers['user-agent'], 240),
      requestIp: safeString(request.ip || '', 120),
      expiresAt: buildEmailAuthAuditExpiresAt(),
    }, { merge: true });
  } catch {}
}

function emailPublicMeta(email) {
  return {
    emailHash: emailHash(email),
    emailDomain: String(email || '').split('@')[1] || '',
  };
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
  const attemptContext = getEmailAuthAttemptContext(request);
  return {
    ...attemptContext,
    requestId: attemptContext.requestId,
    identityPath: 'identity_v2',
    identityResolved: false,
    customTokenIssued: false,
    expectedUidHash: '',
    actualUidHash: '',
    apgUserIdHash: '',
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
      request.log.info({
        requestId: this.requestId,
        authAttemptId: this.authAttemptId || '',
        loginSessionId: this.loginSessionId || '',
        stage,
        status,
        durationMs: row.durationMs,
        ...detail,
      }, 'email-login-forensic');
      void appendEmailAuthAuditEvent(
        request,
        {
          ...attemptContext,
          requestId: this.requestId,
          authAttemptId: this.authAttemptId || attemptContext.authAttemptId,
          loginSessionId: this.loginSessionId || attemptContext.loginSessionId,
          appMode: this.appMode || attemptContext.appMode,
          platform: this.platform || attemptContext.platform,
          frontendVersion: this.frontendVersion || attemptContext.frontendVersion,
        },
        {
          stage,
          status,
          durationMs: row.durationMs,
          payload: detail,
        },
      );
      return row;
    },
  };
}

function classifyEmailLoginError(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || error?.error || '');
  if (code === 'EMAIL_STAGE_TIMEOUT') return { code, statusCode: 504 };
  if (code === 'USER_NOT_FOUND') return { code: 'EMAIL_ACCOUNT_NOT_FOUND', statusCode: 404 };
  if (code === 'EMAIL_ACCOUNT_NOT_FOUND') return { code, statusCode: 404 };
  if (code === 'EMAIL_REGISTRATION_REQUIRED') return { code, statusCode: 409 };
  if (code === 'EMAIL_IDENTITY_CREATE_FAILED') return { code, statusCode: 503 };
  if (code === 'EMAIL_CODE_INVALID') return { code, statusCode: 400 };
  if (code === 'EMAIL_CODE_EXPIRED') return { code, statusCode: 400 };
  if (code === 'EMAIL_AUTH_TEMPORARILY_UNAVAILABLE') return { code, statusCode: 503 };
  if (code.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded')) {
    return { code: 'EMAIL_FIRESTORE_QUOTA', statusCode: 503 };
  }
  if (code.includes('auth/') || message.includes('createCustomToken') || message.includes('custom token')) {
    return { code: 'CUSTOM_TOKEN_FAILED', statusCode: 502 };
  }
  if (code === 'INVALID_EMAIL') return { code: 'INVALID_EMAIL', statusCode: 400 };
  return { code: code || 'EMAIL_LOGIN_FAILED', statusCode: Number(error?.statusCode || 500) };
}

function publicEmailAuthMessage(code) {
  return {
    EMAIL_ACCOUNT_NOT_FOUND: 'Аккаунт с таким email пока не создан. Зарегистрируйтесь или запросите новый код.',
    EMAIL_REGISTRATION_REQUIRED: 'Аккаунт с таким email пока не создан. Зарегистрируйтесь или запросите новый код.',
    EMAIL_IDENTITY_CREATE_FAILED: 'Не удалось завершить регистрацию. Попробуйте ещё раз.',
    EMAIL_CODE_INVALID: 'Неверный код. Проверьте письмо и попробуйте ещё раз.',
    EMAIL_CODE_EXPIRED: 'Код истёк. Запросите новый.',
    EMAIL_AUTH_TEMPORARILY_UNAVAILABLE: 'Сервис авторизации временно недоступен.',
    EMAIL_STAGE_TIMEOUT: 'Сервис авторизации временно недоступен.',
    EMAIL_FIRESTORE_QUOTA: 'Сервис авторизации временно недоступен.',
    CUSTOM_TOKEN_FAILED: 'Сервис авторизации временно недоступен.',
  }[code] || 'Ошибка входа. Попробуйте снова.';
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
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  try {
    await serverFoundation.identityV2.putEmailVerifyToken({ token, email, userId, expiresAt });
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    await db.collection('emailVerifyTokens').doc(token).set({
      email, userId,
      expiresAt: Timestamp.fromMillis(expiresAt.getTime()),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
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

function shouldWriteLegacyIdentitySideEffects() {
  return !serverFoundation.identityV2.isPostgresPrimary?.() || serverFoundation.identityV2.isLegacyDualWriteEnabled?.();
}

async function resolveEmailUser(db, email, ref, { createIfMissing = false } = {}) {
  const identity = await serverFoundation.identityV2.resolveEmailIdentity({ email, ref, createIfMissing });
  const userId = identity.userId;
  if (shouldWriteLegacyIdentitySideEffects()) {
    db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
    attachPendingPartnerInvites(db, email, userId).catch(() => {});
  }
  return identity;
}

async function consumeVerificationToken(db, token) {
  try {
    return { source: 'identity_v2', data: await serverFoundation.identityV2.consumeEmailVerifyToken(token) };
  } catch (error) {
    if (error?.code !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
    const ref = db.collection('emailVerifyTokens').doc(String(token));
    const snap = await ref.get();
    if (!snap.exists) return { source: 'firestore_fallback', data: null };
    await ref.delete();
    return { source: 'firestore_fallback', data: snap.data() || null };
  }
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
  fastify.post('/api/email-auth-audit', async (request, reply) => {
    const body = request.body || {};
    const requestContext = getEmailAuthAttemptContext(request);
    const rawStage = safeString(body.stage, 120);
    const normalizedStage = rawStage.toLowerCase();
    if (!rawStage || !EMAIL_AUTH_AUDIT_ALLOWED_STAGES.has(normalizedStage)) {
      return reply.code(400).send({ ok: false, error: 'invalid_stage' });
    }
    const key = `${safeString(request.ip, 120)}_${normalizedStage}`;
    if (isEmailAuthAuditRateLimited(key)) {
      return reply.code(429).send({ ok: false, error: 'rate_limited', retryAfterMs: EMAIL_AUTH_AUDIT_WINDOW_MS });
    }
    const context = {
      ...requestContext,
      requestId: safeString(body.requestId || requestContext.requestId, 120),
      loginSessionId: safeString(body.loginSessionId || requestContext.loginSessionId, 120),
      authAttemptId: safeString(body.authAttemptId || requestContext.authAttemptId, 120),
      stage: rawStage,
      status: safeString(body.status, 30) || 'OK',
      appMode: safeString(body.appMode || requestContext.appMode, 40),
      platform: safeString(body.platform || requestContext.platform, 120),
      frontendVersion: safeString(body.frontendVersion || requestContext.frontendVersion, 80),
    };
    const payload = sanitizeEmailAuthAuditPayload({
      ...body,
      stage: rawStage,
      status: context.status,
      requestId: context.requestId,
      loginSessionId: context.loginSessionId,
      authAttemptId: context.authAttemptId,
      appMode: context.appMode,
      platform: context.platform,
      frontendVersion: context.frontendVersion,
    });
    await appendEmailAuthAuditEvent(request, context, {
      ...payload,
      stage: context.stage,
      status: context.status,
      durationMs: body.durationMs,
      payload: {
        ...payload,
        requestId: context.requestId,
        loginSessionId: context.loginSessionId,
        authAttemptId: context.authAttemptId,
      },
    });
    return {
      ok: true,
      requestId: context.requestId,
      authAttemptId: context.authAttemptId,
      stage: context.stage,
    };
  });

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
        metadata: { action, ...emailPublicMeta(email) },
      });
      if (ref || referralContext.referralFlowId) {
        recordReferralEventAsync(db, {
          ...referralContext,
          referralCode: ref || referralContext.referralCode,
          referrerId: ref || referralContext.referralCode,
          type: REFERRAL_EVENT_TYPES.AUTH_STARTED,
          status: 'started',
          source: 'email-auth',
          metadata: { action, ...emailPublicMeta(email) },
        });
        if (request.body?.referralSessionId || request.body?.sessionId) {
          recordReferralEventAsync(db, {
            ...referralContext,
            referralCode: ref || referralContext.referralCode,
            referrerId: ref || referralContext.referralCode,
            type: REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED,
            status: 'started',
            source: 'email-auth',
            metadata: { action, ...emailPublicMeta(email) },
          });
        }
      }
    }
    const codeRef = email ? db.collection('emailAuthCodes').doc(email) : null;

    // ── SEND ────────────────────────────────────────────────────────────────────
    if (action === 'send') {
      const trace = createEmailLoginTrace(request);
      trace.mark('email_auth_started', 'START', { action, ...emailPublicMeta(email) });
      trace.mark('otp_send_started', 'START', { action, ...emailPublicMeta(email) });
      const existing = await getEmailOtp(codeRef, email);
      if (existing.data) {
        const created = otpCreatedMs(existing.data);
        if (Date.now() - created < 60_000) {
          trace.mark('otp_send_failed', 'FAILED', { publicCode: 'EMAIL_RATE_LIMITED' });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_RATE_LIMITED', failedStage: 'otp_send_started' });
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
        trace.mark('otp_send_failed', 'FAILED', { publicCode: 'EMAIL_SEND_FAILED', internalErrorCode: e.code || e?.name || 'EMAIL_SEND_FAILED', message: e.message || null });
        trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_SEND_FAILED', failedStage: 'otp_send_started', internalErrorCode: e.code || e?.name || 'EMAIL_SEND_FAILED' });
        return reply.code(500).send({ ok: false, error: 'email_error', message: 'Не удалось отправить письмо. Проверьте адрес или попробуйте позже.' });
      }

      trace.mark('otp_send_succeeded', 'OK', { stageDurationMs: Date.now() - trace.startedAt });
      trace.mark('email_auth_completed', 'END', { email: emailPublicMeta(email).emailHash, totalMs: Date.now() - trace.startedAt });
      return {
        ok: true,
        diagnostics: {
          requestId: trace.requestId,
          authAttemptId: trace.authAttemptId,
          loginSessionId: trace.loginSessionId,
          timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
          identityPath: trace.identityPath,
          identityResolved: false,
          customTokenIssued: false,
          backendRevision: EMAIL_AUTH_BACKEND_REVISION,
          frontendVersion: trace.frontendVersion,
        },
      };
    }

    // ── VERIFY ──────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      const trace = createEmailLoginTrace(request);
      trace.identityPath = 'identity_v2';
      trace.mark('email_auth_started', 'START', { action, createIfMissing: true, ...emailPublicMeta(email), authAttemptId: trace.authAttemptId || '' });
      trace.mark('otp_verify_started', 'START', { action, createIfMissing: true, ...emailPublicMeta(email) });
      try {
        if (!code || !/^\d{6}$/.test(String(code))) {
          trace.mark('otp_verify_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', stage: 'otp_verify_started', publicErrorCode: 'EMAIL_CODE_INVALID' });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', failedStage: 'otp_verify_started', internalErrorCode: 'EMAIL_CODE_INVALID' });
          return reply.code(400).send({
            ok: false,
            error: 'EMAIL_CODE_INVALID',
            message: publicEmailAuthMessage('EMAIL_CODE_INVALID'),
            diagnostics: {
              requestId: trace.requestId,
              authAttemptId: trace.authAttemptId,
              loginSessionId: trace.loginSessionId,
              identityPath: trace.identityPath,
              identityResolved: false,
              customTokenIssued: false,
              backendRevision: EMAIL_AUTH_BACKEND_REVISION,
              failedStage: 'otp_verify_started',
              statusCode: 400,
              error: 'EMAIL_CODE_INVALID',
              timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            },
          });
        }

        const otp = await withEmailLoginStage(trace, 'email_code_verified', () => getEmailOtp(codeRef, email), 5000);
        if (!otp.data) {
          trace.mark('otp_verify_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', stage: 'email_code_verified' });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', failedStage: 'email_code_verified', internalErrorCode: 'EMAIL_CODE_INVALID' });
          return reply.code(400).send({
            ok: false,
            error: 'EMAIL_CODE_INVALID',
            message: publicEmailAuthMessage('EMAIL_CODE_INVALID'),
            diagnostics: {
              requestId: trace.requestId,
              authAttemptId: trace.authAttemptId,
              loginSessionId: trace.loginSessionId,
              identityPath: trace.identityPath,
              identityResolved: false,
              customTokenIssued: false,
              backendRevision: EMAIL_AUTH_BACKEND_REVISION,
              failedStage: 'email_code_verified',
              statusCode: 400,
              error: 'EMAIL_CODE_INVALID',
              timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            },
          });
        }

        const data = otp.data;

        if (otpExpiresMs(data) < Date.now()) {
          await deleteEmailOtp(codeRef, email).catch(() => {});
          trace.mark('otp_verify_failed', 'FAILED', { publicCode: 'EMAIL_CODE_EXPIRED', stage: 'email_code_verified' });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_CODE_EXPIRED', failedStage: 'email_code_verified', internalErrorCode: 'EMAIL_CODE_EXPIRED' });
          return reply.code(400).send({
            ok: false,
            error: 'EMAIL_CODE_EXPIRED',
            message: publicEmailAuthMessage('EMAIL_CODE_EXPIRED'),
            diagnostics: {
              requestId: trace.requestId,
              authAttemptId: trace.authAttemptId,
              loginSessionId: trace.loginSessionId,
              identityPath: trace.identityPath,
              identityResolved: false,
              customTokenIssued: false,
              backendRevision: EMAIL_AUTH_BACKEND_REVISION,
              failedStage: 'email_code_verified',
              statusCode: 400,
              error: 'EMAIL_CODE_EXPIRED',
              timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            },
          });
        }

        if ((data.attempts ?? 0) >= 5) {
          trace.mark('otp_verify_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', stage: 'email_code_verified' });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', failedStage: 'email_code_verified', internalErrorCode: 'EMAIL_CODE_INVALID' });
          return reply.code(429).send({
            ok: false,
            error: 'EMAIL_CODE_INVALID',
            message: 'Слишком много попыток. Запросите новый код',
            diagnostics: {
              requestId: trace.requestId,
              authAttemptId: trace.authAttemptId,
              loginSessionId: trace.loginSessionId,
              identityPath: trace.identityPath,
              identityResolved: false,
              customTokenIssued: false,
              backendRevision: EMAIL_AUTH_BACKEND_REVISION,
              failedStage: 'email_code_verified',
              statusCode: 429,
              error: 'EMAIL_CODE_INVALID',
              timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            },
          });
        }

        if (data.code !== String(code)) {
          await incrementEmailOtpAttempts(codeRef, email);
          const left = 4 - (data.attempts ?? 0);
          trace.mark('otp_verify_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', stage: 'email_code_verified', remainingAttempts: left });
          trace.mark('email_auth_failed', 'FAILED', { publicCode: 'EMAIL_CODE_INVALID', failedStage: 'email_code_verified', internalErrorCode: 'EMAIL_CODE_INVALID' });
          return reply.code(400).send({
            ok: false,
            error: 'EMAIL_CODE_INVALID',
            message: `Неверный код. Осталось попыток: ${left}`,
            diagnostics: {
              requestId: trace.requestId,
              authAttemptId: trace.authAttemptId,
              loginSessionId: trace.loginSessionId,
              identityPath: trace.identityPath,
              identityResolved: false,
              customTokenIssued: false,
              backendRevision: EMAIL_AUTH_BACKEND_REVISION,
              failedStage: 'email_code_verified',
              statusCode: 400,
              error: 'EMAIL_CODE_INVALID',
              timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            },
          });
        }

        trace.mark('identity_resolve_started', 'START', { createIfMissing: true, ...emailPublicMeta(email) });
        const identity = await withEmailLoginStage(trace, 'resolve_email_user', () => resolveEmailUser(db, email, ref ?? null, { createIfMissing: true }), 9000).catch(error => {
          error.code = error?.code === 'USER_NOT_FOUND' ? 'EMAIL_IDENTITY_CREATE_FAILED' : error?.code;
          throw error;
        });
        trace.identityResolved = true;
        trace.mark('identity_resolve_succeeded', 'OK', { userIdHash: hashValue(identity.userId || ''), source: identity.source || null });
        trace.mark('identity_resolve_completed', 'END', { userIdHash: hashValue(identity.userId || '') , source: identity.source || null });
        trace.mark(identity.source === 'identity_v2_created' ? 'email_identity_created' : 'email_identity_found', 'END', { source: identity.source || null });
        trace.apgUserIdHash = hashValue(identity.userId || '');
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
            metadata: emailPublicMeta(email),
          });
        }

        trace.mark('custom_token_started', 'START', { userIdHash: hashValue(userId || '') });
        const token = await withEmailLoginStage(trace, 'create_custom_token', () => createFirebaseToken(userId, ud), 5000);
        trace.mark('custom_token_issued', 'OK', { userIdHash: hashValue(userId || '') });
        trace.mark('custom_token_created', 'END', { userId });
        trace.customTokenIssued = true;
        trace.expectedUidHash = hashValue(userId || '');
        deleteEmailOtp(codeRef, email).catch(() => {});
        trace.mark('email_code_consumed', 'END');
        trace.mark('email_auth_completed', 'END', { userId, totalMs: Date.now() - trace.startedAt, userIdHash: hashValue(userId || '') });
        trace.mark('attempt_completed', 'SUCCESS', { finalResult: 'BACKEND_AUTH_SUCCESS' });
        return {
          ok: true,
          token,
          canonicalUserId: userId,
          diagnostics: {
            requestId: trace.requestId,
            authAttemptId: trace.authAttemptId,
            loginSessionId: trace.loginSessionId,
            identityPath: trace.identityPath,
            identityResolved: trace.identityResolved,
            customTokenIssued: trace.customTokenIssued,
            backendRevision: EMAIL_AUTH_BACKEND_REVISION,
            userIdHash: hashValue(userId || ''),
            expectedUidHash: trace.expectedUidHash,
            timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
          },
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
      } catch (error) {
        const classified = classifyEmailLoginError(error);
        const failedStage = error?.failedStage || trace.timeline.findLast?.(item => item.status === 'FAILED')?.stage || 'unknown';
        if (String(failedStage).includes('resolve') || String(failedStage).includes('identity')) {
          trace.mark('identity_resolve_failed', 'FAILED', { publicCode: classified.code, internalErrorCode: error?.code || error?.error || null });
        }
        if (String(failedStage).includes('custom_token') || String(failedStage).includes('create_custom_token')) {
          trace.mark('custom_token_failed', 'FAILED', { publicCode: classified.code, internalErrorCode: error?.code || error?.error || null });
        }
        const failureCategory = classifyFailureCategory(failedStage, classified.code, error?.code || error?.error);
        trace.mark('attempt_completed', 'FAILED', {
          finalResult: 'BACKEND_AUTH_FAILED',
          failureCategory,
          failedStage,
        });
        trace.mark('email_auth_failed', 'FAILED', {
          failedStage,
          publicCode: classified.code,
          internalCode: error?.code || error?.error || null,
          totalMs: Date.now() - trace.startedAt,
        });
        request.log.error({
          requestId: trace.requestId,
          failedStage,
          publicCode: classified.code,
          internalCode: error?.code || error?.error || null,
          message: String(error?.message || String(error)).slice(0, 300),
          action,
          createIfMissing: true,
          ...emailPublicMeta(email),
          identity: serverFoundation.identityV2.snapshot(),
          timeline: trace.timeline,
        }, 'email-auth verify failed');
        return reply.code(classified.statusCode).send({
          ok: false,
          error: classified.code,
          message: publicEmailAuthMessage(classified.code),
          diagnostics: {
            requestId: trace.requestId,
            authAttemptId: trace.authAttemptId,
            loginSessionId: trace.loginSessionId,
            identityPath: trace.identityPath,
            identityResolved: trace.identityResolved,
            customTokenIssued: trace.customTokenIssued,
            backendRevision: EMAIL_AUTH_BACKEND_REVISION,
            failedStage,
            statusCode: classified.statusCode,
            error: classified.code,
            timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
            expectedUidHash: trace.expectedUidHash,
            actualUidHash: trace.actualUidHash,
            finalResult: 'BACKEND_AUTH_FAILED',
            failureCategory,
          },
        });
      }
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
        const code = e?.code;
        if (code === 'EMAIL_ALREADY_USED') {
          return reply.code(409).send({
            ok: false,
            error: 'identity_conflict',
            code: 'IDENTITY_CONFLICT',
            message: e.message || 'Email уже привязан к другому аккаунту.',
          });
        }
        return reply.code(e.statusCode || 500).send({
          ok: false,
          error: e.statusCode === 409 ? 'already_used' : 'link_failed',
          message: e.message || 'Не удалось привязать email.',
        });
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
        trace.mark('email_auth_started', 'START', { action, createIfMissing: false, ...emailPublicMeta(email) });
        const { ref } = request.body ?? {};
        trace.mark('identity_resolve_started', 'START', { createIfMissing: false, ...emailPublicMeta(email) });
        const identity = await withEmailLoginStage(trace, 'resolve_email_user', () => resolveEmailUser(db, email, ref ?? null, { createIfMissing: false }), 9000);
        trace.identityResolved = true;
        trace.apgUserIdHash = hashValue(identity.userId || '');
        trace.mark('identity_resolve_succeeded', 'OK', { userIdHash: trace.apgUserIdHash, source: identity.source || null });
        trace.mark('identity_resolve_completed', 'END', { userIdHash: trace.apgUserIdHash, source: identity.source || null });
        trace.mark('email_identity_found', 'END', { source: identity.source || null });
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
            metadata: emailPublicMeta(email),
          });
        }
        if (ud.emailVerified === false) {
          sendVerificationEmail(db, email, userId, APP_URL).catch((e) => {
            request.log.warn({ name: e.name, message: e.message, metadata: e.$metadata || {}, responseBody: e.$response?.body || '' }, 'Postbox verification email failed');
          });
        }
        trace.mark('custom_token_started', 'START', { userIdHash: trace.apgUserIdHash });
        const token = await withEmailLoginStage(trace, 'create_custom_token', () => createFirebaseToken(userId, ud), 5000);
        trace.customTokenIssued = true;
        trace.expectedUidHash = trace.apgUserIdHash;
        trace.mark('custom_token_issued', 'OK', { userIdHash: trace.apgUserIdHash });
        trace.mark('custom_token_created', 'END', { userId });
        trace.mark('attempt_completed', 'SUCCESS', { finalResult: 'BACKEND_AUTH_SUCCESS' });
        trace.mark('email_auth_completed', 'END', { userId, totalMs: Date.now() - trace.startedAt });
        return {
          ok: true,
          token,
          canonicalUserId: userId,
          diagnostics: {
            requestId: trace.requestId,
            authAttemptId: trace.authAttemptId,
            loginSessionId: trace.loginSessionId,
            identityPath: trace.identityPath,
            identityResolved: trace.identityResolved,
            customTokenIssued: trace.customTokenIssued,
            backendRevision: EMAIL_AUTH_BACKEND_REVISION,
            expectedUidHash: trace.expectedUidHash,
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
        if (String(failedStage).includes('resolve') || String(failedStage).includes('identity')) {
          trace.mark('identity_resolve_failed', 'FAILED', { publicCode: classified.code, internalErrorCode: error?.code || error?.error || null });
        }
        if (String(failedStage).includes('custom_token') || String(failedStage).includes('create_custom_token')) {
          trace.mark('custom_token_failed', 'FAILED', { publicCode: classified.code, internalErrorCode: error?.code || error?.error || null });
        }
        const failureCategory = classifyFailureCategory(failedStage, classified.code, error?.code || error?.error);
        trace.mark('attempt_completed', 'FAILED', {
          finalResult: 'BACKEND_AUTH_FAILED',
          failureCategory,
          failedStage,
        });
        trace.mark('email_auth_failed', 'FAILED', {
          failedStage,
          code: classified.code,
          publicCode: classified.code,
          message: String(error?.message || error).slice(0, 300),
          totalMs: Date.now() - trace.startedAt,
        });
        request.log.error({
          requestId: trace.requestId,
          failedStage,
          publicCode: classified.code,
          internalCode: error?.code || error?.error || null,
          message: String(error?.message || String(error)).slice(0, 300),
          stack: String(error?.stack || '').slice(0, 1800),
          action,
          createIfMissing: false,
          ...emailPublicMeta(email),
          identity: serverFoundation.identityV2.snapshot(),
          timeline: trace.timeline,
        }, 'email-login failed');
        return reply.code(classified.statusCode).send({
          ok: false,
          error: classified.code,
          message: publicEmailAuthMessage(classified.code),
          diagnostics: {
            requestId: trace.requestId,
            authAttemptId: trace.authAttemptId,
            loginSessionId: trace.loginSessionId,
            identityPath: trace.identityPath,
            identityResolved: trace.identityResolved,
            customTokenIssued: trace.customTokenIssued,
            backendRevision: EMAIL_AUTH_BACKEND_REVISION,
            expectedUidHash: trace.expectedUidHash,
            actualUidHash: trace.actualUidHash,
            finalResult: 'BACKEND_AUTH_FAILED',
            failureCategory,
            failedStage,
            statusCode: classified.statusCode,
            error: classified.code,
            timeline: trace.timeline.map(item => ({ stage: item.stage, status: item.status, durationMs: item.durationMs })),
          },
        });
      }
    }

    // ── VERIFY EMAIL ─────────────────────────────────────────────────────────────
    if (action === 'verify-email') {
      const { token } = request.body ?? {};
      if (!token) return reply.code(400).send({ ok: false, error: 'missing_token' });
      const consumed = await consumeVerificationToken(db, token);
      if (!consumed.data) return reply.code(404).send({ ok: false, error: 'invalid_token' });
      const { userId, expiresAt } = consumed.data;
      const expiresMs = expiresAt?.toMillis ? expiresAt.toMillis() : new Date(expiresAt).getTime();
      if (expiresMs < Date.now()) {
        return reply.code(400).send({ ok: false, error: 'token_expired' });
      }
      await serverFoundation.identityV2.markEmailVerified(userId).catch(() => {});
      if (shouldWriteLegacyIdentitySideEffects()) {
        await db.collection('users').doc(userId).update({ emailVerified: true }).catch(() => {});
      }
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
