import { randomBytes } from 'crypto';
import { getDb } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { telegramUrl } from '../../../server-shared/telegram.js';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import { createOrRestoreReferralSession } from '../lib/referralSessions.js';
import { recordReferralEventAsync, referralContextFromBody } from '../lib/referralEvents.js';

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase().trim());
  return Boolean(value);
}

function safeString(value, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

function safeRequestId(request, fallback = '') {
  return safeString(request.headers['x-request-id'] || request.headers['x-request-id'.toLowerCase()] || '', 180)
    || safeString(request.body?.requestId || request.body?.request_id || fallback, 180);
}

function logTelegramAuthStart(logger, entry = {}) {
  const details = {
    requestId: entry.requestId,
    state: entry.state,
    telegramSessionId: entry.telegramSessionId,
    loginSessionId: entry.loginSessionId,
    ownerUserId: entry.ownerUserId,
    ownerEmail: entry.ownerEmail,
    source: entry.source,
    referralSessionId: entry.referralSessionId,
  };
  logger?.info?.({ ...details, at: new Date().toISOString() }, 'telegram-auth-start-forensic');
}

function safeTimelineEvent(stage, requestId, state, loginSessionId, telegramSessionId, detail = {}) {
  return {
    stage,
    at: new Date().toISOString(),
    requestId,
    state,
    loginSessionId: loginSessionId || null,
    telegramSessionId: telegramSessionId || state || null,
    ...detail,
  };
}

export default async function telegramAuthStartRoutes(fastify) {
  fastify.post('/api/telegram-auth-start', async (request, reply) => {
    const body = request.body ?? {};
    const linking = normalizeBoolean(body.linking);
    const ownerUserId = safeString(body.ownerUserId, 200);
    const ownerEmail = safeString(body.email || body.ownerEmail, 220).toLowerCase();
    const source = safeString(body.source, 120) || 'profile_panel';
    const requestId = safeRequestId(request, `tg_req_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`);
    const loginSessionId = safeString(body.loginSessionId || body.sessionId || body.authSessionId, 220);
    if (linking && !ownerUserId) {
      return reply.code(400).send({ ok: false, message: 'owner_required' });
    }
    const state = randomBytes(16).toString('hex');
    const db = getDb();
    const referralSession = await createOrRestoreReferralSession(db, request, {
      ...body,
      source: 'telegram-auth-start',
    }).catch(() => null);
    const referralContext = referralContextFromBody(body, { referralCode: body.ref || body.referralCode || referralSession?.session?.referrerId || '' });
    const referralSessionId = referralSession?.session?.id || safeString(body.referralSessionId || body.sessionId, 180);
    const referrerId = referralSession?.session?.referrerId || safeString(body.referrerId || body.ref || body.referralCode, 180);
    await db.collection('telegramAuthSessions').doc(state).set({
      status: 'pending',
      linking: linking === true,
      requestId,
      telegramSessionId: state,
      loginSessionId: loginSessionId || null,
      ownerUserId: ownerUserId || null,
      ownerEmail: ownerEmail || null,
      source,
      referralSessionId: referralSessionId || null,
      referrerId: referrerId || null,
      referralFlowId: referralContext.referralFlowId || null,
      referralDeviceId: referralContext.deviceId || null,
      referralPlatform: referralContext.platform || null,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      timeline: [
        safeTimelineEvent('session_created', requestId, state, loginSessionId, state, {
          source,
          referralSessionId: referralSessionId || null,
          referrerId: referrerId || null,
        }),
      ],
    });
    logTelegramAuthStart(request.log, {
      requestId,
      state,
      telegramSessionId: state,
      loginSessionId,
      ownerUserId,
      ownerEmail,
      source,
      referralSessionId: referralSessionId || null,
    });
    if (referralSessionId || referrerId) {
      recordReferralEventAsync(db, {
        ...referralContext,
        sessionId: referralSessionId,
        referrerId,
        referralCode: referrerId,
        type: REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED,
        status: 'started',
        source: 'telegram-auth-start',
        metadata: { state, linking },
      });
    }
    return {
      requestId,
      loginSessionId: loginSessionId || null,
      telegramSessionId: state,
      state,
      url: telegramUrl(`apg_zelenograd_bot?start=auth_${state}`),
    };
  });
}
