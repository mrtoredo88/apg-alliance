const eventListeners = new Map();
const wildcardListeners = new Set();
const history = [];

const MAX_HISTORY = 250;

export const APG_EVENT_TYPES = {
  PARTNER_CREATED: 'PartnerCreated',
  PARTNER_UPDATED: 'PartnerUpdated',
  PARTNER_DELETED: 'PartnerDeleted',
  EXPERT_CREATED: 'ExpertCreated',
  EXPERT_UPDATED: 'ExpertUpdated',
  EXPERT_DELETED: 'ExpertDeleted',
  NEWS_PUBLISHED: 'NewsPublished',
  NEWS_UPDATED: 'NewsUpdated',
  NEWS_ARCHIVED: 'NewsArchived',
  EVENT_CREATED: 'EventCreated',
  EVENT_UPDATED: 'EventUpdated',
  EVENT_PUBLISHED: 'EventPublished',
  EVENT_ARCHIVED: 'EventArchived',
  COMMENT_CREATED: 'CommentCreated',
  COMMENT_LIKED: 'CommentLiked',
  COMMENT_UPDATED: 'CommentUpdated',
  QR_SCANNED: 'QRScanned',
  KEYS_AWARDED: 'KeysAwarded',
  REWARD_CLAIMED: 'RewardClaimed',
  REFERRAL_REGISTERED: 'ReferralRegistered',
  USER_AUTHORIZED: 'UserAuthorized',
  USER_REGISTERED: 'UserRegistered',
  CONSENT_ACCEPTED: 'ConsentAccepted',
  PROFILE_UPDATED: 'ProfileUpdated',
  TASK_CLAIMED: 'TaskClaimed',
  TASK_COMPLETED: 'TaskCompleted',
  APP_ACTION: 'AppAction',
};

function resolveEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `apg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeString(value) {
  const text = typeof value === 'string' ? value : String(value ?? '').trim();
  return text || undefined;
}

function normalizeSource(source) {
  return safeString(source) || 'web-app';
}

function normalizeEntityType(type) {
  const normalized = safeString(type)?.toLowerCase() || 'app';
  if (['partner', 'partners'].includes(normalized)) return 'partner';
  if (['expert', 'experts'].includes(normalized)) return 'expert';
  if (['news', 'post', 'posts'].includes(normalized)) return 'news';
  if (['event', 'events'].includes(normalized)) return 'event';
  if (['task', 'tasks'].includes(normalized)) return 'task';
  if (['prize', 'reward', 'rewards'].includes(normalized)) return 'reward';
  if (['comment', 'comments'].includes(normalized)) return 'comment';
  return normalized;
}

export function normalizeEventPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  return payload;
}

export function createEvent({
  type = APG_EVENT_TYPES.APP_ACTION,
  actor = null,
  entityType = null,
  entityId = null,
  payload = {},
  source = 'web-app',
  version = '1',
} = {}) {
  const normalizedEntityType = normalizeEntityType(entityType || payload.entityType);
  return {
    id: resolveEventId(),
    type,
    timestamp: new Date().toISOString(),
    actor: actor || null,
    entityType: normalizedEntityType || null,
    entityId: safeString(entityId || payload.entityId) || null,
    payload: normalizeEventPayload(payload),
    source: normalizeSource(source),
    platform: normalizeSource(source),
    version,
  };
}

export function publishEvent(eventOrType, payload = {}) {
  const event = typeof eventOrType === 'string'
    ? createEvent({ type: eventOrType, payload })
    : createEvent(eventOrType || {});

  history.unshift(event);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

  eventListeners.get(event.type)?.forEach(listener => {
    try { listener(event); } catch { /* noop */ }
  });
  wildcardListeners.forEach(listener => {
    try { listener(event); } catch { /* noop */ }
  });

  return event;
}

export function subscribeToEvents(type, listener) {
  if (typeof listener !== 'function') return () => {};
  if (!type || type === '*') {
    wildcardListeners.add(listener);
    return () => wildcardListeners.delete(listener);
  }

  const set = eventListeners.get(type) ?? new Set();
  set.add(listener);
  eventListeners.set(type, set);

  return () => {
    const current = eventListeners.get(type);
    if (!current) return;
    current.delete(listener);
    if (!current.size) eventListeners.delete(type);
  };
}

export function emitAppActionEvent({ type = APG_EVENT_TYPES.APP_ACTION, actor = null, entityType = null, entityId = null, payload = {}, source = 'web-app', platform = 'web-app', version = '1' } = {}) {
  return publishEvent({
    type,
    actor,
    entityType,
    entityId,
    payload,
    source,
    platform,
    version,
  });
}

export function getEventHistory(limit = 20) {
  return history.slice(0, Math.max(1, Number(limit) || 20));
}

export function clearEventHistory() {
  history.length = 0;
}
