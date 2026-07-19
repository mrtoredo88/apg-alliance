import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const LIMIT = Number(process.env.IDENTITY_CUTOVER_LIMIT || process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 5000);
let getDb = null;
let serverFoundation = null;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(ROOT, 'server/.env'));
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(ROOT, 'server/firebase-service-account.json');
}

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

async function collectionRows(db, name) {
  const snap = await db.collection(name).limit(LIMIT).get();
  return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
}

async function loadFirestoreIdentitySnapshot() {
  const db = getDb();
  const names = ['users', 'emailIndex', 'auth_map', 'tgLinks', 'canonicalUsers', 'identityLinks'];
  const entries = await Promise.all(names.map(async name => [name, await collectionRows(db, name).catch(() => [])]));
  return Object.fromEntries(entries);
}

function buildSnapshot(rows) {
  const users = rows.users || [];
  const emails = new Map();
  const duplicateEmails = [];
  users.forEach(row => {
    const email = normalizeEmail(row.data.email || row.data.linkedEmail);
    if (!email) return;
    if (emails.has(email)) {
      duplicateEmails.push({ emailHash: sha(email).slice(0, 16), userHashes: [emails.get(email), row.id].map(id => sha(id).slice(0, 12)) });
    }
    emails.set(email, row.id);
  });
  const userIds = new Set(users.map(row => row.id));
  const orphanEmailIndex = (rows.emailIndex || []).filter(row => {
    const target = safeString(row.data.userId || row.data.canonicalUserId, 260);
    return target && !userIds.has(target);
  });
  const orphanTelegram = (rows.tgLinks || []).filter(row => {
    const target = safeString(row.data.userId || row.data.canonicalUserId, 260);
    return target && !userIds.has(target);
  });
  return {
    exportedAt: new Date().toISOString(),
    limit: LIMIT,
    counts: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
    checksums: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, sha(value.map(row => ({ id: row.id, data: row.data })))])),
    duplicateEmails: { total: duplicateEmails.length, samples: duplicateEmails.slice(0, 20) },
    orphans: {
      emailIndex: orphanEmailIndex.length,
      tgLinks: orphanTelegram.length,
      samples: [...orphanEmailIndex.slice(0, 10), ...orphanTelegram.slice(0, 10)].map(row => ({ idHash: sha(row.id).slice(0, 12) })),
    },
    conflicts: duplicateEmails.length + orphanEmailIndex.length + orphanTelegram.length,
  };
}

function mapLegacyIdentity(userRow) {
  const user = userRow.data || {};
  const id = safeString(user.canonicalUserId || userRow.id, 260);
  return {
    userId: id,
    canonicalUserId: id,
    user: {
      ...user,
      id,
      legacyId: userRow.id,
      email: normalizeEmail(user.email || user.linkedEmail),
      linkedEmail: normalizeEmail(user.linkedEmail || user.email),
    },
    source: 'identity_cutover_report',
  };
}

async function postgresCounts() {
  const adapter = serverFoundation.identityV2.repository.users.adapter;
  const tables = ['apg_identity_users', 'apg_identity_email_index', 'apg_identity_links', 'apg_identity_roles', 'apg_identity_sessions', 'apg_identity_email_otps', 'apg_identity_email_verify_tokens', 'apg_identity_schema_versions'];
  const counts = {};
  const checksums = {};
  for (const table of tables) {
    const count = await adapter.query(`SELECT count(*)::int AS count FROM ${table}`);
    counts[table] = Number(count.rows[0]?.count || 0);
    const digest = await adapter.query(`SELECT md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS checksum FROM ${table} t`);
    checksums[table] = digest.rows[0]?.checksum || '';
  }
  const schema = await adapter.query('SELECT version, applied_at, checksum FROM apg_identity_schema_versions ORDER BY applied_at DESC LIMIT 5');
  return { counts, checksums, schemaVersions: schema.rows };
}

