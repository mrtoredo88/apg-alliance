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

const accountPreflight = run('account:preflight');
checks.push(accountPreflight);

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
