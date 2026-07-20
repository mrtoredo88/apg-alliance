import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

execFileSync('node', ['scripts/account-core-architecture-guard.mjs'], { stdio: 'inherit' });
execFileSync('node', ['scripts/account-dry-run.mjs'], { stdio: 'inherit' });

const OUT_DIR = 'backups/account-core';
fs.mkdirSync(OUT_DIR, { recursive: true });
const source = {
  schema: fs.readFileSync('server/src/apg/account/schema/account-core.sql', 'utf8').length,
  service: fs.readFileSync('server/src/apg/account/services/AccountCoreService.js', 'utf8').length,
  endpoint: fs.readFileSync('server/src/routes/account.js', 'utf8').length,
};
const report = {
  ok: true,
  mode: 'local_read_only_account_verify',
  verifyStartedAgainstProduction: false,
  firestoreChanged: false,
  productionChanged: false,
  parity: {
    recordCounts: 'NOT_RUN_NO_SNAPSHOT',
    canonicalUserMapping: 'NOT_RUN_NO_SNAPSHOT',
    roleParity: 'NOT_RUN_NO_SNAPSHOT',
    permissionParity: 'NOT_RUN_NO_SNAPSHOT',
    cabinetParity: 'NOT_RUN_NO_SNAPSHOT',
    ownerAdminParity: 'NOT_RUN_NO_SNAPSHOT',
    telegramLinkParity: 'NOT_RUN_NO_SNAPSHOT',
  },
  staticEvidence: source,
  canaryReadiness: 'LOCKED_UNTIL_IMPORT_AND_PARITY_VERIFY',
};
fs.writeFileSync(path.join(OUT_DIR, 'verify-report-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'verify-summary-redacted.md'), [
  '# Account Core Verify Summary',
  '',
  `Status: ${report.ok ? 'PASS_STATIC_ONLY' : 'FAILED'}`,
  '',
  'Production parity verify was not executed because no approved Account Core snapshot/import was run in this local stage.',
  'Canary remains locked until production PostgreSQL, import, parity verify and rollback gates pass.',
  '',
].join('\n'));
console.log(JSON.stringify(report, null, 2));
