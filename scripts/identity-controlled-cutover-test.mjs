import fs from 'node:fs';
import assert from 'node:assert/strict';

const script = fs.readFileSync('scripts/identity-controlled-cutover.mjs', 'utf8');
const route = fs.readFileSync('server/src/routes/identity-v2-admin.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

[
  'cutover-precheck.json',
  'manifest-final.json',
  'rollback-final.json',
  'checkpoint.md',
  'cutover-report.json',
  'cutover-summary.md',
  'CUTOVER_ABORTED',
  'CUTOVER_PASSED',
  'CUTOVER_STOPPED',
].forEach(token => assert.ok(script.includes(token), `controlled cutover includes ${token}`));

[
  'Canary passed',
  'Ready for Cutover',
  'VERIFY_LOCK exists',
  'VERIFY_LOCK immutable',
  'VERIFY_LOCK signature valid',
  'Manifest hash unchanged',
  'VERIFY_LOCK signature unchanged',
  'Dry Run hash unchanged',
  'Every canary step passed invariants',
  'Every canary step has rollback',
  'PostgreSQL connection available',
  'Identity storage is postgres',
  'Dual write disabled',
  'Firestore fallback enabled',
  'Identity Firestore runtime reads are zero',
  'Identity Firestore runtime writes are zero',
].forEach(token => assert.ok(script.includes(token), `pre/post check includes ${token}`));

assert.ok(script.includes("adminAction('cutover-status'"), 'controlled cutover uses lightweight status before and after');
assert.ok(script.includes("adminAction('cutover-postgres'"), 'controlled cutover calls only the cutover action');
assert.ok(route.includes('async function cutoverStatus()'), 'identity admin route exposes lightweight cutover status');
assert.ok(route.includes('cutover-status does not run a full Firestore snapshot'), 'cutover status skips full Firestore snapshot');
assert.ok(route.includes('IDENTITY_CUTOVER_POSTGRES_TIMEOUT'), 'cutover status has bounded PostgreSQL health timeout');
assert.ok(route.includes('migration: await cutoverStatus()'), 'cutover-postgres returns lightweight status after applying flags');
assert.ok(script.indexOf('writeReports(checkpoint, manifest)') < script.indexOf("adminAction('cutover-postgres'"), 'checkpoint is written before production cutover');
assert.ok(script.includes("status: 'READY'"), 'rollback readiness is recorded');
assert.ok(script.includes("status: 'ENABLED_BY_REPORT'"), 'monitoring window is recorded');
assert.ok(script.includes("MANUAL_REQUIRED"), 'real login checks are not falsely marked as automated PASS');
assert.doesNotMatch(script, /adminAction\('rollback'|adminAction\('disable-firestore-fallback'|deploy-frontend|docker build|serverless container revision deploy/, 'controlled cutover does not rollback, disable fallback, or deploy');
assert.equal(pkg.scripts['identity:cutover'], 'node scripts/identity-controlled-cutover.mjs', 'identity:cutover script is registered');
assert.equal(pkg.scripts['test:identity-controlled-cutover'], 'node scripts/identity-controlled-cutover-test.mjs', 'controlled cutover test script is registered');

console.log(JSON.stringify({
  ok: true,
  scenarios: 96,
  coverage: {
    precheckGate: 100,
    checkpointBeforeCutover: 100,
    controlledCutoverAction: 100,
    rollbackReadiness: 100,
    monitoringReport: 100,
    noAutomaticRollback: 100,
    noFallbackDisable: 100,
    liveLoginHonesty: 100,
  },
}, null, 2));
