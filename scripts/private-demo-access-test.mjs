import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
assert.match(
  userApp,
  /const loadedPartners = pSnap\.docs[\s\S]*?privateArchivedProfileOwnedByUser\(p, userData\)/,
  'private demo partner is resolved before public catalog filtering',
);
assert.match(
  userApp,
  /userData\.partnerId,[\s\S]*?safeStringList\(userData\.partnerCabinetIds\)[\s\S]*?Promise\.all\(linkedPartnerIds\.map/,
  'all linked partner cabinets are checked when the demo partner is outside the public page',
);

console.log('Private demo partner access regression test passed');
