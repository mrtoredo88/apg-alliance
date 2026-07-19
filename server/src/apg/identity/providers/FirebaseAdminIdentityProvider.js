import { getDbAuth } from '../../../lib/firebase.js';
import { ServerIdentityProvider } from '../ServerIdentityProvider.js';

export class FirebaseAdminIdentityProvider extends ServerIdentityProvider {
  constructor(authFactory = getDbAuth) {
    super('firebase-admin');
    this.authFactory = authFactory;
  }

  get auth() {
    return this.authFactory();
  }

  async createIdentity(input = {}) {
    if (input.email) return this.auth.createUser({ email: input.email, emailVerified: !!input.emailVerified, disabled: false });
    throw new Error('firebase_admin_create_identity_requires_email');
  }

  async authenticate(input = {}) {
    if (input.type === 'customToken' || input.provider === 'customToken') {
      return this.auth.createCustomToken(String(input.uid), input.claims || {});
    }
    throw new Error(`firebase_admin_unsupported_auth:${input.type || input.provider || ''}`);
  }

  async verifySession(input = {}) {
    return this.auth.verifyIdToken(input.token);
  }

  async refreshSession(input = {}) {
    return this.authenticate(input);
  }

  async invalidateSession(input = {}) {
    if (!input.uid) return false;
    await this.auth.revokeRefreshTokens(String(input.uid));
    return true;
  }

  async updateIdentity(input = {}) {
    return this.auth.updateUser(String(input.uid), input.patch || {});
  }
}
