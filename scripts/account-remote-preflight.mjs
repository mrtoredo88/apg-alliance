import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { Pool } from 'pg';
import { getApps } from 'firebase-admin/app';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

const REPORT_PATH = 'backups/account-core/preflight/remote-preflight-redacted.json';
const PRODUCTION_CONTAINER = 'apg-api';
const PRODUCTION_CONTAINER_ID = 'bbangqkf2d4pa9855lu0';
const PRODUCTION_NETWORK_ID = 'enpa19j9jpki1f67p6kq';
const PRODUCTION_IMAGE = 'cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest';
const EXECUTE = process.argv.includes('--execute') || process.env.APG_REMOTE_PREFLIGHT_EXECUTION === '1';
const RUNTIME_ASSERTED = process.env.APG_REMOTE_OPERATOR_RUNTIME === 'production-vpc';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function now() {
  return new Date().toISOString();
}

function getDsn() {
  return process.env.APG_IDENTITY_DATABASE_URL
    || process.env.IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
}

function redactError(error) {
  return {
    code: error?.code || '',
    name: error?.name || 'Error',
    message: String(error?.message || error || '')
      .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
      .replace(/getaddrinfo ENOTFOUND [^\s]+/gi, 'getaddrinfo ENOTFOUND REDACTED_HOST')
      .replace(/connect ETIMEDOUT [^\s]+/gi, 'connect ETIMEDOUT REDACTED_HOST')
      .replace(/connect ECONNREFUSED [^\s]+/gi, 'connect ECONNREFUSED REDACTED_HOST')
      .slice(0, 500),
  };
}

function parseDsn(dsn) {
  if (!dsn) return { ok: false, reason: 'POSTGRES_DSN_NOT_CONFIGURED' };
  try {
    const url = new URL(dsn);
    return {
      ok: true,
      hostname: url.hostname,
      hostnameRedacted: url.hostname ? 'REDACTED_HOST' : '',
      port: Number(url.port || 5432),
      protocol: url.protocol.replace(':', ''),
      databaseConfigured: Boolean(url.pathname && url.pathname !== '/'),
      usernameConfigured: Boolean(url.username),
      passwordConfigured: Boolean(url.password),
      sslmode: url.searchParams.get('sslmode') || '',
    };
  } catch (error) {
    return { ok: false, reason: 'POSTGRES_DSN_PARSE_FAILED', error: redactError(error) };
  }
}

async function withTimeout(label, timeoutMs, fn) {
  let timeout = null;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'TIMEOUT' })), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function step(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    return { name, status: details?.ok === false ? 'BLOCKED' : 'PASS', durationMs: Date.now() - startedAt, details };
  } catch (error) {
    return { name, status: 'BLOCKED', durationMs: Date.now() - startedAt, error: redactError(error) };
  }
}

function skippedStep(name, reason) {
  return { name, status: 'SKIPPED', durationMs: 0, details: { reason } };
}

async function dnsCheck(hostname) {
  return withTimeout('DNS lookup', 5_000, async () => {
    const records = await dns.lookup(hostname, { all: true });
    return { ok: records.length > 0, addressCount: records.length, families: [...new Set(records.map(record => record.family))] };
  });
}

async function tcpCheck(hostname, port) {
  return withTimeout('TCP connect', 5_000, () => new Promise((resolve, reject) => {
    const socket = net.connect({ host: hostname, port });
    socket.once('connect', () => {
      socket.end();
      resolve({ ok: true, port });
    });
    socket.once('error', reject);
  }));
}

async function tlsCheck(hostname, port) {
  return withTimeout('TLS handshake', 6_000, () => new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false });
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve({
        ok: true,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || '',
        certificatePresent: Boolean(cert && Object.keys(cert).length),
        validTo: cert?.valid_to || '',
      });
    });
    socket.once('error', reject);
  }));
}

async function postgresAuthCheck(dsn) {
  return withTimeout('PostgreSQL authentication', 8_000, async () => {
    const pool = new Pool({
      connectionString: dsn,
      max: 1,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 1_000,
      ssl: process.env.APG_IDENTITY_PG_SSL === '0' ? false : { rejectUnauthorized: false },
    });
    try {
      const result = await pool.query('SELECT 1 AS ok');
      return { ok: result.rows?.[0]?.ok === 1, query: 'SELECT 1', productionDataRead: false };
    } finally {
      await pool.end().catch(() => {});
    }
  });
}

async function firebaseAdminInitCheck() {
  const configured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!configured) return { ok: false, reason: 'FIREBASE_ADMIN_CREDENTIALS_NOT_CONFIGURED' };
  const { getDbAuth } = await import('../server/src/lib/firebase.js');
  const auth = getDbAuth();
  return {
    ok: Boolean(auth),
    initializedApps: getApps().length,
    firestoreReads: 0,
    productionDataRead: false,
  };
}

function fileCheck(files) {
  return {
    ok: files.every(file => fs.existsSync(file)),
    files: files.map(file => ({ file, exists: fs.existsSync(file) })),
  };
}

