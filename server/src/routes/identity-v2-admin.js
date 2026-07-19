import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';
import { serverFoundation } from '../apg/index.js';

const MIGRATION_CENTER_STATE = {
  activeOperation: null,
  lastOperation: null,
  history: [],
  flagsOverride: {},
};

const MIGRATION_ACTIONS = [
  'status',
  'apply-schema',
  'snapshot',
  'dry-run-import',
  'import',
  'verify',
  'enable-postgres',
  'cutover-postgres',
  'disable-firestore-fallback',
  'rollback',
  'architecture-report',
];

const MIGRATION_STAGES = ['snapshot', 'dry-run', 'import', 'verification', 'canary', 'cutover', 'rollback'];

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function publicError(error) {
  return { code: error?.code || '', message: String(error?.message || error).slice(0, 240) };
}

function nowIso() {
  return new Date().toISOString();
}

function rememberOperation(operation) {
  MIGRATION_CENTER_STATE.lastOperation = operation;
  MIGRATION_CENTER_STATE.history = [operation, ...MIGRATION_CENTER_STATE.history].slice(0, 20);
}

function beginOperation(action, total = 0) {
  const operation = {
    id: `${action}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action,
    status: 'running',
    startedAt: nowIso(),
    finishedAt: null,
    total,
    imported: 0,
    skipped: 0,
    errors: [],
    conflicts: 0,
    speedPerSec: 0,
    etaSec: null,
    stage: action,
  };
  MIGRATION_CENTER_STATE.activeOperation = operation;
  return operation;
}

function finishOperation(operation, status = 'completed', patch = {}) {
  if (!operation) return null;
  const elapsedSec = Math.max(0.001, (Date.now() - new Date(operation.startedAt).getTime()) / 1000);
  const done = Number(operation.imported || 0) + Number(operation.skipped || 0);
  const finished = {
    ...operation,
    ...patch,
    status,
    finishedAt: nowIso(),
    speedPerSec: Math.round((done / elapsedSec) * 10) / 10,
    etaSec: 0,
  };
  MIGRATION_CENTER_STATE.activeOperation = null;
  rememberOperation(finished);
  return finished;
}

function updateOperation(operation, patch = {}) {
  if (!operation) return null;
  Object.assign(operation, patch);
  const elapsedSec = Math.max(0.001, (Date.now() - new Date(operation.startedAt).getTime()) / 1000);
  const done = Number(operation.imported || 0) + Number(operation.skipped || 0);
  operation.speedPerSec = Math.round((done / elapsedSec) * 10) / 10;
  operation.etaSec = operation.speedPerSec > 0 && operation.total > done ? Math.ceil((operation.total - done) / operation.speedPerSec) : null;
  return operation;
}

function applyIdentityFlagOverride(patch = {}) {
  const service = serverFoundation.identityV2;
  service.flags = { ...(service.flags || {}), ...patch };
  MIGRATION_CENTER_STATE.flagsOverride = { ...MIGRATION_CENTER_STATE.flagsOverride, ...patch };
  return service.snapshot();
}

function architectureGuardReport() {
  const candidates = [
    path.resolve(process.cwd(), 'docs/architecture-guard-report.json'),
    path.resolve(process.cwd(), '../docs/architecture-guard-report.json'),
  ];
  for (const reportPath of candidates) {
    try {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {}
  }
  return {
    ok: null,
    generatedAt: null,
    note: 'Architecture Guard report will be available after running npm run test:architecture-guard.',
    layers: {},
    violations: [],
  };
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
  const operation = beginOperation(dryRun ? 'dry-run-import' : 'import', rows.users.length);
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
    finishOperation(operation, 'failed', { conflicts: snapshot.conflictReport.total, errors: [{ code: 'IDENTITY_IMPORT_CONFLICTS' }] });
    const error = new Error('Identity import has conflicts. Run dry-run and resolve conflicts before production import.');
    error.statusCode = 409;
    error.code = 'IDENTITY_IMPORT_CONFLICTS';
    error.report = report;
    throw error;
  }
  updateOperation(operation, { conflicts: snapshot.conflictReport.total });
  if (dryRun) {
    finishOperation(operation, 'completed', { conflicts: snapshot.conflictReport.total });
    return report;
  }
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
    updateOperation(operation, {
      imported: report.imported.users,
      skipped: report.skipped,
      errors: report.errors,
      conflicts: snapshot.conflictReport.total,
    });
  }
  report.finishedAt = new Date().toISOString();
  if (report.errors.length) {
    finishOperation(operation, 'failed', { errors: report.errors, conflicts: snapshot.conflictReport.total });
    const error = new Error('Identity import failed for one or more users.');
    error.statusCode = 500;
    error.code = 'IDENTITY_IMPORT_FAILED';
    error.report = report;
    throw error;
  }
  finishOperation(operation, 'completed', {
    imported: report.imported.users,
    skipped: report.skipped,
    errors: report.errors,
    conflicts: snapshot.conflictReport.total,
  });
  return report;
}

async function postgresCounts({ ensure = true } = {}) {
  const adapter = serverFoundation.identityV2.repository.users.adapter;
  const tables = ['apg_identity_users', 'apg_identity_email_index', 'apg_identity_links', 'apg_identity_roles', 'apg_identity_sessions', 'apg_identity_email_otps', 'apg_identity_schema_versions'];
  const query = (sql, params = []) => ensure ? adapter.query(sql, params) : adapter.client.query(sql, params);
  const rows = {};
  for (const table of tables) {
    const result = await query(`SELECT count(*)::int AS count FROM ${table}`);
    rows[table] = Number(result.rows[0]?.count || 0);
  }
  const schema = await query('SELECT version, applied_at, checksum FROM apg_identity_schema_versions ORDER BY applied_at DESC LIMIT 5');
  return { tables: rows, schemaVersions: schema.rows };
}

async function verifyIdentity({ limit = 5000 } = {}) {
  const operation = beginOperation('verify', 1);
  const rows = await loadFirestoreIdentitySnapshot(limit);
  const firestore = buildIdentitySnapshot(rows);
  const pg = await postgresCounts();
  const userDelta = pg.tables.apg_identity_users - firestore.counts.users;
  const result = {
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
  finishOperation(operation, userDelta === 0 && firestore.conflictReport.total === 0 ? 'completed' : 'warning', { imported: 1, conflicts: firestore.conflictReport.total });
  return result;
}

async function migrationStatus() {
  const identity = serverFoundation.identityV2.snapshot();
  const postgres = await postgresCounts({ ensure: false }).catch(error => ({ ok: false, error: publicError(error) }));
  const firestoreCounts = await loadFirestoreIdentitySnapshot(5000)
    .then(buildIdentitySnapshot)
    .catch(error => ({ ok: false, error: publicError(error), counts: {} }));
  const architecture = architectureGuardReport();
  const pgTables = postgres?.tables || {};
  const fsCounts = firestoreCounts?.counts || {};
  return {
    migrationCenter: {
      ok: true,
      stages: MIGRATION_STAGES,
      actions: MIGRATION_ACTIONS,
      activeOperation: MIGRATION_CENTER_STATE.activeOperation,
      lastOperation: MIGRATION_CENTER_STATE.lastOperation,
      history: MIGRATION_CENTER_STATE.history,
      flagsOverride: MIGRATION_CENTER_STATE.flagsOverride,
    },
    postgres: {
      ok: postgres?.ok !== false,
      provider: 'PostgreSQL',
      storage: identity.storage,
      connection: postgres?.ok === false ? 'failed' : 'available',
      schemaVersions: postgres?.schemaVersions || [],
      counts: {
        users: pgTables.apg_identity_users || 0,
        emailIndex: pgTables.apg_identity_email_index || 0,
        identityLinks: pgTables.apg_identity_links || 0,
        roles: pgTables.apg_identity_roles || 0,
        sessions: pgTables.apg_identity_sessions || 0,
      },
      error: postgres?.error || null,
    },
    firestore: {
      ok: firestoreCounts?.ok !== false,
      source: 'Firestore fallback',
      counts: {
        users: fsCounts.users || 0,
        emailIndex: fsCounts.emailIndex || 0,
        authMap: fsCounts.auth_map || 0,
        tgLinks: fsCounts.tgLinks || 0,
        canonicalUsers: fsCounts.canonicalUsers || 0,
        identityLinks: fsCounts.identityLinks || 0,
      },
      checksums: firestoreCounts?.checksums || {},
      error: firestoreCounts?.error || null,
    },
    comparison: {
      users: { firestore: fsCounts.users || 0, postgres: pgTables.apg_identity_users || 0, ok: (fsCounts.users || 0) === (pgTables.apg_identity_users || 0) },
      emailIndex: { firestore: fsCounts.emailIndex || 0, postgres: pgTables.apg_identity_email_index || 0, ok: (fsCounts.emailIndex || 0) === (pgTables.apg_identity_email_index || 0) },
      identityLinks: { firestore: fsCounts.identityLinks || 0, postgres: pgTables.apg_identity_links || 0, ok: (fsCounts.identityLinks || 0) === (pgTables.apg_identity_links || 0) },
      checksum: firestoreCounts?.checksums ? 'available' : 'unavailable',
    },
    dependencyMonitor: {
      reads: { firestore: identity.firestoreReads || 0, postgres: identity.yandexReads || 0 },
      writes: { firestore: identity.firestoreWrites || 0, postgres: identity.yandexWrites || 0 },
      fallback: identity.fallbackCount || identity.firestoreFallbacks || 0,
      dualRead: identity.dualRead,
      dualWrite: identity.dualWrite,
      fallbackEnabled: identity.fallbackEnabled,
    },
    architecture,
    identity,
  };
}

async function requireMigrationActor(request) {
  const provided = safeString(request.headers['x-maintenance-secret'] || request.headers['x-cron-secret'] || '', 500);
  const expected = safeString(process.env.IDENTITY_MIGRATION_SECRET || process.env.CRON_SECRET || '', 500);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (provided && expected && providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      uid: 'system:migration-center',
      role: 'owner',
      userId: 'system:migration-center',
      name: 'APG Migration Center',
      authSource: 'maintenance-secret',
    };
  }
  return requireAdminPermission(request, 'maintenance:write');
}

export default async function identityV2AdminRoutes(fastify) {
  fastify.post('/api/identity-v2-admin', async (request, reply) => {
    const action = safeString(request.body?.action, 80);
    let actor = null;
    try {
      actor = await requireMigrationActor(request);
      let result = null;
      if (action === 'status') {
        result = await migrationStatus();
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
      } else if (action === 'enable-postgres') {
        result = {
          identity: applyIdentityFlagOverride({ identityStorage: 'postgres', identityDualRead: 'true', identityDualWrite: 'true' }),
          migration: await migrationStatus(),
        };
      } else if (action === 'cutover-postgres') {
        result = {
          identity: applyIdentityFlagOverride({ identityStorage: 'postgres', identityDualRead: 'true', identityDualWrite: 'false', identityFallback: 'firestore' }),
          migration: await migrationStatus(),
        };
      } else if (action === 'disable-firestore-fallback') {
        result = {
          identity: applyIdentityFlagOverride({ identityFallback: 'false' }),
          migration: await migrationStatus(),
        };
      } else if (action === 'rollback') {
        result = {
          identity: applyIdentityFlagOverride({ identityStorage: 'firestore', identityFallback: 'true', identityDualRead: 'false', identityDualWrite: 'false' }),
          migration: await migrationStatus(),
        };
      } else if (action === 'architecture-report') {
        result = architectureGuardReport();
      } else {
        return reply.code(400).send({ ok: false, error: 'invalid_action' });
      }
      await writeAuditLog(getDb(), request, actor, `identity-v2:${action}`, 'identity', 'identity-v2', { ok: true }, 'success').catch(() => {});
      return { ok: true, action, result };
    } catch (error) {
      if (error?.report) return reply.code(error.statusCode || 500).send({ ok: false, error: error.code || 'IDENTITY_V2_ADMIN_FAILED', message: error.message, report: error.report });
      if (actor?.authSource === 'maintenance-secret') {
        return reply.code(error.statusCode || 500).send({ ok: false, error: error.code || 'IDENTITY_V2_ADMIN_FAILED', diagnostics: publicError(error) });
      }
      return adminReplyError(reply, error);
    }
  });
}
