import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateVerifyLock } from './identity-verify-lock.mjs';

const ROOT = process.cwd();
const OUT_DIR = 'backups/identity/cutover';
const API_BASE = (process.env.IDENTITY_CUTOVER_API_BASE || process.env.IDENTITY_CANARY_API_BASE || process.env.VITE_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net').replace(/\/$/, '');

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

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha(value, length = 12) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, length);
}

function shell(args, fallback = '') {
  try {
    return execFileSync(args[0], args.slice(1), { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function check(name, ok, details = {}) {
  return { name, ok: Boolean(ok), details };
}

function redact(input) {
  if (Array.isArray(input)) return input.map(redact);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|telegram:|[A-Za-z0-9_-]{16,})/.test(input))) return `[redacted:${sha(input)}]`;
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, redact(value)]));
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

async function adminAction(action, body = {}) {
  const secret = process.env.IDENTITY_MIGRATION_SECRET || process.env.CRON_SECRET || '';
  if (!secret) throw new Error('IDENTITY_MIGRATION_SECRET or CRON_SECRET is required.');
  const res = await fetch(`${API_BASE}/api/identity-v2-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-maintenance-secret': secret },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const error = new Error(json.error || json.message || `HTTP_${res.status}`);
    error.statusCode = res.status;
    error.response = json;
    throw error;
  }
  return json.result;
}

function summarizeStatus(status = {}) {
  return {
    postgres: status.postgres,
    dependencyMonitor: status.dependencyMonitor,
    identity: {
      provider: status.identity?.provider,
      storage: status.identity?.storage,
      fallbackEnabled: status.identity?.fallbackEnabled,
      dualRead: status.identity?.dualRead,
      dualWrite: status.identity?.dualWrite,
    },
  };
}

function validateCanary(canary, manifest, dryRun, verifyLock) {
  return [
    check('Canary passed', canary.status === 'CANARY_PASSED', { status: canary.status }),
    check('Ready for Cutover', canary.readyForCutover === 'YES', { readyForCutover: canary.readyForCutover }),
    check('Cutover locked before execution', canary.cutover === 'LOCKED', { cutover: canary.cutover }),
    check('VERIFY_LOCK exists', verifyLock.ok === true, { packageDir: verifyLock.packageDir, reason: verifyLock.reason }),
    check('VERIFY_LOCK immutable', verifyLock.lock?.immutable === true, { immutable: verifyLock.lock?.immutable }),
    check('VERIFY_LOCK signature valid', verifyLock.ok === true, { signatureHash: verifyLock.lock?.signatureHash }),
    check('Manifest hash unchanged', canary.sourceHashes?.manifest === sha(manifest), { expected: canary.sourceHashes?.manifest, actual: sha(manifest) }),
    check('VERIFY_LOCK signature unchanged', canary.sourceHashes?.verifyLock === verifyLock.lock?.signatureHash, { expected: canary.sourceHashes?.verifyLock, actual: verifyLock.lock?.signatureHash }),
    check('Dry Run hash unchanged', canary.sourceHashes?.dryRun === sha(dryRun), { expected: canary.sourceHashes?.dryRun, actual: sha(dryRun) }),
    check('Every canary step passed invariants', (canary.steps || []).every(step => step.invariants?.passed === true), { steps: (canary.steps || []).length }),
    check('Every canary step has rollback', (canary.steps || []).every(step => step.rollback?.available === true), { steps: (canary.steps || []).length }),
  ];
}

function validatePreStatus(status = {}) {
  return [
    check('PostgreSQL connection available', status.postgres?.connection === 'available' && status.postgres?.ok !== false, { postgres: status.postgres?.connection }),
    check('PostgreSQL has canary rows', Number(status.postgres?.counts?.users || 0) >= 3 && Number(status.postgres?.counts?.identityLinks || 0) >= 9, { counts: status.postgres?.counts }),
    check('Identity storage is postgres', status.identity?.storage === 'postgres', { storage: status.identity?.storage }),
    check('Identity provider is firebase', status.identity?.provider === 'firebase', { provider: status.identity?.provider }),
    check('Dual read enabled', status.identity?.dualRead === true, { dualRead: status.identity?.dualRead }),
    check('Dual write disabled', status.identity?.dualWrite === false, { dualWrite: status.identity?.dualWrite }),
    check('Firestore fallback enabled', status.identity?.fallbackEnabled === true, { fallbackEnabled: status.identity?.fallbackEnabled }),
  ];
}

function validatePostStatus(status = {}) {
  return [
    ...validatePreStatus(status),
    check('Identity Firestore runtime reads are zero', Number(status.dependencyMonitor?.reads?.firestore || 0) === 0, { reads: status.dependencyMonitor?.reads }),
    check('Identity Firestore runtime writes are zero', Number(status.dependencyMonitor?.writes?.firestore || 0) === 0, { writes: status.dependencyMonitor?.writes }),
  ];
}

function renderSummary(report) {
  const rollback = report.rollback || { status: '-' };
  const monitoring = report.monitoring || { status: '-' };
  const steps = report.steps || [];
  const precheck = report.precheck || { checks: [] };
  const postcheck = report.postcheck || { checks: [] };
  const changedData = report.changedData || [];
  const liveChecks = report.liveChecks || [];
  return [
    '# Identity Controlled Cutover',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Cutover: ${report.cutover}`,
    `Ready for Cutover: ${report.readyForCutover}`,
    `Rollback: ${rollback.status}`,
    `Monitoring: ${monitoring.status}`,
    `Commit: ${report.git?.commit || 'unknown'}`,
    `Backend revision: ${report.backend?.revision || 'unknown'}`,
    '',
    '## Precheck',
    '',
    table(['Check', 'Status', 'Details'], precheck.checks.map(item => [item.name, item.ok ? 'PASS' : 'FAILED', JSON.stringify(item.details || {})])),
    '',
    '## Cutover Action',
    '',
    table(['Step', 'Status'], steps.map(item => [item.name, item.status])),
    '',
    '## Postcheck',
    '',
    table(['Check', 'Status', 'Details'], postcheck.checks.map(item => [item.name, item.ok ? 'PASS' : 'FAILED', JSON.stringify(item.details || {})])),
    '',
    '## Changed Data',
    '',
    table(['Scope', 'Change'], changedData.map(item => [item.scope, item.change])),
    '',
    '## Live Checks',
    '',
    table(['Area', 'Status', 'Reason'], liveChecks.map(item => [item.area, item.status, item.reason])),
    '',
  ].join('\n');
}

