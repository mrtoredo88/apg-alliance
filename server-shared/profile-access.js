function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function list(value) {
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean);
  return text(value) ? [text(value)] : [];
}

function unique(values) {
  return [...new Set(values.map(item => text(item)).filter(Boolean))];
}

export function actorProfileIds(actor = {}, type = '') {
  const user = actor.user || {};
  const includePartner = type !== 'expert';
  const includeExpert = type !== 'partner';
  return unique([
    includePartner ? user.partnerId : '',
    includePartner ? user.partnerCabinetIds : [],
    includePartner ? user.ownedPartnerIds : [],
    includeExpert ? user.expertId : '',
    includeExpert ? user.expertCabinetIds : [],
    includeExpert ? user.ownedExpertIds : [],
    user.profileIds,
  ].flat());
}

export function actorOwnsEditableProfile(profile = {}, actor = {}, type = '') {
  if (!profile || !actor) return false;
  const user = actor.user || {};
  const profileId = text(profile.id || profile.profileId || profile.partnerId || profile.expertId);
  const actorIds = unique([
    actor.userId,
    actor.uid,
    user.id,
    user.uid,
    user.firebaseUid,
    user.authUid,
    user.vkId,
    user.vkUserId,
    user.telegramId,
    user.tgId,
    user.linkedTelegram?.tgId,
  ]);
  const actorEmails = unique([
    user.email,
    user.linkedEmail,
    user.normalizedEmail,
  ].map(item => text(item).toLowerCase()));
  const ownerUserIds = unique([
    profile.ownerUserIds,
    profile.ownerIds,
    profile.ownerId,
    profile.ownerUserId,
    profile.userId,
    profile.managerUserId,
    profile.createdByUserId,
  ].flat());
  const ownerEmails = unique([
    profile.ownerEmails,
    profile.ownerEmail,
    profile.connectionEmail,
  ].flat().map(item => text(item).toLowerCase()));
  const linkedProfileIds = actorProfileIds(actor, type);

  return actorIds.some(id => ownerUserIds.includes(id) || text(profile.vkOwnerId) === id)
    || actorEmails.some(email => ownerEmails.includes(email))
    || (profileId && linkedProfileIds.includes(profileId));
}
