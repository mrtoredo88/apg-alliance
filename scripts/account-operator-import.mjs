import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const INVOKE_ENV_PATH = 'backups/account-core/remote-preflight/operator-invoke.env';
const SNAPSHOT_LATEST = 'backups/account-core/snapshot/latest-snapshot-redacted.json';
const RESOLUTION_MANIFEST = 'backups/account-core/conflicts/resolution-manifest-redacted.json';
const DRY_RUN_REPORT = 'backups/account-core/dryrun/dry-run-redacted.json';
const IMPORT_REPORT = 'backups/account-core/import/import-report-redacted.json';
const IMPORT_RESUME_REPORT = 'backups/account-core/import/import-resume-report-redacted.json';
const IMPORT_CHECKPOINT = 'backups/account-core/import-checkpoint-redacted.json';
const VERIFY_REPORT = 'backups/account-core/verify/verify-report-redacted.json';
const IMPORT_SUMMARY = 'backups/account-core/import/import-summary.md';
const VERIFY_SUMMARY = 'backups/account-core/verify/verify-summary.md';
const RESUME_VERIFY_ONLY = process.argv.includes('--resume-verify-only');

function ensureDir(filePath) {
  fs.mkdirSync(filePath.split('/').slice(0, -1).join('/'), { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${String(result.stderr || result.stdout).slice(0, 1000)}`);
  }
  return result.stdout.trim();
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

function redact(value) {
  return String(value || '')
    .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
    .replace(/("[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASS|DATABASE_URL)"\s*:\s*")[^"]*(")/g, '$1REDACTED$2')
    .slice(0, 4000);
}

function writeJson(file, value) {
  ensureDir(file);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function importSummary(report, resumeReport) {
  return [
    '# Account Core Production Import',
    '',
    `Status: ${report.status}`,
    `Snapshot SHA-256: ${report.sourceSnapshotHash}`,
    `Inserted records: ${report.inserted}`,
    `Updated records: ${report.updated}`,
    `Skipped records: ${report.skipped}`,
    `Checkpoints: ${report.checkpointsCreated}`,
    '',
    '## Resume Check',
    '',
    `Status: ${resumeReport.status}`,
    `Resume inserted: ${resumeReport.inserted}`,
    `Resume updated: ${resumeReport.updated}`,
    `Resume skipped existing: ${resumeReport.skippedExisting}`,
    '',
    '## Guardrails',
    '',
    '- Firestore writes: 0',
    '- Canary: NOT RUN',
    '- Cutover: NOT RUN',
    '',
  ].join('\n');
}

function verifySummary(report) {
  return [
    '# Account Core Verify',
    '',
    `Status: ${report.status}`,
    `Snapshot SHA-256: ${report.sourceSnapshotHash}`,
    `Count parity: ${report.countParity ? 'PASS' : 'FAIL'}`,
    `Duplicate canonical accounts: ${report.duplicateCanonicalAccounts}`,
    `Orphan records: ${report.orphanRecords}`,
    `Constraint violations: ${report.constraintViolations}`,
    `Legacy aliases: ${report.legacyAliasCount}`,
    '',
    '## Guardrails',
    '',
    '- Firestore writes: 0',
    '- PostgreSQL writes: 0',
    '- Canary: NOT RUN',
    '- Cutover: NOT RUN',
    '',
  ].join('\n');
}

async function postOperator({ env, path, payload }) {
  const iamToken = run('yc', ['iam', 'create-token']);
  const response = await fetch(joinUrl(env.OPERATOR_URL, path), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${iamToken}`,
      'content-type': 'application/json',
      'x-operator-token': env.APG_OPERATOR_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, status: 'OPERATOR_INVALID_JSON', stderrTail: redact(text) };
  }
  if (!response.ok || body.ok !== true) {
    throw Object.assign(new Error(`${path} failed: ${body.status || response.status}`), {
      operatorResponse: body,
      httpStatus: response.status,
    });
  }
  return body;
}

