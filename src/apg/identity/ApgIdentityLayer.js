export class ApgIdentityLayer {
  constructor({ provider, fallbackProviders = {} } = {}) {
    if (!provider) throw new Error('identity_provider_required');
    this.provider = provider;
    this.fallbackProviders = fallbackProviders;
  }

  get providerName() {
    return this.provider.name;
  }

  resolveIdentity(input) { return this.provider.resolveIdentity(input); }
  createIdentity(input) { return this.provider.createIdentity(input); }
  authenticate(input) { return this.provider.authenticate(input); }
  refreshSession(input) { return this.provider.refreshSession(input); }
  verifySession(input) { return this.provider.verifySession(input); }
  invalidateSession(input) { return this.provider.invalidateSession(input); }
  getCurrentIdentity() { return this.provider.getCurrentIdentity(); }
  getCurrentUser() { return this.provider.getCurrentUser(); }
  linkEmail(input) { return this.provider.linkEmail(input); }
  linkTelegram(input) { return this.provider.linkTelegram(input); }
  unlinkProvider(input) { return this.provider.unlinkProvider(input); }
  getUserRoles(user) { return this.provider.getUserRoles(user); }
  updateIdentity(input) { return this.provider.updateIdentity(input); }
  changePrimaryProvider(input) { return this.provider.changePrimaryProvider(input); }
  onIdentityChanged(handler, errorHandler) { return this.provider.onIdentityChanged?.(handler, errorHandler) || (() => {}); }
  waitForIdentity(uid, timeoutMs) { return this.provider.waitForIdentity?.(uid, timeoutMs); }
  getSessionToken(options) { return this.provider.getSessionToken?.(options); }
  getSessionClaims(options) { return this.provider.getSessionClaims?.(options); }
}
