import { execFileSync } from 'node:child_process';

execFileSync('node', ['scripts/account-core-architecture-guard.mjs'], { stdio: 'inherit' });
execFileSync('node', ['scripts/account-dry-run.mjs'], { stdio: 'inherit' });

console.log(JSON.stringify({
  ok: true,
  mode: 'local_read_only_account_verify',
  verifyStartedAgainstProduction: false,
  firestoreChanged: false,
  productionChanged: false,
}, null, 2));
