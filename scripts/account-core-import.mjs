import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

const EXPECTED_SNAPSHOT_SHA = '3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7';
const SNAPSHOT_LATEST = 'backups/account-core/snapshot/latest-snapshot-redacted.json';
const RESOLUTION_MANIFEST = 'backups/account-core/conflicts/resolution-manifest-redacted.json';
const DRY_RUN_REPORT = 'backups/account-core/dryrun/dry-run-redacted.json';
const SCHEMA_PATH = 'server/src/apg/account/schema/account-core.sql';
const OUT_DIR = 'backups/account-core/import';
const CHECKPOINT = 'backups/account-core/import-checkpoint-redacted.json';
const MANIFEST = 'backups/account-core/manifest.json';
const EXECUTE = process.argv.includes('--execute');
const RESUME = process.argv.includes('--resume');
const BATCH_SIZE = Number(process.env.APG_ACCOUNT_IMPORT_BATCH_SIZE || 100);

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanId(value) {
  return String(value || '').trim();
}

function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._seconds) return new Date(value._seconds * 1000).toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return null;
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
  const candidates = [
    process.env.APG_YANDEX_CA_PATH,
    '/app/certs/YandexInternalRootCA.crt',
    '/root/.postgresql/root.crt',
    'certs/YandexInternalRootCA.crt',
  ].filter(Boolean);
  const file = candidates.find(item => fs.existsSync(item) && fs.statSync(item).size > 0);
  if (!file) throw Object.assign(new Error('Yandex CA certificate not found.'), { code: 'YANDEX_CA_NOT_FOUND' });
  const ca = fs.readFileSync(file, 'utf8');
  if (!ca.includes('BEGIN CERTIFICATE') || ca.includes('PRIVATE KEY')) throw Object.assign(new Error('Yandex CA certificate invalid.'), { code: 'YANDEX_CA_INVALID' });
  return ca;
}

function rolesOf(user) {
  const data = user.data || {};
  return [...new Set([
    ...(Array.isArray(data.roles) ? data.roles : []),
    data.role,
    data.userRole,
  ].map(normalized).filter(Boolean))];
}

function primaryRole(roles) {
  for (const role of ['owner', 'super_admin', 'admin', 'partner', 'expert', 'user']) {
    if (roles.includes(role)) return role;
  }
  return roles[0] || 'user';
}

function ownerIdsFromEntity(entity) {
  const data = entity.data || {};
  return [data.ownerId, data.ownerUserId, data.userId, data.partnerOwnerId, data.expertOwnerId].map(cleanId).filter(Boolean);
}

function duplicateOwnerP0(users) {
  const groups = new Map();
  for (const user of users) {
    const email = normalized(user.data?.email || user.data?.linkedEmail);
    if (!email) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(user);
  }
  for (const [email, group] of groups.entries()) {
    if (group.length < 2) continue;
    const isP0 = group.some(user => {
      const data = user.data || {};
      const roles = (Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean)).map(normalized);
      return roles.some(role => ['owner', 'super_admin', 'admin'].includes(role));
    });
    if (!isP0) continue;
    const canonical = group.find(user => normalized(user.data?.canonicalUserId) === normalized(user.id) && user.data?.identityStatus === 'canonical');
    const legacy = group.find(user => canonical && normalized(user.data?.mergedInto) === normalized(canonical.id) && user.data?.identityStatus === 'legacy_linked');
    if (canonical && legacy) return { emailHash: `email_${hash(email)}`, canonicalId: canonical.id, legacyId: legacy.id };
  }
  return null;
}

