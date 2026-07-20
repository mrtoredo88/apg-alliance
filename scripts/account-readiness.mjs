import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

function exists(file) {
  return fs.existsSync(file);
}

const checks = [];
function check(name, ok, details = {}) {
  checks.push({ name, ok: Boolean(ok), ...details });
}

execFileSync('node', ['scripts/account-core-architecture-guard.mjs'], { stdio: 'inherit' });
execFileSync('node', ['scripts/account-core-test.mjs'], { stdio: 'inherit' });

check('Session restore', exists('server/src/apg/account/sessions/AccountSessionEngine.js'));
check('Role resolution', exists('server/src/apg/account/roles/AccountRoleEngine.js'));
check('Workspace bootstrap', exists('server/src/apg/account/services/AccountCoreService.js'));
check('Profile bootstrap', exists('server/src/apg/account/profiles/AccountProfileEngine.js'));
check('Home bootstrap', fs.readFileSync('server/src/apg/account/services/AccountCoreService.js', 'utf8').includes('bootstrapHome'));
check('Postgres', exists('server/src/apg/account/adapters/PostgresAccountAdapter.js'), { configured: Boolean(process.env.APG_IDENTITY_DATABASE_URL || process.env.DATABASE_URL) });
check('Firestore fallback', exists('server/src/apg/account/adapters/FirestoreAccountFallbackAdapter.js'));
check('Feature flags', ['ACCOUNT_STORAGE', 'ACCOUNT_DUAL_READ', 'ACCOUNT_DUAL_WRITE', 'ACCOUNT_FALLBACK', 'ACCOUNT_CANARY'].every(flag => fs.readFileSync('src/apg/core/FeatureFlags.js', 'utf8').includes(flag)));
check('Architecture guards', exists('scripts/account-core-architecture-guard.mjs'));

const ok = checks.every(item => item.ok);
console.log(JSON.stringify({
  ok,
  mode: 'local_account_readiness',
  productionChanged: false,
  firestoreChanged: false,
  deployStarted: false,
  checks,
}, null, 2));
if (!ok) process.exit(1);
