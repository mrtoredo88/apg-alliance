import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServerFoundation } from '../server/src/apg/index.js';
import { PostgresIdentityAdapter } from '../server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js';

const sharedAdapter = {
  available: false,
  query() {
    throw new Error('not expected');
  },
};
const identityProvider = {
  verifySession() {
    throw new Error('not expected');
  },
};
const foundation = createServerFoundation({ postgresAdapter: sharedAdapter, identityProvider });

assert.equal(foundation.data.adapter.adapter, sharedAdapter);
assert.equal(foundation.account.profiles.adapter, sharedAdapter);
assert.equal(foundation.identityV2.repository.users.adapter, sharedAdapter);

const adapter = new PostgresIdentityAdapter({ connectionString: 'postgres://test:test@127.0.0.1:5432/test' });
assert.equal(adapter.client.options.max, 2);
await adapter.dispose();

const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
assert.match(userApp, /apg_canonical_key_balance/);
assert.match(userApp, /if \(accountBootstrap\?\.profile\) \{\s*setUserKeys\(keys\)/);
assert.match(userApp, /refreshKeyBalance\(\);\s*const handleResume/);

console.log('postgres-pool-regression-test: ok');
