import { createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import {
  REFERRAL_SESSION_STATUSES,
  buildReferralSessionPublic,
  isReferralSessionExpired,
  normalizeReferralCode,
  normalizeReferralSessionId,
  referralSessionExpiresAt,
} from '../../../server-shared/referral-session.js';
import { recordReferralEventAsync, referralContextFromBody } from './referralEvents.js';

function safe(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function clientIp(req) {
  const raw = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.ip || '';
  return safe(String(raw).split(',')[0], 120);
}

function ipHash(req) {
  const ip = clientIp(req);
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : '';
}

function newSessionId() {
  return `refsess_${randomBytes(18).toString('hex')}`;
}

function eventContext(session = {}, id = '') {
  return {
    referralFlowId: session.flowId || session.referralFlowId || '',
    sessionId: id || session.id || '',
    deviceId: session.deviceId || '',
    platform: session.platform || '',
    referralCode: session.referrerId || '',
    referrerId: session.referrerId || '',
  };
}

export async function getReferralSession(db, referralSessionId = '') {
  const id = normalizeReferralSessionId(referralSessionId);
  if (!id) return null;
  const snap = await db.collection('referralSessions').doc(id).get();
  return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
}

export async function resolveReferralSessionReferrer(db, referralSessionId = '', { markMissing = false, userId = '', source = 'server' } = {}) {
  const session = await getReferralSession(db, referralSessionId);
  if (!session) {
    if (markMissing && referralSessionId) {
      recordReferralEventAsync(db, {
        type: REFERRAL_EVENT_TYPES.SESSION_MISSING,
        status: 'error',
        source,
        sessionId: referralSessionId,
        referredUserId: userId,
      });
    }
    return { referrerId: '', session: null, status: 'missing' };
  }
  const expired = isReferralSessionExpired(session.data);
  if (expired && session.data.status !== REFERRAL_SESSION_STATUSES.expired) {
    db.collection('referralSessions').doc(session.id).set({
      status: REFERRAL_SESSION_STATUSES.expired,
      expiredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    recordReferralEventAsync(db, {
      ...eventContext(session.data, session.id),
      type: REFERRAL_EVENT_TYPES.SESSION_EXPIRED,
      status: 'warning',
      source,
      referredUserId: userId,
    });
  }
  if (expired) return { referrerId: '', session, status: 'expired' };
  return { referrerId: normalizeReferralCode(session.data.referrerId), session, status: session.data.status || REFERRAL_SESSION_STATUSES.active };
}

export async function createOrRestoreReferralSession(db, req, body = {}) {
  const requestedSessionId = normalizeReferralSessionId(body.referralSessionId || body.sessionId);
  const referrerId = normalizeReferralCode(body.referrerId || body.ref || body.referralCode);
  const context = referralContextFromBody(body, { referralCode: referrerId });
  const now = new Date();
  const basePatch = {
    flowId: safe(body.referralFlowId || context.referralFlowId, 160),
    deviceId: safe(body.referralDeviceId || body.deviceId || context.deviceId, 160),
    platform: safe(body.referralPlatform || body.platform || context.platform, 160),
    source: safe(body.source || 'client', 120),
    userAgent: safe(req?.headers?.['user-agent'], 500),
    ipHash: ipHash(req),
    lastSeenAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (requestedSessionId) {
    const snap = await db.collection('referralSessions').doc(requestedSessionId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (isReferralSessionExpired(data, now)) {
        await snap.ref.set({ status: REFERRAL_SESSION_STATUSES.expired, expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        recordReferralEventAsync(db, { ...eventContext(data, snap.id), type: REFERRAL_EVENT_TYPES.SESSION_EXPIRED, status: 'warning', source: basePatch.source });
        return { ok: true, restored: false, expired: true, session: buildReferralSessionPublic({ ...data, status: REFERRAL_SESSION_STATUSES.expired }, snap.id) };
      }
      await snap.ref.set({ ...basePatch, status: data.status || REFERRAL_SESSION_STATUSES.active }, { merge: true });
      recordReferralEventAsync(db, { ...eventContext({ ...data, ...basePatch }, snap.id), type: REFERRAL_EVENT_TYPES.SESSION_RESTORED, status: 'completed', source: basePatch.source });
      return { ok: true, restored: true, session: buildReferralSessionPublic({ ...data, ...basePatch }, snap.id) };
    }
    recordReferralEventAsync(db, { type: REFERRAL_EVENT_TYPES.SESSION_MISSING, status: 'warning', source: basePatch.source, sessionId: requestedSessionId, referralCode: referrerId, referrerId });
  }

  if (!referrerId || referrerId.startsWith('guest_')) {
    return { ok: false, error: 'missing_referrer' };
  }
  const id = newSessionId();
  const data = {
    id,
    referrerId,
    referralCode: referrerId,
    status: REFERRAL_SESSION_STATUSES.active,
    completed: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: referralSessionExpiresAt(now),
    ...basePatch,
  };
  await db.collection('referralSessions').doc(id).set(data, { merge: true });
  recordReferralEventAsync(db, { ...eventContext(data, id), type: REFERRAL_EVENT_TYPES.SESSION_CREATED, status: 'completed', source: basePatch.source });
  return { ok: true, created: true, session: buildReferralSessionPublic(data, id) };
}

export function completeReferralSessionAsync(db, referralSessionId = '', patch = {}) {
  const id = normalizeReferralSessionId(referralSessionId);
  if (!id) return;
  const ref = db.collection('referralSessions').doc(id);
  ref.get().then(snap => {
    if (!snap.exists) {
      recordReferralEventAsync(db, { type: REFERRAL_EVENT_TYPES.SESSION_MISSING, status: 'error', source: patch.source || 'complete', sessionId: id, referredUserId: patch.userId || '' });
      return null;
    }
    const data = snap.data() || {};
    return ref.set({
      status: patch.status || REFERRAL_SESSION_STATUSES.completed,
      completed: patch.completed !== false,
      completedAt: FieldValue.serverTimestamp(),
      authType: safe(patch.authType || data.authType, 60),
      userId: safe(patch.userId || data.userId, 180),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).then(() => {
      recordReferralEventAsync(db, {
        ...eventContext(data, id),
        type: REFERRAL_EVENT_TYPES.SESSION_COMPLETED,
        status: 'completed',
        source: patch.source || 'complete',
        referredUserId: patch.userId || data.userId || '',
        metadata: { authType: patch.authType || data.authType || '' },
      });
    });
  }).catch(error => {
    console.warn('[REF] session complete skipped', { id, message: error?.message || String(error) });
  });
}
