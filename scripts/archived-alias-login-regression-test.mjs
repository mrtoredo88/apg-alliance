import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AccountCoreService } from '../server/src/apg/account/services/AccountCoreService.js';

const profileSource = fs.readFileSync(new URL('../server/src/apg/account/repositories/ProfileRepository.js', import.meta.url), 'utf8');
const economySource = fs.readFileSync(new URL('../server/src/apg/account/repositories/EconomyRepository.js', import.meta.url), 'utf8');
const accountRouteSource = fs.readFileSync(new URL('../server/src/routes/account.js', import.meta.url), 'utf8');
const adminSource = fs.readFileSync(new URL('../server/src/routes/admin-actions.js', import.meta.url), 'utf8');
const adminSecuritySource = fs.readFileSync(new URL('../server/src/lib/adminSecurity.js', import.meta.url), 'utf8');

assert.match(profileSource, /SELECT canonical_user_id FROM apg_identity_users WHERE id = \$1/);
assert.match(profileSource, /linkMergedAliases/);
assert.match(profileSource, /UPDATE apg_identity_links/);
assert.match(profileSource, /UPDATE apg_identity_email_index/);
assert.match(profileSource, /UPDATE apg_account_telegram_links/);
assert.match(economySource, /SELECT canonical_user_id FROM apg_identity_users WHERE id = \$1/);
assert.match(accountRouteSource, /account-bootstrap-self-heal/);
assert.match(accountRouteSource, /legacyData\.mergedInto \|\| legacyData\.dataMigratedInto/);
assert.match(adminSource, /linkMergedAccounts\(\{/);
assert.match(adminSecuritySource, /collection\('accountAliases'\)/, 'admin guard must follow a retained merged-account alias');
assert.match(adminSecuritySource, /resolvedViaAlias/, 'canonical profile must remain authoritative after an alias is resolved');

const calls = [];
const service = new AccountCoreService({
  profiles: {
    async linkMergedAliases(payload) {
      calls.push({ type: 'aliases', payload });
      return { targetId: payload.targetId };
    },
  },
  economy: {
    async setBalance(payload) {
      calls.push({ type: 'balance', payload });
      return { balanceAfter: payload.balance };
    },
  },
  roles: {},
  sessions: {},
  cabinets: {},
  telegram: {},
});

await service.linkMergedAccounts({
  targetId: 'darya-active',
  sourceIds: ['darya-archived'],
  profile: { displayName: 'Дарья Самарина', keys: 70 },
  actorId: 'owner',
  idempotencyKey: 'merge-darya',
});

assert.equal(calls[0].type, 'aliases');
assert.equal(calls[0].payload.profile.keys, undefined, 'economy fields must not be copied as ordinary profile data');
assert.equal(calls[1].type, 'balance');
assert.equal(calls[1].payload.balance, 70);
assert.equal(calls[1].payload.idempotencyKey, 'merge_balance:merge-darya');

console.log('Archived alias login regression: canonical routing, self-heal and ledger-safe merge passed');
