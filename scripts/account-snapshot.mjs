import fs from 'node:fs';
import path from 'node:path';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

const REPORT_PATH = 'backups/account-core/preflight-report.json';
const OUT_DIR = 'backups/account-core/snapshot';

function readPreflight() {
  try {
    return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const preflight = readPreflight();
if (preflight?.status !== 'PREFLIGHT_PASSED') {
  const report = {
    status: 'SNAPSHOT_BLOCKED',
    reason: 'PREFLIGHT_NOT_PASSED',
    preflightStatus: preflight?.status || 'MISSING',
    productionChanged: false,
    firestoreChanged: false,
    importStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'snapshot-blocked-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const report = {
  status: 'SNAPSHOT_LOCKED_OWNER_APPROVAL_REQUIRED',
  reason: 'Production Firestore snapshot requires explicit operator approval and protected credentials.',
  productionChanged: false,
  firestoreChanged: false,
};
fs.writeFileSync(path.join(OUT_DIR, 'snapshot-locked-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(1);
