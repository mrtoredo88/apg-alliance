import assert from 'node:assert/strict';
import { privateArchivedProfileOwnedByUser } from '../src/utils/profileOwnership.js';

const demoPartner = {
  id: 'demo-partner-apg',
  archived: true,
  privateDemoAccess: true,
  demoVisibility: 'owners',
  ownerUserIds: ['owner-user', 'tatyana-user'],
};

assert.equal(
  privateArchivedProfileOwnedByUser(demoPartner, { id: 'owner-user' }),
  true,
  'primary owner keeps access to archived demo partner',
);
assert.equal(
  privateArchivedProfileOwnedByUser(demoPartner, { id: 'tatyana-user' }),
  true,
  'Tatiana keeps access to archived demo partner',
);
assert.equal(
  privateArchivedProfileOwnedByUser(demoPartner, { id: 'public-user' }),
  false,
  'public user cannot access archived demo partner',
);
assert.equal(
  privateArchivedProfileOwnedByUser({ ...demoPartner, privateDemoAccess: false }, { id: 'owner-user' }),
  false,
  'ordinary archived partners stay unavailable',
);

console.log('Private demo partner access regression test passed');