async function importUsers(rows, dryRun = true) {
  const report = {
    dryRun,
    planned: {
      users: rows.users.length,
      emailIndex: rows.users.filter(row => normalizeEmail(row.data.email || row.data.linkedEmail)).length,
      telegramLinks: rows.users.filter(row => row.data.linkedTelegram?.tgId || row.data.linkedTelegram?.telegramId).length,
      roles: rows.users.length,
    },
    imported: { users: 0, emailIndex: 0, telegramLinks: 0, roles: 0 },
    skipped: 0,
    errors: [],
  };
  for (const row of rows.users) {
    try {
      const identity = dryRun ? mapLegacyIdentity(row) : await serverFoundation.identityV2.repository.importLegacyIdentity(mapLegacyIdentity(row));
      if (identity?.userId) {
        report.imported.users += 1;
        if (normalizeEmail(identity.user?.email || identity.user?.linkedEmail)) report.imported.emailIndex += 1;
        if (identity.user?.linkedTelegram?.tgId || identity.user?.linkedTelegram?.telegramId) report.imported.telegramLinks += 1;
        report.imported.roles += 1;
      } else {
        report.skipped += 1;
      }
    } catch (error) {
      report.errors.push({ idHash: sha(row.id).slice(0, 12), code: error?.code || '', message: String(error?.message || error).slice(0, 180) });
      if (report.errors.length >= 20) break;
    }
  }
  return report;
}

async function run() {
  ({ getDb } = await import('../server/src/lib/firebase.js'));
  ({ serverFoundation } = await import('../server/src/apg/index.js'));
  const startedAt = Date.now();
  const steps = {};
  if (args.has('--apply-schema') || args.has('--all')) {
    steps.applySchema = await serverFoundation.identityV2.repository.users.adapter.ensureSchema();
  }
  const rows = await loadFirestoreIdentitySnapshot();
  steps.snapshot = buildSnapshot(rows);
  if ((args.has('--dry-run') || args.has('--all')) && steps.snapshot.conflicts === 0) {
    steps.dryRun = await importUsers(rows, true);
  } else if (args.has('--dry-run') || args.has('--all')) {
    steps.dryRun = { skipped: true, reason: 'snapshot_conflicts', conflicts: steps.snapshot.conflicts };
  }
  if ((args.has('--import') || args.has('--all')) && steps.snapshot.conflicts === 0) {
    steps.import = await importUsers(rows, false);
  } else if (args.has('--import') || args.has('--all')) {
    steps.import = { skipped: true, reason: 'snapshot_conflicts', conflicts: steps.snapshot.conflicts };
  }
  if (args.has('--verify') || args.has('--all')) {
    const pg = await postgresCounts();
    steps.verify = {
      firestore: steps.snapshot,
      postgres: pg,
      comparison: {
        users: { firestore: steps.snapshot.counts.users || 0, postgres: pg.counts.apg_identity_users || 0, ok: (steps.snapshot.counts.users || 0) === (pg.counts.apg_identity_users || 0) },
        emailIndex: { firestore: steps.snapshot.counts.emailIndex || 0, postgres: pg.counts.apg_identity_email_index || 0 },
        identityLinks: { firestore: steps.snapshot.counts.identityLinks || 0, postgres: pg.counts.apg_identity_links || 0 },
        conflicts: steps.snapshot.conflicts,
      },
      identity: serverFoundation.identityV2.snapshot(),
    };
  }
  const result = {
    ok: !steps.import?.errors?.length && steps.snapshot.conflicts === 0,
    durationMs: Date.now() - startedAt,
    steps,
  };
  console.log(JSON.stringify(result, null, 2));
  await serverFoundation.identityV2.repository.users.adapter.dispose().catch(() => {});
  if (!result.ok) process.exitCode = 1;
}

run().catch(async error => {
  console.error(JSON.stringify({ ok: false, code: error?.code || '', message: String(error?.message || error).slice(0, 300) }, null, 2));
  await serverFoundation.identityV2.repository.users.adapter.dispose().catch(() => {});
  process.exit(1);
});
