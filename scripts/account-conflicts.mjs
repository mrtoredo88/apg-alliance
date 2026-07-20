import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const OUT_DIR = 'backups/account-core/conflicts';
const SNAPSHOT_DIR = 'backups/account-core/snapshot';
fs.mkdirSync(OUT_DIR, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function latestSnapshot() {
  const latest = path.join(SNAPSHOT_DIR, 'latest-snapshot-redacted.json');
  if (!fs.existsSync(latest)) return null;
  const meta = readJson(latest);
  if (!meta.rawSnapshotPath || !fs.existsSync(meta.rawSnapshotPath)) return null;
  return { meta, snapshot: readJson(meta.rawSnapshotPath) };
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function stableHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function redactValue(value, prefix = 'value') {
  if (!value) return '';
  return `${prefix}_${stableHash(value)}`;
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = normalized(getKey(item));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      ids: items.map(item => item.id || item.path),
    }));
}

function roleOf(user) {
  const data = user.data || {};
  const roles = Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean);
  return roles.map(item => normalized(item)).filter(Boolean);
}

function ownerIdsFromEntity(entity) {
  const data = entity.data || {};
  return [
    data.ownerId,
    data.ownerUserId,
    data.userId,
    data.partnerOwnerId,
    data.expertOwnerId,
  ].map(normalized).filter(Boolean);
}

function buildCabinets(snapshot) {
  const partners = snapshot.collections.partners || [];
  const experts = snapshot.collections.experts || [];
  return [
    ...partners.flatMap(item => ownerIdsFromEntity(item).map(userId => ({ id: `partner:${item.id}:${userId}`, type: 'partner', entityId: item.id, userId }))),
    ...experts.flatMap(item => ownerIdsFromEntity(item).map(userId => ({ id: `expert:${item.id}:${userId}`, type: 'expert', entityId: item.id, userId }))),
  ];
}

function analyze(snapshot) {
  const users = snapshot.collections.users || [];
  const tgLinks = snapshot.collections.tgLinks || [];
  const sessions = snapshot.collections.telegramAuthSessions || [];
  const bookings = snapshot.collectionGroups.bookings || [];
  const userIds = new Set(users.map(item => normalized(item.id)));
  const cabinets = buildCabinets(snapshot);
  const duplicateEmails = groupBy(users, item => item.data?.email || item.data?.linkedEmail);
  const duplicateFirebase = groupBy(users, item => item.data?.firebaseUid || item.data?.authUid);
  const duplicateTelegramIds = groupBy(users, item => item.data?.telegramId || item.data?.tgId);
  const duplicateCabinets = groupBy(cabinets, item => `${item.type}:${item.entityId}`);
  const orphanTgLinks = tgLinks.filter(item => {
    const target = normalized(item.data?.userId || item.data?.uid || item.data?.canonicalUserId);
    return target && !userIds.has(target);
  }).map(item => ({ id: item.id, target: item.data?.userId || item.data?.uid || item.data?.canonicalUserId || '' }));
  const missingBookingUsers = bookings.filter(item => {
    const uid = normalized(item.data?.userId || item.data?.uid || item.path.split('/')[1]);
    return uid && !userIds.has(uid);
  }).map(item => ({ id: item.id, path: item.path }));
  const danglingCabinets = cabinets.filter(item => !userIds.has(normalized(item.userId)));
  const adminUsers = users.filter(item => roleOf(item).some(role => ['owner', 'super_admin', 'admin'].includes(role))).map(item => item.id);
  const ownerUsers = users.filter(item => roleOf(item).includes('owner')).map(item => item.id);
  const sessionConflicts = groupBy(sessions, item => item.data?.userId || item.data?.uid || item.data?.telegramId);

  const p0 = [
    ...duplicateEmails.filter(group => group.ids.some(id => adminUsers.includes(id) || ownerUsers.includes(id))).map(group => ({ type: 'duplicate_admin_or_owner_email', group })),
    ...duplicateFirebase.map(group => ({ type: 'duplicate_firebase_uid', group })),
    ...duplicateTelegramIds.map(group => ({ type: 'duplicate_user_telegram_id', group })),
    ...duplicateCabinets.map(group => ({ type: 'duplicate_cabinet_owner', group })),
    ...danglingCabinets.map(item => ({ type: 'dangling_cabinet_owner', item })),
  ];

  return {
    duplicateUsers: {
      duplicateEmails,
      duplicateFirebase,
      duplicateTelegramIds,
    },
    duplicateRoles: [],
    duplicateCabinets,
    missingProfile: [...orphanTgLinks, ...missingBookingUsers],
    danglingReferences: {
      orphanTgLinks,
      missingBookingUsers,
      danglingCabinets,
    },
    telegramCollisions: [...duplicateTelegramIds, ...groupBy(tgLinks, item => item.id || item.data?.telegramId)],
    sessionConflicts,
    ownerAdminConflicts: {
      adminUsers,
      ownerUsers,
      p0,
    },
    p0,
  };
}

