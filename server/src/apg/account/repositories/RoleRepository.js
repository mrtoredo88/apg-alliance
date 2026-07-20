import { mapRoles, normalizePermissions, normalizeRoles, safeString } from './AccountRepositoryUtils.js';

export class AccountRoleRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'AccountRoleRepository';
  }

  async get(userId) {
    const result = await this.adapter.query('SELECT * FROM apg_account_roles WHERE user_id = $1 LIMIT 1', [safeString(userId, 260)]);
    return mapRoles(result.rows[0]);
  }

  async set({ userId, roles = ['user'], primaryRole = '', permissions = [], claims = {} }) {
    const normalizedRoles = normalizeRoles(roles);
    const normalizedPermissions = normalizePermissions(permissions);
    const result = await this.adapter.query(`
      INSERT INTO apg_account_roles (user_id, primary_role, roles, permissions, claims, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET
        primary_role = EXCLUDED.primary_role,
        roles = EXCLUDED.roles,
        permissions = EXCLUDED.permissions,
        claims = EXCLUDED.claims,
        updated_at = now()
      RETURNING *
    `, [
      safeString(userId, 260),
      safeString(primaryRole || normalizedRoles[0] || 'user', 80),
      JSON.stringify(normalizedRoles),
      JSON.stringify(normalizedPermissions),
      JSON.stringify(claims || {}),
    ]);
    return mapRoles(result.rows[0]);
  }
}
