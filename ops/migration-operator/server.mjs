import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.APG_OPERATOR_TOKEN || '';
const REPORT_PATH = 'backups/account-core/preflight/remote-preflight-redacted.json';
const PREFLIGHT_COMMAND = ['npm', ['run', 'account:remote-preflight', '--', '--execute']];

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

function readReport() {
  try {
    if (!fs.existsSync(REPORT_PATH)) return null;
    return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
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

function runPreflight() {
  return new Promise((resolve) => {
    const [cmd, args] = PREFLIGHT_COMMAND;
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APG_REMOTE_OPERATOR_RUNTIME: 'production-vpc',
        APG_REMOTE_PREFLIGHT_EXECUTION: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => {
      const report = readReport();
      resolve({
        ok: code === 0 && report?.status === 'REMOTE_PREFLIGHT_PASSED',
        exitCode: code,
        status: report?.status || 'REMOTE_PREFLIGHT_BLOCKED',
        report,
        stdoutTail: sanitizeOutput(stdout),
        stderrTail: sanitizeOutput(stderr),
        productionChanged: false,
        snapshotStarted: false,
        importStarted: false,
        verifyStarted: false,
        canaryStarted: false,
        cutoverStarted: false,
        rollbackStarted: false,
      });
    });
  });
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

  if (req.url !== '/run' || req.method !== 'POST') {
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

  if (completed) {
    json(res, 409, { ok: false, error: 'ALREADY_COMPLETED', lastResult });
    return;
  }

  running = true;
  lastResult = await runPreflight();
  running = false;
  completed = true;
  json(res, lastResult.ok ? 200 : 500, lastResult);
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    service: 'apg-migration-operator',
    listening: true,
    port: PORT,
    tokenConfigured: Boolean(TOKEN),
    allowedCommand: 'npm run account:remote-preflight -- --execute',
    productionChanged: false,
  }));
});