function writeReports(report, manifest) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = {
    precheck: path.join(OUT_DIR, 'cutover-precheck.json'),
    manifest: path.join(OUT_DIR, 'manifest-final.json'),
    rollback: path.join(OUT_DIR, 'rollback-final.json'),
    checkpoint: path.join(OUT_DIR, 'checkpoint.md'),
    report: path.join(OUT_DIR, 'cutover-report.json'),
    reportRedacted: path.join(OUT_DIR, 'cutover-report-redacted.json'),
    summary: path.join(OUT_DIR, 'cutover-summary.md'),
    summaryRedacted: path.join(OUT_DIR, 'cutover-summary-redacted.md'),
  };
  writeJson(files.precheck, report.precheck);
  writeJson(files.manifest, manifest);
  writeJson(files.rollback, report.rollback);
  fs.writeFileSync(files.checkpoint, renderSummary({ ...report, postcheck: report.postcheck || { checks: [] }, steps: report.steps || [], changedData: report.changedData || [], liveChecks: report.liveChecks || [] }));
  writeJson(files.report, report);
  writeJson(files.reportRedacted, redact(report));
  fs.writeFileSync(files.summary, renderSummary(report));
  fs.writeFileSync(files.summaryRedacted, renderSummary(redact(report)));
  return files;
}

