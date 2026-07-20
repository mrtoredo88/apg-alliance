import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BACKUP_DIR = 'backups/identity';
const PACKAGE_ROOT = path.join(BACKUP_DIR, 'verify-package');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha(value, length = 16) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, length);
}

function shaFull(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function packageDirs() {
  if (!fs.existsSync(PACKAGE_ROOT)) return [];
  return fs.readdirSync(PACKAGE_ROOT, { withFileTypes: true })
    .filter(item => item.isDirectory() && /^verify-package-v\d+$/.test(item.name))
    .map(item => ({
      version: Number(item.name.replace('verify-package-v', '')),
      dir: path.join(PACKAGE_ROOT, item.name),
    }))
    .sort((a, b) => a.version - b.version);
}

function latestPackageDir() {
  const dirs = packageDirs();
  return dirs.at(-1) || null;
}

function nextPackageDir() {
  const latest = latestPackageDir();
  const version = latest ? latest.version + 1 : 1;
  return { version, dir: path.join(PACKAGE_ROOT, `verify-package-v${version}`) };
}

function assertPackageNotExisting(dir) {
  if (fs.existsSync(dir)) throw new Error(`Immutable verify package already exists: ${dir}`);
}

function sourcePath(name) {
  const map = {
    manifest: path.join(BACKUP_DIR, 'resolution-manifest-v2.json'),
    review: path.join(BACKUP_DIR, 'reviews', 'identity-review-session-2026-07-19T23-33-16-680Z.json'),
    dryRun: path.join(BACKUP_DIR, 'dryrun', 'dry-run-report.json'),
    verify: path.join(BACKUP_DIR, 'verify', 'verify-report.json'),
    verifyChecklist: path.join(BACKUP_DIR, 'verify', 'verify-checklist.md'),
    rollback: path.join(BACKUP_DIR, 'dryrun', 'dry-run-report.json'),
    invariants: path.join(BACKUP_DIR, 'invariants', 'invariant-classification.json'),
  };
  return map[name];
}

function requireExisting(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
  return file;
}

function rollbackSummaryFromDryRun(dryRun) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'dry-run-report.rollbackPreview',
    generated: dryRun.rollbackPreview?.generated === true,
    operations: dryRun.rollbackPreview?.operations || [],
    status: dryRun.rollbackPreview?.generated === true ? 'READY' : 'MISSING',
  };
}

function reviewSummaryFromManifest(manifest, review) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: sourcePath('review'),
    reviewComplete: manifest.reviewComplete === true,
    approved: manifest.summary?.approved || 0,
    deferred: manifest.summary?.deferred || 0,
    unresolved: manifest.unresolvedConflicts?.length || 0,
    stale: manifest.staleDecisions?.length || 0,
    reviewSessionId: review.sessionId || review.id || null,
  };
}

function dryRunSummary(dryRun) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: dryRun.status || null,
    importAllowed: dryRun.importAllowed === true,
    readyForVerify: dryRun.readyForVerify === true,
    operations: dryRun.operations?.length || 0,
    errors: dryRun.diff?.errors?.length || 0,
    preservation: dryRun.preservation?.status || null,
  };
}

function invariantSummary(invariants) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: invariants.summary?.counts || {},
    readiness: invariants.summary?.readiness || {},
  };
}

function signaturePayload({ manifest, reviewSummary, dryRunSummaryValue, verifyReport, rollbackSummary, invariantSummaryValue }) {
  return {
    manifest,
    reviewSummary,
    dryRunSummary: dryRunSummaryValue,
    verifyReport,
    rollbackSummary,
    invariantSummary: invariantSummaryValue,
  };
}

export function createImmutableVerifyPackage() {
  const manifest = readJson(requireExisting(sourcePath('manifest'), 'manifest'));
  const review = readJson(requireExisting(sourcePath('review'), 'review session'));
  const dryRun = readJson(requireExisting(sourcePath('dryRun'), 'dry run'));
  const verifyReport = readJson(requireExisting(sourcePath('verify'), 'verify report'));
  const invariants = readJson(requireExisting(sourcePath('invariants'), 'invariant report'));
  if (verifyReport.status !== 'VERIFY_PASSED') throw new Error(`Verify package requires VERIFY_PASSED, got ${verifyReport.status}`);
  const target = nextPackageDir();
  assertPackageNotExisting(target.dir);
  fs.mkdirSync(target.dir, { recursive: true });
  const reviewSummary = reviewSummaryFromManifest(manifest, review);
  const dryRunSummaryValue = dryRunSummary(dryRun);
  const rollbackSummary = rollbackSummaryFromDryRun(dryRun);
  const invariantSummaryValue = invariantSummary(invariants);
  const hashes = {
    manifestHash: sha(manifest),
    reviewHash: sha(reviewSummary),
    dryRunHash: sha(dryRunSummaryValue),
    verifyHash: sha(verifyReport),
    rollbackHash: sha(rollbackSummary),
    invariantHash: sha(invariantSummaryValue),
  };
  const payload = signaturePayload({ manifest, reviewSummary, dryRunSummaryValue, verifyReport, rollbackSummary, invariantSummaryValue });
  const signature = {
    version: 1,
    algorithm: 'SHA256(JSON.stringify(payload))',
    createdAt: new Date().toISOString(),
    packageVersion: target.version,
    packageHash: shaFull(payload),
    payloadHashes: hashes,
  };
  const lock = {
    version: target.version,
    createdAt: signature.createdAt,
    manifestHash: hashes.manifestHash,
    reviewHash: hashes.reviewHash,
    dryRunHash: hashes.dryRunHash,
    verifyHash: hashes.verifyHash,
    invariantHash: hashes.invariantHash,
    signatureHash: sha(signature),
    packageHash: signature.packageHash,
    immutable: true,
  };
  writeJson(path.join(target.dir, 'manifest.json'), manifest);
  writeJson(path.join(target.dir, 'review-summary.json'), reviewSummary);
  writeJson(path.join(target.dir, 'dry-run-summary.json'), dryRunSummaryValue);
  writeJson(path.join(target.dir, 'verify-report.json'), verifyReport);
  fs.copyFileSync(requireExisting(sourcePath('verifyChecklist'), 'verify checklist'), path.join(target.dir, 'verify-checklist.md'));
  writeJson(path.join(target.dir, 'rollback-summary.json'), rollbackSummary);
  writeJson(path.join(target.dir, 'invariant-summary.json'), invariantSummaryValue);
  writeJson(path.join(target.dir, 'hashes.json'), hashes);
  writeJson(path.join(target.dir, 'signature.json'), signature);
  writeJson(path.join(target.dir, 'VERIFY_LOCK.json'), lock);
  return { packageDir: target.dir, lock, signature };
}

