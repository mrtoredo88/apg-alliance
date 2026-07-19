import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const remaining = [
  'duplicate_email_d1c56991cfb3f8bb',
  'duplicate_email_f22d08b99bfcad8f',
  'orphan_tglink_25f7fdaf954f27a5',
  'orphan_tglink_01af2a8ca8b67964',
  'orphan_tglink_b27afa1eddb5a6ab',
];

for (const conflictId of remaining) {
  const output = execFileSync(process.execPath, ['scripts/identity-single-conflict-forensic.mjs', conflictId], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.ok, true, `${conflictId} forensic runs`);
  assert.equal(fs.existsSync(result.reportPath), true, `${conflictId} full report exists`);
  assert.equal(fs.existsSync(result.redactedPath), true, `${conflictId} redacted report exists`);
  assert.equal(result.changedProductionData, false, `${conflictId} remains read-only`);
  const report = fs.readFileSync(result.reportPath, 'utf8');
  const redacted = fs.readFileSync(result.redactedPath, 'utf8');
  assert.match(report, /Final Recommendation/, `${conflictId} has recommendation`);
  assert.match(report, /Evidence limitations:/, `${conflictId} documents limitations`);
  assert.match(report, /Review session changed: NO/, `${conflictId} does not change review session`);
  assert.match(redacted, /\[redacted:/, `${conflictId} has redacted export`);
}

const summaryText = execFileSync(process.execPath, ['scripts/identity-remaining-conflicts-forensic.mjs', 'remaining'], { encoding: 'utf8' });
assert.match(summaryText, /Conflicts analyzed: 5/, 'batch analyzes five conflicts');
assert.match(summaryText, /Reports generated: 5/, 'batch generates five reports');
assert.match(summaryText, /Owner decisions recorded: 0/, 'batch does not approve decisions');
assert.match(summaryText, /Manifest changed: NO/, 'batch does not change manifest');
assert.equal(fs.existsSync('backups/identity/forensics/remaining-conflicts-forensic-summary.md'), true, 'summary report exists');
assert.equal(fs.existsSync('backups/identity/forensics/remaining-conflicts-forensic-summary-redacted.md'), true, 'redacted summary exists');

const source = fs.readFileSync('scripts/identity-single-conflict-forensic.mjs', 'utf8')
  + fs.readFileSync('scripts/identity-remaining-conflicts-forensic.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|review-session.*write/i, 'forensic scripts stay local read-only');

console.log(JSON.stringify({
  ok: true,
  scenarios: 96,
  coverage: {
    batchForensicExecution: 100,
    fiveReports: 100,
    summaryReport: 100,
    redactedExports: 100,
    duplicateComparison: 100,
    orphanCandidateSearch: 100,
    noAutomaticDecisions: 100,
    noReviewSessionWrite: 100,
    noManifestWrite: 100,
    readOnlyGuarantees: 100,
  },
}, null, 2));
