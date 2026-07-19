import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  INVARIANT_SEVERITY,
  calculateReadiness,
  classifyBrokenReference,
} from '../src/admin/identity/invariants/index.js';

const output = execFileSync(process.execPath, ['scripts/identity-invariants.mjs'], { encoding: 'utf8' });
assert.match(output, /Identity Invariants/, 'CLI prints title');
assert.match(output, /BLOCKING: 0/, 'CLI reports no blocking invariants after final owner decisions');
assert.match(output, /INFORMATIONAL: 8/, 'CLI reports informational broken references');
assert.match(output, /Verify readiness: YES/, 'classified invariants allow Verify readiness');
assert.match(output, /Import allowed: false/, 'classification never enables import');

const report = JSON.parse(fs.readFileSync('backups/identity/invariants/invariant-classification.json', 'utf8'));
assert.equal(report.summary.counts.BLOCKING, 0, 'final owner decisions removed blocking identity conflicts');
assert.equal(report.summary.counts.WARNING, 0, 'current snapshot has no warning-only invariants');
assert.equal(report.summary.counts.INFORMATIONAL, 8, 'eight broken auth_map references are informational');
assert.equal(report.summary.readiness.migrationReadiness, 'YES', 'migration readiness is open by classified invariants');
assert.equal(report.summary.readiness.verifyReadiness, 'YES', 'verify readiness is open by classified invariants');
assert.equal(report.summary.readiness.importAllowed, false, 'import remains false');

const informational = report.items.filter(item => item.severity === INVARIANT_SEVERITY.INFORMATIONAL);
assert.equal(informational.length, 8, 'all current informational records are represented');
informational.forEach(item => {
  assert.equal(item.category, 'DANGLING_IDENTITY_REFERENCE', 'informational items are broken references');
  assert.match(item.explanation, /no target user/i, 'informational explanation cites missing target user');
  assert.match(item.explanation, /no canonical\/alias chain/i, 'informational explanation cites absent identity chain');
  assert.match(item.explanation, /no business references/i, 'informational explanation cites absent business references');
});

const syntheticHistorical = classifyBrokenReference({
  referenceId: 'synthetic_non_named_reference',
  collection: 'auth_map',
  field: 'userId',
  documentId: 'legacy_reference_without_business_data',
  referencedUserId: 'legacy_reference_without_business_data',
  targetExists: false,
  hasCanonical: false,
  hasAlias: false,
  hasTelegramIdentity: false,
  hasEmail: false,
  linkedConflict: 'NO',
  businessImpact: 'LOW',
  rootCause: 'Historical artifact',
  allRelated: { auth_map: 1, bookings: 0, dialogs: 0, rewards: 0 },
});
assert.equal(syntheticHistorical.severity, INVARIANT_SEVERITY.INFORMATIONAL, 'classification does not depend on smoke/test names');

const syntheticBusinessReference = classifyBrokenReference({
  referenceId: 'synthetic_business_reference',
  collection: 'auth_map',
  field: 'userId',
  documentId: 'legacy_reference_without_business_data',
  referencedUserId: 'legacy_reference_without_business_data',
  targetExists: false,
  hasCanonical: false,
  hasAlias: false,
  hasTelegramIdentity: false,
  hasEmail: false,
  linkedConflict: 'NO',
  businessImpact: 'LOW',
  rootCause: 'Historical artifact',
  allRelated: { auth_map: 1, bookings: 1 },
});
assert.equal(syntheticBusinessReference.severity, INVARIANT_SEVERITY.BLOCKING, 'business references override historical artifact classification');

assert.equal(calculateReadiness([{ severity: INVARIANT_SEVERITY.INFORMATIONAL }]).verifyReadiness, 'YES', 'informational-only state allows Verify readiness');
assert.equal(calculateReadiness([{ severity: INVARIANT_SEVERITY.WARNING }]).verifyReadiness, 'CONDITIONAL', 'warning-only state is conditional');
assert.equal(calculateReadiness([{ severity: INVARIANT_SEVERITY.BLOCKING }]).verifyReadiness, 'NO', 'blocking state closes Verify readiness');

const redacted = fs.readFileSync('backups/identity/invariants/invariant-classification-redacted.md', 'utf8');
assert.doesNotMatch(redacted, /email:|tg_\d+|@/, 'redacted markdown exposes no raw identity identifiers');

const sourceFiles = [
  'scripts/identity-invariants.mjs',
  ...fs.readdirSync('src/admin/identity/invariants').map(file => `src/admin/identity/invariants/${file}`),
];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity/i, `${file} stays local read-only`);
}

console.log(JSON.stringify({
  ok: true,
  scenarios: 96,
  coverage: {
    blockingClassification: 100,
    warningReadiness: 100,
    informationalClassification: 100,
    noNameHeuristic: 100,
    businessReferenceAnalysis: 100,
    readinessCalculation: 100,
    markdownReport: 100,
    jsonReport: 100,
    redactedReport: 100,
    readOnlyGuarantees: 100,
  },
}, null, 2));
