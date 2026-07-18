const DAY_MS = 24 * 60 * 60 * 1000;
export const SOCIAL_REQUEST_STATUSES = Object.freeze(['pending', 'accepted', 'declined', 'expired']);

function clean(value = '') {
  return String(value || '').trim();
}

function nowMs(now = Date.now()) {
  return typeof now === 'number' ? now : new Date(now).getTime();
}

export function buildConversationRequest({ fromUserId = '', toUserId = '', source = 'profile', now = Date.now() } = {}) {
  const from = clean(fromUserId);
  const to = clean(toUserId);
  const at = new Date(nowMs(now)).toISOString();
  return {
    id: `social-request:${from}:${to}:${nowMs(now)}`,
    fromUserId: from,
    toUserId: to,
    status: 'pending',
    source,
    createdAt: at,
    updatedAt: at,
    expiresAt: new Date(nowMs(now) + 7 * DAY_MS).toISOString(),
  };
}

export function canCreateConversationRequest({ actor = {}, target = {}, requests = [], limit = 10, now = Date.now() } = {}) {
  const actorId = clean(actor.id || actor.uid || actor.userId || actor);
  const targetId = clean(target.id || target.uid || target.userId || target);
  if (!actorId || !targetId || actorId === targetId) return { ok: false, reason: 'invalid_target', remaining: 0 };
  const since = nowMs(now) - DAY_MS;
  const recent = (Array.isArray(requests) ? requests : []).filter(request => clean(request.fromUserId) === actorId && new Date(request.createdAt || 0).getTime() >= since);
  const pendingSame = recent.find(request => clean(request.toUserId) === targetId && request.status === 'pending');
  if (pendingSame) return { ok: false, reason: 'already_pending', remaining: Math.max(0, limit - recent.length) };
  if (recent.length >= limit) return { ok: false, reason: 'rate_limited', remaining: 0 };
  return { ok: true, reason: 'ok', remaining: Math.max(0, limit - recent.length - 1) };
}

export function updateConversationRequestStatus(request = {}, status = 'pending', now = Date.now()) {
  const nextStatus = SOCIAL_REQUEST_STATUSES.includes(status) ? status : 'pending';
  return {
    ...request,
    status: nextStatus,
    updatedAt: new Date(nowMs(now)).toISOString(),
    acceptedAt: nextStatus === 'accepted' ? new Date(nowMs(now)).toISOString() : request.acceptedAt || null,
    declinedAt: nextStatus === 'declined' ? new Date(nowMs(now)).toISOString() : request.declinedAt || null,
  };
}

export function expireConversationRequests(requests = [], now = Date.now()) {
  const ts = nowMs(now);
  return (Array.isArray(requests) ? requests : []).map(request => {
    if (request.status !== 'pending') return request;
    if (!request.expiresAt || new Date(request.expiresAt).getTime() > ts) return request;
    return updateConversationRequestStatus(request, 'expired', ts);
  });
}

export function buildDirectDialogContext({ actor = {}, target = {}, source = 'social-messaging' } = {}) {
  const actorId = clean(actor.id || actor.uid || actor.userId);
  const targetId = clean(target.id || target.uid || target.userId);
  const title = [target.first_name, target.last_name].filter(Boolean).join(' ') || target.displayName || target.name || 'Участник АПГ';
  return {
    type: 'direct',
    category: 'PERSONAL',
    objectId: targetId,
    targetUserId: targetId,
    participantIds: [actorId, targetId].filter(Boolean),
    title,
    subtitle: 'Личный диалог АПГ',
    source,
  };
}
