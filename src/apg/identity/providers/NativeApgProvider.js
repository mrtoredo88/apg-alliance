import { IdentityProvider } from '../IdentityProvider.js';
import { setNativeAuthUser } from '../../../nativeAuth.js';
import { API_BASE_URL } from '../../../constants.js';

const SESSION_REFRESH_AGE_MS = 21 * 86_400_000;

export class NativeApgProvider extends IdentityProvider {
  constructor() {
    super('native-apg');
    this.listeners = new Set();
    this.refreshPromise = null;
    this.identity = this.restore();
    setNativeAuthUser(this.identity);
  }

  restore() {
    try {
      const value = JSON.parse(localStorage.getItem('apg_native_identity') || 'null');
      if (!value?.uid || !value?.token) return null;
      return this.createUser(value);
    } catch {
      return null;
    }
  }

  createUser(value = {}) {
    const provider = this;
    return {
      uid: String(value.uid || value.userId || ''),
      email: value.email || null,
      isAnonymous: Boolean(value.isAnonymous),
      providerId: 'native-apg',
      getIdToken: async () => provider.identity?.token || '',
      getIdTokenResult: async () => ({ token: provider.identity?.token || '', claims: value.claims || {} }),
      token: String(value.token || ''),
      claims: value.claims || {},
      issuedAt: Number(value.issuedAt || Date.now()),
      expiresAt: value.expiresAt || null,
    };
  }

  persist() {
    if (!this.identity) localStorage.removeItem('apg_native_identity');
    else localStorage.setItem('apg_native_identity', JSON.stringify({
      uid: this.identity.uid,
      email: this.identity.email,
      isAnonymous: this.identity.isAnonymous,
      token: this.identity.token,
      claims: this.identity.claims,
      issuedAt: this.identity.issuedAt,
      expiresAt: this.identity.expiresAt,
    }));
    this.listeners.forEach(listener => listener(this.identity));
    setNativeAuthUser(this.identity);
  }

  getCurrentIdentity() { return this.identity; }
  async resolveIdentity() { return this.identity; }

  async authenticate(input = {}) {
    const provider = input.provider || input.type || '';
    if (provider === 'anonymous') {
      this.identity = this.createUser({ uid: `guest_${crypto.randomUUID()}`, isAnonymous: true, token: '' });
      this.persist();
      return this.identity;
    }
    if (!input.token) throw new Error('native_apg_token_required');
    this.identity = this.createUser({
      uid: input.uid || input.userId || input.expectedUid,
      email: input.email,
      token: input.token,
      claims: input.claims || {},
      issuedAt: input.issuedAt || Date.now(),
      expiresAt: input.expiresAt || null,
    });
    if (!this.identity.uid) throw new Error('native_apg_user_id_required');
    this.persist();
    return this.identity;
  }

  async createIdentity(input = {}) { return this.authenticate(input); }
  async refreshSession({ force = false } = {}) {
    if (!this.identity?.token || this.identity.isAnonymous) return this.identity?.token || '';
    const age = Date.now() - Number(this.identity.issuedAt || 0);
    if (!force && age < SESSION_REFRESH_AGE_MS) return this.identity.token;
    if (this.refreshPromise) return this.refreshPromise;
    const currentToken = this.identity.token;
    this.refreshPromise = fetch(`${API_BASE_URL}/api/auth-session/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APG-Auth': currentToken },
      body: JSON.stringify({ platform: 'web-app' }),
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) {
        const error = new Error(data.error || 'auth_session_refresh_failed');
        error.code = data.code || 'AUTH_SESSION_REFRESH_FAILED';
        error.status = response.status;
        throw error;
      }
      if (this.identity?.token !== currentToken) return this.identity?.token || data.token;
      this.identity = this.createUser({
        ...this.identity,
        token: data.token,
        issuedAt: Date.now(),
        expiresAt: data.expiresAt || null,
      });
      this.persist();
      return data.token;
    }).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }
  async verifySession() { return this.identity; }
  async invalidateSession() {
    const token = this.identity?.token || '';
    this.identity = null;
    this.persist();
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth-session/logout`, {
        method: 'POST',
        headers: { 'X-APG-Auth': token },
      }).catch(() => {});
    }
    return true;
  }
  getSessionToken({ forceRefresh = false } = {}) { return this.refreshSession({ force: forceRefresh }); }
  getSessionClaims() { return Promise.resolve({ claims: this.identity?.claims || {} }); }

  onIdentityChanged(handler) {
    this.listeners.add(handler);
    queueMicrotask(() => handler(this.identity));
    return () => this.listeners.delete(handler);
  }

  waitForIdentity(expectedUid, timeoutMs = 4200) {
    if (!expectedUid || this.identity?.uid === expectedUid) return Promise.resolve(this.identity);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(Object.assign(new Error('auth_state_timeout'), { code: 'AUTH_STATE_TIMEOUT' }));
      }, timeoutMs);
      const unsubscribe = this.onIdentityChanged(identity => {
        if (identity?.uid !== expectedUid) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(identity);
      });
    });
  }
}
