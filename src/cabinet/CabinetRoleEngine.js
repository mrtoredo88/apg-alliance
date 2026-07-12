import { getUserRoles } from '../roleEngine.js';

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
  super_admin: {
    id: 'super_admin',
    label: 'Главный администратор',
    modules: ['moderation', 'audit', 'security'],
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
  analyst: {
    id: 'analyst',
    label: 'Аналитик',
    modules: ['analytics', 'audit'],
    taskKeys: [],
  },
};

function hasProfile(profile) {
  return Boolean(profile?.id);
}

export function getCabinetRoles({ user, partner, expert, preferredRole } = {}) {
  const roles = [];
  if (hasProfile(partner)) roles.push({ ...CABINET_ROLE_DEFINITIONS.partner, profile: partner });
  if (hasProfile(expert)) roles.push({ ...CABINET_ROLE_DEFINITIONS.expert, profile: expert });

  getUserRoles(user).forEach(role => {
    const definition = CABINET_ROLE_DEFINITIONS[role];
    if (definition && !['partner', 'expert'].includes(role)) roles.push({ ...definition, profile: user });
  });

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
