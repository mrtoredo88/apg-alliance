import { execFileSync } from 'node:child_process';

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: String(error?.message || error).slice(0, 220) });
  }
}

check('Account Core readiness', () => execFileSync('node', ['scripts/account-readiness.mjs'], { stdio: 'pipe' }));
check('Account Core Firestore outage simulation', () => execFileSync('node', ['scripts/account-firestore-outage-test.mjs'], { stdio: 'pipe' }));
check('Architecture guard', () => execFileSync('node', ['scripts/architecture-guard.mjs'], { stdio: 'pipe' }));

const ok = checks.every(item => item.ok);
console.log(JSON.stringify({
  ok,
  mode: 'local_event_readiness',
  productionChanged: false,
  realEmailTelegramMessagesSent: false,
  checks,
}, null, 2));
if (!ok) process.exit(1);
