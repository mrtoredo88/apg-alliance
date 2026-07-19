import crypto from 'node:crypto';
import { normalizeEmail, safeString } from './IdentityRepositoryUtils.js';

function hash(value) {
  const raw = safeString(value, 500);
  return raw ? crypto.createHash('sha256').update(raw).digest('hex') : '';
}

export class SessionRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'SessionRepository';
  }

  async create({ userId, refreshToken = '', device = {}, platform = '' }) {
    const id = `sess_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
    await this.adapter.query(`
      INSERT INTO apg_identity_sessions (id, user_id, refresh_token_hash, device, platform, last_seen_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, now())
    `, [id, safeString(userId, 260), hash(refreshToken) || null, JSON.stringify(device || {}), safeString(platform, 120) || null]);
    return { id, userId: safeString(userId, 260), status: 'active' };
  }

  async revoke(sessionId) {
    await this.adapter.query(
      "UPDATE apg_identity_sessions SET status = 'revoked', revoked_at = now() WHERE id = $1",
      [safeString(sessionId, 260)],
    );
    return { id: safeString(sessionId, 260), status: 'revoked' };
  }

  async putEmailOtp({ email, code, expiresAt }) {
    const normalized = normalizeEmail(email);
    await this.adapter.query(`
      INSERT INTO apg_identity_email_otps (email, code, attempts, expires_at, updated_at)
      VALUES ($1, $2, 0, $3, now())
      ON CONFLICT (email) DO UPDATE SET
        code = EXCLUDED.code,
        attempts = 0,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    `, [normalized, safeString(code, 20), expiresAt]);
    return { email: normalized };
  }

  async getEmailOtp(email) {
    const normalized = normalizeEmail(email);
    const result = await this.adapter.query('SELECT * FROM apg_identity_email_otps WHERE email = $1 LIMIT 1', [normalized]);
    const row = result.rows[0];
    return row ? {
      email: row.email,
      code: row.code,
      attempts: Number(row.attempts || 0),
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    } : null;
  }

  async incrementEmailOtpAttempts(email) {
    await this.adapter.query('UPDATE apg_identity_email_otps SET attempts = attempts + 1, updated_at = now() WHERE email = $1', [normalizeEmail(email)]);
  }

  async deleteEmailOtp(email) {
    await this.adapter.query('DELETE FROM apg_identity_email_otps WHERE email = $1', [normalizeEmail(email)]);
  }

  async putEmailVerifyToken({ token, email, userId, expiresAt }) {
    await this.adapter.query(`
      INSERT INTO apg_identity_email_verify_tokens (token, email, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (token) DO UPDATE SET
        email = EXCLUDED.email,
        user_id = EXCLUDED.user_id,
        expires_at = EXCLUDED.expires_at
    `, [safeString(token, 260), normalizeEmail(email), safeString(userId, 260), expiresAt]);
    return { token: safeString(token, 260), userId: safeString(userId, 260) };
  }

  async consumeEmailVerifyToken(token) {
    const normalized = safeString(token, 260);
    const result = await this.adapter.query('DELETE FROM apg_identity_email_verify_tokens WHERE token = $1 RETURNING *', [normalized]);
    const row = result.rows[0];
    return row ? {
      token: row.token,
      email: row.email,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    } : null;
  }
}
