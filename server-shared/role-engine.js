export const ROLES = {
  user: 'user',
  expert: 'expert',
  partner: 'partner',
  analyst: 'analyst',
  moderator: 'moderator',
  editor: 'editor',
  admin: 'admin',
  superAdmin: 'super_admin',
  owner: 'owner',
};

export const ROLE_ALIASES = {
  administrator: ROLES.admin,
};

export const PERMISSIONS = {
  userNavigation: 'user.navigation',
  profileRead: 'profile.read',
  profileEditSelf: 'profile.edit.self',
  scannerUse: 'scanner.use',
  rewardsUse: 'rewards.use',
  workspaceOpen: 'workspace.open',
  businessHubOpen: 'businessHub.open',
  businessProfileManage: 'business.profile.manage',
  contentRead: 'content.read',
  contentCreate: 'content.create',
  contentModerate: 'content.moderate',
  contentPublish: 'content.publish',
  contentArchive: 'content.archive',
  usersRead: 'users.read',
  usersManage: 'users.manage',
  adminOpen: 'admin.open',
  diagnosticsOpen: 'diagnostics.open',
  systemRead: 'system.read',
  systemManage: 'system.manage',
};

export const CAPABILITIES = {
  canUseUserMode: 'canUseUserMode',
  canUseWorkspace: 'canUseWorkspace',
  canUseBusinessHub: 'canUseBusinessHub',
  canOpenAdminPanel: 'canOpenAdminPanel',
  canManageOwnPartnerProfile: 'canManageOwnPartnerProfile',
  canManageOwnExpertProfile: 'canManageOwnExpertProfile',
  canModerateContent: 'canModerateContent',
  canPublishContent: 'canPublishContent',
  canViewDiagnostics: 'canViewDiagnostics',
};

const BASE_USER_PERMISSIONS = [
  PERMISSIONS.userNavigation,
  PERMISSIONS.profileRead,
  PERMISSIONS.profileEditSelf,
  PERMISSIONS.scannerUse,
  PERMISSIONS.rewardsUse,
  PERMISSIONS.contentRead,
];

const BASE_USER_CAPABILITIES = [CAPABILITIES.canUseUserMode];

export const ROLE_REGISTRY = Object.freeze({
  [ROLES.user]: {
    rank: 10,
    label: 'Пользователь',
    permissions: BASE_USER_PERMISSIONS,
    capabilities: BASE_USER_CAPABILITIES,
  },
  [ROLES.expert]: {
    rank: 20,
    label: 'Эксперт',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.businessHubOpen, PERMISSIONS.businessProfileManage, PERMISSIONS.contentCreate],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseBusinessHub, CAPABILITIES.canManageOwnExpertProfile],
  },
  [ROLES.partner]: {
    rank: 30,
    label: 'Партнёр',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.businessHubOpen, PERMISSIONS.businessProfileManage, PERMISSIONS.contentCreate],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseBusinessHub, CAPABILITIES.canManageOwnPartnerProfile],
  },
  [ROLES.analyst]: {
    rank: 40,
    label: 'Аналитик',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.usersRead],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canViewDiagnostics],
  },
  [ROLES.moderator]: {
    rank: 50,
    label: 'Модератор',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.usersRead, PERMISSIONS.contentModerate],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canModerateContent, CAPABILITIES.canViewDiagnostics],
  },
  [ROLES.editor]: {
    rank: 60,
    label: 'Редактор',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.contentCreate, PERMISSIONS.contentPublish, PERMISSIONS.contentArchive],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canPublishContent, CAPABILITIES.canViewDiagnostics],
  },
  [ROLES.admin]: {
    rank: 70,
    label: 'Администратор',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.businessHubOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.usersRead, PERMISSIONS.contentCreate, PERMISSIONS.contentModerate, PERMISSIONS.contentPublish, PERMISSIONS.contentArchive],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canUseBusinessHub, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canModerateContent, CAPABILITIES.canPublishContent, CAPABILITIES.canViewDiagnostics],
  },
  [ROLES.superAdmin]: {
    rank: 80,
    label: 'Главный администратор',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.businessHubOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.systemManage, PERMISSIONS.usersRead, PERMISSIONS.usersManage, PERMISSIONS.contentCreate, PERMISSIONS.contentModerate, PERMISSIONS.contentPublish, PERMISSIONS.contentArchive],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canUseBusinessHub, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canModerateContent, CAPABILITIES.canPublishContent, CAPABILITIES.canViewDiagnostics],
  },
  [ROLES.owner]: {
    rank: 90,
    label: 'Владелец',
    permissions: [...BASE_USER_PERMISSIONS, PERMISSIONS.workspaceOpen, PERMISSIONS.businessHubOpen, PERMISSIONS.adminOpen, PERMISSIONS.diagnosticsOpen, PERMISSIONS.systemRead, PERMISSIONS.systemManage, PERMISSIONS.usersRead, PERMISSIONS.usersManage, PERMISSIONS.contentCreate, PERMISSIONS.contentModerate, PERMISSIONS.contentPublish, PERMISSIONS.contentArchive],
    capabilities: [...BASE_USER_CAPABILITIES, CAPABILITIES.canUseWorkspace, CAPABILITIES.canUseBusinessHub, CAPABILITIES.canOpenAdminPanel, CAPABILITIES.canModerateContent, CAPABILITIES.canPublishContent, CAPABILITIES.canViewDiagnostics],
  },
});

