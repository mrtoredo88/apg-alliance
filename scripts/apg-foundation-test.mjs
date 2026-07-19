import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);

const requiredFiles = [
  'src/apg/index.js',
  'src/apg/core/ApgFoundation.js',
  'src/apg/core/DependencyContainer.js',
  'src/apg/core/FeatureFlags.js',
  'src/apg/identity/IdentityProvider.js',
  'src/apg/identity/ApgIdentityLayer.js',
  'src/apg/identity/providers/FirebaseIdentityProvider.js',
  'src/apg/identity/providers/YandexIdentityProvider.js',
  'src/apg/identity/providers/NativeApgProvider.js',
  'src/apg/data/ApgDataLayer.js',
  'src/apg/data/Repository.js',
  'src/apg/infrastructure/adapters/BaseDataAdapter.js',
  'src/apg/infrastructure/adapters/FirestoreAdapter.js',
  'src/apg/infrastructure/adapters/PostgresAdapter.js',
  'src/apg/infrastructure/adapters/YdbAdapter.js',
  'src/apg/infrastructure/adapters/MemoryAdapter.js',
  'src/apg/domain/index.js',
  'server/src/apg/index.js',
  'server/src/apg/identity/ServerIdentityProvider.js',
  'server/src/apg/identity/providers/FirebaseAdminIdentityProvider.js',
  'server/src/apg/identity/providers/YandexServerIdentityProvider.js',
  'server/src/apg/identity/providers/NativeApgServerIdentityProvider.js',
  'server/src/apg/data/ServerDataAdapter.js',
  'server/src/apg/data/FirestoreAdminAdapter.js',
  'server/src/apg/data/ServerRepository.js',
];

for (const file of requiredFiles) {
  assert.ok(exists(file), `${file} exists`);
  console.log(`OK ${file}`);
}

const identityProvider = read('src/apg/identity/IdentityProvider.js');
for (const method of [
  'resolveIdentity',
  'createIdentity',
  'authenticate',
  'refreshSession',
  'verifySession',
  'invalidateSession',
  'getCurrentIdentity',
  'getCurrentUser',
  'linkEmail',
  'linkTelegram',
  'unlinkProvider',
  'getUserRoles',
  'updateIdentity',
  'changePrimaryProvider',
]) {
  assert.ok(identityProvider.includes(method), `IdentityProvider exposes ${method}`);
  console.log(`OK IdentityProvider ${method}`);
}

const firebaseProvider = read('src/apg/identity/providers/FirebaseIdentityProvider.js');
assert.ok(firebaseProvider.includes("provider === 'anonymous'"), 'Firebase provider supports anonymous auth');
assert.ok(firebaseProvider.includes("provider === 'firebaseCustomToken'"), 'Firebase provider supports custom token auth');
assert.ok(firebaseProvider.includes('getSessionToken'), 'Firebase provider owns token retrieval');
assert.ok(firebaseProvider.includes('waitForIdentity'), 'Firebase provider owns auth-state waiting');
console.log('OK FirebaseIdentityProvider wraps Firebase Auth');

const flags = read('src/apg/core/FeatureFlags.js');
for (const flag of ['IDENTITY_PROVIDER', 'DATA_PROVIDER', 'MESSAGE_PROVIDER', 'SEARCH_PROVIDER', 'STORAGE_PROVIDER']) {
  assert.ok(flags.includes(flag), `${flag} flag exists`);
  console.log(`OK flag ${flag}`);
}

const dataLayer = read('src/apg/data/ApgDataLayer.js');
for (const repo of [
  'UserRepository',
  'PartnerRepository',
  'ExpertRepository',
  'EventRepository',
  'NewsRepository',
  'PromotionRepository',
  'BookingRepository',
  'MeetingRepository',
  'DialogRepository',
  'MessageRepository',
  'RewardRepository',
  'KeyRepository',
  'ReferralRepository',
  'WorkspaceRepository',
  'NotificationRepository',
  'ConfigRepository',
  'AnalyticsRepository',
]) {
  assert.ok(dataLayer.includes(repo), `${repo} registered`);
  console.log(`OK repository ${repo}`);
}

