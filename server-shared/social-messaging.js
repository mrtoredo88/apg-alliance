export const SOCIAL_PRIVACY = Object.freeze({
  ALLOWED_CONNECTIONS: 'allowed_connections',
  FRIENDS_ONLY: 'friends_only',
  NOBODY: 'nobody',
});

export const SOCIAL_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const SOCIAL_EVENTS = Object.freeze({
  REQUEST_CREATED: 'SOCIAL_MESSAGE_REQUEST_CREATED',
  REQUEST_ACCEPTED: 'SOCIAL_MESSAGE_REQUEST_ACCEPTED',
  REQUEST_DECLINED: 'SOCIAL_MESSAGE_REQUEST_DECLINED',
  REQUEST_BLOCKED: 'SOCIAL_MESSAGE_REQUEST_BLOCKED',
  REQUEST_RATE_LIMITED: 'SOCIAL_MESSAGE_REQUEST_RATE_LIMITED',
  DIALOG_LINKED: 'SOCIAL_MESSAGE_DIALOG_LINKED',
  WRITE_DENIED: 'SOCIAL_MESSAGE_WRITE_DENIED',
});

export const SOCIAL_REQUEST_LIMIT = 10;
export const SOCIAL_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SOCIAL_REQUEST_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;
export const SOCIAL_DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export function cleanSocialId(value = '') {
  return String(value || '').trim().replace(/[/#?[\\\]]/g, '_').slice(0, 180);
}

export function normalizeSocialPair(a = '', b = '') {
  const ids = [cleanSocialId(a), cleanSocialId(b)].filter(Boolean).sort();
  return ids.length === 2 ? ids.join('__') : '';
}

export function socialRequestId(senderId = '', recipientId = '') {
  const pair = normalizeSocialPair(senderId, recipientId);
  return pair ? `social__${pair}` : '';
}

export function socialDirectDialogId(a = '', b = '') {
  const pair = normalizeSocialPair(a, b);
  return pair ? `direct__${pair}` : '';
}

export function normalizeSocialPrivacy(value = '') {
  const raw = String(value || '').trim();
  if (raw === 'allowed_relations') return SOCIAL_PRIVACY.ALLOWED_CONNECTIONS;
  if (Object.values(SOCIAL_PRIVACY).includes(raw)) return raw;
  if (raw === 'friends' || raw === 'friends_only') return SOCIAL_PRIVACY.FRIENDS_ONLY;
  if (raw === 'none' || raw === 'nobody') return SOCIAL_PRIVACY.NOBODY;
  return SOCIAL_PRIVACY.ALLOWED_CONNECTIONS;
}

export function normalizeSocialRequestStatus(value = '', now = Date.now(), expiresAt = null) {
  const status = String(value || '').trim().toLowerCase();
  if (status === SOCIAL_REQUEST_STATUS.PENDING && expiresAt) {
    const ms = typeof expiresAt?.toMillis === 'function' ? expiresAt.toMillis() : new Date(expiresAt).getTime();
    if (Number.isFinite(ms) && ms <= Number(now)) return SOCIAL_REQUEST_STATUS.EXPIRED;
  }
  return Object.values(SOCIAL_REQUEST_STATUS).includes(status) ? status : SOCIAL_REQUEST_STATUS.PENDING;
}

export function socialPublicUser(user = {}, id = '') {
  return {
    id: cleanSocialId(id || user.id || user.userId),
    displayName: String(user.displayName || [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ') || user.name || 'Участник АПГ').trim().slice(0, 160),
    photo: String(user.photo || user.photo_200 || '').trim().slice(0, 1000),
  };
}

export function createSocialRequestRecord({ senderId, recipientId, sender = {}, recipient = {}, relationshipReason = 'manual_permission', now = Date.now() } = {}) {
  const id = socialRequestId(senderId, recipientId);
  const createdAt = new Date(now).toISOString();
  return {
    id,
    pairKey: normalizeSocialPair(senderId, recipientId),
    senderId: cleanSocialId(senderId),
    recipientId: cleanSocialId(recipientId),
    participants: [cleanSocialId(senderId), cleanSocialId(recipientId)].filter(Boolean),
    status: SOCIAL_REQUEST_STATUS.PENDING,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Number(now) + SOCIAL_REQUEST_EXPIRE_MS).toISOString(),
    acceptedAt: null,
    declinedAt: null,
    cancelledAt: null,
    resolvedBy: null,
    relationshipReason,
    dialogId: '',
    sender: socialPublicUser(sender, senderId),
    recipient: socialPublicUser(recipient, recipientId),
  };
}

export function isRecentSocialRequest(record = {}, now = Date.now(), windowMs = SOCIAL_REQUEST_WINDOW_MS) {
  const ms = typeof record.createdAt?.toMillis === 'function' ? record.createdAt.toMillis() : new Date(record.createdAt || 0).getTime();
  return Number.isFinite(ms) && Number(now) - ms < windowMs;
}

export function isDeclineCooldownActive(record = {}, now = Date.now()) {
  if (record.status !== SOCIAL_REQUEST_STATUS.DECLINED) return false;
  const ms = typeof record.declinedAt?.toMillis === 'function' ? record.declinedAt.toMillis() : new Date(record.declinedAt || record.updatedAt || 0).getTime();
  return Number.isFinite(ms) && Number(now) - ms < SOCIAL_DECLINE_COOLDOWN_MS;
}
