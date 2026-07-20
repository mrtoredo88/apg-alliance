import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PostgresAccountAdapter } from '../server/src/apg/account/adapters/PostgresAccountAdapter.js';

const OUT_DIR = 'backups/account-core';
const REPORT_PATH = path.join(OUT_DIR, 'preflight-report.json');
const API_BASE_URL = process.env.APG_PRODUCTION_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net';
const FRONTEND_VERSION_URL = process.env.APG_PRODUCTION_VERSION_URL || 'https://myapg.ru/version.json';
const EXPECTED_COMMIT = 'fedb2135';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function now() {
  return new Date().toISOString();
}

function shell(args, fallback = '') {
  try {
    return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return fallback || String(error?.message || error);
  }
}

function runCheck(name, fn, options = {}) {
  const startedAt = Date.now();
  try {
    const details = fn();
    const ok = options.ok ? options.ok(details) : true;
    return { name, ok: Boolean(ok), durationMs: Date.now() - startedAt, details };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: String(error?.message || error).slice(0, 500),
    };
  }
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function runNpmScript(script) {
  const result = spawnSync('npm', ['run', script], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    script,
    ok: result.status === 0,
    status: result.status,
    stdoutTail: String(result.stdout || '').slice(-2500),
    stderrTail: String(result.stderr || '').slice(-2500),
  };
}

async function checkPostgres() {
  const configured = Boolean(
    process.env.APG_IDENTITY_DATABASE_URL
      || process.env.IDENTITY_DATABASE_URL
      || process.env.POSTGRES_DATABASE_URL
      || process.env.DATABASE_URL
  );
  if (!configured) return { configured, connected: false, schemaApplied: false, reason: 'POSTGRES_DSN_NOT_CONFIGURED' };
  const adapter = new PostgresAccountAdapter();
  try {
    await adapter.ensureSchema();
    const schema = await adapter.query('SELECT version, checksum FROM apg_account_schema_versions ORDER BY applied_at DESC LIMIT 5');
    return {
      configured,
      connected: true,
      schemaApplied: schema.rows?.some(row => row.version === 'account-core-v1-2026-07-20') || false,
      schemaVersions: schema.rows || [],
    };
  } finally {
    await adapter.dispose().catch(() => {});
  }
}

async function checkFirebaseReadAccess() {
  const configured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!configured) return { configured, readable: false, reason: 'FIREBASE_ADMIN_CREDENTIALS_NOT_CONFIGURED' };
  const { getDb } = await import('../server/src/lib/firebase.js');
  const snap = await getDb().collection('users').limit(1).get();
  return { configured, readable: true, sampleCount: snap.size };
}

async function main() {
  ensureDir(OUT_DIR);
  const gitStatus = shell(['git', 'status', '--short']);
  const commit = shell(['git', 'rev-parse', '--short', 'HEAD']);
  const sourceCommit = shell(['git', 'rev-parse', '--short', EXPECTED_COMMIT]);
  const sourceIsAncestor = spawnSync('git', ['merge-base', '--is-ancestor', EXPECTED_COMMIT, 'HEAD']).status === 0;
  const branch = shell(['git', 'branch', '--show-current']);
  const freeKb = shell(['df', '-Pk', '.']);
  const checks = [];

  checks.push(runCheck('working_tree_clean', () => ({
    clean: gitStatus.length === 0,
    statusLines: gitStatus.split('\n').filter(Boolean).slice(0, 40),
    omittedStatusLines: Math.max(0, gitStatus.split('\n').filter(Boolean).length - 40),
  }), { ok: details => details.clean }));

  checks.push(runCheck('expected_source_commit', () => ({ currentCommit: commit, sourceCommit, expected: EXPECTED_COMMIT, sourceIsAncestor }), { ok: details => details.sourceCommit === details.expected && details.sourceIsAncestor }));
  checks.push(runCheck('production_frontend_version', async () => fetchJson(FRONTEND_VERSION_URL), { ok: details => details.ok && Boolean(details.body?.v) }));
  checks.push(runCheck('production_backend_health', async () => fetchJson(`${API_BASE_URL}/health`), { ok: details => details.ok && details.body?.ok === true }));
  checks.push(runCheck('postgres_connectivity', async () => checkPostgres(), { ok: details => details.configured && details.connected && details.schemaApplied }));
  checks.push(runCheck('firebase_firestore_read_access', async () => checkFirebaseReadAccess(), { ok: details => details.configured && details.readable }));
  checks.push(runCheck('local_snapshot_space', () => ({ df: freeKb.split('\n').slice(-1)[0] || freeKb }), { ok: () => true }));
  checks.push(runCheck('rollback_commands', () => ({ accountRollbackScript: fs.existsSync('scripts/account-rollback.mjs') }), { ok: details => details.accountRollbackScript }));
  checks.push(runCheck('monitoring_surface', () => ({
    systemStatusRoute: fs.existsSync('server/src/routes/system-status.js'),
    accountSnapshot: fs.existsSync('server/src/apg/account/services/AccountCoreService.js'),
  }), { ok: details => details.systemStatusRoute && details.accountSnapshot }));

  for (const name of ['test:account-core', 'test:account-core-guard', 'test:account-integration', 'test:account-firestore-outage', 'readiness:account', 'readiness:event']) {
    checks.push(runCheck(name, () => runNpmScript(name), { ok: details => details.ok }));
  }

  const resolvedChecks = [];
  for (const check of checks) {
    if (check?.details && typeof check.details.then === 'function') {
      try {
        const details = await check.details;
        resolvedChecks.push({ ...check, ok: check.name === 'production_frontend_version' ? details.ok && Boolean(details.body?.v) : check.name === 'production_backend_health' ? details.ok && details.body?.ok === true : check.name === 'postgres_connectivity' ? details.configured && details.connected && details.schemaApplied : check.name === 'firebase_firestore_read_access' ? details.configured && details.readable : check.ok, details });
      } catch (error) {
        resolvedChecks.push({ ...check, ok: false, details: undefined, error: String(error?.message || error).slice(0, 500) });
      }
    } else {
      resolvedChecks.push(check);
    }
  }

  const blockers = resolvedChecks.filter(item => !item.ok).map(item => ({
    name: item.name,
    error: item.error || item.details?.reason || item.details?.stderrTail || 'FAILED',
  }));
  const report = {
    version: 1,
    migration: 'account-core-production-v1',
    status: blockers.length ? 'PREFLIGHT_BLOCKED' : 'PREFLIGHT_PASSED',
    generatedAt: now(),
    productionChanged: false,
    firestoreChanged: false,
    postgresWrites: 0,
    importStarted: false,
    snapshotStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
    branch,
    currentCommit: commit,
    sourceCommit,
    expectedCommit: EXPECTED_COMMIT,
    checks: resolvedChecks,
    blockers,
    nextSafeStep: blockers.length ? 'Resolve preflight blockers, then rerun npm run account:preflight. Do not snapshot/import/canary/cutover.' : 'Run npm run account:snapshot after explicit owner approval.',
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    report: REPORT_PATH,
    blockers,
    productionChanged: false,
  }, null, 2));
  if (blockers.length) process.exit(1);
}

main().catch(error => {
  ensureDir(OUT_DIR);
  const report = {
    version: 1,
    migration: 'account-core-production-v1',
    status: 'PREFLIGHT_BLOCKED',
    generatedAt: now(),
    productionChanged: false,
    firestoreChanged: false,
    postgresWrites: 0,
    error: String(error?.stack || error?.message || error).slice(0, 2000),
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify({ status: report.status, report: REPORT_PATH, error: report.error }, null, 2));
  process.exit(1);
});
