import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../../../firebase.js';
import { IdentityProvider } from '../IdentityProvider.js';

export class FirebaseIdentityProvider extends IdentityProvider {
  constructor(firebaseAuth = auth) {
    super('firebase');
    this.auth = firebaseAuth;
  }

  getCurrentIdentity() {
    return this.auth.currentUser || null;
  }

  async resolveIdentity() {
    return this.getCurrentIdentity();
  }

  async createIdentity(input = {}) {
    return this.authenticate({ ...input, provider: input.provider || 'anonymous' });
  }

  async authenticate(input = {}) {
    const provider = input.provider || input.type || 'anonymous';
    if (provider === 'anonymous') {
      const credential = await signInAnonymously(this.auth);
      return credential.user;
    }
    if (provider === 'firebaseCustomToken' || provider === 'customToken') {
      const credential = await signInWithCustomToken(this.auth, input.token);
      return credential.user;
    }
    throw new Error(`firebase_identity_provider_unsupported_auth:${provider}`);
  }

  async refreshSession(options = {}) {
    return this.getSessionToken({ ...options, forceRefresh: true });
  }

  async verifySession() {
    return this.getCurrentIdentity();
  }

  async invalidateSession() {
    await signOut(this.auth);
    return true;
  }

  onIdentityChanged(handler, errorHandler) {
    return onAuthStateChanged(this.auth, handler, errorHandler);
  }

  waitForIdentity(expectedUid, timeoutMs = 4200) {
    const current = this.getCurrentIdentity();
    if (!expectedUid || current?.uid === expectedUid) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      let done = false;
      let unsubscribe = () => {};
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        unsubscribe();
        reject(Object.assign(new Error('auth_state_timeout'), { code: 'AUTH_STATE_TIMEOUT' }));
      }, timeoutMs);
      unsubscribe = this.onIdentityChanged(currentUser => {
        if (currentUser?.uid !== expectedUid) return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(currentUser);
      }, error => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      });
    });
  }

  async getSessionToken(options = {}) {
    const user = this.getCurrentIdentity();
    if (!user?.getIdToken) return '';
    return user.getIdToken(!!options.forceRefresh);
  }

  async getSessionClaims(options = {}) {
    const user = this.getCurrentIdentity();
    if (!user?.getIdTokenResult) return null;
    return user.getIdTokenResult(!!options.forceRefresh);
  }

  async linkEmail() { throw new Error('firebase_identity_link_email_uses_backend_flow'); }
  async linkTelegram() { throw new Error('firebase_identity_link_telegram_uses_backend_flow'); }
  async unlinkProvider() { throw new Error('firebase_identity_unlink_provider_not_enabled'); }
  async updateIdentity() { throw new Error('firebase_identity_update_uses_apg_profile_actions'); }
  async changePrimaryProvider() { throw new Error('firebase_identity_change_primary_provider_not_enabled'); }
}