export const VALID_ROLES = Object.freeze(Object.keys(ROLE_REGISTRY));

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeRole(value) {
  const role = clean(value);
  if (!role) return '';
  const aliased = ROLE_ALIASES[role] || role;
  return ROLE_REGISTRY[aliased] ? aliased : '';
}

export function getUnknownRoles(identity = {}) {
  const raw = [
    identity.role,
    identity.userRole,
    identity.authRole,
    ...(Array.isArray(identity.roles) ? identity.roles : []),
  ].map(clean).filter(Boolean);
  return unique(raw.filter(role => !normalizeRole(role)));
}

export function getUserRoles(identity = {}) {
  const roles = [
    identity.role,
    identity.userRole,
    identity.authRole,
    ...(Array.isArray(identity.roles) ? identity.roles : []),
    identity.owner === true || identity.isOwner === true ? ROLES.owner : '',
    identity.admin === true || identity.isAdmin === true ? ROLES.admin : '',
    identity.partnerId || identity.partnerCabinetEnabled || (Array.isArray(identity.partnerCabinetIds) && identity.partnerCabinetIds.length) ? ROLES.partner : '',
    identity.expertId || identity.expertCabinetEnabled || (Array.isArray(identity.expertCabinetIds) && identity.expertCabinetIds.length) ? ROLES.expert : '',
  ].map(normalizeRole).filter(Boolean);
  return unique(roles.length ? roles : [ROLES.user]);
}

export function getPrimaryRole(identityOrRoles = {}) {
  const roles = Array.isArray(identityOrRoles) ? identityOrRoles.map(normalizeRole).filter(Boolean) : getUserRoles(identityOrRoles);
  return roles.sort((a, b) => (ROLE_REGISTRY[b]?.rank || 0) - (ROLE_REGISTRY[a]?.rank || 0))[0] || ROLES.user;
}

export function getRolePermissions(identity = {}) {
  return unique(getUserRoles(identity).flatMap(role => ROLE_REGISTRY[role]?.permissions || []));
}

export function getRoleCapabilities(identity = {}) {
  return unique(getUserRoles(identity).flatMap(role => ROLE_REGISTRY[role]?.capabilities || []));
}

export function hasRole(identity, role) {
  const normalized = normalizeRole(role);
  return Boolean(normalized && getUserRoles(identity).includes(normalized));
}

export function hasPermission(identity, permission) {
  const permissions = getRolePermissions(identity);
  return permissions.includes('*') || permissions.includes(permission);
}

export function hasCapability(identity, capability) {
  return getRoleCapabilities(identity).includes(capability);
}

export function getRoleDiagnostics(identity = {}) {
  const roles = getUserRoles(identity);
  return {
    rawRoles: unique([
      identity.role,
      identity.userRole,
      identity.authRole,
      ...(Array.isArray(identity.roles) ? identity.roles : []),
    ].map(clean).filter(Boolean)),
    roles,
    unknownRoles: getUnknownRoles(identity),
    primaryRole: getPrimaryRole(roles),
    permissions: getRolePermissions(identity),
    capabilities: getRoleCapabilities(identity),
  };
}

export function isRoleWithinRolloutStage(identity = {}, stage = 'owner') {
  const normalizedStage = clean(stage);
  if (normalizedStage === 'off') return false;
  if (normalizedStage === 'all') return true;
  if (hasRole(identity, ROLES.owner)) return true;
  if (normalizedStage === ROLES.owner) return hasRole(identity, ROLES.superAdmin);
  if (normalizedStage === ROLES.admin) {
    return [ROLES.superAdmin, ROLES.admin, ROLES.moderator, ROLES.editor, ROLES.analyst].some(role => hasRole(identity, role));
  }
  if (normalizedStage === ROLES.partner) {
    return [ROLES.superAdmin, ROLES.admin, ROLES.moderator, ROLES.editor, ROLES.analyst, ROLES.partner].some(role => hasRole(identity, role));
  }
  if (normalizedStage === ROLES.expert) {
    return [ROLES.superAdmin, ROLES.admin, ROLES.moderator, ROLES.editor, ROLES.analyst, ROLES.partner, ROLES.expert].some(role => hasRole(identity, role));
  }
  return false;
}
