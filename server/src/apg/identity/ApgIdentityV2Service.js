import { getPrimaryRole, getUserRoles } from '../../../../server-shared/role-engine.js';
import { normalizeEmail, safeString } from './repositories/IdentityRepositoryUtils.js';

function defaultFlags(flags = {}) {
  return {
    identityProvider: process.env.IDENTITY_PROVIDER || flags.IDENTITY_PROVIDER || flags.identityProvider || 'firebase',
    identityStorage: process.env.IDENTITY_STORAGE || flags.IDENTITY_STORAGE || flags.identityStorage || 'postgres',
    identityFallback: process.env.IDENTITY_FALLBACK ?? flags.IDENTITY_FALLBACK ?? flags.identityFallback ?? '1',
    identityDualWrite: process.env.IDENTITY_DUAL_WRITE ?? flags.IDENTITY_DUAL_WRITE ?? flags.identityDualWrite ?? '1',
    identityDualRead: process.env.IDENTITY_DUAL_READ ?? flags.IDENTITY_DUAL_READ ?? flags.identityDualRead ?? '1',
  };
}

function enabled(value) {
  return !['0', 'false', 'off', 'disabled', 'no'].includes(String(value ?? '').toLowerCase());
}

function classify(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || error?.error || '');
  if (code.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded')) return 'FIRESTORE_RESOURCE_EXHAUSTED';
  if (code === 'IDENTITY_POSTGRES_NOT_CONFIGURED') return code;
  return code || 'IDENTITY_ERROR';
}

export class ApgIdentityV2Service {
  constructor({ repository, sessionRepository, legacySource = null, tokenProvider = null, flags = {}, metrics = null } = {}) {
    this.repository = repository;
    this.sessionRepository = sessionRepository;
    this.legacySource = legacySource;
    this.tokenProvider = tokenProvider;
    this.flags = defaultFlags(flags);
    this.metrics = metrics || {
      provider: this.flags.identityProvider,
      storage: this.flags.identityStorage,
      repository: repository?.name || 'IdentityRepository',
      yandexReads: 0,
      yandexWrites: 0,
      firestoreReads: 0,
      firestoreWrites: 0,
      firestoreFallbacks: 0,
      fallbackCount: 0,
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
      fallbackEnabled: enabled(this.flags.identityFallback),
      dualRead: enabled(this.flags.identityDualRead),
      dualWrite: enabled(this.flags.identityDualWrite),
      ...this.metrics,
      legacy: this.legacySource?.snapshot?.() || null,
    };
  }

  async resolveEmailIdentity({ email, ref = '', createIfMissing = true } = {}) {
    const startedAt = Date.now();
    const normalized = normalizeEmail(email);
    if (!normalized) throw Object.assign(new Error('Некорректный email.'), { statusCode: 400, code: 'INVALID_EMAIL' });
    try {
      let identity = null;
      if (this.repository && enabled(this.flags.identityDualRead)) {
        try {
          this.metrics.yandexReads += 1;
          identity = await this.repository.resolveByEmail(normalized);
        } catch (error) {
          this.metrics.lastError = classify(error);
          if (classify(error) !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
        }
      }
      if (!identity && this.legacySource && enabled(this.flags.identityFallback)) {
        this.metrics.fallbackCount += 1;
        const legacy = await this.legacySource.resolveEmailIdentity({ email: normalized, ref, createIfMissing: false }).catch(error => {
          this.metrics.lastError = classify(error);
          if (classify(error) === 'FIRESTORE_RESOURCE_EXHAUSTED') return null;
          throw error;
        });
        if (legacy?.userId && this.repository) {
          this.metrics.yandexWrites += 1;
          identity = await this.repository.importLegacyIdentity({ ...legacy, email: normalized });
        } else if (legacy?.userId) {
          identity = legacy;
        }
      }
      if (!identity && createIfMissing) {
        try {
          this.metrics.yandexWrites += 1;
          identity = await this.repository.createEmailIdentity({ email: normalized, ref });
          this.dualWriteLegacy(identity).catch(() => {});
        } catch (error) {
          this.metrics.lastError = classify(error);
          if (classify(error) !== 'IDENTITY_POSTGRES_NOT_CONFIGURED') throw error;
          if (!this.legacySource || !enabled(this.flags.identityFallback)) throw error;
          this.metrics.fallbackCount += 1;
          identity = await this.legacySource.resolveEmailIdentity({ email: normalized, ref, createIfMissing });
        }
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

  async dualWriteLegacy(identity) {
    if (!this.legacySource || !enabled(this.flags.identityDualWrite)) return null;
    const user = identity?.user || {};
    const userId = safeString(identity?.userId || identity?.canonicalUserId, 260);
    if (!userId) return null;
    this.metrics.firestoreWrites += 1;
    await this.legacySource.writeUser(userId, {
      ...user,
      canonicalUserId: userId,
      identityStatus: user.identityStatus || 'canonical',
      identityVersion: 'identity-v2-dual-write',
    });
    const email = normalizeEmail(user.email || user.linkedEmail);
    if (email) {
      this.metrics.firestoreWrites += 2;
      await this.legacySource.linkEmail({ email, userId });
    }
    return { ok: true };
  }

  async linkEmail({ email, userId, firebaseUid = '' }) {
    const result = await this.repository.linkEmail({ email, userId, firebaseUid });
    this.metrics.yandexWrites += 2;
    if (this.legacySource && enabled(this.flags.identityDualWrite)) {
      this.legacySource.linkEmail({ email: normalizeEmail(email), userId, firebaseUid }).catch(() => {});
    }
    return result;
  }

  async linkTelegram({ telegramId, userId, telegram = {}, firebaseUid = '' }) {
    const result = await this.repository.linkTelegram({ telegramId, userId, telegram });
    this.metrics.yandexWrites += 2;
    if (this.legacySource && enabled(this.flags.identityDualWrite)) {
      this.legacySource.linkTelegram({ telegramId, userId, telegram, firebaseUid }).catch(() => {});
    }
    return result;
  }

  async getUser(userId) {
    this.metrics.yandexReads += 1;
    return this.repository.users.get(userId);
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
