import { randomUUID } from 'node:crypto';
import { PostgresAccountAdapter } from '../account/adapters/PostgresAccountAdapter.js';
import { ServerDataAdapter } from './ServerDataAdapter.js';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.document_id,
    ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {}),
  };
}

export class PostgresDataAdapter extends ServerDataAdapter {
  constructor(adapter = new PostgresAccountAdapter()) {
    super('postgres-data');
    this.adapter = adapter;
  }

  async health() {
    const result = await this.adapter.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async getDocument(collectionName, id, { parentPath = '' } = {}) {
    const result = await this.adapter.query(
      `SELECT * FROM apg_app_documents
       WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3 LIMIT 1`,
      [clean(collectionName, 160), clean(parentPath, 700), clean(id, 500)],
    );
    return mapRow(result.rows[0]);
  }

  async listDocuments(collectionName, { limit = 100, parentPath = '', orderBy = 'updated_at', direction = 'desc' } = {}) {
    const safeOrder = orderBy === 'created_at' ? 'created_at' : 'updated_at';
    const safeDirection = String(direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const result = await this.adapter.query(
      `SELECT * FROM apg_app_documents
       WHERE collection_name = $1 AND parent_path = $2
       ORDER BY ${safeOrder} ${safeDirection}, document_id ASC
       LIMIT $3`,
      [clean(collectionName, 160), clean(parentPath, 700), Math.max(1, Math.min(10000, Number(limit) || 100))],
    );
    return result.rows.map(mapRow);
  }

  async setDocument(collectionName, id, data, { merge = true, parentPath = '' } = {}) {
    const documentId = clean(id, 500);
    const payload = { ...(data || {}), id: documentId };
    const result = await this.adapter.query(
      `INSERT INTO apg_app_documents (collection_name, document_id, parent_path, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (collection_name, parent_path, document_id) DO UPDATE SET
         data = CASE WHEN $5::boolean
           THEN apg_app_documents.data || EXCLUDED.data
           ELSE EXCLUDED.data
         END,
         updated_at = now()
       RETURNING *`,
      [clean(collectionName, 160), documentId, clean(parentPath, 700), JSON.stringify(payload), Boolean(merge)],
    );
    return mapRow(result.rows[0]);
  }

  async updateDocument(collectionName, id, data, options = {}) {
    const existing = await this.getDocument(collectionName, id, options);
    if (!existing) throw Object.assign(new Error('Document not found.'), { code: 'DOCUMENT_NOT_FOUND' });
    return this.setDocument(collectionName, id, data, { ...options, merge: true });
  }

  async addDocument(collectionName, data, options = {}) {
    const id = clean(data?.id, 500) || randomUUID();
    return this.setDocument(collectionName, id, data, { ...options, merge: false });
  }

}