function redactGroup(group) {
  return {
    keyHash: redactValue(group.key, 'key'),
    count: group.count,
    ids: (group.ids || []).map(id => redactValue(id, 'account')),
  };
}

function redactReference(item) {
  return Object.fromEntries(Object.entries(item || {}).map(([key, value]) => [key, redactValue(value, key)]));
}

function redactP0(item) {
  return {
    type: item.type,
    group: item.group ? redactGroup(item.group) : undefined,
    item: item.item ? redactReference(item.item) : undefined,
  };
}

function redactAnalysis(analysis) {
  return {
    duplicateUsers: {
      duplicateEmails: analysis.duplicateUsers.duplicateEmails.map(redactGroup),
      duplicateFirebase: analysis.duplicateUsers.duplicateFirebase.map(redactGroup),
      duplicateTelegramIds: analysis.duplicateUsers.duplicateTelegramIds.map(redactGroup),
    },
    duplicateRoles: analysis.duplicateRoles,
    duplicateCabinets: analysis.duplicateCabinets.map(redactGroup),
    missingProfile: analysis.missingProfile.map(redactReference),
    danglingReferences: {
      orphanTgLinks: analysis.danglingReferences.orphanTgLinks.map(redactReference),
      missingBookingUsers: analysis.danglingReferences.missingBookingUsers.map(redactReference),
      danglingCabinets: analysis.danglingReferences.danglingCabinets.map(redactReference),
    },
    telegramCollisions: analysis.telegramCollisions.map(redactGroup),
    sessionConflicts: analysis.sessionConflicts.map(redactGroup),
    ownerAdminConflicts: {
      adminUsers: analysis.ownerAdminConflicts.adminUsers.map(id => redactValue(id, 'account')),
      ownerUsers: analysis.ownerAdminConflicts.ownerUsers.map(id => redactValue(id, 'account')),
      p0: analysis.ownerAdminConflicts.p0.map(redactP0),
    },
    p0: analysis.p0.map(redactP0),
  };
}

const latest = latestSnapshot();
if (!latest) {
  const report = {
    status: 'CONFLICT_ANALYSIS_BLOCKED_NO_SNAPSHOT',
    productionChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'conflicts-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const analysis = analyze(latest.snapshot);
const conflictCount = Object.values(analysis).reduce((sum, value) => {
  if (Array.isArray(value)) return sum + value.length;
  if (value && typeof value === 'object') {
    return sum + Object.values(value).reduce((inner, item) => inner + (Array.isArray(item) ? item.length : 0), 0);
  }
  return sum;
}, 0);

const report = {
  status: analysis.p0.length ? 'CONFLICT_ANALYSIS_BLOCKED_P0' : 'CONFLICT_ANALYSIS_PASSED',
  generatedAt: new Date().toISOString(),
  snapshotSha256: latest.meta.sha256,
  accountCount: latest.meta.accountCount,
  conflictCount,
  p0Conflicts: analysis.p0.length,
  analysis: redactAnalysis(analysis),
  productionChanged: false,
  firestoreWrites: 0,
  postgresWrites: 0,
  importStarted: false,
  verifyStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
};

fs.writeFileSync(path.join(OUT_DIR, 'conflicts-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'conflicts-summary.md'), [
  '# Account Core Conflict Analysis',
  '',
  `Status: ${report.status}`,
  `Snapshot SHA256: ${report.snapshotSha256}`,
  `Account count: ${report.accountCount}`,
  `Conflict count: ${report.conflictCount}`,
  `P0 conflicts: ${report.p0Conflicts}`,
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
if (analysis.p0.length) process.exit(1);
