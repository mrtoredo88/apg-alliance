import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.APG_OPERATOR_TOKEN || '';
const REPORT_PATH = 'backups/account-core/preflight/remote-preflight-redacted.json';
const PREFLIGHT_COMMAND = ['npm', ['run', 'account:remote-preflight', '--', '--execute']];
const IMPORT_REPORT_PATH = 'backups/account-core/import/import-report-redacted.json';
const VERIFY_REPORT_PATH = 'backups/account-core/verify/verify-report-redacted.json';
const IMPORT_COMMAND = ['npm', ['run', 'account:import', '--', '--execute']];
const IMPORT_RESUME_COMMAND = ['npm', ['run', 'account:import', '--', '--execute', '--resume']];
const VERIFY_COMMAND = ['npm', ['run', 'account:verify']];
const IDENTITY_MERGE_COMMAND = ['node', ['scripts/identity-merge-execute.mjs', '--execute']];
const ADMIN_PASSWORD_REPAIR_COMMAND = ['node', ['scripts/admin-pg-password-repair.mjs']];
const TATYANA_PG_AUDIT_COMMAND = ['node', ['scripts/tatyana-pg-account-repair.mjs']];
const TATYANA_PG_REPAIR_COMMAND = ['node', ['scripts/tatyana-pg-account-repair.mjs', '--execute']];

let running = false;
let completed = false;
let lastResult = null;

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(`${payload}\n`);
}

function isAuthorized(req) {
  if (!TOKEN) return false;
  return req.headers['x-operator-token'] === TOKEN;
}

function readReport(file = REPORT_PATH) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sanitizeOutput(value) {
  return String(value || '')
    .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
    .replace(/RealMadrid2025!?/gi, 'REDACTED_PASSWORD')
    .replace(/getaddrinfo ENOTFOUND [^\s]+/gi, 'getaddrinfo ENOTFOUND REDACTED_HOST')
    .slice(-4000);
}