async function run() {
  loadEnv(path.join(ROOT, 'server/.env'));
  const manifest = readJson('backups/identity/resolution-manifest-v2.json');
  const dryRun = readJson('backups/identity/dryrun/dry-run-report.json');
  const canary = readJson('backups/identity/canary/canary-report.json');
  const verifyLock = validateVerifyLock();
  const gitCommit = shell(['git', 'rev-parse', '--short', 'HEAD']);
  const tagTarget = shell(['git', 'rev-list', '-n', '1', 'identity-migration-v1-canary-passed']);
  const backendRevisionsRaw = shell(['yc', 'serverless', 'container', 'revision', 'list', '--container-name', 'apg-api', '--format', 'json'], '[]');
  const backendRevision = JSON.parse(backendRevisionsRaw || '[]')?.[0]?.id || '';
  const preStatus = await adminAction('cutover-status');
  const preChecks = [
    check('Git tag identity-migration-v1-canary-passed exists', Boolean(tagTarget), { tag: 'identity-migration-v1-canary-passed' }),
    check('Current commit is available for audit', Boolean(gitCommit), { commit: gitCommit, canaryTagTarget: tagTarget ? tagTarget.slice(0, 12) : '' }),
    ...validateCanary(canary, manifest, dryRun, verifyLock),
    ...validatePreStatus(preStatus),
  ];
  const precheck = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE.replace(/https?:\/\/([^/]+).*/, 'https://$1/...'),
    git: { commit: gitCommit, canaryTag: 'identity-migration-v1-canary-passed', tagTarget: tagTarget ? tagTarget.slice(0, 12) : '' },
    backend: { revision: backendRevision },
    sourceHashes: { manifest: sha(manifest), verifyLock: verifyLock.lock?.signatureHash || null, dryRun: sha(dryRun), canary: sha(canary) },
    verifyLock: verifyLock.ok ? { packageDir: verifyLock.packageDir, version: verifyLock.version, signatureHash: verifyLock.lock.signatureHash, packageHash: verifyLock.lock.packageHash } : verifyLock,
    status: summarizeStatus(preStatus),
    checks: preChecks,
  };
  if (preChecks.some(item => !item.ok)) {
    const report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: 'CUTOVER_ABORTED',
      readyForCutover: 'NO',
      cutover: 'LOCKED',
      git: precheck.git,
      backend: precheck.backend,
      precheck,
      steps: [],
      postcheck: { checks: [] },
      rollback: { status: 'READY', executed: false, action: 'identity-v2:rollback', checklist: ['Use Migration Center rollback action if owner approves rollback.'] },
      monitoring: { status: 'NOT_STARTED', windowHours: 24 },
      changedData: [],
      liveChecks: [],
    };
    writeReports(report, manifest);
    console.log('Identity Controlled Cutover');
    console.log('Status: CUTOVER_ABORTED');
    console.log('Reason: precheck failed');
    process.exitCode = 1;
    return;
  }
  const checkpoint = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: 'CUTOVER_CHECKPOINT_CREATED',
    readyForCutover: 'YES',
    cutover: 'LOCKED',
    git: precheck.git,
    backend: precheck.backend,
    precheck,
    steps: [],
    postcheck: { checks: [] },
    rollback: { status: 'READY', executed: false, action: 'identity-v2:rollback', checklist: ['Use Migration Center rollback action if owner approves rollback.'] },
    monitoring: { status: 'PENDING_CUTOVER', windowHours: 24 },
    changedData: [],
    liveChecks: [],
  };
  writeReports(checkpoint, manifest);
  const cutoverResult = await adminAction('cutover-postgres');
  const postStatus = await adminAction('cutover-status');
  const postChecks = validatePostStatus(postStatus);
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: postChecks.every(item => item.ok) ? 'CUTOVER_PASSED' : 'CUTOVER_STOPPED',
    readyForCutover: postChecks.every(item => item.ok) ? 'COMPLETE' : 'NO',
    cutover: postChecks.every(item => item.ok) ? 'PASSED' : 'LOCKED',
    git: precheck.git,
    backend: { revision: backendRevision },
    precheck,
    steps: [
      { name: 'cutover-postgres', status: 'EXECUTED', result: summarizeStatus(cutoverResult.migration || {}) },
      { name: 'post-status', status: 'EXECUTED', result: summarizeStatus(postStatus) },
    ],
    postcheck: { generatedAt: new Date().toISOString(), status: summarizeStatus(postStatus), checks: postChecks },
    rollback: {
      status: 'READY',
      executed: false,
      action: 'identity-v2:rollback',
      checklist: [
        'Use Migration Center rollback action only after explicit owner approval.',
        'Expected rollback flags: identityStorage=firestore, identityFallback=true, identityDualRead=false, identityDualWrite=false.',
        'Re-run Identity status, email login smoke, and production smoke after rollback.',
      ],
    },
    monitoring: {
      status: 'ENABLED_BY_REPORT',
      windowHours: 24,
      signals: ['login failures', 'auth mismatches', 'owner failures', 'partner failures', 'duplicate identities', 'rollback triggers'],
    },
    changedData: [
      { scope: 'Runtime Identity flags', change: 'identityStorage=postgres, identityDualRead=true, identityDualWrite=false, identityFallback=firestore' },
      { scope: 'PostgreSQL Identity rows', change: 'No additional row migration by cutover; Canary rows preserved.' },
      { scope: 'Firestore business data', change: 'No business-domain mutation by controlled cutover script.' },
    ],
    liveChecks: [
      { area: 'owner login', status: 'MANUAL_REQUIRED', reason: 'Requires real owner session/OTP; API health and owner preservation were checked during Canary.' },
      { area: 'user login', status: 'MANUAL_REQUIRED', reason: 'Requires real user email OTP/session.' },
      { area: 'Telegram login', status: 'MANUAL_REQUIRED', reason: 'Requires live Telegram auth interaction.' },
      { area: 'partner cabinet', status: 'COVERED_BY_HEALTH_AND_OWNER_CANARY', reason: 'Owner preservation passed; full cabinet login requires live owner session.' },
      { area: 'workspace/bookings/dialogs/notifications/rewards/referrals/keys/scans', status: 'NO_DIRECT_MUTATION', reason: 'Controlled cutover changes only Identity flags; business domains unchanged.' },
    ],
  };
  const files = writeReports(report, manifest);
  console.log('Identity Controlled Cutover');
  console.log(`Status: ${report.status}`);
  console.log(`Cutover: ${report.cutover}`);
  console.log(`Rollback: ${report.rollback.status}`);
  console.log(`Monitoring: ${report.monitoring.status}`);
  console.log(`Report: ${files.summary}`);
  console.log(`JSON: ${files.report}`);
  if (report.status !== 'CUTOVER_PASSED') process.exitCode = 1;
}

run().catch(error => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: 'CUTOVER_STOPPED',
    readyForCutover: 'NO',
    cutover: 'LOCKED',
    error: { code: error?.code || '', message: String(error?.message || error).slice(0, 300), statusCode: error?.statusCode || null },
    rollback: { status: 'READY', executed: false, action: 'identity-v2:rollback' },
    monitoring: { status: 'NOT_STARTED', windowHours: 24 },
    changedData: [],
    liveChecks: [],
  };
  writeJson(path.join(OUT_DIR, 'cutover-report.json'), report);
  writeJson(path.join(OUT_DIR, 'cutover-report-redacted.json'), redact(report));
  console.log('Identity Controlled Cutover');
  console.log('Status: CUTOVER_STOPPED');
  console.log(`Reason: ${report.error.message}`);
  process.exit(1);
});
