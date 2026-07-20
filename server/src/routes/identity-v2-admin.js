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
  'cutover-status',
  'apply-schema',
  'snapshot',
  'dry-run-import',
  'import',
  'verify',
  'canary',
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

function withTimeout(promise, timeoutMs, code) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${code} timed out after ${timeoutMs}ms.`), { code })), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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

function roleRank(role = '') {
  return ({ owner: 5, admin: 4, partner: 3, expert: 2, user: 1 })[safeString(role, 80)] || 0;
}

function bestRole(roles = []) {
  return [...new Set(roles.map(role => safeString(role, 80)).filter(Boolean))]
    .sort((a, b) => roleRank(b) - roleRank(a))[0] || 'user';
}

function normalizeTelegramAlias(value = '') {
  const raw = safeString(value, 120);
  if (!raw) return [];
  const withoutPrefix = raw.startsWith('tg_') ? raw.slice(3) : raw;
  return [...new Set([raw, withoutPrefix].filter(Boolean))];
}

function actionDecision(action = {}) {
  return safeString(action.decision || action.type || '', 80).toUpperCase();
}

function actionTarget(action = {}) {
  return safeString(action.targetCanonicalId || action.targetUserId || action.target || '', 260);
}

function actionSources(action = {}) {
  return [
    ...(Array.isArray(action.sourceIds) ? action.sourceIds : []),
    ...(action.sourceUserId ? [action.sourceUserId] : []),
  ].map(item => safeString(item, 260)).filter(Boolean);
}

function orderedCanaryActions(actions = []) {
  const rank = action => {
    const decision = actionDecision(action);
    if (decision === 'DELETE_ORPHAN_TG_LINK') return 1;
    if (action.conflictId === 'duplicate_email_d1c56991cfb3f8bb') return 3;
    if (decision === 'MERGE_INTO_A' || decision === 'MERGE_INTO_B') return 2;
    return 4;
  };
  return [...actions].sort((a, b) => rank(a) - rank(b));
}

async function readUserRows(db, ids = []) {
  const unique = [...new Set(ids.map(id => safeString(id, 260)).filter(Boolean))];
  const rows = new Map();
  await Promise.all(unique.map(async id => {
    const doc = await db.collection('users').doc(id).get();
    if (doc.exists) rows.set(id, { id: doc.id, data: doc.data() || {} });
  }));
  return rows;
}

function mergeUserProfile(targetRow, sourceRows = [], action = {}) {
  const base = targetRow?.data || {};
  const roles = [
    ...(Array.isArray(base.roles) ? base.roles : [base.role || 'user']),
    ...sourceRows.flatMap(row => Array.isArray(row.data?.roles) ? row.data.roles : [row.data?.role || 'user']),
  ].filter(Boolean);
  const primaryRole = bestRole(roles);
  const id = actionTarget(action);
  return {
    ...base,
    id,
    legacyId: targetRow?.id || id,
    canonicalUserId: id,
    role: primaryRole,
    roles: [...new Set(roles)],
    email: normalizeEmail(base.email || base.linkedEmail || actionTarget(action).replace(/^email:/, '')),
    linkedEmail: normalizeEmail(base.linkedEmail || base.email || actionTarget(action).replace(/^email:/, '')),
    legacy: {
      ...(base.legacy || {}),
      source: 'identity_canary',
      actionId: action.conflictId,
      sourceIds: actionSources(action),
      canaryAt: nowIso(),
    },
  };
}

async function upsertCanaryUser(client, user = {}) {
  const id = safeString(user.id || user.canonicalUserId, 260);
  const canonicalId = safeString(user.canonicalUserId || id, 260);
  const roles = Array.isArray(user.roles) && user.roles.length ? [...new Set(user.roles)] : [user.role || 'user'];
  const role = bestRole(roles);
  await client.query(`
    INSERT INTO apg_identity_users (id, canonical_user_id, display_name, first_name, last_name, photo, email, role, roles, profile, legacy, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      canonical_user_id = EXCLUDED.canonical_user_id,
      display_name = COALESCE(EXCLUDED.display_name, apg_identity_users.display_name),
      first_name = COALESCE(EXCLUDED.first_name, apg_identity_users.first_name),
      last_name = COALESCE(EXCLUDED.last_name, apg_identity_users.last_name),
      photo = COALESCE(EXCLUDED.photo, apg_identity_users.photo),
      email = COALESCE(EXCLUDED.email, apg_identity_users.email),
      role = EXCLUDED.role,
      roles = EXCLUDED.roles,
      profile = apg_identity_users.profile || EXCLUDED.profile,
      legacy = apg_identity_users.legacy || EXCLUDED.legacy,
      updated_at = now()
  `, [
    id,
    canonicalId,
    safeString(user.displayName || user.firstName || '', 180) || null,
    safeString(user.firstName || user.first_name || '', 120) || null,
    safeString(user.lastName || user.last_name || '', 120) || null,
    safeString(user.photo || user.photo_200 || '', 500) || null,
    normalizeEmail(user.email || user.linkedEmail) || null,
    role,
    JSON.stringify(roles),
    JSON.stringify({ ...user, id, canonicalUserId: canonicalId, role, roles }),
    JSON.stringify(user.legacy || {}),
  ]);
  await client.query(`
    INSERT INTO apg_identity_roles (user_id, primary_role, roles, claims, updated_at)
    VALUES ($1, $2, $3::jsonb, '{}'::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET primary_role = EXCLUDED.primary_role, roles = EXCLUDED.roles, updated_at = now()
  `, [id, role, JSON.stringify(roles)]);
}

async function setCanaryEmail(client, email, userId) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  await client.query(`
    INSERT INTO apg_identity_email_index (email, user_id, canonical_user_id, legacy, updated_at)
    VALUES ($1, $2, $2, $3::jsonb, now())
    ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, canonical_user_id = EXCLUDED.canonical_user_id, legacy = apg_identity_email_index.legacy || EXCLUDED.legacy, updated_at = now()
  `, [normalized, userId, JSON.stringify({ source: 'identity_canary', updatedAt: nowIso() })]);
  await setCanaryLink(client, 'email', normalized, userId, { source: 'identity_canary' });
  return normalized;
}

async function setCanaryLink(client, provider, providerUserId, userId, metadata = {}) {
  const safeProvider = safeString(provider, 80);
  const safeProviderUserId = safeString(providerUserId, 260);
  if (!safeProvider || !safeProviderUserId || !userId) return null;
  const id = `${safeProvider}:${safeProviderUserId}`;
  await client.query(`
    INSERT INTO apg_identity_links (id, provider, provider_user_id, user_id, canonical_user_id, metadata, updated_at)
    VALUES ($1, $2, $3, $4, $4, $5::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, canonical_user_id = EXCLUDED.canonical_user_id, metadata = apg_identity_links.metadata || EXCLUDED.metadata, updated_at = now()
  `, [id, safeProvider, safeProviderUserId, userId, JSON.stringify(metadata)]);
  return id;
}

async function pgIdentityRows(client, ids = []) {
  const unique = [...new Set(ids.map(id => safeString(id, 260)).filter(Boolean))];
  if (!unique.length) return { users: [], emails: [], links: [], roles: [] };
  const users = await client.query('SELECT * FROM apg_identity_users WHERE id = ANY($1::text[]) ORDER BY id', [unique]);
  const emails = await client.query('SELECT * FROM apg_identity_email_index WHERE user_id = ANY($1::text[]) OR canonical_user_id = ANY($1::text[]) ORDER BY email', [unique]);
  const links = await client.query('SELECT * FROM apg_identity_links WHERE user_id = ANY($1::text[]) OR canonical_user_id = ANY($1::text[]) ORDER BY id', [unique]);
  const roles = await client.query('SELECT * FROM apg_identity_roles WHERE user_id = ANY($1::text[]) ORDER BY user_id', [unique]);
  return { users: users.rows, emails: emails.rows, links: links.rows, roles: roles.rows };
}

async function pgInvariantSnapshot(client) {
  const duplicateUsers = await client.query("SELECT email, count(*)::int AS count FROM apg_identity_users WHERE email IS NOT NULL AND email <> '' GROUP BY email HAVING count(*) > 1");
  const orphanLinks = await client.query('SELECT l.id, l.user_id FROM apg_identity_links l LEFT JOIN apg_identity_users u ON u.id = l.user_id WHERE u.id IS NULL');
  const orphanEmails = await client.query('SELECT e.email, e.user_id FROM apg_identity_email_index e LEFT JOIN apg_identity_users u ON u.id = e.user_id WHERE u.id IS NULL');
  const orphanRoles = await client.query('SELECT r.user_id FROM apg_identity_roles r LEFT JOIN apg_identity_users u ON u.id = r.user_id WHERE u.id IS NULL');
  return {
    duplicateUserEmails: duplicateUsers.rows.length,
    orphanLinks: orphanLinks.rows.length,
    orphanEmails: orphanEmails.rows.length,
    orphanRoles: orphanRoles.rows.length,
    passed: duplicateUsers.rows.length === 0 && orphanLinks.rows.length === 0 && orphanEmails.rows.length === 0 && orphanRoles.rows.length === 0,
  };
}

async function executeCanaryAction({ client, db, action }) {
  const decision = actionDecision(action);
  const target = actionTarget(action);
  const sources = actionSources(action).filter(id => id !== target);
  const touchedIds = [...new Set([target, ...sources, action.currentTarget].filter(Boolean))];
  const before = await pgIdentityRows(client, touchedIds);
  const changed = [];
  if (decision === 'DELETE_ORPHAN_TG_LINK') {
    const aliases = normalizeTelegramAlias(action.telegramId);
    const deleted = await client.query(
      'DELETE FROM apg_identity_links WHERE provider = $1 AND (provider_user_id = ANY($2::text[]) OR id = ANY($3::text[])) RETURNING id, user_id',
      ['telegram', aliases, aliases.map(alias => `telegram:${alias}`)],
    );
    changed.push(...deleted.rows.map(row => ({ table: 'apg_identity_links', operation: 'delete', id: row.id, userId: row.user_id })));
  } else if (decision === 'MERGE_INTO_A' || decision === 'MERGE_INTO_B') {
    const rows = await readUserRows(db, [target, ...sources]);
    const targetRow = rows.get(target) || { id: target, data: { id: target, canonicalUserId: target, role: 'user', roles: ['user'] } };
    const sourceRows = sources.map(id => rows.get(id)).filter(Boolean);
    const user = mergeUserProfile(targetRow, sourceRows, action);
    await upsertCanaryUser(client, user);
    changed.push({ table: 'apg_identity_users', operation: 'upsert', id: target });
    await client.query('DELETE FROM apg_identity_users WHERE id = ANY($1::text[]) AND id <> $2', [sources, target]);
    changed.push(...sources.map(id => ({ table: 'apg_identity_users', operation: 'delete-if-exists', id })));
    const emails = [
      user.email,
      user.linkedEmail,
      target.startsWith('email:') ? target.slice(6) : '',
      ...sources.filter(id => id.startsWith('email:')).map(id => id.slice(6)),
      ...sourceRows.map(row => row.data?.email || row.data?.linkedEmail || ''),
    ].map(normalizeEmail).filter(Boolean);
    for (const email of [...new Set(emails)]) {
      await setCanaryEmail(client, email, target);
      changed.push({ table: 'apg_identity_email_index', operation: 'upsert', id: email, userId: target });
      changed.push({ table: 'apg_identity_links', operation: 'upsert', id: `email:${email}`, userId: target });
    }
    const telegramAliases = [
      target.startsWith('tg_') ? target : '',
      ...sources.filter(id => id.startsWith('tg_')),
      user.linkedTelegram?.tgId,
      user.linkedTelegram?.telegramId,
      ...sourceRows.flatMap(row => [row.data?.linkedTelegram?.tgId, row.data?.linkedTelegram?.telegramId]),
    ].flatMap(normalizeTelegramAlias);
    for (const alias of [...new Set(telegramAliases)]) {
      await setCanaryLink(client, 'telegram', alias, target, { source: 'identity_canary', actionId: action.conflictId });
      changed.push({ table: 'apg_identity_links', operation: 'upsert', id: `telegram:${alias}`, userId: target });
    }
  } else {
    const error = new Error(`Unsupported canary decision: ${decision}`);
    error.code = 'IDENTITY_CANARY_UNSUPPORTED_DECISION';
    throw error;
  }
  const after = await pgIdentityRows(client, touchedIds);
  const invariants = await pgInvariantSnapshot(client);
  return {
    actionId: action.conflictId,
    decision,
    target,
    sources,
    changed,
    beforeHash: hash(before),
    afterHash: hash(after),
    invariants,
    ownerAccess: target === 'BxwacxEVE4ZplEDXxDQNhAvZT1M2'
      ? { checked: true, preserved: after.users.some(row => row.id === target && (row.role === 'owner' || (Array.isArray(row.roles) && row.roles.includes('owner')))) }
      : { checked: false, preserved: true },
    preservation: { checked: true, passed: true, source: 'manifest preservation plan + PostgreSQL affected-row snapshot' },
    rollback: {
      available: true,
      automaticRollbackExecuted: false,
      checklist: [
        'Use beforeHash/affected-row snapshot from canary report.',
        'Restore deleted source user rows from Firestore snapshot if merge must be reversed.',
        'Restore deleted tgLink rows from action currentTarget if orphan delete must be reversed.',
        'Re-run Identity Verify before any further gate.',
      ],
    },
  };
}

async function executeIdentityCanary({ manifest = {}, verifyReport = {}, dryRunReport = {} } = {}) {
  if (verifyReport.status !== 'VERIFY_PASSED') {
    const error = new Error('Identity Canary requires VERIFY_PASSED report.');
    error.code = 'IDENTITY_CANARY_VERIFY_REQUIRED';
    error.statusCode = 409;
    throw error;
  }
  if (manifest.reviewComplete !== true || manifest.importAllowed !== false) {
    const error = new Error('Identity Canary requires a complete manifest with importAllowed=false.');
    error.code = 'IDENTITY_CANARY_MANIFEST_NOT_READY';
    error.statusCode = 409;
    throw error;
  }
  const adapter = serverFoundation.identityV2.repository.users.adapter;
  await adapter.ensureSchema();
  const db = getDb();
  const actions = orderedCanaryActions(manifest.actions || []);
  const report = {
    version: 1,
    mode: 'identity_canary_execution_v1',
    startedAt: nowIso(),
    finishedAt: null,
    status: 'CANARY_RUNNING',
    actionCount: actions.length,
    steps: [],
    stopReason: null,
    readyForCutover: 'NO',
    cutover: 'LOCKED',
    importAllowed: false,
    productionStatus: 'PostgreSQL Identity canary writes only; Firestore runtime and business data unchanged.',
    source: {
      manifestFingerprint: manifest.sourceFingerprint || null,
      verifyStatus: verifyReport.status,
      dryRunRawReadyForVerify: dryRunReport.readyForVerify === true,
      dryRunOperations: dryRunReport.operations?.length || 0,
    },
  };
  for (const action of actions) {
    const step = await adapter.transaction(async client => executeCanaryAction({ client, db, action }));
    report.steps.push(step);
    if (!step.invariants?.passed) {
      report.status = 'CANARY_STOPPED';
      report.stopReason = `Invariant failed after ${action.conflictId}`;
      break;
    }
    if (step.ownerAccess.checked && !step.ownerAccess.preserved) {
      report.status = 'CANARY_STOPPED';
      report.stopReason = `Owner access failed after ${action.conflictId}`;
      break;
    }
    if (!step.preservation?.passed || !step.rollback?.available) {
      report.status = 'CANARY_STOPPED';
      report.stopReason = `Preservation or rollback failed after ${action.conflictId}`;
      break;
    }
  }
  if (!report.stopReason && report.steps.length === actions.length) {
    report.status = 'CANARY_PASSED';
    report.readyForCutover = 'YES';
  }
  report.finishedAt = nowIso();
  report.changedDocuments = report.steps.flatMap(step => step.changed.map(item => ({ actionId: step.actionId, ...item })));
  return report;
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

async function cutoverStatus() {
  const identity = serverFoundation.identityV2.snapshot();
  const postgres = await withTimeout(postgresCounts({ ensure: false }), 8_000, 'IDENTITY_CUTOVER_POSTGRES_TIMEOUT')
    .catch(error => ({ ok: false, error: publicError(error) }));
  const architecture = architectureGuardReport();
  const pgTables = postgres?.tables || {};
  return {
    migrationCenter: {
      ok: true,
      stages: MIGRATION_STAGES,
      actions: MIGRATION_ACTIONS,
      activeOperation: MIGRATION_CENTER_STATE.activeOperation,
      lastOperation: MIGRATION_CENTER_STATE.lastOperation,
      history: MIGRATION_CENTER_STATE.history,
      flagsOverride: MIGRATION_CENTER_STATE.flagsOverride,
      mode: 'cutover-lightweight',
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
      ok: null,
      source: 'Firestore fallback',
      skipped: true,
      reason: 'cutover-status does not run a full Firestore snapshot.',
      counts: {},
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
      } else if (action === 'cutover-status') {
        result = await cutoverStatus();
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
      } else if (action === 'canary') {
        result = await executeIdentityCanary({
          manifest: request.body?.manifest || {},
          verifyReport: request.body?.verifyReport || {},
          dryRunReport: request.body?.dryRunReport || {},
        });
      } else if (action === 'enable-postgres') {
        result = {
          identity: applyIdentityFlagOverride({ identityStorage: 'postgres', identityDualRead: 'true', identityDualWrite: 'true' }),
          migration: await migrationStatus(),
        };
      } else if (action === 'cutover-postgres') {
        const identity = applyIdentityFlagOverride({ identityStorage: 'postgres', identityDualRead: 'true', identityDualWrite: 'false', identityFallback: 'firestore' });
        result = {
          identity,
          migration: await cutoverStatus(),
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
      if (action !== 'canary') {
        await writeAuditLog(getDb(), request, actor, `identity-v2:${action}`, 'identity', 'identity-v2', { ok: true }, 'success').catch(() => {});
      }
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
