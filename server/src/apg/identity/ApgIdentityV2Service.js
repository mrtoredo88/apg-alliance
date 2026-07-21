import { getPrimaryRole, getUserRoles } from '../../../../server-shared/role-engine.js';
import { normalizeEmail, safeString } from './repositories/IdentityRepositoryUtils.js';

function defaultFlags(flags = {}) {
  return {
    identityProvider: process.env.IDENTITY_PROVIDER || flags.IDENTITY_PROVIDER || flags.identityProvider || 'firebase',
    identityStorage: process.env.IDENTITY_STORAGE || flags.IDENTITY_STORAGE || flags.identityStorage || 'postgres',
  };
}

function classify(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || error?.error || '');
  if (code.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded')) return 'FIRESTORE_RESOURCE_EXHAUSTED';
  if (code === 'IDENTITY_POSTGRES_NOT_CONFIGURED') return code;
  if (code === 'USER_NOT_FOUND' || Number(error?.statusCode) === 404) return 'USER_NOT_FOUND';
  return code || 'IDENTITY_ERROR';
}

function normalizeTelegramId(value) {
  const raw = safeString(value, 260);
  return raw.startsWith('tg_') ? raw.slice(3) : raw;
}

export class ApgIdentityV2Service {
  constructor({ repository, sessionRepository, tokenProvider = null, flags = {}, metrics = null } = {}) {
    this.repository = repository;
    this.sessionRepository = sessionRepository;
    this.tokenProvider = tokenProvider;
    this.flags = defaultFlags(flags);
    this.metrics = metrics || {
      provider: this.flags.identityProvider,
      storage: this.flags.identityStorage,
      repository: repository?.name || 'IdentityRepository',
      yandexReads: 0,
      yandexWrites: 0,
      lastLoginTimeMs: null,
      lastError: null,
      lastSource: null,
    };
  }

  snapshot() {
    return {
      provider: this.flags.identityProvider,
      storage: this.flags.identityStorage,
      repository: this.repository?.name || 'IdentityRepository',
      fallbackEnabled: false,
      dualRead: false,
      dualWrite: false,
      ...this.metrics,
    };
  }

  isPostgresPrimary() {
    return String(this.flags.identityStorage || '').toLowerCase() === 'postgres';
  }

