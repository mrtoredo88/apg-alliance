import fs from 'node:fs';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';

const [inputPath] = process.argv.slice(2);
const databaseUrl = process.env.APG_DATA_DATABASE_URL || process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
if (!inputPath || !databaseUrl) {
  console.error('Usage: APG_DATA_DATABASE_URL=... node scripts/import-apg-documents.mjs <export.json>');
  process.exit(2);
}

const raw = fs.readFileSync(inputPath);
const payload = JSON.parse(raw);
const documents = Array.isArray(payload) ? payload : payload.documents;
if (!Array.isArray(documents)) throw new Error('Export must be an array or { documents: [] }.');

const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  ssl: process.env.APG_DATA_PG_SSL === '0' ? false : { rejectUnauthorized: false },
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
