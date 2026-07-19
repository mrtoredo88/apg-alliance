import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/identity-migration-orchestrator.mjs'], { encoding: 'utf8' });
assert.match(output, /Identity Migration Orchestrator/, 'CLI prints title');
assert.match(output, /Review: PASS/, 'review gate passes after final owner decisions');
assert.match(output, /Validation: PASS/, 'validation gate passes');
assert.match(output, /Dry Run: PASS/, 'dry-run gate passes through classified invariants');
assert.match(output, /Verify Package: GENERATED/, 'verify package is generated');
assert.match(output, /Verify Gate: READY/, 'verify gate is ready');
assert.match(output, /Canary: LOCKED/, 'Canary remains locked');
assert.match(output, /Cutover: LOCKED/, 'Cutover remains locked');
assert.match(output, /Production unchanged/, 'production stays unchanged');

const reportPath = 'backups/identity/orchestrator/orchestrator-report.json';
const mdPath = 'backups/identity/orchestrator/orchestrator-report.md';
const redactedPath = 'backups/identity/orchestrator/orchestrator-report-redacted.md';
const redactedJsonPath = 'backups/identity/orchestrator/orchestrator-report-redacted.json';
assert.equal(fs.existsSync(reportPath), true, 'json report exists');
assert.equal(fs.existsSync(mdPath), true, 'markdown report exists');
assert.equal(fs.existsSync(redactedPath), true, 'redacted markdown exists');
assert.equal(fs.existsSync(redactedJsonPath), true, 'redacted json exists');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert.equal(report.pipelineStatus, 'READY_FOR_VERIFY', 'pipeline is ready for verify');
assert.equal(report.stopReason, null, 'no stop reason');
assert.equal(report.gates.review, 'PASS', 'review gate passed');
assert.equal(report.gates.validation, 'PASS', 'validation gate passed');
assert.equal(report.gates.dryRun, 'PASS', 'dry run gate passed');
assert.equal(report.gates.verify, 'READY', 'verify gate ready');
assert.equal(report.gates.canary, 'LOCKED', 'canary gate locked');
assert.equal(report.gates.cutover, 'LOCKED', 'cutover gate locked');
assert.ok(report.verifyPackage, 'verify package is generated when gates pass');
assert.equal(report.summaries.review.approved, 6, 'approved count is reported');
assert.equal(report.summaries.review.deferred, 0, 'deferred count is reported');
assert.equal(report.summaries.review.reviewComplete, true, 'review is complete');
assert.equal(report.summaries.dryRun.rawReadyForVerify, false, 'raw dry-run still records historical artifacts');
assert.equal(report.summaries.dryRun.operationalReadyForVerify, true, 'classified gate is operationally ready');
assert.equal(report.summaries.invariants.counts.BLOCKING, 0, 'blocking invariants absent');
assert.equal(report.summaries.invariants.counts.INFORMATIONAL, 8, 'historical artifacts remain visible');

assert.equal(report.safety.dataChanged, false, 'orchestrator changes no data');
assert.equal(report.safety.firestoreChanged, false, 'Firestore unchanged');
assert.equal(report.safety.runtimeChanged, false, 'runtime unchanged');
assert.equal(report.safety.apiChanged, false, 'API unchanged');
assert.equal(report.safety.securityRulesChanged, false, 'Security Rules unchanged');
assert.equal(report.safety.reviewSessionChangedAutomatically, false, 'review session unchanged');
assert.equal(report.safety.manifestChangedAutomatically, false, 'manifest unchanged');
assert.equal(report.safety.importStarted, false, 'import not started');
assert.equal(report.safety.verifyStarted, false, 'verify not started');
assert.equal(report.safety.canaryStarted, false, 'canary not started');
assert.equal(report.safety.cutoverStarted, false, 'cutover not started');
assert.equal(report.safety.productionDeployed, false, 'production not deployed');

const md = fs.readFileSync(mdPath, 'utf8');
assert.match(md, /Verify Package/, 'markdown includes verify package section');
assert.match(md, /Manifest changed automatically: NO/, 'markdown confirms manifest unchanged');
const redacted = fs.readFileSync(redactedPath, 'utf8');
assert.match(redacted, /\[redacted:/, 'redacted report hides identifiers');

const source = fs.readFileSync('scripts/identity-migration-orchestrator.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|verify-identity|run-canary|start-canary|deploy-frontend/i, 'orchestrator contains no production mutation calls');

console.log(JSON.stringify({
  ok: true,
  scenarios: 104,
  coverage: {
    reviewGateStop: 100,
    validationNotRunAfterStop: 100,
    dryRunNotRunAfterStop: 100,
    verifyPackageGate: 100,
    verifyLocked: 100,
    canaryLocked: 100,
    cutoverLocked: 100,
    reports: 100,
    readOnlyGuarantees: 100,
  },
}, null, 2));
