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

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'moderator', 'editor']);
const OWNER_ROLES = new Set(['owner', 'super_admin']);
const APG_OWNER_USER_IDS = new Set(['988504']);

export function normalizeWorkspaceFlag(value, fallback = DESKTOP_WORKSPACE_FLAG.owner) {
  const normalized = String(value || '').trim().toLowerCase();
  return FLAG_ORDER.includes(normalized) ? normalized : fallback;
}

export function getDesktopWorkspaceFlag(storage = globalThis.localStorage) {
  try {
    return normalizeWorkspaceFlag(storage?.getItem?.('apg_desktop_workspace_flag'), DESKTOP_WORKSPACE_FLAG.owner);
  } catch {
    return DESKTOP_WORKSPACE_FLAG.owner;
  }
}

export function getWorkspaceUserRoles({ user, partner, expert } = {}) {
  const roles = new Set();
  const userRole = String(user?.role || user?.userRole || user?.authRole || '').toLowerCase();
  if (userRole) {
    roles.add(userRole);
    if (userRole === 'super_admin') roles.add('admin');
  }
  if (user?.owner === true || user?.isOwner === true) roles.add('owner');
  if (user?.admin === true || user?.isAdmin === true) roles.add('admin');
  if (APG_OWNER_USER_IDS.has(String(user?.id || ''))) roles.add('owner');
  if (partner?.id || user?.partnerId || user?.partnerCabinetEnabled || (Array.isArray(user?.partnerCabinetIds) && user.partnerCabinetIds.length)) roles.add('partner');
  if (expert?.id || user?.expertId || user?.expertCabinetEnabled || (Array.isArray(user?.expertCabinetIds) && user.expertCabinetIds.length)) roles.add('expert');
  if (!roles.size) roles.add('user');
  return Array.from(roles);
}

export function isWorkspaceOwner({ user, partner, expert } = {}) {
  const roles = getWorkspaceUserRoles({ user, partner, expert });
  return roles.some(role => OWNER_ROLES.has(role));
}

export function canUseDesktopWorkspace({ user, partner, expert, flag } = {}) {
  const resolvedFlag = normalizeWorkspaceFlag(flag, DESKTOP_WORKSPACE_FLAG.owner);
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.off) return false;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.all) return true;

  const roles = getWorkspaceUserRoles({ user, partner, expert });
  if (roles.some(role => OWNER_ROLES.has(role))) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.owner) return false;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.admin && roles.some(role => ADMIN_ROLES.has(role))) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.partner && (roles.some(role => ADMIN_ROLES.has(role)) || roles.includes('partner'))) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.expert && (roles.some(role => ADMIN_ROLES.has(role)) || roles.includes('partner') || roles.includes('expert'))) return true;
  return false;
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
