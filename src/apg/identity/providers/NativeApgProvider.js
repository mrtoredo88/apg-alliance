import { IdentityProvider } from '../IdentityProvider.js';
import { API_BASE_URL } from '../../../constants.js';
import { apgSession } from '../../../auth/apgSession.js';

export class NativeApgProvider extends IdentityProvider {
  constructor() {
    super('native-apg');
  }

  getCurrentIdentity() {
    return apgSession.currentUser;
  }

  async resolveIdentity() {
    return this.getCurrentIdentity();
  }

  async authenticate(input = {}) {
    const provider = input.provider || input.type || 'anonymous';
    if (provider === 'customToken' || provider === 'firebaseCustomToken' || provider === 'apgToken') {
      return apgSession.setToken(input.token);
    }
    if (provider === 'anonymous') {
      const response = await fetch(`${API_BASE_URL}/api/session/anonymous`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) throw new Error(data.error || 'Не удалось создать гостевую сессию.');
      return apgSession.setToken(data.token);
    }
    throw new Error(`native_apg_unsupported_auth:${provider}`);
  }

  async createIdentity(input = {}) {
    return this.authenticate(input);
  }

  async refreshSession() {
    const current = this.getCurrentIdentity();
    if (!current) return '';
    const response = await fetch(`${API_BASE_URL}/api/session/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apgSession.token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || 'Не удалось обновить сессию.');
    apgSession.setToken(data.token);
    return data.token;
  }

  async verifySession() {
    return this.getCurrentIdentity();
  }

  async invalidateSession() {
    apgSession.clear();
    return true;
  }

  onIdentityChanged(handler) {
    return apgSession.subscribe(handler);
  }

  waitForIdentity(expectedUid, timeoutMs = 4200) {
    const current = this.getCurrentIdentity();
    if (!expectedUid || current?.uid === expectedUid) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe?.();
        reject(Object.assign(new Error('auth_state_timeout'), { code: 'AUTH_STATE_TIMEOUT' }));
      }, timeoutMs);
      let unsubscribe = null;
      unsubscribe = this.onIdentityChanged(user => {
        if (user?.uid !== expectedUid) return;
        clearTimeout(timer);
        unsubscribe?.();
        resolve(user);
      });
    });
  }

  async getSessionToken() {
    return apgSession.token;
  }

  async getSessionClaims() {
    return this.getCurrentIdentity()?.getIdTokenResult?.() || null;
  }
}
