import fs from 'node:fs';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';

const expectedPath = process.argv[2] || '';
function envFileValue(key) {
  try {
    const line = fs.readFileSync(process.env.APG_ENV_FILE || 'server/.env', 'utf8')
      .split(/\r?\n/)
      .find(item => item.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : '';
  } catch {
    return '';
  }
}
const databaseUrl = process.env.APG_DATA_DATABASE_URL
  || process.env.APG_IDENTITY_DATABASE_URL
  || process.env.POSTGRES_DATABASE_URL
  || process.env.DATABASE_URL
  || envFileValue('APG_DATA_DATABASE_URL')
  || envFileValue('APG_IDENTITY_DATABASE_URL');
if (!databaseUrl) throw new Error('APG PostgreSQL URL is missing.');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const digest = value => createHash('sha256').update(stable(value)).digest('hex');
function normalizedDatabaseUrl(value) {
  const url = new URL(value);
  url.searchParams.delete('sslmode');
  return url.toString();
}
function sslConfig() {
  const caPath = process.env.APG_YANDEX_CA_PATH;
  if (caPath && fs.existsSync(caPath)) return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}
const pool = new Pool({
  connectionString: normalizedDatabaseUrl(databaseUrl),
  max: 2,
  ssl: process.env.APG_DATA_PG_SSL === '0' ? false : sslConfig(),
});

let rows = [];
try {
  const exists = await pool.query(`SELECT to_regclass('public.apg_documents') AS name`);
  if (exists.rows[0]?.name) {
    rows = (await pool.query('SELECT path, data FROM apg_documents ORDER BY path')).rows;
  }
} finally {
  await pool.end();
}

if (!expectedPath) {
  console.log(JSON.stringify({ ok: true, documents: rows.length, tableExists: rows.length > 0 }, null, 2));
  process.exit(0);
}

const expectedPayload = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
const expected = new Map(expectedPayload.documents.map(item => [item.path, digest(item.data)]));
const actual = new Map(rows.map(item => [item.path, digest(item.data)]));
const missing = [...expected.keys()].filter(path => !actual.has(path));
const extra = [...actual.keys()].filter(path => !expected.has(path));
const changed = [...expected.keys()].filter(path => actual.has(path) && actual.get(path) !== expected.get(path));
const result = {
  ok: missing.length === 0 && extra.length === 0 && changed.length === 0,
  expected: expected.size,
  actual: actual.size,
  missing: missing.length,
  extra: extra.length,
  changed: changed.length,
  samples: { missing: missing.slice(0, 5), extra: extra.slice(0, 5), changed: changed.slice(0, 5) },
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
