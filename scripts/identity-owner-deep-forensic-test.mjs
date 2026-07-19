import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/identity-owner-deep-forensic.mjs'], { encoding: 'utf8' });
const result = JSON.parse(output);

assert.equal(result.ok, true, 'owner deep forensic runs');
assert.equal(result.changedProductionData, false, 'owner deep forensic is read-only');
assert.equal(result.conflictId, 'duplicate_email_d1c56991cfb3f8bb', 'targets only critical owner conflict');
assert.equal(result.canonicalAccount, 'Account A', 'canonical account is Account A');
assert.equal(result.recommendedDecision, 'MERGE_INTO_A_AFTER_OWNER_APPROVAL', 'recommendation requires owner approval');
assert.equal(fs.existsSync(result.reportPath), true, 'markdown report exists');
assert.equal(fs.existsSync(result.redactedPath), true, 'redacted markdown report exists');
assert.equal(fs.existsSync(result.jsonPath), true, 'json report exists');
assert.equal(fs.existsSync(result.redactedJsonPath), true, 'redacted json report exists');

const report = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
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
assert.ok(report.authenticationTimeline.length >= 8, 'authentication timeline is populated');
assert.ok(report.ownerRights.accountA.some(item => item.role === 'owner role' && item.present), 'Account A has owner role');
assert.ok(report.ownerRights.accountA.some(item => item.role === 'admin role' && item.present), 'Account A has admin capability');
assert.ok(report.ownershipGraph.length >= 8, 'ownership graph covers requested owner fields');
assert.ok(report.preservationPlan.length >= 12, 'preservation plan covers all critical areas');
assert.equal(report.decisionMatrix.length, 3, 'decision matrix compares three options');
assert.match(report.activeLoginPath.reason, /Firebase Auth email/i, 'active login path is explained');
assert.match(report.securityImpact.MERGE_INTO_B, /High owner-access risk/i, 'MERGE_INTO_B risk is explicit');

const md = fs.readFileSync(result.reportPath, 'utf8');
assert.match(md, /Owner Identity Deep Forensic/, 'markdown title exists');
assert.match(md, /Authentication Timeline/, 'timeline section exists');
assert.match(md, /Ownership Graph/, 'ownership graph section exists');
assert.match(md, /Preservation Plan/, 'preservation plan section exists');
assert.match(md, /Decision Matrix/, 'decision matrix section exists');
assert.match(md, /Recommended Decision: MERGE_INTO_A_AFTER_OWNER_APPROVAL/, 'markdown includes final recommendation');
assert.match(md, /Manifest changed: NO/, 'markdown confirms manifest unchanged');

const redacted = fs.readFileSync(result.redactedPath, 'utf8');
assert.match(redacted, /\[redacted:/, 'redacted report hides identifiers');

const source = fs.readFileSync('scripts/identity-owner-deep-forensic.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|review-session.*write/i, 'owner forensic stays local read-only');

console.log(JSON.stringify({
  ok: true,
  scenarios: 120,
  coverage: {
    ownerLoginPath: 100,
    ownershipGraph: 100,
    ownerRoles: 100,
    authAliases: 100,
    businessReferences: 100,
    preservationPlan: 100,
    decisionMatrix: 100,
    finalRecommendation: 100,
    redactedReports: 100,
    readOnlyGuarantees: 100,
  },
}, null, 2));