function buildPlan(snapshot) {
  const users = snapshot.collections.users || [];
  const p0 = duplicateOwnerP0(users);
  const skipUsers = new Set(p0 ? [normalized(p0.legacyId)] : []);
  const canonicalByLegacy = new Map(p0 ? [[normalized(p0.legacyId), p0.canonicalId]] : []);
  const usersById = new Map(users.map(user => [normalized(user.id), user]));
  const profiles = [];
  const roles = [];
  for (const user of users) {
    if (skipUsers.has(normalized(user.id))) continue;
    const data = user.data || {};
    const merged = p0 && normalized(user.id) === normalized(p0.canonicalId) ? usersById.get(normalized(p0.legacyId)) : null;
    const roleSet = new Set([...rolesOf(user), ...(merged ? rolesOf(merged) : [])]);
    if (!roleSet.size) roleSet.add('user');
    const roleList = [...roleSet];
    const profilePayload = {
      ...data,
      legacyMerged: Boolean(merged),
      legacyAliases: merged ? [`account_${hash(merged.id)}`] : [],
      migration: { source: 'account-core-snapshot', snapshotSha256: EXPECTED_SNAPSHOT_SHA },
    };
    profiles.push({
      userId: user.id,
      canonicalUserId: data.canonicalUserId || user.id,
      firebaseUid: data.firebaseUid || data.authUid || '',
      email: data.email || data.linkedEmail || '',
      telegramId: data.telegramId || data.tgId || data.linkedTelegram || '',
      displayName: data.displayName || data.name || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      photo: data.photo || data.avatar || data.photo_200 || '',
      city: data.city || '',
      profile: profilePayload,
      bootstrap: {},
      legacy: { sourceUserHash: `account_${hash(user.id)}`, legacyMerge: merged ? `account_${hash(merged.id)}` : null },
      lastSeenAt: parseTimestamp(data.lastSeen || data.lastLoginAt || data.updatedAt),
    });
    roles.push({
      userId: user.id,
      primaryRole: primaryRole(roleList),
      roles: roleList,
      permissions: Array.isArray(data.adminPermissions) ? data.adminPermissions : [],
      claims: { sourceUserHash: `account_${hash(user.id)}` },
    });
  }
  const profileIds = new Set(profiles.map(item => normalized(item.userId)));
  const remapUser = userId => canonicalByLegacy.get(normalized(userId)) || usersById.get(normalized(userId))?.id || userId;
  const cabinets = [
    ...(snapshot.collections.partners || []).flatMap(item => ownerIdsFromEntity(item).map(userId => ({ type: 'partner', entityId: item.id, userId: remapUser(userId) }))),
    ...(snapshot.collections.experts || []).flatMap(item => ownerIdsFromEntity(item).map(userId => ({ type: 'expert', entityId: item.id, userId: remapUser(userId) }))),
  ].filter(item => profileIds.has(normalized(item.userId))).map(item => ({
    id: `${item.type}:${item.entityId}:${item.userId}`,
    ...item,
    role: 'owner',
    status: 'active',
    metadata: { source: 'account-core-snapshot', entityHash: `${item.type}_${hash(item.entityId)}` },
  }));
  const telegramLinks = (snapshot.collections.tgLinks || []).map(item => {
    const data = item.data || {};
    const userId = remapUser(data.userId || data.uid || data.canonicalUserId || '');
    return { telegramId: item.id, userId, canonicalUserId: userId, metadata: { source: 'account-core-snapshot', linkHash: `tg_${hash(item.id)}` } };
  }).filter(item => item.telegramId && profileIds.has(normalized(item.userId)));
  const sessions = (snapshot.collections.telegramAuthSessions || []).map(item => {
    const data = item.data || {};
    const userId = remapUser(data.userId || data.uid || '');
    return {
      id: item.id,
      userId,
      firebaseUid: data.firebaseUid || data.authUid || '',
      device: { source: 'telegramAuthSessions', sessionHash: `session_${hash(item.id)}` },
      platform: data.platform || 'telegram',
      status: data.status || 'active',
      lastSeenAt: parseTimestamp(data.lastSeenAt || data.updatedAt || data.createdAt),
      expiresAt: parseTimestamp(data.expiresAt),
    };
  }).filter(item => item.id && profileIds.has(normalized(item.userId)));
  return {
    p0,
    profiles,
    roles,
    cabinets,
    telegramLinks,
    sessions,
    skips: {
      legacyMergedUsers: p0 ? 1 : 0,
      orphanTelegramLinks: (snapshot.collections.tgLinks || []).length - telegramLinks.length,
      orphanSessions: (snapshot.collections.telegramAuthSessions || []).length - sessions.length,
    },
  };
}

