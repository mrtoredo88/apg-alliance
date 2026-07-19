function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function rowsFor(snapshot = {}, name = '') {
  return Array.isArray(snapshot.collections?.[name]) ? snapshot.collections[name] : [];
}

export function rowData(row = {}) {
  return row.data && typeof row.data === 'object' ? row.data : {};
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function userEmail(row = {}) {
  const data = rowData(row);
  return normalizeEmail(data.email || data.linkedEmail || data.normalizedEmail);
}

export function userTelegramId(row = {}) {
  const data = rowData(row);
  return String(data.linkedTelegram?.tgId || data.linkedTelegram?.telegramId || data.linkedTgId || data.telegramId || data.tgId || '').trim();
}

export function createDryRunState(snapshot = {}) {
  const collections = clone(snapshot.collections || {});
  const state = {
    sourceSnapshot: {
      exportedAt: snapshot.exportedAt || null,
      projectId: snapshot.projectId || null,
      counts: clone(snapshot.counts || {}),
      checksums: clone(snapshot.checksums || {}),
    },
    collections,
    virtualUsers: clone(collections.users || []),
    virtualIdentityIndex: clone(collections.emailIndex || []),
    virtualTelegramLinks: clone(collections.tgLinks || []),
    virtualAuthMap: clone(collections.auth_map || []),
    virtualCanonicalUsers: clone(collections.canonicalUsers || []),
    virtualIdentityLinks: clone(collections.identityLinks || []),
    virtualRoles: clone(collections.roles || []),
    virtualOwnership: clone(collections.ownership || []),
    virtualBookings: clone(collections.bookings || []),
    virtualFriends: clone(collections.friends || []),
    virtualKeys: clone(collections.keys || []),
    virtualNotifications: clone(collections.notifications || []),
    virtualDialogs: clone(collections.dialogs || collections.contextDialogs || []),
    virtualRewards: clone(collections.rewards || []),
    operations: [],
    warnings: [],
    errors: [],
    disposed: false,
  };
  state.before = snapshotCounts(state);
  return state;
}

export function snapshotCounts(state = {}) {
  return {
    users: state.virtualUsers?.length || 0,
    identityIndex: state.virtualIdentityIndex?.length || 0,
    telegramLinks: state.virtualTelegramLinks?.length || 0,
    authMap: state.virtualAuthMap?.length || 0,
    canonicalUsers: state.virtualCanonicalUsers?.length || 0,
    identityLinks: state.virtualIdentityLinks?.length || 0,
    roles: state.virtualRoles?.length || 0,
    ownership: state.virtualOwnership?.length || 0,
    bookings: state.virtualBookings?.length || 0,
    friends: state.virtualFriends?.length || 0,
    keys: state.virtualKeys?.length || 0,
    notifications: state.virtualNotifications?.length || 0,
    dialogs: state.virtualDialogs?.length || 0,
    rewards: state.virtualRewards?.length || 0,
  };
}

export function disposeDryRunState(state = {}) {
  Object.keys(state).forEach(key => {
    if (Array.isArray(state[key])) state[key] = [];
    else if (state[key] && typeof state[key] === 'object') state[key] = null;
  });
  state.disposed = true;
  return state;
}
