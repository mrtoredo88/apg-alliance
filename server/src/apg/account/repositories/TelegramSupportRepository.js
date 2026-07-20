import { safeString } from './AccountRepositoryUtils.js';

export class TelegramSupportRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'TelegramSupportRepository';
  }

  async get(telegramId) {
    const result = await this.adapter.query('SELECT * FROM apg_account_telegram_links WHERE telegram_id = $1 LIMIT 1', [safeString(telegramId, 120)]);
    const row = result.rows[0];
    return row ? {
      telegramId: row.telegram_id,
      userId: row.user_id,
      canonicalUserId: row.canonical_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } : null;
  }

  async upsert({ telegramId, userId, canonicalUserId = userId, metadata = {} }) {
    const result = await this.adapter.query(`
      INSERT INTO apg_account_telegram_links (telegram_id, user_id, canonical_user_id, metadata, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, now())
      ON CONFLICT (telegram_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        canonical_user_id = EXCLUDED.canonical_user_id,
        metadata = apg_account_telegram_links.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING *
    `, [safeString(telegramId, 120), safeString(userId, 260), safeString(canonicalUserId, 260), JSON.stringify(metadata || {})]);
    return {
      telegramId: result.rows[0].telegram_id,
      userId: result.rows[0].user_id,
      canonicalUserId: result.rows[0].canonical_user_id,
      metadata: result.rows[0].metadata || {},
    };
  }
}
