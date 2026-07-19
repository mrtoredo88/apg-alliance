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

export const CONNECTION_STATUS = Object.freeze({
  PENDING: 'pending',
  CONNECTED: 'connected',
  DECLINED: 'declined',
  BLOCKED: 'blocked',
});

export const CONNECTION_SOURCE = Object.freeze({
  NETWORKING: 'networking',
  EVENT: 'event',
  PARTNER: 'partner',
  EXPERT: 'expert',
  QR: 'qr',
  MANUAL: 'manual',
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

export function connectionId(a = '', b = '') {
  const pair = normalizeSocialPair(a, b);
  return pair ? `connection__${pair}` : '';
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

export function normalizeConnectionStatus(value = '') {
  const status = String(value || '').trim().toLowerCase();
  if (status === SOCIAL_REQUEST_STATUS.ACCEPTED) return CONNECTION_STATUS.CONNECTED;
  if (status === SOCIAL_REQUEST_STATUS.CANCELLED) return CONNECTION_STATUS.DECLINED;
  return Object.values(CONNECTION_STATUS).includes(status) ? status : CONNECTION_STATUS.PENDING;
}

export function normalizeConnectionSource(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (Object.values(CONNECTION_SOURCE).includes(raw)) return raw;
  if (raw === 'network' || raw === 'networking_event') return CONNECTION_SOURCE.NETWORKING;
  if (raw === 'event' || raw === 'events') return CONNECTION_SOURCE.EVENT;
  if (raw === 'partner' || raw === 'partners') return CONNECTION_SOURCE.PARTNER;
  if (raw === 'expert' || raw === 'experts') return CONNECTION_SOURCE.EXPERT;
  if (raw === 'qr' || raw === 'qrcode') return CONNECTION_SOURCE.QR;
  return CONNECTION_SOURCE.MANUAL;
}

export function socialPublicUser(user = {}, id = '') {
  return {
    id: cleanSocialId(id || user.id || user.userId),
    displayName: String(user.displayName || [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ') || user.name || 'Участник АПГ').trim().slice(0, 160),
    photo: String(user.photo || user.photo_200 || '').trim().slice(0, 1000),
    role: String(user.role || user.userRole || user.status || '').trim().slice(0, 80),
    city: String(user.city || user.town || '').trim().slice(0, 120),
    about: String(user.about || user.bio || user.description || '').trim().slice(0, 240),
    company: String(user.company || user.companyName || user.organization || '').trim().slice(0, 160),
  };
}

export function createConnectionContext({ source = CONNECTION_SOURCE.MANUAL, sourceId = '', sourceTitle = '', sourceDate = '' } = {}) {
  const normalized = normalizeConnectionSource(source);
  const labels = {
    [CONNECTION_SOURCE.NETWORKING]: 'Нетворкинг',
    [CONNECTION_SOURCE.EVENT]: 'Мероприятие',
    [CONNECTION_SOURCE.PARTNER]: 'Партнёр',
    [CONNECTION_SOURCE.EXPERT]: 'Эксперт',
    [CONNECTION_SOURCE.QR]: 'QR',
    [CONNECTION_SOURCE.MANUAL]: 'Ручной запрос',
  };
  return {
    source: normalized,
    sourceLabel: labels[normalized] || labels[CONNECTION_SOURCE.MANUAL],
    sourceId: cleanSocialId(sourceId),
    sourceTitle: String(sourceTitle || '').trim().slice(0, 180),
    sourceDate: String(sourceDate || '').trim().slice(0, 80),
  };
}

export function buildConnectionSharedContext(left = {}, right = {}) {
  const collect = (value = {}, keys = []) => keys.flatMap(key => Array.isArray(value[key]) ? value[key].map(String) : []).filter(Boolean);
  const intersect = (a = [], b = []) => {
    const rightSet = new Set(b.map(String));
    return [...new Set(a.map(String))].filter(id => rightSet.has(id)).slice(0, 12);
  };
  return {
    events: intersect(collect(left, ['registeredEventIds', 'eventIds']), collect(right, ['registeredEventIds', 'eventIds'])),
    partners: intersect(collect(left, ['visitedPartnerIds', 'partnerIds']), collect(right, ['visitedPartnerIds', 'partnerIds'])),
    contacts: intersect(collect(left, ['connectionIds', 'socialConnectionIds', 'friendIds', 'friends']), collect(right, ['connectionIds', 'socialConnectionIds', 'friendIds', 'friends'])),
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
