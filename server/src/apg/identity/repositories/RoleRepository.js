import { normalizeRoles, safeString } from './IdentityRepositoryUtils.js';

export class RoleRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'RoleRepository';
  }

  async get(userId) {
    const result = await this.adapter.query('SELECT * FROM apg_identity_roles WHERE user_id = $1 LIMIT 1', [safeString(userId, 260)]);
    const row = result.rows[0];
    return row ? {
      userId: row.user_id,
      primaryRole: row.primary_role || 'user',
      roles: Array.isArray(row.roles) ? row.roles : ['user'],
      claims: row.claims || {},
    } : null;
  }

  async set({ userId, roles = ['user'], primaryRole = roles[0] || 'user', claims = {} }) {
    const normalizedRoles = normalizeRoles(roles);
    await this.adapter.query(`
      INSERT INTO apg_identity_roles (user_id, primary_role, roles, claims, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET
        primary_role = EXCLUDED.primary_role,
        roles = EXCLUDED.roles,
        claims = EXCLUDED.claims,
        updated_at = now()
    `, [safeString(userId, 260), safeString(primaryRole, 80) || 'user', JSON.stringify(normalizedRoles), JSON.stringify(claims)]);
    return this.get(userId);
  }
}
