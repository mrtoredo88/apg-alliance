import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actorOwnsEditableProfile } from '../server-shared/profile-access.js';

assert.equal(
  actorOwnsEditableProfile({ id: 'coffee-time' }, { userId: 'u1', uid: 'auth1', user: { partnerId: 'coffee-time' } }, 'partner'),
  true,
  'partnerId must grant access to the linked partner profile',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'beauty-demo' }, { userId: 'u1', uid: 'auth1', user: { partnerCabinetIds: ['beauty-demo'] } }, 'partner'),
  true,
  'partnerCabinetIds must grant access to the linked partner profile',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'expert-demo' }, { userId: 'u2', uid: 'auth2', user: { expertId: 'expert-demo' } }, 'expert'),
  true,
  'expertId must grant access to the linked expert profile',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'expert-team' }, { userId: 'u2', uid: 'auth2', user: { expertCabinetIds: ['expert-team'] } }, 'expert'),
  true,
  'expertCabinetIds must grant access to the linked expert profile',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'profile-1', ownerUserIds: ['u3'] }, { userId: 'u3', uid: 'auth3', user: {} }, 'partner'),
  true,
  'legacy ownerUserIds must keep working',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'profile-2', ownerEmail: 'owner@example.com' }, { userId: 'u4', uid: 'auth4', user: { email: 'owner@example.com' } }, 'partner'),
  true,
  'legacy ownerEmail must keep working',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'expert-demo' }, { userId: 'u5', uid: 'auth5', user: { partnerId: 'expert-demo' } }, 'expert'),
  false,
  'partnerId must not grant access to an expert profile with the same id',
);

assert.equal(
  actorOwnsEditableProfile({ id: 'coffee-time' }, { userId: 'u6', uid: 'auth6', user: { partnerId: 'other-partner' } }, 'partner'),
  false,
  'a linked partner must not access another partner profile',
);

const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
assert.match(
  userActions,
  /await assertOwnedProfile\(db, actor, type, id\);/,
  'partner:profileUpdate and expert:profileUpdate must use the shared owned-profile guard',
);
assert.match(
  userActions,
  /hasRole\(actor\.user \|\| \{\}, ROLES\.admin\)/,
  'shared owned-profile guard must keep admin access for recovery saves',
);

console.log('Profile save access regression test passed');
