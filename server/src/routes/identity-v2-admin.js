import crypto from 'node:crypto';
import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';
import { serverFoundation } from '../apg/index.js';

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function publicError(error) {
  return { code: error?.code || '', message: String(error?.message || error).slice(0, 240) };
}

async function collectionRows(db, name, limit = 5000) {
  const snap = await db.collection(name).limit(limit).get();
  return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
}

function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

function buildIdentitySnapshot(rows) {
  const users = rows.users || [];
  const emails = new Map();
  const duplicateEmails = [];
  users.forEach(row => {
    const email = normalizeEmail(row.data.email || row.data.linkedEmail);
    if (!email) return;
    if (emails.has(email)) duplicateEmails.push({ emailHash: hash(email), userIds: [emails.get(email), row.id].map(id => hash(id).slice(0, 12)) });
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
    counts: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
    checksums: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, hash(value.map(row => ({ id: row.id, data: row.data })))])),
    duplicateReport: { duplicateEmails: duplicateEmails.slice(0, 50), total: duplicateEmails.length },
    orphanReport: {
      emailIndex: orphanEmailIndex.slice(0, 50).map(row => ({ idHash: hash(row.id).slice(0, 12), targetHash: hash(row.data.userId || row.data.canonicalUserId).slice(0, 12) })),
      tgLinks: orphanTelegram.slice(0, 50).map(row => ({ idHash: hash(row.id).slice(0, 12), targetHash: hash(row.data.userId || row.data.canonicalUserId).slice(0, 12) })),
      total: orphanEmailIndex.length + orphanTelegram.length,
    },
    conflictReport: { total: duplicateEmails.length + orphanEmailIndex.length + orphanTelegram.length },
  };
}

async function loadFirestoreIdentitySnapshot(limit = 5000) {
  const db = getDb();
  const names = ['users', 'emailIndex', 'auth_map', 'tgLinks', 'canonicalUsers', 'identityLinks'];
  const entries = await Promise.all(names.map(async name => [name, await collectionRows(db, name, limit)]));
  return Object.fromEntries(entries);
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
    source: 'identity_v2_cutover_import',
  };
}

async function importFirestoreUsers({ dryRun = true, limit = 5000 } = {}) {
  const rows = await loadFirestoreIdentitySnapshot(limit);
  const snapshot = buildIdentitySnapshot(rows);
  const report = {
    dryRun,
    startedAt: new Date().toISOString(),
    planned: {
      users: rows.users.length,
      emailIndex: rows.users.filter(row => normalizeEmail(row.data.email || row.data.linkedEmail)).length,
      telegramLinks: rows.users.filter(row => row.data.linkedTelegram?.tgId || row.data.linkedTelegram?.telegramId).length,
      roles: rows.users.length,
    },
    imported: { users: 0, emailIndex: 0, telegramLinks: 0, roles: 0 },
    skipped: 0,
    conflicts: snapshot.conflictReport.total,
    errors: [],
    snapshot,
  };
  if (snapshot.conflictReport.total > 0 && !dryRun) {
    const error = new Error('Identity import has conflicts. Run dry-run and resolve conflicts before production import.');
    error.statusCode = 409;
    error.code = 'IDENTITY_IMPORT_CONFLICTS';
    error.report = report;
    throw error;
  }
  if (dryRun) return report;
  for (const row of rows.users) {
    try {
      const identity = await serverFoundation.identityV2.repository.importLegacyIdentity(mapLegacyIdentity(row));
      if (identity?.userId) {
        report.imported.users += 1;
        if (normalizeEmail(identity.user?.email || identity.user?.linkedEmail)) report.imported.emailIndex += 1;
        if (identity.user?.linkedTelegram?.tgId || identity.user?.linkedTelegram?.telegramId) report.imported.telegramLinks += 1;
        report.imported.roles += 1;
      } else {
        report.skipped += 1;
      }
    } catch (error) {
      report.errors.push({ idHash: hash(row.id).slice(0, 12), ...publicError(error) });
      if (report.errors.length >= 20) break;
    }
  }
  report.finishedAt = new Date().toISOString();
  if (report.errors.length) {
    const error = new Error('Identity import failed for one or more users.');
    error.statusCode = 500;
    error.code = 'IDENTITY_IMPORT_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}

async function postgresCounts() {
  const adapter = serverFoundation.identityV2.repository.users.adapter;
  const tables = ['apg_identity_users', 'apg_identity_email_index', 'apg_identity_links', 'apg_identity_roles', 'apg_identity_sessions', 'apg_identity_email_otps', 'apg_identity_schema_versions'];
  const rows = {};
  for (const table of tables) {
    const result = await adapter.query(`SELECT count(*)::int AS count FROM ${table}`);
    rows[table] = Number(result.rows[0]?.count || 0);
  }
  const schema = await adapter.query('SELECT version, applied_at, checksum FROM apg_identity_schema_versions ORDER BY applied_at DESC LIMIT 5');
  return { tables: rows, schemaVersions: schema.rows };
}

async function verifyIdentity({ limit = 5000 } = {}) {
  const rows = await loadFirestoreIdentitySnapshot(limit);
  const firestore = buildIdentitySnapshot(rows);
  const pg = await postgresCounts();
  const userDelta = pg.tables.apg_identity_users - firestore.counts.users;
  return {
    verifiedAt: new Date().toISOString(),
    firestore,
    postgres: pg,
    comparison: {
      users: { firestore: firestore.counts.users, postgres: pg.tables.apg_identity_users, delta: userDelta },
      emailIndex: { firestore: firestore.counts.emailIndex, postgres: pg.tables.apg_identity_email_index },
      identityLinks: { firestore: firestore.counts.identityLinks, postgres: pg.tables.apg_identity_links },
      conflicts: firestore.conflictReport.total,
      ok: userDelta === 0 && firestore.conflictReport.total === 0,
    },
    identity: serverFoundation.identityV2.snapshot(),
  };
}

export default async function identityV2AdminRoutes(fastify) {
  fastify.post('/api/identity-v2-admin', async (request, reply) => {
    const action = safeString(request.body?.action, 80);
    try {
      const actor = await requireAdminPermission(request, 'maintenance:write');
      let result = null;
      if (action === 'status') {
        result = { identity: serverFoundation.identityV2.snapshot(), postgres: await postgresCounts().catch(error => ({ ok: false, error: publicError(error) })) };
      } else if (action === 'apply-schema') {
        result = await serverFoundation.identityV2.repository.users.adapter.ensureSchema();
        result.postgres = await postgresCounts();
      } else if (action === 'snapshot') {
        const rows = await loadFirestoreIdentitySnapshot(Number(request.body?.limit || 5000));
        result = buildIdentitySnapshot(rows);
      } else if (action === 'dry-run-import') {
        result = await importFirestoreUsers({ dryRun: true, limit: Number(request.body?.limit || 5000) });
      } else if (action === 'import') {
        result = await importFirestoreUsers({ dryRun: false, limit: Number(request.body?.limit || 5000) });
      } else if (action === 'verify') {
        result = await verifyIdentity({ limit: Number(request.body?.limit || 5000) });
      } else {
        return reply.code(400).send({ ok: false, error: 'invalid_action' });
      }
      await writeAuditLog(getDb(), request, actor, `identity-v2:${action}`, 'identity', 'identity-v2', { ok: true }, 'success').catch(() => {});
      return { ok: true, action, result };
    } catch (error) {
      if (error?.report) return reply.code(error.statusCode || 500).send({ ok: false, error: error.code || 'IDENTITY_V2_ADMIN_FAILED', message: error.message, report: error.report });
      return adminReplyError(reply, error);
    }
  });
}
