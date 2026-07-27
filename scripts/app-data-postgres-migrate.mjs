import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { getDb } from '../server/src/lib/firebase.js';

const execute = process.argv.includes('--execute');
const COLLECTIONS = [
  'partners',
  'experts',
  'events',
  'news',
  'notifications',
  'reviews',
  'customTasks',
  'lokiKnowledge',
  'prizes',
  'promotions',
  'bookings',
  'contextDialogs',
  'messages',
  'visitTokens',
  'scans',
  'expertScans',
  'stats',
  'config',
  'referralEvents',
  'guestSessions',
];

function databaseUrl() {
  return process.env.APG_IDENTITY_DATABASE_URL
    || process.env.IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
}

function plain(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function canonical(rows) {
  return JSON.stringify(rows.map(row => stable({ id: row.id, parentPath: row.parentPath || '', data: row.data })).sort((a, b) => `${a.parentPath}/${a.id}`.localeCompare(`${b.parentPath}/${b.id}`)));
}

function digest(rows) {
  return createHash('sha256').update(canonical(rows)).digest('hex');
}

async function firestoreRows(db, collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map(doc => ({ id: doc.id, parentPath: '', data: { ...plain(doc.data() || {}), id: doc.id } }));
}

async function firestoreDialogMessages(db) {
  const dialogs = await db.collection('contextDialogs').get();
  const groups = await Promise.all(dialogs.docs.map(async dialog => {
    const messages = await dialog.ref.collection('messages').get();
    return messages.docs.map(message => ({
      id: message.id,
      parentPath: `contextDialogs/${dialog.id}`,
      data: { ...plain(message.data() || {}), id: message.id, dialogId: dialog.id },
    }));
  }));
  return groups.flat();
}

async function postgresRows(client, collectionName) {
  const result = await client.query(
    `SELECT document_id AS id, parent_path AS "parentPath", data
     FROM apg_app_documents
     WHERE collection_name = $1
     ORDER BY parent_path, document_id`,
    [collectionName],
  );
  return result.rows.map(row => ({ id: row.id, parentPath: row.parentPath || '', data: plain(row.data || {}) }));
}

async function upsertCollection(client, collectionName, rows) {
  await client.query('BEGIN');
  try {
    for (let offset = 0; offset < rows.length; offset += 250) {
      const batch = rows.slice(offset, offset + 250);
      await client.query(
        `INSERT INTO apg_app_documents (collection_name, document_id, parent_path, data)
         SELECT $1, item.id, item.parent_path, item.data
         FROM jsonb_to_recordset($2::jsonb) AS item(id text, parent_path text, data jsonb)
         ON CONFLICT (collection_name, parent_path, document_id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = now()`,
        [collectionName, JSON.stringify(batch.map(item => ({ id: item.id, parent_path: item.parentPath || '', data: item.data })))],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function main() {
  const url = databaseUrl();
  if (!url) throw new Error('POSTGRES_DATABASE_URL_REQUIRED');
  const pool = new Pool({
    connectionString: url.replace(/[?&]sslmode=[^&]+/, ''),
    max: 2,
    ssl: process.env.APG_IDENTITY_PG_SSL === '0' ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync('server/src/apg/account/schema/account-core.sql', 'utf8');
    await client.query(schema);
    const db = getDb();
    const report = [];
    for (const collectionName of COLLECTIONS) {
      const source = await firestoreRows(db, collectionName);
      if (execute) await upsertCollection(client, collectionName, source);
      const target = execute ? await postgresRows(client, collectionName) : [];
      report.push({
        collection: collectionName,
        sourceCount: source.length,
        targetCount: target.length,
        sourceSha256: digest(source),
        targetSha256: execute ? digest(target) : '',
        match: execute ? source.length === target.length && digest(source) === digest(target) : null,
      });
    }
    const dialogMessages = await firestoreDialogMessages(db);
    if (execute) await upsertCollection(client, 'dialogMessages', dialogMessages);
    const targetDialogMessages = execute ? await postgresRows(client, 'dialogMessages') : [];
    report.push({
      collection: 'dialogMessages',
      sourceCount: dialogMessages.length,
      targetCount: targetDialogMessages.length,
      sourceSha256: digest(dialogMessages),
      targetSha256: execute ? digest(targetDialogMessages) : '',
      match: execute ? dialogMessages.length === targetDialogMessages.length && digest(dialogMessages) === digest(targetDialogMessages) : null,
    });
    const ok = execute ? report.every(item => item.match) : true;
    console.log(JSON.stringify({
      ok,
      mode: execute ? 'execute-and-verify' : 'read-only-inventory',
      firestoreWrites: 0,
      postgresWrites: execute ? report.reduce((sum, item) => sum + item.sourceCount, 0) : 0,
      collections: report,
    }, null, 2));
    if (!ok) process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error).slice(0, 500),
    firestoreWrites: 0,
  }, null, 2));
  process.exit(1);
});
