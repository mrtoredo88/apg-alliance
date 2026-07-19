import {
  backupBeforeManifest,
  buildConflictCenter,
  latestFile,
  readJson,
  RESOLUTION_MANIFEST_PATH,
  writeJson,
} from '../src/admin/identity/conflicts/index.js';

const reportPath = process.env.IDENTITY_CONFLICT_REPORT
  || latestFile('identity-conflict-resolution-', '-redacted.json');
const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE
  || latestFile('firestore-identity-snapshot-', '.json');

if (!reportPath) {
  console.error('Identity Conflict Center: no redacted conflict report found. Run npm run identity:conflict-resolution-audit first.');
  process.exit(1);
}

const report = readJson(reportPath);
const backupPath = backupBeforeManifest({
  sourceReportPath: reportPath,
  sourceSnapshotPath: snapshotPath,
  manifestPath: RESOLUTION_MANIFEST_PATH,
});
const center = buildConflictCenter({ report, manifestPath: RESOLUTION_MANIFEST_PATH });

if (!center.ok) {
  console.error(center.text);
  process.exit(1);
}

writeJson(RESOLUTION_MANIFEST_PATH, center.manifest);
writeJson(RESOLUTION_MANIFEST_PATH.replace('.json', '-cards-redacted.json'), {
  generatedAt: new Date().toISOString(),
  sourceReportPath: reportPath,
  backupPath,
  summary: center.analysis.summary,
  cards: center.analysis.conflicts,
});

console.log(center.text);
console.log(`Backup: ${backupPath}`);
