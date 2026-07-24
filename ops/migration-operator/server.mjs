import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.APG_OPERATOR_TOKEN || '';
const REPORT_PATH = 'backups/account-core/preflight/remote-preflight-redacted.json';
const PREFLIGHT_COMMAND = ['npm', ['run', 'account:remote-preflight', '--', '--execute']];
const IMPORT_REPORT_PATH = 'backups/account-core/import/import-report-redacted.json';
const VERIFY_REPORT_PATH = 'backups/account-core/verify/verify-report-redacted.json';
const IMPORT_COMMAND = ['npm', ['run', 'account:import', '--', '--execute']];
const IMPORT_RESUME_COMMAND = ['npm', ['run', 'account:import', '--', '--execute', '--resume']];
const VERIFY_COMMAND = ['npm', ['run', 'account:verify']];
const DOCUMENT_IMPORT_COMMAND = ['node', ['scripts/import-apg-documents.mjs', '/tmp/apg-documents/snapshot.json']];
const DOCUMENT_VERIFY_COMMAND = ['node', ['scripts/verify-apg-documents.mjs', '/tmp/apg-documents/snapshot.json']];

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
  if (payload.documentSnapshotBase64) {
    fs.mkdirSync('/tmp/apg-documents', { recursive: true });
    fs.writeFileSync('/tmp/apg-documents/snapshot.json', Buffer.from(payload.documentSnapshotBase64, 'base64'), { mode: 0o600 });
  }
  if (payload.documentSnapshotGzipBase64) {
    fs.mkdirSync('/tmp/apg-documents', { recursive: true });
    const compressed = Buffer.from(payload.documentSnapshotGzipBase64, 'base64');
    fs.writeFileSync('/tmp/apg-documents/snapshot.json', gunzipSync(compressed), { mode: 0o600 });
  }
  if (payload.documentUploadId) {
    const uploadId = String(payload.documentUploadId);
    if (!/^[a-f0-9]{16,64}$/.test(uploadId)) throw new Error('INVALID_DOCUMENT_UPLOAD_ID');
    const encodedPath = `/tmp/apg-documents/${uploadId}.b64`;
    if (!fs.existsSync(encodedPath)) throw new Error('DOCUMENT_UPLOAD_NOT_FOUND');
    fs.mkdirSync('/tmp/apg-documents', { recursive: true });
    fs.writeFileSync('/tmp/apg-documents/snapshot.json', Buffer.from(fs.readFileSync(encodedPath, 'utf8'), 'base64'), { mode: 0o600 });
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

function runCommand(command, reportPath, extraEnv = {}) {
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
        productionChanged: false,
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

  const allowed = ['/run', '/import', '/import-resume', '/verify', '/documents/upload', '/documents/import', '/documents/verify'];
  if (!allowed.includes(req.url) || req.method !== 'POST') {
    json(res, 404, { ok: false, error: 'NOT_FOUND' });
    return;
  }

  if (!isAuthorized(req)) {
    json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  if (req.url === '/documents/upload') {
    try {
      const payload = await readBody(req, 3 * 1024 * 1024);
      const uploadId = String(payload.uploadId || '');
      const index = Number(payload.index);
      const total = Number(payload.total);
      const chunk = String(payload.chunk || '');
      if (!/^[a-f0-9]{16,64}$/.test(uploadId) || !Number.isInteger(index) || index < 0 || !Number.isInteger(total) || total < 1 || index >= total || !chunk) {
        json(res, 400, { ok: false, error: 'INVALID_UPLOAD_CHUNK' });
        return;
      }
      fs.mkdirSync('/tmp/apg-documents', { recursive: true });
      const encodedPath = `/tmp/apg-documents/${uploadId}.b64`;
      const statePath = `/tmp/apg-documents/${uploadId}.state`;
      const expected = fs.existsSync(statePath) ? Number(fs.readFileSync(statePath, 'utf8')) : 0;
      if (index !== expected) {
        json(res, 409, { ok: false, error: 'UPLOAD_CHUNK_OUT_OF_ORDER', expected, received: index });
        return;
      }
      fs.appendFileSync(encodedPath, chunk, { mode: 0o600 });
      fs.writeFileSync(statePath, String(index + 1), { mode: 0o600 });
      json(res, 200, { ok: true, uploadId, received: index + 1, total, complete: index + 1 === total });
    } catch (error) {
      json(res, 400, { ok: false, error: error.code || error.message || 'UPLOAD_FAILED' });
    }
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
    if (req.url === '/documents/import') {
      lastResult = await runCommand(DOCUMENT_IMPORT_COMMAND, '');
      lastResult.productionChanged = lastResult.ok;
    }
    if (req.url === '/documents/verify') lastResult = await runCommand(DOCUMENT_VERIFY_COMMAND, '');
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
    productionChanged: false,
  }));
});
