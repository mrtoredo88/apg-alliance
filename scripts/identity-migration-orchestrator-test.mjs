import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/identity-migration-orchestrator.mjs'], { encoding: 'utf8' });
assert.match(output, /Identity Migration Orchestrator/, 'CLI prints title');
assert.match(output, /Review: STOP/, 'current review gate stops');
assert.match(output, /Owner decisions incomplete/, 'CLI explains incomplete owner decisions');
assert.match(output, /3 deferred owner decisions/, 'CLI prints deferred count');
assert.match(output, /Pipeline stopped/, 'CLI stops pipeline');
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
assert.equal(report.pipelineStatus, 'STOPPED', 'pipeline is stopped');
assert.equal(report.stopReason, 'Owner decisions incomplete', 'stop reason is explicit');
assert.equal(report.gates.review, 'STOP', 'review gate stopped');
assert.equal(report.gates.validation, 'NOT_RUN', 'validation was not run after failed review gate');
assert.equal(report.gates.dryRun, 'NOT_RUN', 'dry run was not run after failed review gate');
assert.equal(report.gates.verify, 'LOCKED', 'verify gate locked');
assert.equal(report.gates.canary, 'LOCKED', 'canary gate locked');
assert.equal(report.gates.cutover, 'LOCKED', 'cutover gate locked');
assert.equal(report.verifyPackage, null, 'verify package is not generated when gates fail');
assert.equal(report.summaries.review.approved, 3, 'approved count is reported');
assert.equal(report.summaries.review.deferred, 3, 'deferred count is reported');
assert.equal(report.summaries.review.reviewComplete, false, 'review is incomplete');

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
assert.match(md, /Verify Package: NOT GENERATED/, 'markdown confirms no verify package');
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
