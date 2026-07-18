export const SOCIAL_PRIVACY = Object.freeze({
  ALLOWED_RELATIONS: 'allowed_relations',
  FRIENDS_ONLY: 'friends_only',
  NOBODY: 'nobody',
});

export const SOCIAL_ELIGIBILITY_REASONS = Object.freeze({
  FRIENDS: 'friends',
  SHARED_EVENT: 'shared_event',
  EXISTING_CONVERSATION: 'existing_conversation',
  SHARED_PARTNER: 'shared_partner',
  MANUAL_PERMISSION: 'manual_permission',
  SELF: 'self',
  BLOCKED: 'blocked',
  PRIVACY: 'privacy',
  NONE: 'none',
});

function id(value = {}) {
  return String(value?.id || value?.uid || value?.userId || value?.canonicalUserId || value || '').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

function rows(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function pairKey(a = '', b = '') {
  return [String(a || '').trim(), String(b || '').trim()].filter(Boolean).sort().join(':');
}

function hasBoth(values = [], actorId = '', targetId = '') {
  const set = new Set(list(values));
  return set.has(actorId) && set.has(targetId);
}

export function normalizeSocialPrivacy(value = '') {
  const normalized = String(value || '').trim();
  if (Object.values(SOCIAL_PRIVACY).includes(normalized)) return normalized;
  if (normalized === 'friends' || normalized === 'friends_only') return SOCIAL_PRIVACY.FRIENDS_ONLY;
  if (normalized === 'none' || normalized === 'nobody') return SOCIAL_PRIVACY.NOBODY;
  return SOCIAL_PRIVACY.ALLOWED_RELATIONS;
}

export function isBlockedPair({ actor = {}, target = {}, blocked = [] } = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  const actorBlocked = list(actor.blockedUserIds || actor.socialBlockedUserIds || blocked).includes(targetId);
  const targetBlocked = list(target.blockedUserIds || target.socialBlockedUserIds).includes(actorId);
  return actorBlocked || targetBlocked;
}

export function findExistingConversation({ actor = {}, target = {}, dialogs = [] } = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  if (!actorId || !targetId) return null;
  return rows(dialogs).find(dialog => {
    const type = String(dialog.type || dialog.context?.type || '').toLowerCase();
    if (type !== 'direct') return false;
    return hasBoth(dialog.participantIds || dialog.participants || dialog.userIds, actorId, targetId);
  }) || null;
}

export function areFriends(actor = {}, target = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  const actorFriends = list(actor.friendIds || actor.friends || actor.socialFriendIds);
  const targetFriends = list(target.friendIds || target.friends || target.socialFriendIds);
  return actorFriends.includes(targetId) || targetFriends.includes(actorId);
}

export function findSharedEvent({ actor = {}, target = {}, events = [], registeredEventIds = [] } = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  const actorEvents = new Set([...list(actor.eventIds || actor.registeredEventIds), ...list(registeredEventIds)]);
  const targetEvents = new Set(list(target.eventIds || target.registeredEventIds));
  for (const eventId of actorEvents) {
    if (targetEvents.has(eventId)) return { id: eventId };
  }
  return rows(events).find(event => hasBoth(event.participantIds || event.registeredUserIds || event.userIds || event.attendeeIds, actorId, targetId)) || null;
}

export function findSharedPartner({ actor = {}, target = {}, bookings = [], interactions = [] } = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  const actorPartners = new Set(list(actor.partnerIds || actor.visitedPartnerIds || actor.scannedPartnerIds));
  const targetPartners = new Set(list(target.partnerIds || target.visitedPartnerIds || target.scannedPartnerIds));
  rows(bookings).forEach(booking => {
    const userId = id(booking.userId || booking.clientUserId || booking.customerId);
    const partnerId = String(booking.partnerId || booking.providerId || '').trim();
    if (!partnerId) return;
    if (userId === actorId) actorPartners.add(partnerId);
    if (userId === targetId) targetPartners.add(partnerId);
  });
  rows(interactions).forEach(row => {
    const userId = id(row.userId);
    const partnerId = String(row.partnerId || row.providerId || row.objectId || '').trim();
    if (!partnerId) return;
    if (userId === actorId) actorPartners.add(partnerId);
    if (userId === targetId) targetPartners.add(partnerId);
  });
  for (const partnerId of actorPartners) {
    if (targetPartners.has(partnerId)) return { id: partnerId };
  }
  return null;
}

export function findManualPermission({ actor = {}, target = {}, requests = [] } = {}) {
  const key = pairKey(id(actor), id(target));
  return rows(requests).find(request => pairKey(request.fromUserId, request.toUserId) === key && request.status === 'accepted') || null;
}

export function getConversationRequestStatus({ actor = {}, target = {}, requests = [] } = {}) {
  const actorId = id(actor);
  const targetId = id(target);
  const active = rows(requests)
    .filter(request => pairKey(request.fromUserId, request.toUserId) === pairKey(actorId, targetId))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0];
  return active?.status || '';
}

export function evaluateConversationEligibility(input = {}) {
  const actor = input.actor || {};
  const target = input.target || {};
  const actorId = id(actor);
  const targetId = id(target);
  const privacy = normalizeSocialPrivacy(target.socialMessagingPrivacy || input.privacy);
  if (!actorId || !targetId) return { eligible: false, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.NONE, privacy, requestStatus: '' };
  if (actorId === targetId) return { eligible: false, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.SELF, privacy, requestStatus: '' };
  if (isBlockedPair(input)) return { eligible: false, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.BLOCKED, privacy, requestStatus: getConversationRequestStatus(input) };
  const existing = findExistingConversation(input);
  if (existing) return { eligible: true, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.EXISTING_CONVERSATION, privacy, dialogId: existing.id || existing.dialogId, requestStatus: getConversationRequestStatus(input) };
  const manual = findManualPermission(input);
  if (manual) return { eligible: true, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.MANUAL_PERMISSION, privacy, requestId: manual.id, requestStatus: manual.status };
  if (privacy === SOCIAL_PRIVACY.NOBODY) return { eligible: false, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.PRIVACY, privacy, requestStatus: getConversationRequestStatus(input) };
  if (areFriends(actor, target)) return { eligible: true, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.FRIENDS, privacy, requestStatus: getConversationRequestStatus(input) };
  if (privacy === SOCIAL_PRIVACY.FRIENDS_ONLY) return { eligible: false, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.PRIVACY, privacy, requestStatus: getConversationRequestStatus(input) };
  const event = findSharedEvent(input);
  if (event) return { eligible: true, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.SHARED_EVENT, privacy, eventId: event.id, requestStatus: getConversationRequestStatus(input) };
  const partner = findSharedPartner(input);
  if (partner) return { eligible: true, canRequest: false, reason: SOCIAL_ELIGIBILITY_REASONS.SHARED_PARTNER, privacy, partnerId: partner.id, requestStatus: getConversationRequestStatus(input) };
  const requestStatus = getConversationRequestStatus(input);
  return { eligible: false, canRequest: requestStatus !== 'pending', reason: SOCIAL_ELIGIBILITY_REASONS.NONE, privacy, requestStatus };
}

export function getSocialConversationAction(input = {}) {
  const result = evaluateConversationEligibility(input);
  if (result.eligible) return { ...result, label: 'Написать', action: 'open_direct_dialog' };
  if (result.canRequest) return { ...result, label: 'Запросить общение', action: 'request_conversation' };
  return { ...result, label: result.requestStatus === 'pending' ? 'Запрос отправлен' : 'Недоступно', action: 'disabled' };
}
