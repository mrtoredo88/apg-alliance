import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'backups/account-core/conflicts';
fs.mkdirSync(OUT_DIR, { recursive: true });

const snapshots = fs.existsSync('backups/account-core/snapshot')
  ? fs.readdirSync('backups/account-core/snapshot').filter(name => /^account-core-snapshot-.*\.sha256$/.test(name))
  : [];

const report = {
  status: snapshots.length ? 'CONFLICT_ANALYSIS_LOCKED_NO_RAW_SNAPSHOT_READER' : 'CONFLICT_ANALYSIS_BLOCKED_NO_SNAPSHOT',
  snapshotManifests: snapshots,
  productionChanged: false,
  firestoreChanged: false,
  importStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
};

fs.writeFileSync(path.join(OUT_DIR, 'conflicts-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'conflicts-summary.md'), [
  '# Account Core Conflict Analysis',
  '',
  `Status: ${report.status}`,
  '',
  'No production data was read or changed by this command.',
  '',
].join('\n'));
console.log(JSON.stringify(report, null, 2));
process.exit(1);
