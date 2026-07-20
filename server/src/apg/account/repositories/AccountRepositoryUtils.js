export function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

export function normalizeRoles(value) {
  const raw = Array.isArray(value) ? value : [value || 'user'];
  const roles = raw.map(item => safeString(item, 80).toLowerCase()).filter(Boolean);
  return [...new Set(roles.length ? roles : ['user'])];
}

export function normalizePermissions(value) {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.map(item => safeString(item, 120)).filter(Boolean))];
}

export function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function mapProfile(row) {
  if (!row) return null;
  const profile = parseJson(row.profile, {});
  return {
    ...profile,
    id: row.user_id,
    userId: row.user_id,
    canonicalUserId: row.canonical_user_id,
    firebaseUid: row.firebase_uid || profile.firebaseUid || '',
    email: row.email || profile.email || '',
    telegramId: row.telegram_id || profile.telegramId || profile.tgId || '',
    displayName: row.display_name || profile.displayName || profile.name || '',
    firstName: row.first_name || profile.firstName || '',
    lastName: row.last_name || profile.lastName || '',
    photo: row.photo || profile.photo || profile.avatar || '',
    city: row.city || profile.city || '',
    bootstrap: parseJson(row.bootstrap, {}),
    legacy: parseJson(row.legacy, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeen: row.last_seen_at || profile.lastSeen || null,
  };
}

export function mapRoles(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    primaryRole: row.primary_role || 'user',
    roles: normalizeRoles(parseJson(row.roles, ['user'])),
    permissions: normalizePermissions(parseJson(row.permissions, [])),
    claims: parseJson(row.claims, {}),
  };
}

export function mapCabinet(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    role: row.role,
    entityId: row.entity_id,
    status: row.status,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    firebaseUid: row.firebase_uid || '',
    device: parseJson(row.device, {}),
    platform: row.platform || '',
    status: row.status || 'active',
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}