  async resolveEmailIdentity({ email, ref = '', createIfMissing = true } = {}) {
    const startedAt = Date.now();
    const normalized = normalizeEmail(email);
    if (!normalized) throw Object.assign(new Error('Некорректный email.'), { statusCode: 400, code: 'INVALID_EMAIL' });
    try {
      this.metrics.yandexReads += 1;
      const identity = await this.repository.resolveByEmail(normalized);
      if (!identity && createIfMissing) {
        this.metrics.yandexWrites += 1;
        const created = await this.repository.createEmailIdentity({ email: normalized, ref });
        this.metrics.lastLoginTimeMs = Date.now() - startedAt;
        this.metrics.lastSource = created.source || 'identity_v2_created';
        return created;
      }
      if (!identity?.userId) throw Object.assign(new Error('Пользователь не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
      this.metrics.yandexWrites += 1;
      await this.repository.users.updateLastSeen(identity.userId).catch(() => {});
      this.metrics.lastLoginTimeMs = Date.now() - startedAt;
      this.metrics.lastSource = identity.source || 'identity_v2';
      return identity;
    } catch (error) {
      this.metrics.lastLoginTimeMs = Date.now() - startedAt;
      this.metrics.lastError = classify(error);
      throw error;
    }
  }

  async resolveTelegramIdentity({ telegramId, telegram = {}, createIfMissing = true } = {}) {
    const startedAt = Date.now();
    const normalizedTelegramId = normalizeTelegramId(telegramId);
    if (!normalizedTelegramId) {
      const error = Object.assign(new Error('Некорректный Telegram ID.'), { statusCode: 400, code: 'INVALID_TELEGRAM_ID' });
      this.metrics.lastError = classify(error);
      throw error;
    }
    try {
      let identity = await this.repository.resolveByProvider('telegram', normalizedTelegramId);
      if (!identity && createIfMissing) {
        this.metrics.yandexWrites += 1;
        identity = await this.repository.createTelegramIdentity({ telegramId: normalizedTelegramId, telegram });
      }
      if (!identity?.userId) {
        const error = Object.assign(new Error('Пользователь не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
        this.metrics.lastError = classify(error);
        throw error;
      }
      this.metrics.yandexWrites += 1;
      await this.repository.users.updateLastSeen(identity.userId).catch(() => {});
      this.metrics.lastLoginTimeMs = Date.now() - startedAt;
      this.metrics.lastSource = identity.source || 'identity_v2';
      return {
        ...identity,
        identityId: identity.identityId || `telegram:${normalizedTelegramId}`,
        source: 'identity_v2_telegram_resolve',
      };
    } catch (error) {
      this.metrics.lastLoginTimeMs = Date.now() - startedAt;
      this.metrics.lastError = classify(error);
      throw error;
    }
  }

  async linkEmail({ email, userId, firebaseUid = '' }) {
    const result = await this.repository.linkEmail({ email, userId, firebaseUid });
    this.metrics.yandexWrites += 2;
    return result;
  }

  async linkTelegram({ telegramId, userId, telegram = {}, firebaseUid = '' } = {}) {
    const normalizedTelegramId = normalizeTelegramId(telegramId);
    const normalizedUserId = safeString(userId, 260);
    let result = null;
    try {
      result = await this.repository.linkTelegram({
        telegramId: normalizedTelegramId,
        userId: normalizedUserId,
        telegram,
      });
    } catch (error) {
      throw error;
    }

    const persistedLink = await this.repository.links.get('telegram', normalizedTelegramId).catch(() => null);
    const persistedTelegramId = normalizeTelegramId(
      persistedLink?.providerUserId || persistedLink?.metadata?.tgId || persistedLink?.metadata?.telegramId || '',
    );
    const requestedTelegramId = normalizeTelegramId(
      telegram?.tgId || telegram?.telegramId || normalizedTelegramId,
    );
      if (
        !persistedLink
        || String(persistedLink.userId || '') !== normalizedUserId
        || !persistedTelegramId
        || persistedTelegramId !== requestedTelegramId
      ) {
      const error = Object.assign(
        new Error('Не удалось надежно сохранить привязку Telegram.'),
        { statusCode: 500, code: 'TELEGRAM_LINK_PERSISTENCE_FAILED' },
      );
      this.metrics.lastError = classify(error);
      throw error;
    }

    this.metrics.yandexWrites += 2;
    return result;
  }

  async getUser(userId) {
    this.metrics.yandexReads += 1;
    return typeof this.repository.getUser === 'function'
      ? this.repository.getUser(userId)
      : this.repository.users.get(userId);
  }

  async createSession(input) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.create(input);
  }

  async putEmailOtp(input) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.putEmailOtp(input);
  }

  async getEmailOtp(email) {
    this.metrics.yandexReads += 1;
    return this.sessionRepository.getEmailOtp(email);
  }

  async incrementEmailOtpAttempts(email) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.incrementEmailOtpAttempts(email);
  }

  async deleteEmailOtp(email) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.deleteEmailOtp(email);
  }

  async putEmailVerifyToken(input) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.putEmailVerifyToken(input);
  }

  async consumeEmailVerifyToken(token) {
    this.metrics.yandexWrites += 1;
    return this.sessionRepository.consumeEmailVerifyToken(token);
  }

  async markEmailVerified(userId) {
    this.metrics.yandexWrites += 1;
    return this.repository.users.markEmailVerified(userId);
  }

  async createCustomToken(userId, user = {}) {
    const role = getPrimaryRole(user);
    const roles = getUserRoles(user);
    return this.tokenProvider.authenticate({
      provider: 'customToken',
      uid: String(userId),
      claims: {
        role,
        ...(roles.length ? { roles } : {}),
        ...(role === 'owner' ? { owner: true } : {}),
        ...(['owner', 'super_admin', 'admin'].includes(role) ? { admin: true } : {}),
      },
    });
  }
}
