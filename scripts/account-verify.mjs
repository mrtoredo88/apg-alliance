import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

const EXPECTED_SNAPSHOT_SHA = '3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7';
const IMPORT_REPORT = 'backups/account-core/import/import-report-redacted.json';
const DRY_RUN_REPORT = 'backups/account-core/dryrun/dry-run-redacted.json';
const RESOLUTION_MANIFEST = 'backups/account-core/conflicts/resolution-manifest-redacted.json';
const OUT_DIR = 'backups/account-core/verify';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getDsn() {
  return process.env.APG_IDENTITY_DATABASE_URL
    || process.env.IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
}

function normalizeDsnForPg(dsn) {
  const url = new URL(dsn);
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  return url.toString();
}

function readYandexCa() {
  const candidates = [process.env.APG_YANDEX_CA_PATH, '/app/certs/YandexInternalRootCA.crt', '/root/.postgresql/root.crt', 'certs/YandexInternalRootCA.crt'].filter(Boolean);
  const file = candidates.find(item => fs.existsSync(item) && fs.statSync(item).size > 0);
  if (!file) throw Object.assign(new Error('Yandex CA certificate not found.'), { code: 'YANDEX_CA_NOT_FOUND' });
  return fs.readFileSync(file, 'utf8');
}

async function scalar(pool, sql, params = []) {
  const result = await pool.query(sql, params);
  return Number(result.rows[0]?.value || 0);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const importReport = readJson(IMPORT_REPORT);
  const dryRun = readJson(DRY_RUN_REPORT);
  const resolution = readJson(RESOLUTION_MANIFEST);
  if (importReport.status !== 'IMPORT_PASSED') throw Object.assign(new Error('IMPORT_NOT_PASSED'), { code: 'IMPORT_NOT_PASSED' });
  if (importReport.sourceSnapshotHash !== EXPECTED_SNAPSHOT_SHA || dryRun.snapshotSha256 !== EXPECTED_SNAPSHOT_SHA || resolution.sourceSnapshotHash !== EXPECTED_SNAPSHOT_SHA) {
    throw Object.assign(new Error('SOURCE_HASH_MISMATCH'), { code: 'SOURCE_HASH_MISMATCH' });
  }
  const pool = new Pool({
    connectionString: normalizeDsnForPg(getDsn()),
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 2_000,
    ssl: { ca: readYandexCa(), rejectUnauthorized: true },
  });
  try {
    const counts = {
      apg_account_profiles: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_profiles'),
      apg_account_roles: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_roles'),
      apg_account_cabinets: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_cabinets'),
      apg_account_telegram_links: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_telegram_links'),
      apg_account_sessions: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_sessions'),
    };
    const duplicateCanonicalOwner = await scalar(pool, `
      SELECT count(*) AS value FROM (
        SELECT email FROM apg_account_profiles p
        JOIN apg_account_roles r ON r.user_id = p.user_id
        WHERE p.email IS NOT NULL AND r.roles ?| array['owner','super_admin','admin']
        GROUP BY email HAVING count(*) > 1
      ) x
    `);
    const orphans = {
      roles: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_roles r LEFT JOIN apg_account_profiles p ON p.user_id = r.user_id WHERE p.user_id IS NULL'),
      cabinets: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_cabinets c LEFT JOIN apg_account_profiles p ON p.user_id = c.user_id WHERE p.user_id IS NULL'),
      telegramLinks: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_telegram_links t LEFT JOIN apg_account_profiles p ON p.user_id = t.user_id WHERE p.user_id IS NULL'),
      sessions: await scalar(pool, 'SELECT count(*) AS value FROM apg_account_sessions s LEFT JOIN apg_account_profiles p ON p.user_id = s.user_id WHERE p.user_id IS NULL'),
    };
    const legacyAliasCount = await scalar(pool, "SELECT count(*) AS value FROM apg_account_profiles WHERE jsonb_array_length(COALESCE(profile->'legacyAliases', '[]'::jsonb)) > 0");
    const expected = dryRun.expectedTables || {};
    const countParity = Object.entries(expected).every(([table, count]) => counts[table] === count);
    const orphanCount = Object.values(orphans).reduce((sum, count) => sum + count, 0);
    const ok = countParity && duplicateCanonicalOwner === 0 && orphanCount === 0 && legacyAliasCount >= (dryRun.transformations?.legacyMerges || 0);
    const report = {
      version: 1,
      status: ok ? 'VERIFY_PASSED' : 'VERIFY_FAILED',
      sourceSnapshotHash: EXPECTED_SNAPSHOT_SHA,
      countParity,
      expected,
      actual: counts,
      duplicateCanonicalAccounts: duplicateCanonicalOwner,
      orphanRecords: orphanCount,
      orphanBreakdown: orphans,
      constraintViolations: orphanCount + duplicateCanonicalOwner,
      legacyAliasCount,
      canonicalOwnerPreserved: duplicateCanonicalOwner === 0 && legacyAliasCount >= 1,
      rolesPreserved: counts.apg_account_roles === expected.apg_account_roles,
      cabinetsPreserved: counts.apg_account_cabinets === expected.apg_account_cabinets,
      firestoreWrites: 0,
      postgresWrites: 0,
      canaryStarted: false,
      cutoverStarted: false,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'verify-report-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT_DIR, 'verify-summary.md'), [
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
      '- Canary: NOT RUN',
      '- Cutover: NOT RUN',
      '',
    ].join('\n'));
    console.log(JSON.stringify(report, null, 2));
    if (!ok) process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(error => {
  const report = {
    status: 'VERIFY_FAILED',
    error: { code: error?.code || '', message: String(error?.message || error).slice(0, 240) },
    firestoreWrites: 0,
    postgresWrites: 0,
    canaryStarted: false,
    cutoverStarted: false,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'verify-report-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