export function validateVerifyLock(dir = latestPackageDir()?.dir) {
  if (!dir) return { ok: false, reason: 'VERIFY_LOCK_NOT_FOUND', packageDir: null };
  const required = [
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
  ];
  const missing = required.filter(file => !fs.existsSync(path.join(dir, file)));
  if (missing.length) return { ok: false, reason: 'VERIFY_PACKAGE_INCOMPLETE', packageDir: dir, missing };
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const reviewSummary = readJson(path.join(dir, 'review-summary.json'));
  const dryRunSummaryValue = readJson(path.join(dir, 'dry-run-summary.json'));
  const verifyReport = readJson(path.join(dir, 'verify-report.json'));
  const rollbackSummary = readJson(path.join(dir, 'rollback-summary.json'));
  const invariantSummaryValue = readJson(path.join(dir, 'invariant-summary.json'));
  const hashes = readJson(path.join(dir, 'hashes.json'));
  const signature = readJson(path.join(dir, 'signature.json'));
  const lock = readJson(path.join(dir, 'VERIFY_LOCK.json'));
  const calculatedHashes = {
    manifestHash: sha(manifest),
    reviewHash: sha(reviewSummary),
    dryRunHash: sha(dryRunSummaryValue),
    verifyHash: sha(verifyReport),
    rollbackHash: sha(rollbackSummary),
    invariantHash: sha(invariantSummaryValue),
  };
  const payload = signaturePayload({ manifest, reviewSummary, dryRunSummaryValue, verifyReport, rollbackSummary, invariantSummaryValue });
  const calculatedPackageHash = shaFull(payload);
  const calculatedSignatureHash = sha({ ...signature, packageHash: calculatedPackageHash, payloadHashes: calculatedHashes });
  const checks = [
    { name: 'VERIFY_LOCK immutable', ok: lock.immutable === true },
    { name: 'Payload hashes match', ok: JSON.stringify(hashes) === JSON.stringify(calculatedHashes) },
    { name: 'Signature package hash valid', ok: signature.packageHash === calculatedPackageHash },
    { name: 'Lock package hash valid', ok: lock.packageHash === calculatedPackageHash },
    { name: 'Lock signature hash valid', ok: lock.signatureHash === calculatedSignatureHash },
    { name: 'Verify report passed', ok: verifyReport.status === 'VERIFY_PASSED' },
  ];
  return {
    ok: checks.every(item => item.ok),
    reason: checks.every(item => item.ok) ? 'OK' : 'VERIFY_LOCK_INVALID',
    packageDir: dir,
    version: lock.version,
    lock,
    signature,
    hashes,
    checks,
  };
}

function renderLockReport(result) {
  return [
    '# Immutable Verify Package',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Package: ${result.packageDir || '-'}`,
    `Version: ${result.version || '-'}`,
    `Locked: ${result.ok ? 'YES' : 'NO'}`,
    `Signature valid: ${result.ok ? 'YES' : 'NO'}`,
    `Ready for Canary: ${result.ok ? 'YES' : 'NO'}`,
    '',
    '## Hashes',
    '',
    table(['Hash', 'Value'], Object.entries(result.lock || {}).filter(([key]) => key.endsWith('Hash')).map(([key, value]) => [key, value])),
    '',
    '## Checks',
    '',
    table(['Check', 'Status'], (result.checks || []).map(item => [item.name, item.ok ? 'PASS' : 'FAILED'])),
    '',
  ].join('\n');
}

function writeLockReports(result) {
  fs.mkdirSync(PACKAGE_ROOT, { recursive: true });
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: result.ok ? 'VERIFY_LOCK_VALID' : 'VERIFY_LOCK_INVALID',
    ...result,
  };
  writeJson(path.join(PACKAGE_ROOT, 'verify-lock-report.json'), report);
  fs.writeFileSync(path.join(PACKAGE_ROOT, 'verify-lock-report.md'), renderLockReport(result));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateVerifyLock();
  const report = writeLockReports(result);
  console.log('Immutable Verify Package');
  console.log(`Version: ${report.version || report.lock?.version || '-'}`);
  console.log(`Locked: ${report.ok ? 'YES' : 'NO'}`);
  console.log(`Manifest hash: ${report.lock?.manifestHash || '-'}`);
  console.log(`Package hash: ${report.lock?.packageHash || '-'}`);
  console.log(`Signature valid: ${report.ok ? 'YES' : 'NO'}`);
  console.log(`Ready for Canary: ${report.ok ? 'YES' : 'NO'}`);
  if (!report.ok) process.exitCode = 1;
}
