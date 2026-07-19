import { defaultEmailUser, normalizeEmail, safeString } from './IdentityRepositoryUtils.js';

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

  async linkTelegram({ telegramId, userId, telegram = {} }) {
    const user = await this.users.get(userId);
    if (!user) throw Object.assign(new Error('Аккаунт не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    const existing = await this.links.get('telegram', telegramId);
    if (existing?.userId && existing.userId !== String(userId)) {
      throw Object.assign(new Error('Этот Telegram уже привязан к другому аккаунту.'), { statusCode: 409, code: 'TELEGRAM_ALREADY_USED' });
    }
    await this.links.set({ provider: 'telegram', providerUserId: telegramId, userId, canonicalUserId: user.canonicalUserId || userId, metadata: telegram });
    const updated = await this.users.upsert({ ...user, id: userId, linkedTelegram: { ...telegram, tgId: telegramId, linkedAt: new Date().toISOString() } });
    return { userId, canonicalUserId: updated.canonicalUserId || userId, user: updated, source: 'identity_v2_link_telegram' };
  }
}