async function upsertProfile(client, item) {
  const result = await client.query(`
    INSERT INTO apg_account_profiles (user_id, canonical_user_id, firebase_uid, email, telegram_id, display_name, first_name, last_name, photo, city, profile, bootstrap, legacy, updated_at, last_seen_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,now(),COALESCE($14::timestamptz, now()))
    ON CONFLICT (user_id) DO UPDATE SET
      canonical_user_id = EXCLUDED.canonical_user_id,
      firebase_uid = COALESCE(EXCLUDED.firebase_uid, apg_account_profiles.firebase_uid),
      email = COALESCE(EXCLUDED.email, apg_account_profiles.email),
      telegram_id = COALESCE(EXCLUDED.telegram_id, apg_account_profiles.telegram_id),
      display_name = COALESCE(EXCLUDED.display_name, apg_account_profiles.display_name),
      first_name = COALESCE(EXCLUDED.first_name, apg_account_profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, apg_account_profiles.last_name),
      photo = COALESCE(EXCLUDED.photo, apg_account_profiles.photo),
      city = COALESCE(EXCLUDED.city, apg_account_profiles.city),
      profile = apg_account_profiles.profile || EXCLUDED.profile,
      bootstrap = apg_account_profiles.bootstrap || EXCLUDED.bootstrap,
      legacy = apg_account_profiles.legacy || EXCLUDED.legacy,
      updated_at = now(),
      last_seen_at = COALESCE(EXCLUDED.last_seen_at, apg_account_profiles.last_seen_at)
    RETURNING (xmax = 0) AS inserted
  `, [item.userId, item.canonicalUserId, safeString(item.firebaseUid, 260) || null, normalizeEmail(item.email) || null, safeString(item.telegramId, 120) || null, safeString(item.displayName, 180) || null, safeString(item.firstName, 120) || null, safeString(item.lastName, 120) || null, safeString(item.photo, 500) || null, safeString(item.city, 120) || null, JSON.stringify(item.profile), JSON.stringify(item.bootstrap), JSON.stringify(item.legacy), item.lastSeenAt]);
  return Boolean(result.rows[0]?.inserted);
}

async function upsertRole(client, item) {
  const result = await client.query(`
    INSERT INTO apg_account_roles (user_id, primary_role, roles, permissions, claims, updated_at)
    VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,now())
    ON CONFLICT (user_id) DO UPDATE SET primary_role = EXCLUDED.primary_role, roles = EXCLUDED.roles, permissions = EXCLUDED.permissions, claims = EXCLUDED.claims, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `, [item.userId, item.primaryRole, JSON.stringify(item.roles), JSON.stringify(item.permissions), JSON.stringify(item.claims)]);
  return Boolean(result.rows[0]?.inserted);
}

async function upsertCabinet(client, item) {
  const result = await client.query(`
    INSERT INTO apg_account_cabinets (id, user_id, type, role, entity_id, status, metadata, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
    ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, type = EXCLUDED.type, role = EXCLUDED.role, entity_id = EXCLUDED.entity_id, status = EXCLUDED.status, metadata = apg_account_cabinets.metadata || EXCLUDED.metadata, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `, [item.id, item.userId, item.type, item.role, item.entityId, item.status, JSON.stringify(item.metadata)]);
  return Boolean(result.rows[0]?.inserted);
}

async function upsertTelegram(client, item) {
  const result = await client.query(`
    INSERT INTO apg_account_telegram_links (telegram_id, user_id, canonical_user_id, metadata, updated_at)
    VALUES ($1,$2,$3,$4::jsonb,now())
    ON CONFLICT (telegram_id) DO UPDATE SET user_id = EXCLUDED.user_id, canonical_user_id = EXCLUDED.canonical_user_id, metadata = apg_account_telegram_links.metadata || EXCLUDED.metadata, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `, [safeString(item.telegramId, 120), item.userId, item.canonicalUserId, JSON.stringify(item.metadata)]);
  return Boolean(result.rows[0]?.inserted);
}

async function upsertSession(client, item) {
  const result = await client.query(`
    INSERT INTO apg_account_sessions (id, user_id, firebase_uid, device, platform, status, last_seen_at, expires_at)
    VALUES ($1,$2,$3,$4::jsonb,$5,$6,COALESCE($7::timestamptz, now()),$8::timestamptz)
    ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, firebase_uid = COALESCE(EXCLUDED.firebase_uid, apg_account_sessions.firebase_uid), device = apg_account_sessions.device || EXCLUDED.device, platform = COALESCE(EXCLUDED.platform, apg_account_sessions.platform), status = EXCLUDED.status, last_seen_at = COALESCE(EXCLUDED.last_seen_at, apg_account_sessions.last_seen_at), expires_at = COALESCE(EXCLUDED.expires_at, apg_account_sessions.expires_at)
    RETURNING (xmax = 0) AS inserted
  `, [safeString(item.id, 260), item.userId, safeString(item.firebaseUid, 260) || null, JSON.stringify(item.device), safeString(item.platform, 120) || null, safeString(item.status, 60) || 'active', item.lastSeenAt, item.expiresAt]);
  return Boolean(result.rows[0]?.inserted);
}

