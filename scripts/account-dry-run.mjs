import fs from 'node:fs';
import path from 'node:path';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

loadMigrationEnv();

const SNAPSHOT_LATEST = 'backups/account-core/snapshot/latest-snapshot-redacted.json';
const CONFLICTS_REPORT = 'backups/account-core/conflicts/conflicts-redacted.json';
const RESOLUTION_MANIFEST = 'backups/account-core/conflicts/resolution-manifest-redacted.json';
const OUT_DIR = 'backups/account-core/dryrun';

const required = [
  'server/src/apg/account/schema/account-core.sql',
  'server/src/apg/account/bootstrap/createAccountCore.js',
  'server/src/apg/account/services/AccountCoreService.js',
  'server/src/apg/account/repositories/ProfileRepository.js',
  'server/src/apg/account/repositories/RoleRepository.js',
  'server/src/apg/account/repositories/SessionRepository.js',
  'server/src/apg/account/repositories/CabinetRepository.js',
  'server/src/apg/account/repositories/TelegramSupportRepository.js',
];

const missing = required.filter(file => !fs.existsSync(file));
fs.mkdirSync(OUT_DIR, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function ownerIdsFromEntity(entity) {
  const data = entity.data || {};
  return [data.ownerId, data.ownerUserId, data.userId, data.partnerOwnerId, data.expertOwnerId].map(normalized).filter(Boolean);
}

function plannedCabinets(snapshot) {
  return [
    ...(snapshot.collections.partners || []).flatMap(item => ownerIdsFromEntity(item).map(userId => ({ type: 'partner', entityId: item.id, userId }))),
    ...(snapshot.collections.experts || []).flatMap(item => ownerIdsFromEntity(item).map(userId => ({ type: 'expert', entityId: item.id, userId }))),
  ];
}

function duplicateOwnerP0(users) {
  const groups = new Map();
  for (const user of users) {
    const email = normalized(user.data?.email || user.data?.linkedEmail);
    if (!email) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(user);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const isP0 = group.some(user => {
      const data = user.data || {};
      const roles = (Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean)).map(normalized);
      return roles.some(role => ['owner', 'super_admin', 'admin'].includes(role));
    });
    if (!isP0) continue;
    const canonical = group.find(user => normalized(user.data?.canonicalUserId) === normalized(user.id) && user.data?.identityStatus === 'canonical');
    const legacy = group.find(user => canonical && normalized(user.data?.mergedInto) === normalized(canonical.id) && user.data?.identityStatus === 'legacy_linked');
    if (canonical && legacy) return { canonicalId: canonical.id, legacyId: legacy.id };
  }
  return null;
}

function dryRunPlan(snapshot) {
  const users = snapshot.collections.users || [];
  const p0 = duplicateOwnerP0(users);
  const canonicalByLegacy = new Map(p0 ? [[normalized(p0.legacyId), p0.canonicalId]] : []);
  const remapUser = userId => canonicalByLegacy.get(normalized(userId)) || userId;
  const profileIds = new Set(users.filter(user => normalized(user.id) !== normalized(p0?.legacyId)).map(user => normalized(user.id)));
  const tgLinks = (snapshot.collections.tgLinks || []).filter(item => profileIds.has(normalized(remapUser(item.data?.userId || item.data?.uid || item.data?.canonicalUserId || ''))));
  const sessions = (snapshot.collections.telegramAuthSessions || []).filter(item => profileIds.has(normalized(remapUser(item.data?.userId || item.data?.uid || ''))));
  const cabinets = plannedCabinets(snapshot).map(item => ({ ...item, userId: remapUser(item.userId) })).filter(item => profileIds.has(normalized(item.userId)));
  const manifest = fs.existsSync(RESOLUTION_MANIFEST) ? readJson(RESOLUTION_MANIFEST) : { actions: [] };
  const mergeActions = (manifest.actions || []).filter(action => action.type === 'mergeLegacyIntoCanonical');
  const canonicalProfileCount = Math.max(0, users.length - mergeActions.length);
  const orphanTelegramLinks = (snapshot.collections.tgLinks || []).length - tgLinks.length;
  const orphanSessions = (snapshot.collections.telegramAuthSessions || []).length - sessions.length;
  const inserts = {
    apg_account_profiles: canonicalProfileCount,
    apg_account_roles: canonicalProfileCount,
    apg_account_cabinets: cabinets.length,
    apg_account_telegram_links: tgLinks.length,
    apg_account_sessions: sessions.length,
  };
  return {
    expectedInserts: Object.values(inserts).reduce((sum, count) => sum + count, 0),
    expectedUpdates: 0,
    expectedUnchanged: 0,
    expectedSkips: mergeActions.length + orphanTelegramLinks + orphanSessions,
    expectedTables: inserts,
    transformations: {
      legacyMerges: mergeActions.length,
      orphanTelegramLinks,
      orphanSessions,
      resolutionManifestApplied: mergeActions.length > 0,
    },
    batching: {
      batchSize: 100,
      batches: Object.fromEntries(Object.entries(inserts).map(([name, count]) => [name, Math.ceil(count / 100)])),
    },
    resume: {
      checkpointEveryBatch: true,
      idempotencyKeys: ['user_id', 'cabinet_id', 'telegram_id', 'session_id'],
    },
    storage: {
      rawSnapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    },
  };
}

