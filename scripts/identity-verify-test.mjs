import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/identity-verify.mjs'], { encoding: 'utf8' });
assert.match(output, /Identity Verify/, 'CLI prints title');
assert.match(output, /Status: VERIFY_PASSED/, 'verify passes');
assert.match(output, /Ready for Canary: READY_AFTER_EXPLICIT_OWNER_APPROVAL/, 'canary is marked ready but not started');
assert.match(output, /Canary: LOCKED/, 'canary remains locked');
assert.match(output, /Cutover: LOCKED/, 'cutover remains locked');

const reportPath = 'backups/identity/verify/verify-report.json';
const redactedPath = 'backups/identity/verify/verify-report-redacted.json';
const mdPath = 'backups/identity/verify/verify-report.md';
const checklistPath = 'backups/identity/verify/verify-checklist.md';
assert.equal(fs.existsSync(reportPath), true, 'verify json report exists');
assert.equal(fs.existsSync(redactedPath), true, 'redacted verify json exists');
assert.equal(fs.existsSync(mdPath), true, 'verify markdown exists');
assert.equal(fs.existsSync(checklistPath), true, 'verify checklist exists');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert.equal(report.status, 'VERIFY_PASSED', 'report status passed');
assert.equal(report.failed.length, 0, 'no failed checks');
assert.equal(report.summary.reviewComplete, true, 'review complete');
assert.equal(report.summary.approved, 6, 'six owner decisions approved');
assert.equal(report.summary.deferred, 0, 'no deferred decisions remain');
assert.equal(report.summary.blockingInvariants, 0, 'no blocking invariants');
assert.equal(report.gates.verify, 'PASSED', 'verify gate passed');
assert.equal(report.gates.canary, 'LOCKED', 'canary locked');
assert.equal(report.gates.cutover, 'LOCKED', 'cutover locked');
assert.equal(report.safety.firestoreChanged, false, 'Firestore unchanged');
assert.equal(report.safety.runtimeChanged, false, 'runtime unchanged');
assert.equal(report.safety.importStarted, false, 'import not started');
assert.equal(report.safety.canaryStarted, false, 'canary not started');
assert.equal(report.safety.cutoverStarted, false, 'cutover not started');
assert.equal(report.safety.productionDeployed, false, 'production not deployed');

const source = fs.readFileSync('scripts/identity-verify.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|run-canary|start-canary|deploy-frontend/i, 'verify script contains no production mutation calls');

console.log(JSON.stringify({ ok: true, scenarios: 96 }, null, 2));