async function tableCounts(client) {
  const tables = ['apg_account_profiles', 'apg_account_roles', 'apg_account_cabinets', 'apg_account_telegram_links', 'apg_account_sessions'];
  const out = {};
  for (const table of tables) {
    const result = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    out[table] = result.rows[0]?.count || 0;
  }
  return out;
}

async function assertProfileCoverage(pool, label, items) {
  const userIds = [...new Set(items.map(item => item.userId).filter(Boolean))];
  if (!userIds.length) return;
  const result = await pool.query('SELECT user_id FROM apg_account_profiles WHERE user_id = ANY($1::text[])', [userIds]);
  const found = new Set(result.rows.map(row => normalized(row.user_id)));
  const missing = userIds.filter(userId => !found.has(normalized(userId)));
  if (missing.length) {
    throw Object.assign(new Error(`${label.toUpperCase()}_PROFILE_COVERAGE_MISSING`), {
      code: `${label.toUpperCase()}_PROFILE_COVERAGE_MISSING`,
      missingHashes: missing.map(userId => `account_${hash(userId)}`),
    });
  }
}

function batches(items) {
  const out = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) out.push(items.slice(index, index + BATCH_SIZE));
  return out;
}

async function importItems({ pool, label, items, fn, checkpoint }) {
  let inserted = 0;
  let updated = 0;
  let skippedExisting = 0;
  let batchIndex = 0;
  const existsSql = {
    profiles: 'SELECT 1 FROM apg_account_profiles WHERE user_id = $1 LIMIT 1',
    roles: 'SELECT 1 FROM apg_account_roles WHERE user_id = $1 LIMIT 1',
    cabinets: 'SELECT 1 FROM apg_account_cabinets WHERE id = $1 LIMIT 1',
    telegramLinks: 'SELECT 1 FROM apg_account_telegram_links WHERE telegram_id = $1 LIMIT 1',
    sessions: 'SELECT 1 FROM apg_account_sessions WHERE id = $1 LIMIT 1',
  }[label];
  const idOf = item => {
    if (label === 'profiles' || label === 'roles') return item.userId;
    if (label === 'telegramLinks') return item.telegramId;
    return item.id;
  };
  for (const batch of batches(items)) {
    batchIndex += 1;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of batch) {
        if (RESUME && existsSql) {
          const exists = await client.query(existsSql, [idOf(item)]);
          if (exists.rows.length) {
            skippedExisting += 1;
            continue;
          }
        }
        const wasInserted = await fn(client, item);
        if (wasInserted) inserted += 1;
        else updated += 1;
      }
      await client.query('COMMIT');
      checkpoint.batches.push({ label, batch: batchIndex, size: batch.length, inserted, updated, skippedExisting, committed: true, retryCount: 0 });
      ensureDir(CHECKPOINT);
      fs.writeFileSync(CHECKPOINT, `${JSON.stringify(checkpoint, null, 2)}\n`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      checkpoint.status = 'IMPORT_PARTIAL';
      checkpoint.failedBatch = { label, batch: batchIndex, error: String(error?.code || error?.message || error).slice(0, 200) };
      fs.writeFileSync(CHECKPOINT, `${JSON.stringify(checkpoint, null, 2)}\n`);
      throw error;
    } finally {
      client.release();
    }
  }
  return { inserted, updated, skippedExisting };
}

