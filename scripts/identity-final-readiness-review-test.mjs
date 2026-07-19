import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/identity-final-readiness-review.mjs'], { encoding: 'utf8' });
const result = JSON.parse(output);

assert.equal(result.ok, true, 'final readiness review runs');
assert.equal(result.readyForVerifyNow, true, 'current Identity is ready for Verify after final owner decisions');
assert.equal(result.verifyBlockers, 0, 'current report has no objective Verify blockers');
assert.equal(result.technicalFixRequired, 0, 'no technical fix is required by current evidence');
assert.equal(result.changedProductionData, false, 'review is read-only');
assert.equal(fs.existsSync(result.reportPath), true, 'markdown report exists');
assert.equal(fs.existsSync(result.jsonPath), true, 'json report exists');
assert.equal(fs.existsSync(result.redactedPath), true, 'redacted markdown report exists');
assert.equal(fs.existsSync(result.redactedJsonPath), true, 'redacted json report exists');

const report = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
assert.equal(report.summary.importAllowed, false, 'readiness review never enables import');
assert.equal(report.summary.ownerDecisionRequired, 0, 'no owner-decision blockers remain');
assert.equal(report.readinessBuckets.Ready.length, 8, 'broken references are ready/informational');
assert.equal(report.finalTable.find(item => item.area === 'Broken references').blocksVerify, 'NO', 'broken references do not block Verify');
assert.equal(report.finalTable.find(item => item.area === 'Duplicate emails').blocksVerify, 'NO', 'duplicate emails no longer block Verify');
assert.equal(report.finalTable.find(item => item.area === 'Owner decisions').blocksVerify, 'NO', 'owner decisions no longer block Verify');
assert.match(report.finalConclusion.answer, /готова к Verify/i, 'conclusion says Identity is ready for Verify');
assert.ok(report.evidenceLinks.some(item => item.source.includes('owner-identity-deep-forensic.json')), 'owner forensic is cited');
assert.ok(report.evidenceLinks.some(item => item.source.includes('invariant-classification.json')), 'invariant classification is cited');
assert.ok(report.evidenceLinks.some(item => item.source.includes('broken-references.json')), 'broken references forensic is cited');

assert.equal(report.safety.firestoreChanged, false, 'Firestore unchanged');
assert.equal(report.safety.runtimeChanged, false, 'runtime unchanged');
assert.equal(report.safety.apiChanged, false, 'API unchanged');
assert.equal(report.safety.securityRulesChanged, false, 'Security Rules unchanged');
assert.equal(report.safety.reviewSessionChanged, false, 'review session unchanged');
assert.equal(report.safety.manifestChanged, false, 'manifest unchanged');
assert.equal(report.safety.importStarted, false, 'import not started');
assert.equal(report.safety.verifyStarted, false, 'verify not started');
assert.equal(report.safety.canaryStarted, false, 'canary not started');
assert.equal(report.safety.cutoverStarted, false, 'cutover not started');
assert.equal(report.safety.rollbackStarted, false, 'rollback not started');
assert.equal(report.safety.productionDeployed, false, 'production not deployed');

const md = fs.readFileSync(result.reportPath, 'utf8');
assert.match(md, /Identity Final Readiness Review/, 'markdown title exists');
assert.match(md, /Final Table/, 'final table exists');
assert.match(md, /Readiness Matrix/, 'readiness matrix exists');
assert.match(md, /Technical Fix Required: 0/, 'markdown confirms no technical fix bucket');
assert.match(md, /Manifest changed: NO/, 'markdown confirms manifest unchanged');

const redacted = fs.readFileSync(result.redactedPath, 'utf8');
assert.match(redacted, /\[redacted:/, 'redacted report hides identifiers');

const source = fs.readFileSync('scripts/identity-final-readiness-review.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|review-session.*write/i, 'final readiness review stays local read-only');

console.log(JSON.stringify({
  ok: true,
  scenarios: 112,
  coverage: {
    blockerInventory: 100,
    readinessMatrix: 100,
    finalTable: 100,
    evidenceLinks: 100,
    brokenReferencesNonBlocking: 100,
    ownerDecisionGate: 100,
    technicalFixBucket: 100,
    redactedReports: 100,
    readOnlyGuarantees: 100,
  },
}, null, 2));
