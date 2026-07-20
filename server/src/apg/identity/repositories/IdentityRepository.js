import { defaultEmailUser, normalizeEmail, safeString } from './IdentityRepositoryUtils.js';

function normalizeTelegramId(value) {
  const raw = safeString(value, 260);
  return raw.startsWith('tg_') ? raw.slice(3) : raw;
}

function normalizeIdentityProviderValue(provider) {
  return safeString(provider, 80).toLowerCase();
}

function ensureCanonicalId(user) {
  return safeString(user?.canonicalUserId || user?.canonical_user_id || user?.id, 260);
}

export class IdentityRepository {
  constructor({ users, emails, links, roles, sessions }) {
    this.name = 'IdentityRepository';
    this.users = users;
    this.emails = emails;
    this.links = links;
    this.roles = roles;
    this.sessions = sessions;
  }

  async resolveByEmail(email) {
    const normalized = normalizeEmail(email);
    const index = await this.emails.get(normalized);
    if (index?.userId) {
      const user = await this.users.get(index.userId);
      if (user) return { userId: user.id, canonicalUserId: user.canonicalUserId || user.id, user, source: 'identity_v2_email_index' };
    }
    const users = await this.users.findByEmail(normalized);
    if (users.length) {
      const user = users[0];
      await this.emails.set({ email: normalized, userId: user.id, canonicalUserId: user.canonicalUserId || user.id });
      return { userId: user.id, canonicalUserId: user.canonicalUserId || user.id, user, source: 'identity_v2_user_email' };
    }
    return null;
  }

  async resolveByProvider(provider, providerUserId) {
    const normalizedProvider = normalizeIdentityProviderValue(provider);
    const normalizedProviderUserId = normalizedProvider === 'telegram' ? normalizeTelegramId(providerUserId) : safeString(providerUserId, 260);
    const link = await this.links.get(normalizedProvider, normalizedProviderUserId);
    if (!link?.userId) return null;
    const user = await this.users.get(link.userId);
    return user
      ? {
          userId: user.id,
          canonicalUserId: user.canonicalUserId || user.id,
          user,
          link,
          identityId: link?.id || `${provider}:${normalizedProviderUserId}`,
          source: 'identity_v2_provider_index',
        }
      : null;
  }

  async createTelegramIdentity({ telegramId, telegram = {} }) {
    const normalized = normalizeTelegramId(telegramId);
    const userId = `tg_${normalized}`;
    const user = await this.users.upsert({
      id: userId,
      canonicalUserId: userId,
      authProvider: 'telegram',
      displayName: telegram.firstName || telegram.username || telegram.tgId || telegram.telegramId || '',
      firstName: telegram.firstName || null,
      lastName: telegram.lastName || null,
      photo: telegram.photo || telegram.photo_url || null,
      role: 'user',
      roles: ['user'],
      email: '',
      telegramId: normalized,
      linkedTelegram: {
        tgId: normalized,
        telegramId: normalized,
        firstName: telegram.firstName || null,
        lastName: telegram.lastName || null,
        username: telegram.username || null,
        linkedAt: new Date().toISOString(),
        ...telegram,
      },
      identityStatus: 'canonical',
      identityVersion: 'identity-v2',
    });
    await this.links.set({
      provider: 'telegram',
      providerUserId: normalized,
      userId,
      canonicalUserId: user.canonicalUserId || userId,
      metadata: {
        providerUserId: normalized,
        firstName: telegram.firstName || null,
        lastName: telegram.lastName || null,
        username: telegram.username || null,
      },
    });
    return {
      userId: user.id,
      canonicalUserId: user.canonicalUserId || user.id,
      user,
      identityId: `telegram:${normalized}`,
      source: 'identity_v2_created',
    };
  }

  async createEmailIdentity({ email, ref = '' }) {
    const user = await this.users.upsert(defaultEmailUser(email, ref));
    await this.emails.set({ email, userId: user.id, canonicalUserId: user.canonicalUserId || user.id });
    await this.links.set({ provider: 'email', providerUserId: normalizeEmail(email), userId: user.id, canonicalUserId: user.canonicalUserId || user.id });
    await this.roles.set({ userId: user.id, roles: user.roles || ['user'], primaryRole: user.role || 'user' });
    return { userId: user.id, canonicalUserId: user.canonicalUserId || user.id, user, source: 'identity_v2_created' };
  }

