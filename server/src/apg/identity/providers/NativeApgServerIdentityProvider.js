import { ServerIdentityProvider } from '../ServerIdentityProvider.js';

export class NativeApgServerIdentityProvider extends ServerIdentityProvider {
  constructor(sessionRepository = null) {
    super('native-apg-server');
    this.sessions = sessionRepository;
  }

  async authenticate(input = {}) {
    if (!this.sessions || !input.uid) throw new Error('native_apg_session_repository_unavailable');
    return this.sessions.createBearerSession({
      userId: String(input.uid),
      device: input.device || {},
      platform: input.platform || 'web-app',
      ttlDays: input.ttlDays || 30,
      claims: input.claims || {},
    });
  }

  async verifySession(input = {}) {
    if (!this.sessions) throw new Error('native_apg_session_repository_unavailable');
    const identity = await this.sessions.verifyBearerToken(input.token);
    if (!identity) throw Object.assign(new Error('Недействительная сессия.'), { code: 'AUTH_SESSION_INVALID', statusCode: 401 });
    return identity;
  }

  async refreshSession(input = {}) {
    const identity = await this.verifySession(input);
    return this.sessions.rotateBearerSession({
      token: input.token,
      userId: identity.uid,
      device: input.device,
      platform: input.platform,
      claims: {
        ...(identity.claims || {}),
        role: identity.role || 'user',
        roles: Array.isArray(identity.roles) ? identity.roles : ['user'],
      },
    });
  }

  async invalidateSession(input = {}) {
    return this.sessions ? this.sessions.revokeBearerToken(input.token) : false;
  }
}
