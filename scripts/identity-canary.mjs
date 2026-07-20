import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateVerifyLock } from './identity-verify-lock.mjs';

const ROOT = process.cwd();
const OUT_DIR = 'backups/identity/canary';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
  return file;
}

function hash(value, length = 12) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, length);
}

function redact(input) {
  if (Array.isArray(input)) return input.map(redact);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|[A-Za-z0-9_-]{16,})/.test(input))) return `[redacted:${hash(input)}]`;
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (/email|telegram|user|uid|target|source|canonical|id/i.test(key)) return [key, redact(value)];
    return [key, redact(value)];
  }));
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function renderSummary(report) {
  return [
    '# Identity Canary Execution',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Ready for Cutover: ${report.readyForCutover}`,
    `Cutover: ${report.cutover}`,
    `Stop reason: ${report.stopReason || '-'}`,
    '',
    '## Steps',
    '',
    table(['#', 'Action', 'Decision', 'Changed Rows', 'Invariants', 'Owner Access', 'Rollback'], (report.steps || []).map((step, index) => [
      index + 1,
      step.actionId,
      step.decision,
      step.changed?.length || 0,
      step.invariants?.passed ? 'PASS' : 'FAILED',
      step.ownerAccess?.preserved ? 'PASS' : 'FAILED',
      step.rollback?.available ? 'AVAILABLE' : 'MISSING',
    ])),
    '',
    '## Changed Documents',
    '',
    table(['Action', 'Table', 'Operation', 'ID'], (report.changedDocuments || []).map(item => [item.actionId, item.table, item.operation, item.id])),
    '',
    '## Safety',
    '',
    '- Firestore writes outside approved action: NO',
    '- Cutover started: NO',
    '- Rollback executed automatically: NO',
    '- Production deploy by this script: NO',
    '',
  ].join('\n');
}

function writeReports(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'canary-report.json');
  const redactedJsonPath = path.join(OUT_DIR, 'canary-report-redacted.json');
  const summaryPath = path.join(OUT_DIR, 'canary-summary.md');
  const redactedSummaryPath = path.join(OUT_DIR, 'canary-summary-redacted.md');
  const rollbackPath = path.join(OUT_DIR, 'rollback-checklist.md');
  const redacted = redact(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redacted, null, 2)}\n`);
  fs.writeFileSync(summaryPath, renderSummary(report));
  fs.writeFileSync(redactedSummaryPath, renderSummary(redacted));
  fs.writeFileSync(rollbackPath, [
    '# Identity Canary Rollback Checklist',
    '',
    ...((report.steps || []).map(step => [
      `## ${step.actionId}`,
      '',
      ...(step.rollback?.checklist || ['Rollback checklist unavailable.']).map(item => `- ${item}`),
      '',
    ].join('\n'))),
    '',
    'Rollback was not executed automatically.',
    '',
  ].join('\n'));
  return { jsonPath, redactedJsonPath, summaryPath, redactedSummaryPath, rollbackPath };
}

async function runRemote({ manifest, verifyReport, dryRunReport }) {
  loadEnv(path.join(ROOT, 'server/.env'));
  const apiBase = (process.env.IDENTITY_CANARY_API_BASE || process.env.VITE_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net').replace(/\/$/, '');
  const secret = process.env.IDENTITY_MIGRATION_SECRET || process.env.CRON_SECRET || '';
  if (!secret) throw new Error('IDENTITY_MIGRATION_SECRET or CRON_SECRET is required for remote canary.');
  const res = await fetch(`${apiBase}/api/identity-v2-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-maintenance-secret': secret },
    body: JSON.stringify({ action: 'canary', manifest, verifyReport, dryRunReport }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const error = new Error(json.error || json.message || `Remote canary failed with HTTP ${res.status}`);
    error.report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: 'CANARY_STOPPED',
      readyForCutover: 'NO',
      cutover: 'LOCKED',
      stopReason: json.error || json.message || `HTTP_${res.status}`,
      diagnostics: json.diagnostics || json.report || {},
      steps: [],
      changedDocuments: [],
    };
    throw error;
  }
  return json.result;
}

async function run() {
  const manifest = readJson(requireFile('backups/identity/resolution-manifest-v2.json', 'resolution manifest'));
  const verifyLock = validateVerifyLock();
  if (!verifyLock.ok) {
    const report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: 'CANARY_STOPPED',
      readyForCutover: 'NO',
      cutover: 'LOCKED',
      stopReason: `VERIFY_LOCK_INVALID:${verifyLock.reason}`,
      verifyLock,
      steps: [],
      changedDocuments: [],
    };
    const files = writeReports(report);
    console.log('Identity Canary Execution');
    console.log(`Status: ${report.status}`);
    console.log(`Stop reason: ${report.stopReason}`);
    console.log(`Report: ${files.summaryPath}`);
    process.exitCode = 1;
    return;
  }
  const verifyReport = readJson(requireFile(path.join(verifyLock.packageDir, 'verify-report.json'), 'immutable verify report'));
  const dryRunReport = readJson(requireFile('backups/identity/dryrun/dry-run-report.json', 'dry-run report'));
  let result;
  try {
    result = await runRemote({ manifest, verifyReport, dryRunReport });
  } catch (error) {
    result = error.report || {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: 'CANARY_STOPPED',
      readyForCutover: 'NO',
      cutover: 'LOCKED',
      stopReason: String(error?.message || error),
      steps: [],
      changedDocuments: [],
    };
  }
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    ...result,
    sourceHashes: {
      manifest: hash(manifest),
      verifyLock: verifyLock.lock.signatureHash,
      verifyPackage: hash(verifyLock.lock),
      dryRun: hash(dryRunReport),
    },
    verifyLock: {
      packageDir: verifyLock.packageDir,
      version: verifyLock.version,
      signatureHash: verifyLock.lock.signatureHash,
      packageHash: verifyLock.lock.packageHash,
      immutable: verifyLock.lock.immutable === true,
    },
  };
  const files = writeReports(report);
  console.log('Identity Canary Execution');
  console.log(`Status: ${report.status}`);
  console.log(`Ready for Cutover: ${report.readyForCutover}`);
  console.log(`Cutover: ${report.cutover}`);
  console.log(`Changed documents: ${(report.changedDocuments || []).length}`);
  if (report.stopReason) console.log(`Stop reason: ${report.stopReason}`);
  console.log(`Report: ${files.summaryPath}`);
  console.log(`JSON: ${files.jsonPath}`);
  if (report.status !== 'CANARY_PASSED') process.exitCode = 1;
}

run().catch(error => {
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: 'CANARY_STOPPED',
    readyForCutover: 'NO',
    cutover: 'LOCKED',
    stopReason: String(error?.message || error),
    steps: [],
    changedDocuments: [],
  };
  const files = writeReports(report);
  console.error(`Identity Canary Execution\nStatus: ${report.status}\nStop reason: ${report.stopReason}\nReport: ${files.summaryPath}`);
  process.exit(1);
});