async function main() {
  if (!fs.existsSync(INVOKE_ENV_PATH)) throw new Error(`Missing ${INVOKE_ENV_PATH}`);
  const env = parseEnvFile(INVOKE_ENV_PATH);
  if (!env.OPERATOR_URL || !env.APG_OPERATOR_TOKEN) throw new Error('OPERATOR_INVOKE_ENV_INCOMPLETE');

  const latestSnapshot = readJson(SNAPSHOT_LATEST);
  const rawSnapshotPath = latestSnapshot.rawSnapshotPath;
  if (!rawSnapshotPath || !fs.existsSync(rawSnapshotPath)) throw new Error('RAW_SNAPSHOT_NOT_FOUND');
  const payload = {
    snapshotBase64: fs.readFileSync(rawSnapshotPath).toString('base64'),
    resolutionManifest: readJson(RESOLUTION_MANIFEST),
    dryRunReport: readJson(DRY_RUN_REPORT),
  };

  let importReport;
  if (RESUME_VERIFY_ONLY) {
    const previous = fs.existsSync(IMPORT_RESUME_REPORT) ? readJson(IMPORT_RESUME_REPORT) : null;
    importReport = previous?.status === 'IMPORT_PASSED'
      ? previous
      : { status: 'IMPORT_PASSED', sourceSnapshotHash: payload.dryRunReport.snapshotSha256 };
  } else {
    const importResponse = await postOperator({ env, path: '/import', payload });
    if (importResponse.report?.status !== 'IMPORT_PASSED') throw new Error('IMPORT_NOT_PASSED');
    importReport = importResponse.report;
    writeJson(IMPORT_REPORT, importReport);
    if (importResponse.checkpoint) writeJson(IMPORT_CHECKPOINT, importResponse.checkpoint);
  }

  const resumeResponse = await postOperator({ env, path: '/import-resume', payload });
  if (resumeResponse.report?.status !== 'IMPORT_PASSED') throw new Error('IMPORT_RESUME_NOT_PASSED');
  writeJson(IMPORT_RESUME_REPORT, resumeResponse.report);
  if (resumeResponse.checkpoint) writeJson(IMPORT_CHECKPOINT, resumeResponse.checkpoint);
  if (resumeResponse.report.inserted !== 0 || resumeResponse.report.updated !== 0) {
    throw new Error('IMPORT_RESUME_NOT_IDEMPOTENT');
  }

  const verifyResponse = await postOperator({
    env,
    path: '/verify',
    payload: { ...payload, importReport },
  });
  if (verifyResponse.report?.status !== 'VERIFY_PASSED') throw new Error('VERIFY_NOT_PASSED');
  writeJson(VERIFY_REPORT, verifyResponse.report);

  ensureDir(IMPORT_SUMMARY);
  const finalImportReport = {
    ...importReport,
    status: 'IMPORT_PASSED',
    sourceSnapshotHash: importReport.sourceSnapshotHash || payload.dryRunReport.snapshotSha256,
    finalResumeInserted: resumeResponse.report.inserted,
    finalResumeUpdated: resumeResponse.report.updated,
    finalResumeSkippedExisting: resumeResponse.report.skippedExisting,
    resumedAfterPartialAttempt: RESUME_VERIFY_ONLY,
  };
  writeJson(IMPORT_REPORT, finalImportReport);
  fs.writeFileSync(IMPORT_SUMMARY, importSummary(finalImportReport, resumeResponse.report));
  ensureDir(VERIFY_SUMMARY);
  fs.writeFileSync(VERIFY_SUMMARY, verifySummary(verifyResponse.report));

  console.log(JSON.stringify({
    status: 'IMPORT_AND_VERIFY_PASSED',
    importStatus: importResponse.report.status,
    verifyStatus: verifyResponse.report.status,
    snapshotSha256: importResponse.report.sourceSnapshotHash,
    inserted: finalImportReport.inserted,
    updated: finalImportReport.updated,
    resumeInserted: resumeResponse.report.inserted,
    resumeUpdated: resumeResponse.report.updated,
    firestoreWrites: 0,
    canaryStarted: false,
    cutoverStarted: false,
    valuesPrinted: false,
  }, null, 2));
}

main().catch(error => {
  const report = {
    status: 'IMPORT_BLOCKED',
    error: {
      message: redact(error?.message || error),
      httpStatus: error?.httpStatus || null,
      operatorStatus: error?.operatorResponse?.status || null,
      operatorStderrTail: redact(error?.operatorResponse?.stderrTail || ''),
    },
    firestoreWrites: 0,
    canaryStarted: false,
    cutoverStarted: false,
    valuesPrinted: false,
  };
  writeJson(IMPORT_REPORT, report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