  async importLegacyIdentity(identity = {}) {
    const userId = safeString(identity.userId || identity.canonicalUserId, 260);
    if (!userId) return null;
    const user = await this.users.upsert({
      ...(identity.user || {}),
      id: userId,
      canonicalUserId: identity.canonicalUserId || userId,
      legacy: {
        source: identity.source || 'legacy',
        candidates: identity.candidates || [],
        importedAt: new Date().toISOString(),
      },
    });
    const email = normalizeEmail(user.email || user.linkedEmail || identity.email || identity.user?.email || identity.user?.linkedEmail);
    if (email) {
      await this.emails.set({ email, userId: user.id, canonicalUserId: user.canonicalUserId || user.id, legacy: { importedAt: new Date().toISOString() } });
      await this.links.set({ provider: 'email', providerUserId: email, userId: user.id, canonicalUserId: user.canonicalUserId || user.id, metadata: { importedFrom: identity.source || 'legacy' } });
    }
    const telegramId = safeString(user.linkedTelegram?.tgId || user.linkedTelegram?.telegramId || '', 120);
    if (telegramId) {
      await this.links.set({ provider: 'telegram', providerUserId: telegramId, userId: user.id, canonicalUserId: user.canonicalUserId || user.id, metadata: user.linkedTelegram });
    }
    await this.roles.set({ userId: user.id, roles: user.roles || [user.role || 'user'], primaryRole: user.role || 'user' });
    return { userId: user.id, canonicalUserId: user.canonicalUserId || user.id, user, source: 'identity_v2_imported' };
  }

