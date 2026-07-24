import { FieldValue } from './documentValues.js';
import { normalizeReferralEvent } from '../../../server-shared/referral-observability.js';

function cleanEventForFirestore(event) {
  const normalized = normalizeReferralEvent(event);
  return {
    ...normalized,
    createdAt: FieldValue.serverTimestamp(),
    timestampMs: Date.parse(normalized.timestamp) || Date.now(),
  };
}

export function referralContextFromBody(body = {}, fallback = {}) {
  return {
    referralFlowId: String(body.referralFlowId || fallback.referralFlowId || '').trim(),
    sessionId: String(body.referralSessionId || body.sessionId || fallback.sessionId || '').trim(),
    deviceId: String(body.referralDeviceId || body.deviceId || fallback.deviceId || '').trim(),
    platform: String(body.referralPlatform || body.platform || fallback.platform || '').trim(),
    referralCode: String(body.referralCode || body.ref || fallback.referralCode || '').trim(),
  };
}

export async function recordReferralEvent(db, event = {}) {
  const data = cleanEventForFirestore(event);
  await db.collection('referralEvents').add(data);
  return data;
}

export function recordReferralEventAsync(db, event = {}) {
  recordReferralEvent(db, event).catch(error => {
    console.warn('[REF] event log skipped', { type: event.type, message: error?.message || String(error) });
  });
}

export function recordReferralClientEventsAsync(db, events = [], base = {}) {
  if (!Array.isArray(events) || events.length === 0) return;
  events.slice(-40).forEach(event => {
    recordReferralEventAsync(db, {
      ...base,
      ...event,
      metadata: { ...(event.metadata || {}), ...(base.metadata || {}), clientEventId: event.id || null },
      source: event.source || base.source || 'client',
      referralFlowId: event.referralFlowId || base.referralFlowId,
      sessionId: event.sessionId || base.sessionId,
      deviceId: event.deviceId || base.deviceId,
      platform: event.platform || base.platform,
      referralCode: event.referralCode || base.referralCode,
    });
  });
}
