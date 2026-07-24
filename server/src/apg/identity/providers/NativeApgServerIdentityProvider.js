import { ServerIdentityProvider } from '../ServerIdentityProvider.js';
import { apgTokenAuth } from '../../../lib/apgTokens.js';

export class NativeApgServerIdentityProvider extends ServerIdentityProvider {
  constructor() {
    super('native-apg-server');
  }

  async authenticate(input = {}) {
    if (input.type === 'customToken' || input.provider === 'customToken') {
      return apgTokenAuth.createCustomToken(String(input.uid), input.claims || {});
    }
    throw new Error(`native_apg_unsupported_auth:${input.type || input.provider || ''}`);
  }

  async verifySession(input = {}) {
    return apgTokenAuth.verifyIdToken(input.token);
  }

  async refreshSession(input = {}) {
    return this.authenticate(input);
  }
}
