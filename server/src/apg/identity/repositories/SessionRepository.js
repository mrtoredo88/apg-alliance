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

  async create({ userId, refreshToken = '', device = {}, platform = '', expiresAt = null }) {
    const id = `sess_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
    await this.adapter.query(`
      INSERT INTO apg_identity_sessions (id, user_id, refresh_token_hash, device, platform, expires_at, last_seen_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
    `, [id, safeString(userId, 260), hash(refreshToken) || null, JSON.stringify(device || {}), safeString(platform, 120) || null, expiresAt]);
    return { id, userId: safeString(userId, 260), status: 'active', expiresAt };
  }

  async createBearerSession({ userId, device = {}, platform = '', ttlDays = 30 }) {
    const token = `apg_${crypto.randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + Math.max(1, Number(ttlDays) || 30) * 86_400_000);
    const session = await this.create({ userId, refreshToken: token, device, platform, expiresAt });
    return { ...session, token };
  }

  async verifyBearerToken(token) {
    const tokenHash = hash(token);
    if (!tokenHash) return null;
    const result = await this.adapter.query(`
      SELECT s.*, u.email, u.display_name, r.primary_role, r.roles, r.claims
      FROM apg_identity_sessions s
      JOIN apg_identity_users u ON u.id = s.user_id
      LEFT JOIN apg_identity_roles r ON r.user_id = s.user_id
      WHERE s.refresh_token_hash = $1
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
      LIMIT 1
    `, [tokenHash]);
    const row = result.rows[0];
    if (!row) return null;
    await this.adapter.query('UPDATE apg_identity_sessions SET last_seen_at = now() WHERE id = $1', [row.id]);
    return {
      uid: row.user_id,
      userId: row.user_id,
      email: row.email || '',
      name: row.display_name || '',
      role: row.primary_role || 'user',
      roles: Array.isArray(row.roles) ? row.roles : ['user'],
      claims: row.claims || {},
      sessionId: row.id,
      provider: 'native-apg',
    };
  }

  async rotateBearerSession({ token, userId, device = {}, platform = '', ttlDays = 30 }) {
    const currentHash = hash(token);
    const nextToken = `apg_${crypto.randomBytes(32).toString('base64url')}`;
    const nextHash = hash(nextToken);
    const expiresAt = new Date(Date.now() + Math.max(1, Number(ttlDays) || 30) * 86_400_000);
    const result = await this.adapter.query(`
      UPDATE apg_identity_sessions
      SET refresh_token_hash = $1, device = $2::jsonb, platform = $3, expires_at = $4, last_seen_at = now()
      WHERE refresh_token_hash = $5 AND user_id = $6 AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING id
    `, [nextHash, JSON.stringify(device || {}), safeString(platform, 120) || null, expiresAt, currentHash, safeString(userId, 260)]);
    if (!result.rowCount) throw Object.assign(new Error('Недействительная сессия.'), { code: 'AUTH_SESSION_INVALID', statusCode: 401 });
    return { id: result.rows[0].id, userId: safeString(userId, 260), status: 'active', token: nextToken, expiresAt };
  }

  async revokeBearerToken(token) {
    const result = await this.adapter.query(
      "UPDATE apg_identity_sessions SET status = 'revoked', revoked_at = now() WHERE refresh_token_hash = $1 RETURNING id",
      [hash(token)],
    );
    return result.rowCount > 0;
  }

  async revoke(sessionId) {
    await this.adapter.query(
      "UPDATE apg_identity_sessions SET status = 'revoked', revoked_at = now() WHERE id = $1",
      [safeString(sessionId, 260)],
    );
    return { id: safeString(sessionId, 260), status: 'revoked' };
  }

  async revokeUser(userId) {
    const result = await this.adapter.query(
      "UPDATE apg_identity_sessions SET status = 'revoked', revoked_at = now() WHERE user_id = $1 AND status = 'active'",
      [safeString(userId, 260)],
    );
    return { userId: safeString(userId, 260), revoked: result.rowCount };
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
