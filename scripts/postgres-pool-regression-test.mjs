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
const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const cabinetCore = readFileSync(new URL('../src/cabinet/CabinetCorePage.jsx', import.meta.url), 'utf8');
const economyRepository = readFileSync(new URL('../server/src/apg/account/repositories/EconomyRepository.js', import.meta.url), 'utf8');
const profileRepository = readFileSync(new URL('../server/src/apg/account/repositories/ProfileRepository.js', import.meta.url), 'utf8');
assert.match(userApp, /apg_canonical_key_balance/);
assert.match(userApp, /if \(accountBootstrap\?\.profile\) \{\s*setUserKeys\(keys\)/);
assert.match(userApp, /refreshKeyBalance\(\);\s*const handleResume/);
assert.match(userActions, /ACCOUNT_CORE_ECONOMY_FIELDS/);
assert.match(userActions, /withoutAccountCoreEconomy\(profile\)/);
assert.match(userActions, /canonical\?\.canonicalUserId \|\| canonical\?\.id/);
assert.match(userApp, /partnerCabinetIds: partnerCabinetIds\.length \? partnerCabinetIds : userData\.partnerCabinetIds/);
assert.match(userApp, /const bootstrapCabinets = Array\.isArray\(accountBootstrap\.cabinets\)/);
assert.match(userApp, /partnerId: data\.partnerId \|\| u\.partnerId \|\| null/);
assert.match(userApp, /requestId === balanceRequestIdRef\.current/);
assert.match(userApp, /activeBalanceUserIdRef\.current === userId/);
assert.match(userApp, /if \(result\?\.dailyBonusAwarded\)/);
assert.match(userApp, /userAction\('profile:sync', syncExistingPayload\)\.then\(handleDailySyncResult\)/);
assert.match(userActions, /timeZone:\s*'Europe\/Moscow'/);
assert.match(userActions, /if \(accountCoreWriteEnabled\(\)\) \{\s*const dailyResult = await serverFoundation\.account\.awardDailyBonus/);
assert.match(userActions, /migratedDocuments\.flatMap\(row => \[row\.partnerId/);
assert.match(userApp, /\[data-horizontal-gesture-boundary="true"\], \[data-apg-horizontal-scroll="true"\]/);
assert.match(economyRepository, /daily_bonus:\$\{cleanUserId\}:\$\{cleanDateKey\}/);
assert.match(economyRepository, /currentProfile\.rows\[0\]\?\.profile\?\.keys/);
assert.match(economyRepository, /lostDailyBonus/);
assert.match(economyRepository, /created_at > \$2/);
assert.match(userActions, /accountProfileForSync/);
assert.match(userActions, /delete accountProfileForSync\[field\]/);
assert.match(profileRepository, /\(user_id = \$1\) DESC/);
assert.match(cabinetCore, /shareEntity\(\{/);
assert.doesNotMatch(cabinetCore, /window\.open\(shareLink\([^)]*\), '_blank'\)/);

console.log('postgres-pool-regression-test: ok');
