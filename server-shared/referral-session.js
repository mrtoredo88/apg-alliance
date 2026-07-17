export const REFERRAL_SESSION_TTL_DAYS = 30;
export const REFERRAL_SESSION_STATUSES = Object.freeze({
  active: 'active',
  completed: 'completed',
  expired: 'expired',
});

function safe(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function hasUnsafeReferralChars(value) {
  return Array.from(String(value || '')).some(char => {
    const code = char.charCodeAt(0);
    return code < 32 || char === '<' || char === '>';
  });
}

export function normalizeReferralCode(value) {
  const clean = safe(value, 180);
  return clean && !hasUnsafeReferralChars(clean) ? clean : '';
}

export function normalizeReferralSessionId(value) {
  const clean = safe(value, 180);
  return /^refsess_[a-f0-9]{24,64}$/i.test(clean) ? clean : '';
}

export function referralSessionExpiresAt(now = new Date(), ttlDays = REFERRAL_SESSION_TTL_DAYS) {
  return new Date(now.getTime() + Math.max(1, Number(ttlDays) || REFERRAL_SESSION_TTL_DAYS) * 24 * 60 * 60 * 1000);
}

export function isReferralSessionExpired(session = {}, now = new Date()) {
  const expires = session.expiresAt?.toDate ? session.expiresAt.toDate() : session.expiresAt ? new Date(session.expiresAt) : null;
  return !!expires && expires.getTime() <= now.getTime();
}

export function buildReferralSessionPublic(session = {}, id = '') {
  return {
    id: normalizeReferralSessionId(id || session.id) || safe(id || session.id, 180),
    referrerId: normalizeReferralCode(session.referrerId),
    flowId: safe(session.flowId || session.referralFlowId, 160),
    deviceId: safe(session.deviceId, 160),
    source: safe(session.source, 120),
    status: safe(session.status || REFERRAL_SESSION_STATUSES.active, 60),
    completed: session.completed === true,
    authType: safe(session.authType, 60),
    userId: safe(session.userId, 180),
  };
}