function readBody(req, maxBytes = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { code: 'BODY_TOO_LARGE' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function writeArtifacts(payload = {}) {
  if (payload.snapshotBase64) {
    fs.mkdirSync('/tmp/apg-account-core', { recursive: true });
    fs.writeFileSync('/tmp/apg-account-core/snapshot.json', Buffer.from(payload.snapshotBase64, 'base64'));
    process.env.APG_ACCOUNT_SNAPSHOT_PATH = '/tmp/apg-account-core/snapshot.json';
  }
  const writes = [
    ['resolutionManifest', 'backups/account-core/conflicts/resolution-manifest-redacted.json'],
    ['dryRunReport', 'backups/account-core/dryrun/dry-run-redacted.json'],
    ['importReport', IMPORT_REPORT_PATH],
  ];
  for (const [key, file] of writes) {
    if (!payload[key]) continue;
    fs.mkdirSync(file.split('/').slice(0, -1).join('/'), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(payload[key], null, 2)}\n`);
  }
}

function runCommand(command, reportPath, extraEnv = {}, options = {}) {
  return new Promise((resolve) => {
    const [cmd, args] = command;
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APG_REMOTE_OPERATOR_RUNTIME: 'production-vpc',
        APG_REMOTE_PREFLIGHT_EXECUTION: '1',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => {
      const report = readReport(reportPath);
      const checkpoint = readReport('backups/account-core/import-checkpoint-redacted.json');
      resolve({
        ok: code === 0,
        exitCode: code,
        status: report?.status || (code === 0 ? 'PASSED' : 'BLOCKED'),
        report,
        checkpoint,
        stdoutTail: sanitizeOutput(stdout),
        stderrTail: sanitizeOutput(stderr),
        productionChanged: Boolean(options.productionChanged),
        snapshotStarted: false,
        importStarted: command === IMPORT_COMMAND || command === IMPORT_RESUME_COMMAND,
        verifyStarted: command === VERIFY_COMMAND,
        canaryStarted: false,
        cutoverStarted: false,
        rollbackStarted: false,
      });
    });
  });
}

function runPreflight() {
  return runCommand(PREFLIGHT_COMMAND, REPORT_PATH).then(result => ({
    ...result,
    ok: result.exitCode === 0 && result.report?.status === 'REMOTE_PREFLIGHT_PASSED',
    status: result.report?.status || 'REMOTE_PREFLIGHT_BLOCKED',
  }));
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    json(res, 200, {
      ok: true,
      service: 'apg-migration-operator',
      tokenConfigured: Boolean(TOKEN),
      running,
      completed,
      productionChanged: false,
    });
    return;
  }

  const allowed = ['/run', '/import', '/import-resume', '/verify', '/identity-merge', '/admin-password-repair', '/tatyana-pg-audit', '/tatyana-pg-repair'];
  if (!allowed.includes(req.url) || req.method !== 'POST') {
    json(res, 404, { ok: false, error: 'NOT_FOUND' });
    return;
  }

  if (!isAuthorized(req)) {
    json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  if (running) {
    json(res, 409, { ok: false, error: 'ALREADY_RUNNING' });
    return;
  }

  if (req.url === '/run' && completed) {
    json(res, 409, { ok: false, error: 'ALREADY_COMPLETED', lastResult });
    return;
  }

  running = true;
  if (req.url === '/run') {
    lastResult = await runPreflight();
  } else {
    const payload = await readBody(req);
    writeArtifacts(payload);
    if (req.url === '/import') lastResult = await runCommand(IMPORT_COMMAND, IMPORT_REPORT_PATH);
    if (req.url === '/import-resume') lastResult = await runCommand(IMPORT_RESUME_COMMAND, IMPORT_REPORT_PATH);
    if (req.url === '/verify') lastResult = await runCommand(VERIFY_COMMAND, VERIFY_REPORT_PATH);
    if (req.url === '/admin-password-repair') {
      const adminPassword = String(payload.adminPassword || '');
      if (!adminPassword) {
        running = false;
        json(res, 400, { ok: false, error: 'ADMIN_PASSWORD_REQUIRED', productionChanged: false });
        return;
      }
      lastResult = await runCommand(
        ADMIN_PASSWORD_REPAIR_COMMAND,
        '',
        { APG_ADMIN_REPAIR_PASSWORD: adminPassword },
        { productionChanged: true },
      );
    }
    if (req.url === '/identity-merge') {
      const approval = String(payload.identityMergeApproval || '');
      if (!approval) {
        running = false;
        json(res, 400, { ok: false, error: 'IDENTITY_MERGE_APPROVAL_REQUIRED', productionChanged: false });
        return;
      }
      lastResult = await runCommand(
        IDENTITY_MERGE_COMMAND,
        'backups/audits/merge-tatyana/merge-exec-report-latest.json',
        { IDENTITY_MERGE_APPROVAL: approval },
        { productionChanged: true },
      );
    }
    if (req.url === '/tatyana-pg-audit') {
      lastResult = await runCommand(TATYANA_PG_AUDIT_COMMAND, '', {}, { productionChanged: false });
    }
    if (req.url === '/tatyana-pg-repair') {
      if (String(payload.confirm || '') !== 'REPAIR_TATYANA_PG') {
        running = false;
        json(res, 400, { ok: false, error: 'TATYANA_PG_REPAIR_CONFIRMATION_REQUIRED', productionChanged: false });
        return;
      }
      lastResult = await runCommand(TATYANA_PG_REPAIR_COMMAND, '', {}, { productionChanged: true });
    }
  }
  running = false;
  completed = req.url === '/run';
  json(res, lastResult.ok ? 200 : 500, lastResult);
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    service: 'apg-migration-operator',
    listening: true,
    port: PORT,
    tokenConfigured: Boolean(TOKEN),
    allowedCommand: 'npm run account:remote-preflight -- --execute',
    allowedImportCommand: 'npm run account:import -- --execute',
    allowedVerifyCommand: 'npm run account:verify',
    allowedIdentityMergeCommand: 'node scripts/identity-merge-execute.mjs --execute',
    allowedAdminPasswordRepairCommand: 'node scripts/admin-pg-password-repair.mjs',
    allowedTatyanaPgAuditCommand: 'node scripts/tatyana-pg-account-repair.mjs',
    allowedTatyanaPgRepairCommand: 'node scripts/tatyana-pg-account-repair.mjs --execute',
    productionChanged: false,
  }));
});
