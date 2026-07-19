import { normalizeEmail, safeString } from './IdentityRepositoryUtils.js';

export class EmailIndexRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'EmailIndexRepository';
  }

  async get(email) {
    const normalized = normalizeEmail(email);
    const result = await this.adapter.query('SELECT * FROM apg_identity_email_index WHERE email = $1 LIMIT 1', [normalized]);
    const row = result.rows[0];
    return row ? {
      email: row.email,
      userId: row.user_id,
      canonicalUserId: row.canonical_user_id,
      firebaseUid: row.firebase_uid || '',
      legacy: row.legacy || {},
    } : null;
  }

  async set({ email, userId, canonicalUserId = userId, firebaseUid = '', legacy = {} }) {
    const normalized = normalizeEmail(email);
    await this.adapter.query(`
      INSERT INTO apg_identity_email_index (email, user_id, canonical_user_id, firebase_uid, legacy, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        canonical_user_id = EXCLUDED.canonical_user_id,
        firebase_uid = COALESCE(EXCLUDED.firebase_uid, apg_identity_email_index.firebase_uid),
        legacy = apg_identity_email_index.legacy || EXCLUDED.legacy,
        updated_at = now()
    `, [normalized, safeString(userId, 260), safeString(canonicalUserId, 260), safeString(firebaseUid, 260) || null, JSON.stringify(legacy)]);
    return this.get(normalized);
  }
}
