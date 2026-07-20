import { mapCabinet, safeString } from './AccountRepositoryUtils.js';

export class CabinetRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'CabinetRepository';
  }

  async listByUser(userId) {
    const result = await this.adapter.query(`
      SELECT * FROM apg_account_cabinets
      WHERE user_id = $1 AND status = 'active'
      ORDER BY type ASC, created_at ASC
    `, [safeString(userId, 260)]);
    return result.rows.map(mapCabinet).filter(Boolean);
  }

  async upsert(cabinet = {}) {
    const type = safeString(cabinet.type, 60);
    const entityId = safeString(cabinet.entityId || cabinet.entity_id, 260);
    const userId = safeString(cabinet.userId || cabinet.user_id, 260);
    const id = safeString(cabinet.id || `${type}:${entityId}:${userId}`, 520);
    const result = await this.adapter.query(`
      INSERT INTO apg_account_cabinets (id, user_id, type, role, entity_id, status, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        type = EXCLUDED.type,
        role = EXCLUDED.role,
        entity_id = EXCLUDED.entity_id,
        status = EXCLUDED.status,
        metadata = apg_account_cabinets.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING *
    `, [id, userId, type, safeString(cabinet.role || 'owner', 80), entityId, safeString(cabinet.status || 'active', 60), JSON.stringify(cabinet.metadata || {})]);
    return mapCabinet(result.rows[0]);
  }
}
