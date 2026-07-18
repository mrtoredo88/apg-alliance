import { getMessagingCategory, normalizeMessagingType } from './MessagingRegistry.js';

function idOf(actor = {}) {
  return String(actor?.id || actor?.uid || actor?.userId || actor?.canonicalUserId || '').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

export function getMessagingActor(actor = {}) {
  const role = String(actor?.role || actor?.primaryRole || actor?.type || 'user').trim().toLowerCase();
  return {
    id: idOf(actor),
    role,
    isAdmin: ['owner', 'super_admin', 'admin', 'moderator', 'support'].includes(role) || actor?.isAdmin === true,
    partnerId: String(actor?.partnerId || actor?.ownedPartnerId || '').trim(),
    expertId: String(actor?.expertId || actor?.ownedExpertId || '').trim(),
  };
}

export function canAccessDialog(actor = {}, dialog = {}) {
  const user = getMessagingActor(actor);
  if (!user.id) return { allowed: false, reason: 'anonymous' };
  const type = normalizeMessagingType(dialog.type || dialog.context?.type);
  const category = getMessagingCategory(type, dialog.context || {});
  const participantIds = list(dialog.participantIds || dialog.participants || dialog.userIds);
  const ownerUserIds = list(dialog.ownerUserIds || dialog.context?.ownerUserIds);
  const userId = String(dialog.userId || dialog.clientUserId || '').trim();
  if (user.isAdmin && category !== 'PERSONAL') return { allowed: true, reason: 'admin' };
  if (participantIds.includes(user.id) || ownerUserIds.includes(user.id) || userId === user.id) return { allowed: true, reason: 'participant' };
  if (category === 'PERSONAL') return { allowed: false, reason: 'not-participant' };
  if (category === 'SUPPORT') return { allowed: true, reason: 'support-public' };
  if (type === 'partner' && user.partnerId && String(dialog.context?.partnerId || dialog.context?.objectId || '') === user.partnerId) return { allowed: true, reason: 'partner-owner' };
  if (type === 'expert' && user.expertId && String(dialog.context?.expertId || dialog.context?.objectId || '') === user.expertId) return { allowed: true, reason: 'expert-owner' };
  if (['partner', 'expert', 'booking', 'event', 'promotion', 'news', 'group'].includes(type)) return { allowed: true, reason: 'public-context' };
  return { allowed: false, reason: 'denied' };
}

export function buildMessagingPermissions(actor = {}, dialog = {}) {
  const access = canAccessDialog(actor, dialog);
  const user = getMessagingActor(actor);
  const owner = list(dialog.ownerUserIds || dialog.context?.ownerUserIds).includes(user.id);
  return {
    ...access,
    canRead: access.allowed,
    canWrite: access.allowed && dialog.archived !== true && dialog.workspaceState?.archived !== true,
    canModerate: user.isAdmin || owner,
    actorRole: user.role,
  };
}