function verifyInputs({ snapshotSha, resolution, dryRun }) {
  if (snapshotSha !== EXPECTED_SNAPSHOT_SHA) throw Object.assign(new Error('SNAPSHOT_HASH_MISMATCH'), { code: 'SNAPSHOT_HASH_MISMATCH' });
  if (resolution.sourceSnapshotHash !== EXPECTED_SNAPSHOT_SHA || !resolution.actions?.length) throw Object.assign(new Error('RESOLUTION_MANIFEST_INVALID'), { code: 'RESOLUTION_MANIFEST_INVALID' });
  if (dryRun.snapshotSha256 !== EXPECTED_SNAPSHOT_SHA || dryRun.status !== 'DRY_RUN_PASSED') throw Object.assign(new Error('DRY_RUN_NOT_VERIFIED'), { code: 'DRY_RUN_NOT_VERIFIED' });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const snapshotPath = process.env.APG_ACCOUNT_SNAPSHOT_PATH || readJson(SNAPSHOT_LATEST).rawSnapshotPath;
  const snapshotText = fs.readFileSync(snapshotPath, 'utf8');
  const snapshotSha = sha256Text(snapshotText);
  const snapshot = JSON.parse(snapshotText);
  const resolution = readJson(RESOLUTION_MANIFEST);
  const dryRun = readJson(DRY_RUN_REPORT);
  verifyInputs({ snapshotSha, resolution, dryRun });
  const plan = buildPlan(snapshot);
  if (!EXECUTE) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', importExecuted: false, sourceSnapshotHash: snapshotSha, expected: dryRun.expectedTables }, null, 2));
    return;
  }
  const pool = new Pool({
    connectionString: normalizeDsnForPg(getDsn()),
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 2_000,
    ssl: { ca: readYandexCa(), rejectUnauthorized: true },
  });
  const checkpoint = {
    ok: false,
    status: 'IMPORT_RUNNING',
    dryRun: false,
    resume: RESUME,
    sourceSnapshotHash: snapshotSha,
    startedAt: new Date().toISOString(),
    batches: [],
    productionChanged: true,
    firestoreChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
  };
  let totals = { inserted: 0, updated: 0 };
  let skippedExisting = 0;
  try {
    await pool.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const before = await tableCounts(pool);
    const stages = [
      ['profiles', plan.profiles, upsertProfile],
      ['roles', plan.roles, upsertRole],
      ['cabinets', plan.cabinets, upsertCabinet],
      ['telegramLinks', plan.telegramLinks, upsertTelegram],
      ['sessions', plan.sessions, upsertSession],
    ];
    for (const [label, items, fn] of stages) {
      if (['cabinets', 'telegramLinks', 'sessions'].includes(label)) {
        await assertProfileCoverage(pool, label, items);
      }
      const result = await importItems({ pool, label, items, fn, checkpoint });
      totals.inserted += result.inserted;
      totals.updated += result.updated;
      skippedExisting += result.skippedExisting;
    }
    const after = await tableCounts(pool);
    checkpoint.ok = true;
    checkpoint.status = 'IMPORT_PASSED';
    checkpoint.finishedAt = new Date().toISOString();
    checkpoint.postgresWrites = totals.inserted + totals.updated;
    checkpoint.inserted = totals.inserted;
    checkpoint.updated = totals.updated;
    checkpoint.skipped = plan.skips.legacyMergedUsers + plan.skips.orphanTelegramLinks + plan.skips.orphanSessions + skippedExisting;
    checkpoint.skippedExisting = skippedExisting;
    checkpoint.tableCountsBefore = before;
    checkpoint.tableCountsAfter = after;
    checkpoint.rollbackReady = true;
    fs.writeFileSync(CHECKPOINT, `${JSON.stringify(checkpoint, null, 2)}\n`);
    const report = {
      version: 1,
      status: 'IMPORT_PASSED',
      sourceSnapshotHash: snapshotSha,
      inserted: totals.inserted,
      updated: totals.updated,
      skipped: checkpoint.skipped,
      skippedExisting,
      retryCount: 0,
      checkpointsCreated: checkpoint.batches.length,
      expectedDryRunInserts: dryRun.expectedInserts,
      tableCountsBefore: before,
      tableCountsAfter: after,
      p0Resolution: resolution.actions.length,
      legacyMerges: plan.skips.legacyMergedUsers,
      firestoreWrites: 0,
      postgresWrites: checkpoint.postgresWrites,
      verifyStarted: false,
      canaryStarted: false,
      cutoverStarted: false,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'import-report-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT_DIR, 'import-summary.md'), [
      '# Account Core Import',
      '',
      `Status: ${report.status}`,
      `Snapshot SHA-256: ${report.sourceSnapshotHash}`,
      `Inserted records: ${report.inserted}`,
      `Updated records: ${report.updated}`,
      `Skipped records: ${report.skipped}`,
      `Checkpoints: ${report.checkpointsCreated}`,
      '',
      '## Guardrails',
      '',
      '- Firestore writes: 0',
      '- Canary: NOT RUN',
      '- Cutover: NOT RUN',
      '',
    ].join('\n'));
    fs.writeFileSync(MANIFEST, `${JSON.stringify({ ...report, migrationId: 'account_core_import_v1', rollbackReady: true }, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(error => {
  const report = {
    status: 'IMPORT_BLOCKED',
    error: {
      code: error?.code || '',
      message: String(error?.message || error).slice(0, 240),
      missingHashes: error?.missingHashes || [],
    },
    firestoreWrites: 0,
    canaryStarted: false,
    cutoverStarted: false,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'import-report-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