if (!fs.existsSync(SNAPSHOT_LATEST)) {
  const report = { status: 'DRY_RUN_BLOCKED_NO_SNAPSHOT', ok: false, productionChanged: false, firestoreWrites: 0, postgresWrites: 0 };
  fs.writeFileSync(path.join(OUT_DIR, 'dry-run-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

if (!fs.existsSync(CONFLICTS_REPORT)) {
  const report = { status: 'DRY_RUN_BLOCKED_NO_CONFLICT_ANALYSIS', ok: false, productionChanged: false, firestoreWrites: 0, postgresWrites: 0 };
  fs.writeFileSync(path.join(OUT_DIR, 'dry-run-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const snapshotMeta = readJson(SNAPSHOT_LATEST);
const conflicts = readJson(CONFLICTS_REPORT);
if (conflicts.status !== 'CONFLICT_ANALYSIS_PASSED') {
  const report = {
    status: 'DRY_RUN_BLOCKED_CONFLICTS',
    ok: false,
    conflictStatus: conflicts.status,
    p0Conflicts: conflicts.p0Conflicts ?? null,
    productionChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'dry-run-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const snapshot = readJson(snapshotMeta.rawSnapshotPath);
const plan = dryRunPlan(snapshot);
const report = {
  ok: missing.length === 0,
  status: missing.length === 0 ? 'DRY_RUN_PASSED' : 'DRY_RUN_FAILED',
  mode: 'snapshot_read_only_account_dry_run',
  generatedAt: new Date().toISOString(),
  snapshotSha256: snapshotMeta.sha256,
  accountCount: snapshotMeta.accountCount,
  accountBootstrapEndpoint: fs.existsSync('server/src/routes/account.js'),
  frontendCanaryClient: fs.existsSync('src/accountApi.js'),
  ...plan,
  importStarted: false,
  verifyStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
  productionChanged: false,
  firestoreWrites: 0,
  postgresWrites: 0,
  missing,
};

fs.writeFileSync(path.join(OUT_DIR, 'dry-run-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'dry-run-summary.md'), [
  '# Account Core Dry Run',
  '',
  `Status: ${report.status}`,
  `Snapshot SHA256: ${report.snapshotSha256}`,
  `Account count: ${report.accountCount}`,
  `Expected inserts: ${report.expectedInserts}`,
  `Expected updates: ${report.expectedUpdates}`,
  `Expected unchanged: ${report.expectedUnchanged}`,
  `Expected skips: ${report.expectedSkips}`,
  `Legacy merges: ${report.transformations.legacyMerges}`,
  '',
  '## Guardrails',
  '',
  '- Firestore writes: 0',
  '- PostgreSQL writes: 0',
  '- Import: NOT RUN',
  '- Verify: NOT RUN',
  '- Canary: NOT RUN',
  '- Cutover: NOT RUN',
  '',
].join('\n'));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
