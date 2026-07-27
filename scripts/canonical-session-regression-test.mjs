import assert from 'node:assert/strict';
import { IdentityRepository } from '../server/src/apg/identity/repositories/IdentityRepository.js';
import { ProfileRepository } from '../server/src/apg/account/repositories/ProfileRepository.js';

const alias = {
  id: 'legacy-user',
  canonicalUserId: 'canonical-user',
  email: 'owner@example.test',
};
const canonical = {
  id: 'canonical-user',
  canonicalUserId: 'canonical-user',
  email: 'owner@example.test',
  displayName: 'Canonical owner',
  keys: 33,
};

const users = {
  async get(id) { return id === alias.id ? alias : id === canonical.id ? canonical : null; },
  async findByEmail() { return [alias]; },
};
const emails = {
  async get() { return { userId: alias.id, canonicalUserId: canonical.id }; },
  async set() {},
};
const links = {
  async getByUserProvider() { return null; },
};
const identity = new IdentityRepository({
  users,
  emails,
  links,
  roles: {},
  sessions: {},
});

const resolved = await identity.resolveByEmail(alias.email);
assert.equal(resolved.userId, canonical.id, 'email login issues the session for the canonical account');
assert.equal(resolved.user.id, canonical.id, 'email login returns the canonical profile');
assert.equal(resolved.user.keys, 33, 'canonical balance is preserved');

const profileAdapter = {
  async query(sql, params) {
    assert.match(sql, /canonical_user_id = \$1/);
    assert.deepEqual(params, [alias.id]);
    return { rows: [{ user_id: canonical.id, canonical_user_id: canonical.id, profile: canonical }] };
  },
};
const profile = await new ProfileRepository(profileAdapter).get(alias.id);
assert.equal(profile.userId, canonical.id, 'legacy session aliases resolve to the canonical account profile');
assert.equal(profile.keys, 33, 'legacy session aliases read the canonical balance');

console.log(JSON.stringify({ ok: true, scenarios: 5 }, null, 2));
