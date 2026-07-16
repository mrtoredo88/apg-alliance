import assert from 'node:assert/strict';
import {
  buildChangedPatch,
  findAutosaveConflictFields,
  hasChangedFields,
  shouldOfferDraftRecovery,
  stableAutosaveString,
  valuesEqual,
} from '../server-shared/profile-autosave.js';

const base = {
  description: 'old',
  phone: '+7 (999) 000-00-00',
  gallery: ['a', 'b'],
  nested: { b: 2, a: 1 },
};

assert.equal(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true, 'stable compare must ignore object key order');
assert.equal(stableAutosaveString({ b: 2, a: 1 }), stableAutosaveString({ a: 1, b: 2 }));

assert.deepEqual(
  buildChangedPatch({ ...base, description: 'new' }, base),
  { description: 'new' },
  'partial save must send only changed fields',
);
assert.equal(hasChangedFields(base, { ...base }), false, 'same data must not trigger save');
assert.equal(hasChangedFields({ ...base, phone: '+7 (999) 111-11-11' }, base), true);

assert.deepEqual(
  findAutosaveConflictFields({
    base,
    server: { ...base, description: 'server edit', phone: base.phone },
    next: { ...base, description: 'local edit', phone: '+7 (999) 111-11-11' },
  }),
  ['description'],
  'conflict must be reported only where server and local changed the same field',
);

assert.deepEqual(
  findAutosaveConflictFields({
    base,
    server: { ...base, offer: 'server new field' },
    next: { ...base, phone: '+7 (999) 222-22-22' },
  }),
  [],
  'independent server changes must not block local partial save',
);

assert.equal(
  shouldOfferDraftRecovery({
    draftUpdatedAt: 2000,
    serverProfile: { profileUpdatedAt: 1000 },
    draftData: { description: 'local' },
    serverData: { description: 'server' },
  }),
  true,
  'newer local draft must be offered for recovery',
);

assert.equal(
  shouldOfferDraftRecovery({
    draftUpdatedAt: 1000,
    serverProfile: { profileUpdatedAt: 2000 },
    draftData: { description: 'local' },
    serverData: { description: 'server' },
  }),
  false,
  'older local draft must not override a newer server profile',
);

assert.equal(
  shouldOfferDraftRecovery({
    draftUpdatedAt: 3000,
    serverProfile: { profileUpdatedAt: 1000 },
    draftData: { description: 'same' },
    serverData: { description: 'same' },
  }),
  false,
  'identical local draft must not show recovery prompt',
);

console.log('Profile autosave regression test passed');
