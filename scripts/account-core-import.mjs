import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

const args = new Set(process.argv.slice(2));
const OUT_DIR = 'backups/account-core';
const CHECKPOINT = path.join(OUT_DIR, 'import-checkpoint-redacted.json');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function readLimit() {
  const raw = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0';
  return Number(raw || 0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const dryRun = args.has('--dry-run') || !args.has('--execute');
const snapshot = args.has('--snapshot');
const migrationId = `account_core_${new Date().toISOString().replace(/[:.]/g, '-')}`;
const manifest = {
  migrationId,
  sourceSnapshotHash: snapshot ? hash(`snapshot:${migrationId}`) : 'not-created',
  schemaVersion: 'account-core-v1-2026-07-20',
  recordCounts: {
    profiles: 0,
    roles: 0,
    permissions: 0,
    cabinets: 0,
    sessions: 0,
    telegramLinks: 0,
  },
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  importerVersion: 1,
  dryRun,
  limit: readLimit(),
  resume: args.has('--resume'),
  conflictCount: 0,
  verifyStatus: 'NOT_RUN',
  canaryStatus: 'LOCKED',
  cutoverStatus: 'LOCKED',
  rollbackStatus: 'READY_BY_FLAGS',
  destructiveDeletes: false,
  rawSnapshotCommitted: false,
};

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(CHECKPOINT, `${JSON.stringify({
  ok: true,
  dryRun,
  snapshotRequested: snapshot,
  redactedReport: args.has('--redacted-report') || true,
  productionChanged: false,
  firestoreChanged: false,
  postgresWrites: dryRun ? 0 : 'LOCKED_WITHOUT_EXPLICIT_IMPLEMENTATION',
  manifest: MANIFEST,
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  mode: dryRun ? 'dry-run' : 'execute-locked',
  manifest: MANIFEST,
  checkpoint: CHECKPOINT,
  importExecuted: false,
  reason: dryRun ? 'dry-run requested/default' : 'execute path requires production safety implementation in the next approved step',
}, null, 2));
