import { safeString } from './IdentityRepositoryUtils.js';

export class IdentityLinkRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'IdentityLinkRepository';
  }

  normalizeProviderUserId(provider, providerUserId) {
    const value = safeString(providerUserId, 260);
    if (provider !== 'telegram') return value;
    return value.startsWith('tg_') ? value.slice(3) : value;
  }

  async get(provider, providerUserId) {
    const safeProvider = safeString(provider, 80);
    const safeProviderUserId = this.normalizeProviderUserId(safeProvider, providerUserId);
    const result = await this.adapter.query(
      'SELECT * FROM apg_identity_links WHERE provider = $1 AND provider_user_id = $2 LIMIT 1',
      [safeProvider, safeProviderUserId],
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
    const safeProviderUserId = this.normalizeProviderUserId(safeProvider, providerUserId);
    const safeUserId = safeString(userId, 260);
    const id = `${safeProvider}:${safeProviderUserId}`;
    const safeCanonicalUserId = safeString(canonicalUserId, 260);
    await this.adapter.query(`
      INSERT INTO apg_identity_links (id, provider, provider_user_id, user_id, canonical_user_id, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        user_id = apg_identity_links.user_id,
        canonical_user_id = CASE
          WHEN apg_identity_links.user_id = EXCLUDED.user_id THEN COALESCE(NULLIF(EXCLUDED.canonical_user_id, ''), apg_identity_links.canonical_user_id)
          ELSE apg_identity_links.canonical_user_id
        END,
        metadata = CASE
          WHEN apg_identity_links.user_id = EXCLUDED.user_id THEN apg_identity_links.metadata || EXCLUDED.metadata
          ELSE apg_identity_links.metadata
        END,
        updated_at = now()
    `, [id, safeProvider, safeProviderUserId, safeUserId, safeCanonicalUserId, JSON.stringify(metadata)]);
    return this.get(safeProvider, safeProviderUserId);
  }
}
