import { IdentityProvider } from '../IdentityProvider.js';
import { setNativeAuthUser } from '../../../nativeAuth.js';

export class NativeApgProvider extends IdentityProvider {
  constructor() {
    super('native-apg');
    this.listeners = new Set();
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
    });
    if (!this.identity.uid) throw new Error('native_apg_user_id_required');
    this.persist();
    return this.identity;
  }

  async createIdentity(input = {}) { return this.authenticate(input); }
  async refreshSession() { return this.getSessionToken(); }
  async verifySession() { return this.identity; }
  async invalidateSession() { this.identity = null; this.persist(); return true; }
  getSessionToken() { return Promise.resolve(this.identity?.token || ''); }
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
