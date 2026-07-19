import fs from 'node:fs';
import path from 'node:path';
import {
  executeIdentityDryRun,
  formatDryRunSummary,
  writeDryRunReports,
} from '../src/admin/identity/dryrun/index.js';

function latestFile(dir, predicate) {
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter(predicate).sort();
  return files.length ? path.join(dir, files.at(-1)) : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE
  || latestFile('backups/identity', file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'));
const manifestPath = process.env.IDENTITY_RESOLUTION_MANIFEST
  || 'backups/identity/resolution-manifest-v2.json';

if (!snapshotPath || !fs.existsSync(snapshotPath)) {
  console.error('Identity Dry Run: no local Identity Snapshot found. Snapshot is required and no production request will be made.');
  process.exit(1);
}

if (!manifestPath || !fs.existsSync(manifestPath)) {
  console.error('Identity Dry Run: resolution-manifest-v2.json not found. Run npm run identity:review -- export first.');
  process.exit(1);
}

const snapshot = readJson(snapshotPath);
const manifest = readJson(manifestPath);
const report = executeIdentityDryRun({
  snapshot,
  manifest,
  source: { snapshotPath, manifestPath },
  writeReports: writeDryRunReports,
});

console.log(formatDryRunSummary(report));
console.log(`Report: ${report.files.jsonPath}`);
console.log(`Redacted: ${report.files.redactedPath}`);
console.log(`Summary: ${report.files.summaryPath}`);
