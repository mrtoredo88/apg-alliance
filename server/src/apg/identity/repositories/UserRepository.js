import { defaultEmailUser, mapUser, normalizeRoles, safeString, toJson } from './IdentityRepositoryUtils.js';

export class UserRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'UserRepository';
  }

  async get(id) {
    const result = await this.adapter.query('SELECT * FROM apg_identity_users WHERE id = $1 LIMIT 1', [safeString(id, 260)]);
    return mapUser(result.rows[0]);
  }

  async findByEmail(email) {
    const result = await this.adapter.query('SELECT * FROM apg_identity_users WHERE email = $1 LIMIT 5', [safeString(email, 220).toLowerCase()]);
    return result.rows.map(mapUser).filter(Boolean);
  }

  async upsert(user = {}) {
    const id = safeString(user.id || user.userId || user.canonicalUserId, 260);
    if (!id) throw Object.assign(new Error('Identity user id is required.'), { code: 'IDENTITY_USER_ID_REQUIRED' });
    const canonicalId = safeString(user.canonicalUserId || user.canonical_user_id || id, 260);
    const roles = normalizeRoles(user.roles || user.role);
    const role = safeString(user.role || roles[0] || 'user', 80) || 'user';
    const profile = {
      ...user,
      id,
      canonicalUserId: canonicalId,
      roles,
      role,
    };
    const result = await this.adapter.query(`
      INSERT INTO apg_identity_users (id, canonical_user_id, display_name, first_name, last_name, photo, email, role, roles, profile, legacy, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        canonical_user_id = EXCLUDED.canonical_user_id,
        display_name = COALESCE(EXCLUDED.display_name, apg_identity_users.display_name),
        first_name = COALESCE(EXCLUDED.first_name, apg_identity_users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, apg_identity_users.last_name),
        photo = COALESCE(EXCLUDED.photo, apg_identity_users.photo),
        email = COALESCE(EXCLUDED.email, apg_identity_users.email),
        role = EXCLUDED.role,
        roles = EXCLUDED.roles,
        profile = apg_identity_users.profile || EXCLUDED.profile,
        legacy = apg_identity_users.legacy || EXCLUDED.legacy,
        updated_at = now()
      RETURNING *
    `, [
      id,
      canonicalId,
      safeString(user.displayName || user.firstName || '', 180) || null,
      safeString(user.firstName || user.first_name || '', 120) || null,
      safeString(user.lastName || user.last_name || '', 120) || null,
      safeString(user.photo || user.photo_200 || '', 500) || null,
      safeString(user.email || user.linkedEmail || '', 220).toLowerCase() || null,
      role,
      JSON.stringify(roles),
      JSON.stringify(profile),
      JSON.stringify(toJson(user.legacy, {})),
    ]);
    return mapUser(result.rows[0]);
  }

  async createEmailUser(email, ref = '') {
    return this.upsert(defaultEmailUser(email, ref));
  }

  async updateLastSeen(id) {
    const result = await this.adapter.query(
      'UPDATE apg_identity_users SET last_seen_at = now(), updated_at = now() WHERE id = $1 RETURNING *',
      [safeString(id, 260)],
    );
    return mapUser(result.rows[0]);
  }
}