  async linkEmail({ email, userId, firebaseUid = '' }) {
    const user = await this.users.get(userId);
    if (!user) throw Object.assign(new Error('Аккаунт не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    const existing = await this.resolveByEmail(email);
    if (existing?.userId && existing.userId !== String(userId)) {
      throw Object.assign(new Error('Этот email уже привязан к другому аккаунту.'), { statusCode: 409, code: 'EMAIL_ALREADY_USED' });
    }
    await this.emails.set({ email, userId, canonicalUserId: user.canonicalUserId || userId, firebaseUid });
    await this.links.set({ provider: 'email', providerUserId: normalizeEmail(email), userId, canonicalUserId: user.canonicalUserId || userId });
    const updated = await this.users.upsert({ ...user, id: userId, linkedEmail: normalizeEmail(email), email: user.email || normalizeEmail(email) });
    return { userId, canonicalUserId: updated.canonicalUserId || userId, user: updated, source: 'identity_v2_link_email' };
  }

  async linkTelegram({ telegramId, userId, telegram = {}, debug = null }) {
    const normalizedTelegramId = normalizeTelegramId(telegramId);
    const mark = typeof debug?.mark === 'function' ? debug.mark : () => {};
    const requestId = safeString(debug?.requestId, 120);
    const user = await this.users.get(userId);
    if (!user) {
      mark('identityRepository.linkTelegram.entered', 'FAIL', {
        requestId,
        userId: safeString(userId, 260),
        telegramId: normalizedTelegramId,
        reason: 'user_not_found',
      });
      throw Object.assign(new Error('Аккаунт не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    const adapter = this.links.adapter;
    const identityId = `telegram:${normalizedTelegramId}`;
    const payload = {
      ...telegram,
      tgId: normalizedTelegramId,
      telegramId: normalizedTelegramId,
      linkedAt: new Date().toISOString(),
    };
    mark('identityRepository.linkTelegram.entered', 'PASS', {
      requestId,
      userId: safeString(userId, 260),
      telegramId: normalizedTelegramId,
    });

    let repositoryLink = null;
    try {
      await adapter.transaction(async client => {
        const upserted = await client.query(
          `INSERT INTO apg_identity_links (id, provider, provider_user_id, user_id, canonical_user_id, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
           ON CONFLICT (id) DO UPDATE SET
             metadata = CASE
               WHEN apg_identity_links.user_id = EXCLUDED.user_id THEN apg_identity_links.metadata || EXCLUDED.metadata
               ELSE apg_identity_links.metadata
             END,
             canonical_user_id = CASE
               WHEN apg_identity_links.user_id = EXCLUDED.user_id THEN COALESCE(NULLIF(EXCLUDED.canonical_user_id, ''), apg_identity_links.canonical_user_id)
               ELSE apg_identity_links.canonical_user_id
             END,
             user_id = apg_identity_links.user_id,
             updated_at = now()
           RETURNING id, user_id, canonical_user_id, metadata
           `,
          [
            identityId,
            'telegram',
            normalizedTelegramId,
            safeString(userId, 260),
            ensureCanonicalId(user),
            JSON.stringify(payload),
          ],
        );
        if (!upserted?.rows?.length || String(upserted.rows[0]?.user_id || '') !== String(safeString(userId, 260))) {
          mark('identityRepository.linkTelegram.sql_write', 'FAIL', {
            requestId,
            userId: safeString(userId, 260),
            telegramId: normalizedTelegramId,
            reason: 'owner_or_conflict',
          });
          const error = Object.assign(
            new Error('Этот Telegram уже привязан к другому аккаунту.'),
            { statusCode: 409, code: 'TELEGRAM_ALREADY_USED' },
          );
          throw error;
        }

        mark('identityRepository.linkTelegram.sql_write', 'PASS', {
          requestId,
          userId: safeString(userId, 260),
          telegramId: normalizedTelegramId,
        });

        const committed = await client.query(
          'SELECT id, provider, provider_user_id, user_id, canonical_user_id, metadata FROM apg_identity_links WHERE provider = $1 AND provider_user_id = $2 LIMIT 1',
          ['telegram', normalizedTelegramId],
        );
        const row = committed.rows?.[0] || null;
        if (!row) {
          mark('identityRepository.linkTelegram.tx_read', 'FAIL', {
            requestId,
            telegramId: normalizedTelegramId,
            reason: 'missing_commit_row',
          });
          const error = Object.assign(new Error('Не удалось зафиксировать ссылку Telegram в БД.'), {
            statusCode: 500,
            code: 'TELEGRAM_LINK_PERSISTENCE_FAILED',
          });
          throw error;
        }
        repositoryLink = {
          id: row.id,
          provider: row.provider,
          providerUserId: row.provider_user_id,
          userId: row.user_id,
          canonicalUserId: row.canonical_user_id,
          metadata: row.metadata || {},
        };
        mark('identityRepository.linkTelegram.tx_read', 'PASS', {
          requestId,
          telegramId: normalizedTelegramId,
          linkUserId: safeString(row.user_id, 260),
        });
      });
    } catch (error) {
      mark('identityRepository.linkTelegram.transaction', 'FAIL', {
        requestId,
        userId: safeString(userId, 260),
        telegramId: normalizedTelegramId,
        publicError: safeString(error?.message || error?.code || error?.error || '', 220),
        internalCode: safeString(error?.code || error?.statusCode || error?.error || 'unknown', 120),
      });
      throw error;
    }
    mark('identityRepository.linkTelegram.transaction', 'PASS', {
      requestId,
      userId: safeString(userId, 260),
      telegramId: normalizedTelegramId,
    });

    await this.users.upsert({ ...user, id: userId, linkedTelegram: { ...telegram, tgId: normalizedTelegramId, linkedAt: new Date().toISOString() } });

    const persistedLink = await this.links.get('telegram', normalizedTelegramId);
    if (!persistedLink || String(persistedLink.userId || '') !== String(userId)) {
      mark('identityRepository.linkTelegram.persistence_verified', 'FAIL', {
        requestId,
        userId: safeString(userId, 260),
        telegramId: normalizedTelegramId,
        reason: !persistedLink ? 'missing_link' : 'owner_mismatch',
      });
      throw Object.assign(
        new Error('Не удалось надежно сохранить ссылку Telegram.'),
        { statusCode: 500, code: 'TELEGRAM_LINK_PERSISTENCE_FAILED' },
      );
    }

    const persistedUser = await this.users.get(userId);
    const persistedTelegram = persistedUser?.linkedTelegram && typeof persistedUser.linkedTelegram === 'object'
      ? persistedUser.linkedTelegram
      : null;
    if (
      !persistedUser
      || normalizeTelegramId(persistedTelegram?.tgId || persistedTelegram?.telegramId || '') !== normalizedTelegramId
    ) {
      mark('identityRepository.linkTelegram.persistence_verified', 'FAIL', {
        requestId,
        userId: safeString(userId, 260),
        telegramId: normalizedTelegramId,
        persistedUserId: safeString(persistedUser?.id || '', 260),
        persistedTelegramId: safeString(persistedTelegram?.tgId || persistedTelegram?.telegramId || '', 120),
      });
      throw Object.assign(
        new Error('Не удалось надежно сохранить привязку Telegram.'),
        { statusCode: 500, code: 'TELEGRAM_LINK_PERSISTENCE_FAILED' },
      );
    }

    const updated = persistedUser;
    mark('identityRepository.linkTelegram.persistence_verified', 'PASS', {
      requestId,
      userId: safeString(userId, 260),
      telegramId: normalizedTelegramId,
      source: 'normalized_repository_readback',
    });
    return {
      userId,
      canonicalUserId: updated.canonicalUserId || userId,
      user: updated,
      link: repositoryLink || { userId: updated.id || userId, providerUserId: normalizedTelegramId },
      identityId,
      source: 'identity_v2_link_telegram',
    };
  }
}
