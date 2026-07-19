export function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

export function normalizeRoles(value) {
  const list = Array.isArray(value) ? value : [value || 'user'];
  return [...new Set(list.map(item => safeString(item, 80)).filter(Boolean))] || ['user'];
}

export function toJson(value, fallback = {}) {
  return value == null ? fallback : value;
}

export function mapUser(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    canonicalUserId: row.canonical_user_id || row.canonicalUserId || row.id,
    displayName: row.display_name || row.displayName || '',
    firstName: row.first_name || row.firstName || '',
    lastName: row.last_name || row.lastName || '',
    photo: row.photo || null,
    email: row.email || '',
    role: row.role || 'user',
    roles: Array.isArray(row.roles) ? row.roles : ['user'],
    ...(row.profile && typeof row.profile === 'object' ? row.profile : {}),
    legacy: row.legacy && typeof row.legacy === 'object' ? row.legacy : {},
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    lastSeenAt: row.last_seen_at || row.lastSeenAt || null,
  };
}

export function defaultEmailUser(email, ref = '') {
  const normalized = normalizeEmail(email);
  const userId = `email:${normalized}`;
  const isValidRef = ref && ref !== userId;
  const today = new Date().toLocaleDateString('sv');
  return {
    id: userId,
    canonicalUserId: userId,
    authProvider: 'email',
    email: normalized,
    linkedEmail: normalized,
    linkedEmails: [normalized],
    roles: ['user'],
    role: 'user',
    displayName: normalized.split('@')[0],
    firstName: normalized.split('@')[0],
    lastName: null,
    photo: null,
    keys: isValidRef ? 2 : 0,
    favorites: [],
    scannedPartners: {},
    completedTasks: [],
    streak: 0,
    onboardingDone: false,
    scanDates: [],
    lastBonusDate: today,
    referredBy: isValidRef ? ref : null,
    emailVerified: false,
    identityStatus: 'canonical',
    identityVersion: 'identity-v2',
  };
}
