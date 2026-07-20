import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

function run(script) {
  const result = spawnSync('npm', ['run', script], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 });
  return {
    script,
    ok: result.status === 0,
    status: result.status,
    stdoutTail: String(result.stdout || '').slice(-2000),
    stderrTail: String(result.stderr || '').slice(-2000),
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function activeAccountRuntime() {
  try {
    const raw = execFileSync('yc', ['serverless', 'container', 'revision', 'list', '--container-name', 'apg-api', '--format', 'json'], { encoding: 'utf8' });
    const latest = JSON.parse(raw)[0] || {};
    const env = latest.image?.environment || {};
    return {
      revision: latest.id || '',
      status: latest.status || '',
      accountStorage: env.ACCOUNT_STORAGE || '',
      accountCanary: env.ACCOUNT_CANARY || '',
      accountDualRead: env.ACCOUNT_DUAL_READ || '',
      accountDualWrite: env.ACCOUNT_DUAL_WRITE || '',
      accountFallback: env.ACCOUNT_FALLBACK || '',
      network: Boolean(latest.connectivity?.network_id),
    };
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 300) };
  }
}

function accountProductionRuntimeCheck() {
  const remotePreflight = fs.existsSync('backups/account-core/remote-preflight/remote-preflight-report-redacted.json')
    ? readJson('backups/account-core/remote-preflight/remote-preflight-report-redacted.json')
    : null;
  const cutover = fs.existsSync('backups/account-core/final/production-cutover-report.json')
    ? readJson('backups/account-core/final/production-cutover-report.json')
    : null;
  const runtime = activeAccountRuntime();
  const failures = [];
  if (!remotePreflight?.ok || remotePreflight?.status !== 'REMOTE_PREFLIGHT_PASSED') failures.push('REMOTE_PREFLIGHT_NOT_PASSED');
  if (cutover?.status !== 'CUTOVER_PASSED' || cutover?.runtimeSwitchedToPostgres !== true) failures.push('CUTOVER_NOT_PASSED');
  if (runtime.accountStorage !== 'postgres') failures.push('ACCOUNT_STORAGE_NOT_POSTGRES');
  if (runtime.accountCanary !== '0') failures.push('ACCOUNT_CANARY_NOT_DISABLED');
  if (runtime.accountDualRead !== '0') failures.push('ACCOUNT_DUAL_READ_NOT_DISABLED');
  if (runtime.accountDualWrite !== '0') failures.push('ACCOUNT_DUAL_WRITE_NOT_DISABLED');
  if (!runtime.network) failures.push('APG_API_VPC_NOT_CONFIGURED');
  return {
    script: 'account:production-runtime',
    ok: failures.length === 0,
    status: failures.length === 0 ? 0 : 1,
    stdoutTail: JSON.stringify({
      ok: failures.length === 0,
      runtime,
      remotePreflight: remotePreflight?.status || 'MISSING',
      cutover: cutover?.status || 'MISSING',
      localPreflightSkipped: true,
      reason: 'production_postgres_is_private_vpc_only',
    }, null, 2),
    stderrTail: failures.join(', '),
  };
}

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const checks = [
  run('test:identity-v2'),
  run('test:identity-cutover'),
  run('test:apg-foundation'),
  run('test:architecture-guard'),
  run('test:identity-v2-guard'),
  run('test:account-core'),
  run('test:account-core-guard'),
  run('test:account-integration'),
  run('test:account-firestore-outage'),
  run('readiness:account'),
  run('readiness:event'),
];

checks.push(accountProductionRuntimeCheck());

const ok = checks.every(item => item.ok);
const report = {
  status: ok ? 'PRODUCTION_READY' : 'PRODUCTION_BLOCKED',
  generatedAt: new Date().toISOString(),
  commit,
  productionChanged: false,
  firestoreChanged: false,
  importStarted: false,
  verifyStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!ok) process.exit(1);
