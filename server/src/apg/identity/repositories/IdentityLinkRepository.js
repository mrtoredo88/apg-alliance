import { safeString } from './IdentityRepositoryUtils.js';

export class IdentityLinkRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'IdentityLinkRepository';
  }

  async get(provider, providerUserId) {
    const result = await this.adapter.query(
      'SELECT * FROM apg_identity_links WHERE provider = $1 AND provider_user_id = $2 LIMIT 1',
      [safeString(provider, 80), safeString(providerUserId, 260)],
    );
    const row = result.rows[0];
    return row ? {
      id: row.id,
      provider: row.provider,
      providerUserId: row.provider_user_id,
      userId: row.user_id,
      canonicalUserId: row.canonical_user_id,
      metadata: row.metadata || {},
    } : null;
  }

  async set({ provider, providerUserId, userId, canonicalUserId = userId, metadata = {} }) {
    const safeProvider = safeString(provider, 80);
    const safeProviderUserId = safeString(providerUserId, 260);
    const id = `${safeProvider}:${safeProviderUserId}`;
    await this.adapter.query(`
      INSERT INTO apg_identity_links (id, provider, provider_user_id, user_id, canonical_user_id, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        canonical_user_id = EXCLUDED.canonical_user_id,
        metadata = apg_identity_links.metadata || EXCLUDED.metadata,
        updated_at = now()
    `, [id, safeProvider, safeProviderUserId, safeString(userId, 260), safeString(canonicalUserId, 260), JSON.stringify(metadata)]);
    return this.get(safeProvider, safeProviderUserId);
  }
}
