import fs from 'node:fs';

const OUT_DIR = 'backups/account-core/observation';
fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  status: 'OBSERVATION_LOCKED',
  reason: 'Canary observation requires CANARY_PASSED and explicit owner command.',
  productionChanged: false,
  firestoreChanged: false,
  canaryStarted: false,
  cutoverStarted: false,
};

fs.writeFileSync(`${OUT_DIR}/observation-report-redacted.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(1);
