import { CAPABILITIES, getUserRoles, hasCapability, hasRole, isRoleWithinRolloutStage, ROLES } from '../roleEngine.js';

export const DESKTOP_WORKSPACE_FLAG = {
  off: 'off',
  owner: 'owner',
  admin: 'admin',
  partner: 'partner',
  expert: 'expert',
  all: 'all',
};

const FLAG_ORDER = [
  DESKTOP_WORKSPACE_FLAG.off,
  DESKTOP_WORKSPACE_FLAG.owner,
  DESKTOP_WORKSPACE_FLAG.admin,
  DESKTOP_WORKSPACE_FLAG.partner,
  DESKTOP_WORKSPACE_FLAG.expert,
  DESKTOP_WORKSPACE_FLAG.all,
];

export function normalizeWorkspaceFlag(value, fallback = DESKTOP_WORKSPACE_FLAG.expert) {
  const normalized = String(value || '').trim().toLowerCase();
  return FLAG_ORDER.includes(normalized) ? normalized : fallback;
}

export function getDesktopWorkspaceFlag(storage = globalThis.localStorage) {
  try {
    return normalizeWorkspaceFlag(storage?.getItem?.('apg_desktop_workspace_flag'), DESKTOP_WORKSPACE_FLAG.expert);
  } catch {
    return DESKTOP_WORKSPACE_FLAG.expert;
  }
}

export function getWorkspaceUserRoles({ user, partner, expert } = {}) {
  return getUserRoles({
    ...(user || {}),
    partnerId: user?.partnerId || partner?.id,
    expertId: user?.expertId || expert?.id,
  });
}

export function isWorkspaceOwner({ user, partner, expert } = {}) {
  return hasRole({
    ...(user || {}),
    partnerId: user?.partnerId || partner?.id,
    expertId: user?.expertId || expert?.id,
  }, ROLES.owner);
}

export function canUseDesktopWorkspace({ user, partner, expert, flag } = {}) {
  const resolvedFlag = normalizeWorkspaceFlag(flag, DESKTOP_WORKSPACE_FLAG.expert);
  const identity = {
    ...(user || {}),
    partnerId: user?.partnerId || partner?.id,
    expertId: user?.expertId || expert?.id,
  };
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.off) return false;
  return hasCapability(identity, CAPABILITIES.canUseWorkspace) && isRoleWithinRolloutStage(identity, resolvedFlag);
}

export function isDesktopWorkspaceDevice({ width = 0, userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  const safeWidth = Number(width) || 0;
  if (safeWidth >= 1180) return true;
  if (safeWidth < 1024) return false;
  const text = `${platform} ${userAgent}`.toLowerCase();
  const desktopPlatform = /mac|win|linux|cros/.test(text);
  const ipadLikeMac = /mac/.test(text) && Number(maxTouchPoints) > 1;
  return desktopPlatform && !ipadLikeMac;
}

export function resolveDesktopWorkspaceMode({ requestedMode = 'auto', available = false } = {}) {
  if (!available) return 'user';
  if (requestedMode === 'user') return 'user';
  return 'workspace';
}
