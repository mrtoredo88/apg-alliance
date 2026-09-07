import { mapCabinet, safeString } from './AccountRepositoryUtils.js';

export class CabinetRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'CabinetRepository';
  }

  async listByUser(userId) {
    const result = await this.adapter.query(`
      SELECT * FROM apg_account_cabinets
      WHERE status = 'active'
        AND user_id IN (
          SELECT $1
          UNION
          SELECT id FROM apg_identity_users
          WHERE id = $1 OR canonical_user_id = $1
        )
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

  async claimOwnedEntitiesByEmail({ userId, email } = {}) {
    const normalizedUserId = safeString(userId, 260);
    const normalizedEmail = safeString(email, 220).toLowerCase();
    if (!normalizedUserId || !normalizedEmail) return [];
    const result = await this.adapter.query(`
      WITH owned_entities AS (
        SELECT document_id AS entity_id, 'partner'::text AS cabinet_type
        FROM apg_app_documents
        WHERE collection_name = 'partners'
          AND parent_path = ''
          AND lower(COALESCE(data->>'ownerEmail', data->>'connectionEmail', '')) = $2
        UNION ALL
        SELECT document_id, 'expert'
        FROM apg_app_documents
        WHERE collection_name = 'experts'
          AND parent_path = ''
          AND lower(COALESCE(data->>'ownerEmail', data->>'connectionEmail', '')) = $2
      ), inserted AS (
        INSERT INTO apg_account_cabinets (id, user_id, type, role, entity_id, status, metadata, updated_at)
        SELECT cabinet_type || ':' || entity_id || ':' || $1,
               $1, cabinet_type, 'owner', entity_id, 'active',
               '{"source":"verified-owner-email","runtime":true}'::jsonb, now()
        FROM owned_entities
        ON CONFLICT (id) DO UPDATE SET
          status = 'active',
          metadata = apg_account_cabinets.metadata || EXCLUDED.metadata,
          updated_at = now()
        RETURNING *
      )
      SELECT * FROM inserted ORDER BY type ASC, entity_id ASC
    `, [normalizedUserId, normalizedEmail]);
    return result.rows.map(mapCabinet).filter(Boolean);
  }
}