const adapterIndex = read('src/apg/infrastructure/adapters/index.js');
for (const adapter of ['FirestoreAdapter', 'PostgresAdapter', 'YdbAdapter', 'MemoryAdapter']) {
  assert.ok(adapterIndex.includes(adapter), `${adapter} exported`);
  console.log(`OK adapter ${adapter}`);
}

const userApp = read('src/UserApp.jsx');
assert.ok(userApp.includes("import { apgIdentity } from './apg/index.js';"), 'UserApp imports APG Identity Layer');
assert.ok(!userApp.includes("from 'firebase/auth'"), 'UserApp no longer imports Firebase Auth directly');
assert.ok(userApp.includes("apgIdentity.authenticate({ provider: 'firebaseCustomToken'"), 'Email custom-token login goes through APG Identity');
assert.ok(userApp.includes('apgIdentity.invalidateSession()'), 'UserApp logout goes through APG Identity');
console.log('OK UserApp critical auth path uses APG Identity');

const profile = read('src/ProfilePanel.jsx');
assert.ok(profile.includes("import { apgIdentity } from './apg/index.js';"), 'ProfilePanel imports APG Identity Layer');
assert.ok(!profile.includes("from 'firebase/auth'"), 'ProfilePanel no longer imports Firebase Auth directly');
console.log('OK ProfilePanel custom token path uses APG Identity');

const userApi = read('src/userApi.js');
assert.ok(userApi.includes('apgIdentity.getSessionToken()'), 'userAction gets token through APG Identity');
assert.ok(!userApi.includes("import { auth }"), 'userApi does not import Firebase auth');
console.log('OK userAction token path uses APG Identity');

const diagnostics = read('src/diagnostics.js');
assert.ok(diagnostics.includes("apgIdentity.authenticate({ provider: 'anonymous' })"), 'diagnostics anonymous auth uses APG Identity');
assert.ok(!diagnostics.includes("firebase/auth"), 'diagnostics does not import Firebase Auth directly');
console.log('OK diagnostics auth path uses APG Identity');

const serverFoundation = read('server/src/apg/index.js');
assert.ok(serverFoundation.includes('createServerFoundation'), 'server foundation factory exists');
assert.ok(serverFoundation.includes('FirebaseAdminIdentityProvider'), 'server Firebase Admin provider registered');
assert.ok(serverFoundation.includes('YandexServerIdentityProvider'), 'server Yandex provider stub registered');
assert.ok(serverFoundation.includes('NativeApgServerIdentityProvider'), 'server Native APG provider stub registered');
console.log('OK server foundation registered');

const firebaseAdminProvider = read('server/src/apg/identity/providers/FirebaseAdminIdentityProvider.js');
assert.ok(firebaseAdminProvider.includes('createCustomToken'), 'server Firebase provider owns custom token creation');
assert.ok(firebaseAdminProvider.includes('verifyIdToken'), 'server Firebase provider owns token verification');
console.log('OK FirebaseAdminIdentityProvider wraps Firebase Admin Auth');

const emailAuth = read('server/src/routes/email-auth.js');
assert.ok(emailAuth.includes("import { serverFoundation } from '../apg/index.js';"), 'email-auth imports server foundation');
assert.ok(emailAuth.includes('serverFoundation.identity.verifySession'), 'email-auth verifies tokens through server identity');
assert.ok(emailAuth.includes('serverFoundation.identityV2.createCustomToken'), 'email-auth creates custom tokens through Identity v2');
assert.ok(!emailAuth.includes('getDbAuth'), 'email-auth no longer imports Firebase Admin Auth directly');
console.log('OK email-auth critical auth path uses Server Identity');

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:apg-foundation'], 'node scripts/apg-foundation-test.mjs');
console.log('OK package script registered');