async function validateNoDataPreflight(envLoad) {
  const dsn = getDsn();
  const parsed = parseDsn(dsn);
  const checks = [
    await step('runtime_assertion', async () => ({ ok: RUNTIME_ASSERTED, expected: 'production-vpc', asserted: RUNTIME_ASSERTED ? 'production-vpc' : 'missing' })),
    await step('environment_loader', async () => ({
      ok: envLoad.loaded.length > 0,
      loadedKeyCount: envLoad.loaded.length,
      dsnConfigured: Boolean(dsn),
      firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    })),
    await step('dsn_parse', async () => parsed.ok ? {
      ok: true,
      hostname: parsed.hostnameRedacted,
      port: parsed.port,
      protocol: parsed.protocol,
      databaseConfigured: parsed.databaseConfigured,
      usernameConfigured: parsed.usernameConfigured,
      passwordConfigured: parsed.passwordConfigured,
      sslmode: parsed.sslmode,
    } : parsed),
  ];

  if (parsed.ok) {
    const dnsResult = await step('dns', () => dnsCheck(parsed.hostname));
    checks.push(dnsResult);
    if (dnsResult.status === 'PASS') {
      checks.push(await step('tcp', () => tcpCheck(parsed.hostname, parsed.port)));
      checks.push(await step('tls', () => tlsCheck(parsed.hostname, parsed.port)));
      checks.push(await step('postgres_auth', () => postgresAuthCheck(dsn)));
    } else {
      checks.push(skippedStep('tcp', 'SKIPPED_AFTER_DNS_FAILURE'));
      checks.push(skippedStep('tls', 'SKIPPED_AFTER_DNS_FAILURE'));
      checks.push(skippedStep('postgres_auth', 'SKIPPED_AFTER_DNS_FAILURE'));
    }
  }

  checks.push(await step('firebase_admin_initialization', firebaseAdminInitCheck));
  checks.push(await step('migration_manifests', async () => fileCheck([
    'scripts/account-snapshot.mjs',
    'scripts/account-core-import.mjs',
    'scripts/account-dry-run.mjs',
    'scripts/account-verify.mjs',
  ])));
  checks.push(await step('rollback_manifests', async () => fileCheck([
    'scripts/account-rollback.mjs',
    'docs/migration/rollback-readiness.md',
  ])));
  checks.push(await step('monitoring', async () => fileCheck([
    'scripts/account-observe.mjs',
    'docs/migration/monitoring-readiness.md',
    'server/src/routes/system-status.js',
  ])));

  const blocked = checks.filter(check => check.status === 'BLOCKED');
  return {
    ok: blocked.length === 0,
    checks,
    blocked: blocked.map(item => ({ name: item.name, error: item.error?.code || item.details?.reason || 'BLOCKED' })),
    productionDataReads: 0,
    firestoreReads: 0,
    postgresWrites: 0,
  };
}

function buildReport({ executed, envLoad, validation = null }) {
  const passed = executed && validation?.ok;
  return {
    version: 2,
    generatedAt: now(),
    mode: executed ? 'remote_execution_no_data' : 'preparation',
    status: passed ? 'REMOTE_PREFLIGHT_PASSED' : 'REMOTE_PREFLIGHT_BLOCKED',
    productionChanged: false,
    deployStarted: false,
    snapshotStarted: false,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
    rollbackStarted: false,
    postgresWrites: 0,
    firestoreReads: validation?.firestoreReads || 0,
    productionDataReads: validation?.productionDataReads || 0,
    secretsPrinted: false,
    dsnPrinted: false,
    productionNetwork: {
      backendRuntime: 'Yandex Serverless Container',
      containerName: PRODUCTION_CONTAINER,
      containerId: PRODUCTION_CONTAINER_ID,
      image: PRODUCTION_IMAGE,
      networkId: PRODUCTION_NETWORK_ID,
      serviceAccount: 'configured in server/deploy.sh',
    },
    requiredExecutionEnv: {
      APG_REMOTE_OPERATOR_RUNTIME: 'production-vpc',
      APG_REMOTE_PREFLIGHT_EXECUTION: '1',
    },
    localBlocker: 'Local operator DNS cannot resolve the private PostgreSQL hostname.',
    recommendedRuntime: 'Run the migration operator in a one-off container/job attached to the same Yandex VPC network as apg-api.',
    env: {
      loadedKeys: envLoad.loaded.map(item => item.key).sort(),
      sourceCount: Object.keys(envLoad.sources).length,
      redacted: true,
    },
    validation,
    nextSafeStep: passed
      ? 'After explicit owner approval, create the first immutable Account Core production snapshot.'
      : 'Run this no-data remote preflight from the production VPC runtime. Do not snapshot/import/verify/canary/cutover.',
  };
}

async function main() {
  const envLoad = loadMigrationEnv();
  const validation = EXECUTE ? await validateNoDataPreflight(envLoad) : null;
  const report = buildReport({ executed: EXECUTE, envLoad, validation });
  ensureDir(REPORT_PATH);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    mode: report.mode,
    report: REPORT_PATH,
    productionNetwork: {
      backendRuntime: report.productionNetwork.backendRuntime,
      containerName: report.productionNetwork.containerName,
      containerId: report.productionNetwork.containerId,
      networkId: report.productionNetwork.networkId,
    },
    command: 'APG_REMOTE_OPERATOR_RUNTIME=production-vpc APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute',
    blocked: validation?.blocked || [],
    productionDataReads: report.productionDataReads,
    firestoreReads: report.firestoreReads,
    productionChanged: false,
    deployStarted: false,
    postgresWrites: 0,
    secretsPrinted: false,
  }, null, 2));
  if (EXECUTE && report.status !== 'REMOTE_PREFLIGHT_PASSED') process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'REMOTE_PREFLIGHT_BLOCKED',
    error: redactError(error),
    productionChanged: false,
    productionDataReads: 0,
    firestoreReads: 0,
    postgresWrites: 0,
    secretsPrinted: false,
  }, null, 2));
  process.exit(1);
});
