import {
  getAccountFlags,
  isAccountDualReadEnabled,
  isAccountDualWriteEnabled,
  isAccountFallbackEnabled,
  isAccountPostgresPrimary,
} from '../AccountFeatureFlags.js';
import { AccountMetrics } from './AccountMetrics.js';

function now() {
  return Date.now();
}

function normalizeRoles(roleState, profile = {}) {
  const roles = Array.isArray(roleState?.roles) ? roleState.roles : Array.isArray(profile.roles) ? profile.roles : [profile.role || 'user'];
  return [...new Set(roles.map(role => String(role || '').toLowerCase()).filter(Boolean))];
}

export class AccountCoreService {
  constructor({
    profiles,
    roles,
    sessions,
    cabinets,
    telegram,
    fallback = null,
    flags = {},
    metrics = new AccountMetrics(),
  }) {
    this.profiles = profiles;
    this.roles = roles;
    this.sessions = sessions;
    this.cabinets = cabinets;
    this.telegram = telegram;
    this.fallback = fallback;
    this.flags = getAccountFlags(flags);
    this.metrics = metrics;
  }

  get postgresPrimary() {
    return isAccountPostgresPrimary(this.flags);
  }

  async measure(kind, fn) {
    const started = now();
    try {
      return await fn();
    } finally {
      this.metrics.recordLatency(kind, now() - started);
    }
  }

  async readWithFallback(primary, fallback, metricKey = 'accountReads') {
    this.metrics.increment(metricKey);
    try {
      const result = await this.measure('postgres', primary);
      if (result || !isAccountFallbackEnabled(this.flags) || !isAccountDualReadEnabled(this.flags)) return result;
    } catch (error) {
      this.metrics.recordError(error);
      if (!isAccountFallbackEnabled(this.flags)) throw error;
    }
    this.metrics.increment('fallbackCount');
    return this.measure('firestoreFallback', fallback);
  }

  async getProfile(userId) {
    return this.readWithFallback(
      () => this.profiles.get(userId),
      () => this.fallback?.getProfile(userId) || null,
      'profileBootstrap',
    );
  }

  async upsertProfile(profile) {
    this.metrics.increment('accountWrites');
    const saved = await this.measure('postgres', () => this.profiles.upsert(profile));
    if (isAccountDualWriteEnabled(this.flags) && this.fallback?.upsertProfile) {
      this.fallback.upsertProfile(saved).catch(error => this.metrics.recordError(error));
    }
    return saved;
  }

  async resolveRoles(userId) {
    const profile = await this.getProfile(userId);
    const roleState = await this.readWithFallback(
      () => this.roles.get(userId),
      () => this.fallback?.getRoles(userId) || null,
      'roleResolution',
    );
    const roles = normalizeRoles(roleState, profile || {});
    return {
      userId,
      primaryRole: roleState?.primaryRole || roles[0] || 'user',
      roles: roles.length ? roles : ['user'],
      permissions: Array.isArray(roleState?.permissions) ? roleState.permissions : [],
      claims: roleState?.claims || {},
    };
  }

  async setRoles(payload) {
    this.metrics.increment('accountWrites');
    return this.measure('postgres', () => this.roles.set(payload));
  }

  async restoreSession({ sessionId = '', userId = '', firebaseUid = '' } = {}) {
    this.metrics.increment('sessionRestore');
    if (sessionId) {
      const session = await this.sessions.touch(sessionId);
      if (session) return session;
    }
    if (userId) {
      const existing = await this.sessions.findActiveByUser(userId);
      if (existing) return existing;
    }
    if (!userId && firebaseUid) return null;
    return userId ? this.sessions.create({ userId, firebaseUid }) : null;
  }

  async listCabinets(userId) {
    return this.readWithFallback(
      () => this.cabinets.listByUser(userId),
      () => this.fallback?.listCabinets(userId) || [],
      'ownerResolution',
    ) || [];
  }

  async bootstrapWorkspace(userId) {
    this.metrics.increment('workspaceBootstrap');
    const [profile, roleState, cabinets] = await Promise.all([
      this.getProfile(userId),
      this.resolveRoles(userId),
      this.listCabinets(userId),
    ]);
    return {
      ok: Boolean(profile),
      userId,
      profile,
      roles: roleState.roles,
      primaryRole: roleState.primaryRole,
      permissions: roleState.permissions,
      cabinets,
      workspaceReady: Boolean(profile),
      source: this.postgresPrimary ? 'postgres' : 'dual-read',
    };
  }

  async bootstrapHome(userId) {
    this.metrics.increment('homeBootstrap');
    const profile = await this.getProfile(userId);
    const roleState = userId ? await this.resolveRoles(userId) : { roles: ['guest'], primaryRole: 'guest', permissions: [] };
    return {
      ok: true,
      userId,
      profile,
      roles: roleState.roles,
      primaryRole: roleState.primaryRole,
      homeReady: true,
      accountCoreReady: Boolean(profile || !userId),
      source: this.postgresPrimary ? 'postgres' : 'dual-read',
    };
  }

  snapshot() {
    return {
      storage: this.postgresPrimary ? 'postgres' : 'firestore',
      fallbackEnabled: isAccountFallbackEnabled(this.flags),
      dualRead: isAccountDualReadEnabled(this.flags),
      dualWrite: isAccountDualWriteEnabled(this.flags),
      canary: String(this.flags.ACCOUNT_CANARY || '') === '1',
      metrics: this.metrics.snapshot(),
    };
  }
}
