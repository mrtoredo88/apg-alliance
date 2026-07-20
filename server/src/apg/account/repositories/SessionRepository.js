import crypto from 'node:crypto';
import { mapSession, safeString } from './AccountRepositoryUtils.js';

export class AccountSessionRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'AccountSessionRepository';
  }

  async create({ userId, firebaseUid = '', device = {}, platform = '', expiresAt = null }) {
    const id = `acct_sess_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
    const result = await this.adapter.query(`
      INSERT INTO apg_account_sessions (id, user_id, firebase_uid, device, platform, expires_at, last_seen_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
      RETURNING *
    `, [id, safeString(userId, 260), safeString(firebaseUid, 260) || null, JSON.stringify(device || {}), safeString(platform, 120) || null, expiresAt]);
    return mapSession(result.rows[0]);
  }

  async get(sessionId) {
    const result = await this.adapter.query('SELECT * FROM apg_account_sessions WHERE id = $1 LIMIT 1', [safeString(sessionId, 260)]);
    return mapSession(result.rows[0]);
  }

  async findActiveByUser(userId) {
    const result = await this.adapter.query(`
      SELECT * FROM apg_account_sessions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `, [safeString(userId, 260)]);
    return mapSession(result.rows[0]);
  }

  async touch(sessionId) {
    const result = await this.adapter.query(
      "UPDATE apg_account_sessions SET last_seen_at = now() WHERE id = $1 AND status = 'active' RETURNING *",
      [safeString(sessionId, 260)],
    );
    return mapSession(result.rows[0]);
  }

  async revoke(sessionId) {
    const result = await this.adapter.query(
      "UPDATE apg_account_sessions SET status = 'revoked', revoked_at = now() WHERE id = $1 RETURNING *",
      [safeString(sessionId, 260)],
    );
    return mapSession(result.rows[0]);
  }
}
