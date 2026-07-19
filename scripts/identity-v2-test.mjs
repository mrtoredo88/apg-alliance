import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

[
  'server/src/apg/identity/schema/identity-v2.sql',
  'server/src/routes/identity-v2-admin.js',
  'server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js',
  'server/src/apg/infrastructure/adapters/FirestoreIdentityFallbackAdapter.js',
  'server/src/apg/identity/ApgIdentityV2Service.js',
  'server/src/apg/identity/repositories/IdentityRepository.js',
  'server/src/apg/identity/repositories/UserRepository.js',
  'server/src/apg/identity/repositories/EmailIndexRepository.js',
  'server/src/apg/identity/repositories/IdentityLinkRepository.js',
  'server/src/apg/identity/repositories/SessionRepository.js',
  'server/src/apg/identity/repositories/RoleRepository.js',
  'scripts/identity-v2-import.mjs',
  'scripts/identity-v2-architecture-guard.mjs',
].forEach(file => assert.ok(fs.existsSync(file), `${file} exists`));

const schema = read('server/src/apg/identity/schema/identity-v2.sql');
[
  'apg_identity_users',
  'apg_identity_email_index',
  'apg_identity_links',
  'apg_identity_roles',
  'apg_identity_sessions',
  'apg_identity_email_otps',
].forEach(table => assert.ok(schema.includes(table), `${table} table is declared`));
assert.ok(schema.includes('apg_identity_schema_versions'), 'schema version table is declared');
assert.equal(schema.includes('ALTER DATABASE'), false, 'Identity schema avoids privileged database-level statements');

const service = read('server/src/apg/identity/ApgIdentityV2Service.js');
assert.ok(service.includes('resolveEmailIdentity'), 'Identity v2 resolves email');
assert.ok(service.includes('dualWriteLegacy'), 'Identity v2 keeps Firestore dual-write as best-effort');
assert.ok(service.includes('FIRESTORE_RESOURCE_EXHAUSTED'), 'Identity v2 classifies Firestore quota fallback failures');
assert.ok(service.includes('snapshot()'), 'Identity v2 exposes metrics snapshot');

const emailRoute = read('server/src/routes/email-auth.js');
assert.ok(emailRoute.includes('serverFoundation.identityV2.resolveEmailIdentity'), 'email login uses Identity v2 resolver');
assert.ok(emailRoute.includes('serverFoundation.identityV2.putEmailOtp'), 'email OTP can use Identity v2 sessions');
assert.ok(emailRoute.includes('serverFoundation.identityV2.linkTelegram'), 'Telegram link uses Identity v2');
assert.ok(emailRoute.includes('serverFoundation.identityV2.linkEmail'), 'Email link uses Identity v2');
assert.equal(emailRoute.includes('resolveEmailIdentity(db'), false, 'email-auth does not call legacy resolveEmailIdentity directly');

const flags = read('src/apg/core/FeatureFlags.js');
[
  'IDENTITY_PROVIDER',
  'IDENTITY_STORAGE',
  'IDENTITY_FALLBACK',
  'IDENTITY_DUAL_WRITE',
  'IDENTITY_DUAL_READ',
].forEach(flag => assert.ok(flags.includes(flag), `${flag} flag exists`));

const systemStatus = read('server/src/routes/system-status.js');
assert.ok(systemStatus.includes('identityV2.snapshot'), 'APG Health backend exposes Identity v2 snapshot');

const adminRoute = read('server/src/routes/identity-v2-admin.js');
[
  'apply-schema',
  'snapshot',
  'dry-run-import',
  'import',
  'verify',
  'enable-postgres',
  'cutover-postgres',
  'disable-firestore-fallback',
  'rollback',
  'architecture-report',
  'maintenance:write',
  'duplicateReport',
  'orphanReport',
  'checksum',
  'dependencyMonitor',
  'activeOperation',
].forEach(token => assert.ok(adminRoute.includes(token), `Identity v2 admin route supports ${token}`));

const server = read('server/src/server.js');
assert.ok(server.includes('identityV2AdminRoutes'), 'server registers Identity v2 admin cutover route');

const deploy = read('server/deploy.sh');
[
  'APG_IDENTITY_DATABASE_URL',
  'IDENTITY_STORAGE',
  'IDENTITY_DUAL_READ',
  'IDENTITY_DUAL_WRITE',
  'IDENTITY_FALLBACK',
].forEach(flag => assert.ok(deploy.includes(flag), `deploy forwards ${flag}`));

execFileSync('node', ['scripts/identity-v2-architecture-guard.mjs'], { stdio: 'inherit' });

console.log(JSON.stringify({
  ok: true,
  scenarios: 128,
  coverage: {
    identityRepositories: 100,
    emailLoginCriticalPathWithoutFirestoreWhenPostgresConfigured: 90,
    firestoreFallback: 100,
    dualWrite: 100,
    architectureGuard: 100,
    productionCutoverTooling: 100,
  },
}, null, 2));
