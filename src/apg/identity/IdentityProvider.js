export class IdentityProvider {
  constructor(name = 'identity-provider') {
    this.name = name;
  }

  async resolveIdentity() { throw new Error(`${this.name}:resolveIdentity_not_implemented`); }
  async createIdentity() { throw new Error(`${this.name}:createIdentity_not_implemented`); }
  async authenticate() { throw new Error(`${this.name}:authenticate_not_implemented`); }
  async refreshSession() { throw new Error(`${this.name}:refreshSession_not_implemented`); }
  async verifySession() { throw new Error(`${this.name}:verifySession_not_implemented`); }
  async invalidateSession() { throw new Error(`${this.name}:invalidateSession_not_implemented`); }
  getCurrentIdentity() { throw new Error(`${this.name}:getCurrentIdentity_not_implemented`); }
  getCurrentUser() { return this.getCurrentIdentity(); }
  async linkEmail() { throw new Error(`${this.name}:linkEmail_not_implemented`); }
  async linkTelegram() { throw new Error(`${this.name}:linkTelegram_not_implemented`); }
  async unlinkProvider() { throw new Error(`${this.name}:unlinkProvider_not_implemented`); }
  getUserRoles(user = {}) { return Array.isArray(user.roles) ? user.roles : [user.role || 'user'].filter(Boolean); }
  async updateIdentity() { throw new Error(`${this.name}:updateIdentity_not_implemented`); }
  async changePrimaryProvider() { throw new Error(`${this.name}:changePrimaryProvider_not_implemented`); }
}
