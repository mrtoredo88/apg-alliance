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
  if (userRole) roles.add(userRole === 'super_admin' ? 'admin' : userRole);
  if (user?.owner === true || user?.isOwner === true) roles.add('owner');
  if (user?.admin === true || user?.isAdmin === true) roles.add('admin');
  if (partner?.id || user?.partnerId || user?.partnerCabinetEnabled || (Array.isArray(user?.partnerCabinetIds) && user.partnerCabinetIds.length)) roles.add('partner');
  if (expert?.id || user?.expertId || user?.expertCabinetEnabled || (Array.isArray(user?.expertCabinetIds) && user.expertCabinetIds.length)) roles.add('expert');
  if (!roles.size) roles.add('user');
  return Array.from(roles);
}

export function canUseDesktopWorkspace({ user, partner, expert, flag } = {}) {
  const resolvedFlag = normalizeWorkspaceFlag(flag, DESKTOP_WORKSPACE_FLAG.owner);
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.off) return false;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.all) return true;

  const roles = getWorkspaceUserRoles({ user, partner, expert });
  if (roles.includes('owner')) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.owner) return false;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.admin && roles.some(role => ADMIN_ROLES.has(role))) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.partner && (roles.some(role => ADMIN_ROLES.has(role)) || roles.includes('partner'))) return true;
  if (resolvedFlag === DESKTOP_WORKSPACE_FLAG.expert && (roles.some(role => ADMIN_ROLES.has(role)) || roles.includes('partner') || roles.includes('expert'))) return true;
  return false;
}
