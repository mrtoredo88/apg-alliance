import fs from 'node:fs';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';

const [inputPath] = process.argv.slice(2);
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
if (!inputPath || !databaseUrl) {
  console.error('Usage: APG_DATA_DATABASE_URL=... node scripts/import-apg-documents.mjs <export.json>');
  process.exit(2);
}

const raw = fs.readFileSync(inputPath);
const payload = JSON.parse(raw);
const documents = Array.isArray(payload) ? payload : payload.documents;
if (!Array.isArray(documents)) throw new Error('Export must be an array or { documents: [] }.');

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
  max: 4,
  ssl: process.env.APG_DATA_PG_SSL === '0' ? false : sslConfig(),
});

const client = await pool.connect();
let imported = 0;
try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS apg_documents (
      path TEXT PRIMARY KEY,
      collection_path TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS apg_documents_collection_idx ON apg_documents(collection_path);
    CREATE INDEX IF NOT EXISTS apg_documents_data_idx ON apg_documents USING GIN(data);
  `);
  for (const item of documents) {
    const path = String(item?.path || '').split('/').filter(Boolean).join('/');
    const parts = path.split('/');
    if (parts.length < 2 || parts.length % 2 !== 0 || !item?.data || typeof item.data !== 'object') {
      throw new Error(`Invalid document at index ${imported}.`);
    }
    await client.query(`
      INSERT INTO apg_documents(path, collection_path, document_id, data)
      VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(path) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()
    `, [path, parts.slice(0, -1).join('/'), parts.at(-1), JSON.stringify(item.data)]);
    imported += 1;
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}

console.log(JSON.stringify({
  ok: true,
  imported,
  sourceSha256: createHash('sha256').update(raw).digest('hex'),
}, null, 2));
