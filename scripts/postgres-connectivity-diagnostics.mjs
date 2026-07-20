import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { Pool } from 'pg';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

const OUT_DIR = 'backups/account-core/preflight';
const REPORT_PATH = path.join(OUT_DIR, 'postgres-connectivity-diagnostics-redacted.json');
const envLoad = loadMigrationEnv();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      hostnameRedacted: url.hostname ? 'REDACTED_HOST' : '',
      port: Number(url.port || 5432),
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

async function dnsCheck(hostname) {
  return withTimeout('DNS lookup', 5_000, async () => {
    const records = await dns.lookup(hostname, { all: true });
    return {
      ok: records.length > 0,
      addressCount: records.length,
      families: [...new Set(records.map(record => record.family))],
    };
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
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false,
    });
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

async function readOnlyAuthCheck(dsn) {
  return withTimeout('Postgres read-only auth', 8_000, async () => {
    const pool = new Pool({
      connectionString: dsn,
      max: 1,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 1_000,
      ssl: process.env.APG_IDENTITY_PG_SSL === '0' ? false : { rejectUnauthorized: false },
    });
    try {
      const result = await pool.query('SELECT 1 AS ok');
      return { ok: result.rows?.[0]?.ok === 1, query: 'SELECT 1' };
    } finally {
      await pool.end().catch(() => {});
    }
  });
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

async function main() {
  ensureDir(OUT_DIR);
  const dsn = getDsn();
  const parsed = parseDsn(dsn);
  const checks = [
    await step('dsn_configured', async () => ({ ok: Boolean(dsn), source: envLoad.sources.APG_IDENTITY_DATABASE_URL || envLoad.sources.IDENTITY_DATABASE_URL || envLoad.sources.POSTGRES_DATABASE_URL || envLoad.sources.DATABASE_URL || 'unknown' })),
    await step('dsn_parse', async () => parsed.ok ? {
      ok: true,
      protocol: parsed.protocol,
      hostname: parsed.hostnameRedacted,
      port: parsed.port,
      databaseConfigured: parsed.databaseConfigured,
      usernameConfigured: parsed.usernameConfigured,
      passwordConfigured: parsed.passwordConfigured,
      sslmode: parsed.sslmode,
    } : parsed),
  ];

  if (parsed.ok) {
    const dnsResult = await step('dns_lookup', () => dnsCheck(parsed.hostname));
    checks.push(dnsResult);
    if (dnsResult.status === 'PASS') {
      checks.push(await step('tcp_connect', () => tcpCheck(parsed.hostname, parsed.port)));
      checks.push(await step('tls_handshake', () => tlsCheck(parsed.hostname, parsed.port)));
      checks.push(await step('read_only_auth', () => readOnlyAuthCheck(dsn)));
    } else {
      checks.push(skippedStep('tcp_connect', 'SKIPPED_AFTER_DNS_FAILURE'));
      checks.push(skippedStep('tls_handshake', 'SKIPPED_AFTER_DNS_FAILURE'));
      checks.push(skippedStep('read_only_auth', 'SKIPPED_AFTER_DNS_FAILURE'));
    }
  }

  const blocked = checks.filter(check => check.status === 'BLOCKED');
  const report = {
    version: 1,
    generatedAt: now(),
    productionChanged: false,
    postgresWrites: 0,
    secretsPrinted: false,
    dsnPrinted: false,
    checks,
    conclusion: blocked.length ? 'POSTGRES_CONNECTIVITY_BLOCKED' : 'POSTGRES_CONNECTIVITY_PASS',
    rootCause: checks.find(check => check.status !== 'PASS')?.name || 'none',
    nextSafeStep: blocked.length ? 'Resolve the first blocked network/connectivity stage outside code, then rerun diagnostics and account:preflight.' : 'Rerun account:preflight.',
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.conclusion,
    report: REPORT_PATH,
    blocked: blocked.map(item => ({ name: item.name, error: item.error?.code || item.details?.reason || 'BLOCKED' })),
    productionChanged: false,
    postgresWrites: 0,
    secretsPrinted: false,
  }, null, 2));
  if (blocked.length) process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'POSTGRES_CONNECTIVITY_BLOCKED', error: redactError(error), productionChanged: false, postgresWrites: 0 }, null, 2));
  process.exit(1);
});
