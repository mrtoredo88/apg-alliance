import fs from 'node:fs';

const OUT_DIR = 'backups/account-core/drift';
fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  status: 'DRIFT_CHECK_BLOCKED',
  reason: 'Requires SNAPSHOT_VERIFIED and IMPORT_PASSED before post-import drift can be checked.',
  productionChanged: false,
  firestoreChanged: false,
  importStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
};

fs.writeFileSync(`${OUT_DIR}/drift-report-redacted.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(1);
