import { getDb } from '../../../lib/firebase.js';

function serialize(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

export class FirestoreAccountFallbackAdapter {
  constructor(dbFactory = getDb) {
    this.name = 'firestore-account-fallback';
    this.dbFactory = dbFactory;
  }

  get db() {
    return this.dbFactory();
  }

  async getProfile(userId) {
    const snap = await this.db.collection('users').doc(String(userId || '')).get();
    return snap.exists ? { id: snap.id, ...serialize(snap.data() || {}) } : null;
  }

  async getRoles(userId) {
    const profile = await this.getProfile(userId);
    if (!profile) return null;
    const roles = Array.isArray(profile.roles) ? profile.roles : [profile.role || 'user'].filter(Boolean);
    return {
      userId: profile.id,
      primaryRole: profile.role || roles[0] || 'user',
      roles: roles.length ? roles : ['user'],
      permissions: Array.isArray(profile.adminPermissions) ? profile.adminPermissions : [],
      claims: {},
    };
  }

  async listCabinets(userId) {
    const profile = await this.getProfile(userId);
    if (!profile) return [];
    const out = [];
    if (profile.partnerId || profile.partnerOwnerId) {
      out.push({ id: `partner:${profile.partnerId || profile.partnerOwnerId}`, userId: profile.id, type: 'partner', entityId: profile.partnerId || profile.partnerOwnerId, role: 'owner', status: 'active' });
    }
    if (profile.expertId || profile.expertOwnerId) {
      out.push({ id: `expert:${profile.expertId || profile.expertOwnerId}`, userId: profile.id, type: 'expert', entityId: profile.expertId || profile.expertOwnerId, role: 'owner', status: 'active' });
    }
    return out;
  }
}
