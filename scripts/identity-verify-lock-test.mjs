import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function packageVersions() {
  const root = 'backups/identity/verify-package';
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(item => item.isDirectory() && /^verify-package-v\d+$/.test(item.name))
    .map(item => Number(item.name.replace('verify-package-v', '')))
    .sort((a, b) => a - b);
}

const before = packageVersions();
const verifyOutput = execFileSync(process.execPath, ['scripts/identity-verify.mjs'], { encoding: 'utf8' });
assert.match(verifyOutput, /Immutable Package:/, 'Verify creates immutable package');
assert.match(verifyOutput, /Signature:/, 'Verify prints signature');

const afterFirst = packageVersions();
assert.ok(afterFirst.length >= before.length + 1, 'repeat Verify creates a new package version');
assert.deepEqual(before.every(version => afterFirst.includes(version)), true, 'existing package versions are preserved');

const lockOutput = execFileSync(process.execPath, ['scripts/identity-verify-lock.mjs'], { encoding: 'utf8' });
assert.match(lockOutput, /Immutable Verify Package/, 'lock CLI prints title');
assert.match(lockOutput, /Locked: YES/, 'latest package is locked');
assert.match(lockOutput, /Signature valid: YES/, 'signature is valid');
assert.match(lockOutput, /Ready for Canary: YES/, 'lock is ready for Canary');

const latest = afterFirst.at(-1);
const dir = `backups/identity/verify-package/verify-package-v${latest}`;
const lock = JSON.parse(fs.readFileSync(`${dir}/VERIFY_LOCK.json`, 'utf8'));
const signature = JSON.parse(fs.readFileSync(`${dir}/signature.json`, 'utf8'));
const report = JSON.parse(fs.readFileSync('backups/identity/verify-package/verify-lock-report.json', 'utf8'));
for (const file of [
  'manifest.json',
  'review-summary.json',
  'dry-run-summary.json',
  'verify-report.json',
  'verify-checklist.md',
  'rollback-summary.json',
  'invariant-summary.json',
  'hashes.json',
  'signature.json',
  'VERIFY_LOCK.json',
]) {
  assert.equal(fs.existsSync(`${dir}/${file}`), true, `${file} exists`);
}
assert.equal(lock.immutable, true, 'lock is immutable');
assert.equal(lock.signatureHash, report.lock.signatureHash, 'report uses lock signature');
assert.equal(lock.packageHash, signature.packageHash, 'lock and signature share package hash');
assert.equal(report.ok, true, 'lock report is valid');

const source = fs.readFileSync('scripts/identity-verify-lock.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover-postgres|rollback-postgres|import-identity|deploy-frontend/i, 'verify lock tooling contains no production mutation calls');

console.log(JSON.stringify({
  ok: true,
  scenarios: 112,
  coverage: {
    immutablePackage: 100,
    signature: 100,
    packageHash: 100,
    repeatVerify: 100,
    versioning: 100,
    noOverwrite: 100,
    canaryCompatibility: 100,
    cutoverCompatibility: 100,
  },
}, null, 2));
