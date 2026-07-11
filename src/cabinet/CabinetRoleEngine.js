export const CABINET_ROLE_DEFINITIONS = {
  partner: {
    id: 'partner',
    label: 'Партнер',
    collection: 'partners',
    updateAction: 'partner:profileUpdate',
    profileIdField: 'partnerId',
    profileType: 'partner',
    modules: ['promotions', 'events', 'products'],
    taskKeys: ['offer', 'event', 'news', 'photos', 'hours'],
  },
  expert: {
    id: 'expert',
    label: 'Эксперт',
    collection: 'experts',
    updateAction: 'expert:profileUpdate',
    profileIdField: 'expertId',
    profileType: 'expert',
    modules: ['services', 'pricing', 'experience', 'booking', 'events'],
    taskKeys: ['photo', 'description', 'offer', 'services', 'booking', 'video'],
  },
  owner: {
    id: 'owner',
    label: 'Владелец',
    modules: ['audit', 'billing'],
    taskKeys: [],
  },
  admin: {
    id: 'admin',
    label: 'Администратор',
    modules: ['moderation', 'audit'],
    taskKeys: [],
  },
  moderator: {
    id: 'moderator',
    label: 'Модератор',
    modules: ['moderation'],
    taskKeys: [],
  },
  editor: {
    id: 'editor',
    label: 'Редактор',
    modules: ['editorial'],
    taskKeys: [],
  },
};

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'moderator', 'editor']);

function hasProfile(profile) {
  return Boolean(profile?.id);
}

export function getCabinetRoles({ user, partner, expert, preferredRole } = {}) {
  const roles = [];
  if (hasProfile(partner)) roles.push({ ...CABINET_ROLE_DEFINITIONS.partner, profile: partner });
  if (hasProfile(expert)) roles.push({ ...CABINET_ROLE_DEFINITIONS.expert, profile: expert });

  const userRole = String(user?.role || user?.userRole || user?.authRole || '').toLowerCase();
  if (ADMIN_ROLES.has(userRole)) {
    const key = userRole === 'super_admin' ? 'admin' : userRole;
    roles.push({ ...(CABINET_ROLE_DEFINITIONS[key] || CABINET_ROLE_DEFINITIONS.admin), profile: user });
  }
  if (user?.owner === true || user?.isOwner === true) roles.push({ ...CABINET_ROLE_DEFINITIONS.owner, profile: user });
  if (user?.admin === true || user?.isAdmin === true) roles.push({ ...CABINET_ROLE_DEFINITIONS.admin, profile: user });

  const unique = roles.filter((role, index, list) => list.findIndex(item => item.id === role.id) === index);
  const preferred = unique.find(role => role.id === preferredRole);
  return {
    roles: unique,
    activeRole: preferred || unique[0] || null,
    hasMultipleRoles: unique.length > 1,
  };
}

export function getRoleModuleIds(roles = []) {
  const base = ['dashboard', 'tasks', 'analytics', 'media', 'contacts', 'content', 'reviews', 'notifications', 'loki', 'subscription', 'settings', 'history'];
  const roleSpecific = roles.flatMap(role => role.modules || []);
  return Array.from(new Set([...base, ...roleSpecific]));
}

export function getActiveProfile(role) {
  return role?.profile || null;
}
