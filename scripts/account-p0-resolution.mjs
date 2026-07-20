import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SNAPSHOT_LATEST = 'backups/account-core/snapshot/latest-snapshot-redacted.json';
const OUT_DIR = 'backups/account-core/conflicts';
const MANIFEST_PATH = path.join(OUT_DIR, 'resolution-manifest-redacted.json');
const FORENSIC_PATH = path.join(OUT_DIR, 'p0-forensic-redacted.json');
const FORENSIC_SUMMARY_PATH = path.join(OUT_DIR, 'p0-forensic-summary.md');
const DECISION_PATH = path.join(OUT_DIR, 'auto-resolution-redacted.json');
const DECISION_SUMMARY_PATH = path.join(OUT_DIR, 'auto-resolution-summary.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function fullHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function rolesOf(user) {
  const data = user.data || {};
  return [...new Set([
    ...(Array.isArray(data.roles) ? data.roles : []),
    data.role,
    data.userRole,
  ].map(normalized).filter(Boolean))];
}

function ownerIdsFromUser(user) {
  const data = user.data || {};
  return [
    data.ownerPartnerId,
    data.partnerId,
    data.expertId,
    ...(Array.isArray(data.partnerCabinetIds) ? data.partnerCabinetIds : []),
    ...(Array.isArray(data.expertCabinetIds) ? data.expertCabinetIds : []),
  ].map(normalized).filter(Boolean);
}

function completeness(user) {
  const data = user.data || {};
  return Object.values({
    displayName: data.displayName || data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    photo: data.photo,
    city: data.city,
    email: data.email || data.linkedEmail,
    telegram: data.telegramId || data.tgId || data.linkedTelegram,
    firebaseUid: data.firebaseUid || data.authUid,
    lastSeen: data.lastSeen,
    lastLoginAt: data.lastLoginAt,
  }).filter(Boolean).length;
}

function accountEvidence(user, snapshot) {
  const data = user.data || {};
  const roles = rolesOf(user);
  const userId = normalized(user.id);
  const cabinetRefs = [
    ...(snapshot.collections.partners || []),
    ...(snapshot.collections.experts || []),
  ].filter(item => {
    const entity = item.data || {};
    return [
      entity.ownerId,
      entity.ownerUserId,
      entity.userId,
      entity.partnerOwnerId,
      entity.expertOwnerId,
    ].map(normalized).includes(userId);
  });
  const bookingRefs = (snapshot.collectionGroups.bookings || []).filter(item => {
    const booking = item.data || {};
    return normalized(booking.userId || booking.uid || item.path?.split('/')?.[1]) === userId;
  });
  return {
    accountHash: `account_${hash(user.id)}`,
    emailHash: `email_${hash(data.email || data.linkedEmail)}`,
    canonicalUserHash: data.canonicalUserId ? `account_${hash(data.canonicalUserId)}` : '',
    mergedIntoHash: data.mergedInto ? `account_${hash(data.mergedInto)}` : '',
    identityStatus: data.identityStatus || '',
    identityVersion: data.identityVersion || '',
    primaryRole: roles[0] || '',
    roles,
    ownerFlag: roles.includes('owner'),
    superAdminFlag: roles.includes('super_admin'),
    adminFlag: roles.includes('admin') || data.adminStatus === 'active',
    ownerProtected: Boolean(data.ownerProtected),
    firebaseUidPresent: Boolean(data.firebaseUid || data.authUid),
    telegramIdentityPresent: Boolean(data.telegramId || data.tgId || data.linkedTelegram),
    cabinetBindingCount: cabinetRefs.length + ownerIdsFromUser(user).length,
    directBusinessReferenceCount: cabinetRefs.length + bookingRefs.length,
    profileCompleteness: completeness(user),
    createdAtPresent: Boolean(data.createdAt || data.registeredAt),
    updatedAtPresent: Boolean(data.updatedAt),
    lastLoginPresent: Boolean(data.lastLoginAt),
    lastSeenPresent: Boolean(data.lastSeen),
    legacyLinked: data.identityStatus === 'legacy_linked' || Boolean(data.mergedInto),
    canonicalSelf: normalized(data.canonicalUserId) === normalized(user.id) && data.identityStatus === 'canonical',
  };
}

function duplicateEmailGroups(users) {
  const groups = new Map();
  for (const user of users) {
    const email = normalized(user.data?.email || user.data?.linkedEmail);
    if (!email) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(user);
  }
  return [...groups.entries()].filter(([, users]) => users.length > 1).map(([email, users]) => ({ email, users }));
}

function isOwnerAdminP0(group) {
  return group.users.some(user => {
    const data = user.data || {};
    const roles = (Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean)).map(normalized).filter(Boolean);
    return roles.includes('owner') || roles.includes('super_admin') || roles.includes('admin');
  });
}

function scoreCandidate(evidence) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += points;
    reasons.push({ points, reason });
  };
  if (evidence.canonicalSelf) add(1000, 'already_canonical_self');
  if (evidence.ownerFlag) add(800, 'confirmed_owner_role');
  if (evidence.superAdminFlag) add(700, 'confirmed_super_admin_role');
  if (evidence.adminFlag) add(600, 'confirmed_admin_path');
  if (evidence.ownerProtected) add(500, 'owner_protected');
  if (evidence.cabinetBindingCount > 0) add(100 + evidence.cabinetBindingCount, 'cabinet_bindings');
  if (evidence.firebaseUidPresent) add(80, 'firebase_uid_present');
  if (evidence.telegramIdentityPresent) add(30, 'telegram_identity_present');
  if (evidence.legacyLinked) add(-900, 'legacy_linked');
  if (evidence.mergedIntoHash) add(-300, 'already_merged_into_canonical');
  add(evidence.profileCompleteness, 'profile_completeness');
  return { score, reasons };
}

function resolveGroup(group, snapshot, snapshotSha256) {
  const accounts = group.users.map(user => ({
    raw: user,
    evidence: accountEvidence(user, snapshot),
  })).map(item => ({
    ...item,
    decision: scoreCandidate(item.evidence),
  }));
  const sorted = [...accounts].sort((a, b) => b.decision.score - a.decision.score);
  const winner = sorted[0];
  const loser = sorted[1];
  const winnerId = winner.raw.id;
  const loserId = loser.raw.id;
  const loserData = loser.raw.data || {};
  const pointsToWinner = normalized(loserData.canonicalUserId) === normalized(winnerId)
    && normalized(loserData.mergedInto) === normalized(winnerId)
    && loserData.identityStatus === 'legacy_linked';
  const deterministic = Boolean(
    winner
    && loser
    && winner.evidence.canonicalSelf
    && !winner.evidence.legacyLinked
    && loser.evidence.legacyLinked
    && pointsToWinner
    && winner.decision.score > loser.decision.score
  );
  const conflictId = `duplicate_admin_or_owner_email_${hash(group.email)}`;
  return {
    conflictId,
    type: 'duplicate_admin_or_owner_email',
    sourceSnapshotHash: snapshotSha256,
    emailHash: `email_${hash(group.email)}`,
    deterministic,
    status: deterministic ? 'AUTO_RESOLUTION_APPROVED' : 'AUTO_RESOLUTION_BLOCKED',
    canonicalAccountHash: winner ? `account_${hash(winnerId)}` : '',
    legacyAccountHash: loser ? `account_${hash(loserId)}` : '',
    appliedRule: deterministic ? 'canonical_self_owner_admin_with_legacy_linked_duplicate_pointing_to_winner' : 'no_unambiguous_winner',
    accounts: accounts.map(item => ({
      evidence: item.evidence,
      score: item.decision.score,
      scoreReasons: item.decision.reasons,
    })),
    preservation: deterministic ? {
      legacyIdAlias: true,
      providerLinks: true,
      historicalLinks: true,
      rolesUnion: [...new Set([...rolesOf(winner.raw), ...rolesOf(loser.raw)])].sort(),
      permissionsUnion: true,
      cabinetBindingsPreserved: true,
      profileFieldsMergedByCompleteness: true,
      ownerAdminPrivilegesNotDowngraded: true,
      sessionTokensNotMoved: true,
      noFirestoreWrites: true,
      noDeletion: true,
    } : null,
    resolutionId: deterministic ? `account_resolution_${hash(`${snapshotSha256}:${winnerId}:${loserId}`)}` : '',
  };
}

const latest = fs.existsSync(SNAPSHOT_LATEST) ? readJson(SNAPSHOT_LATEST) : null;
if (!latest?.rawSnapshotPath || !fs.existsSync(latest.rawSnapshotPath)) {
  const report = { status: 'AUTO_RESOLUTION_BLOCKED_NO_SNAPSHOT', productionChanged: false, firestoreWrites: 0, postgresWrites: 0 };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(DECISION_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const snapshot = readJson(latest.rawSnapshotPath);
const groups = duplicateEmailGroups(snapshot.collections.users || []).filter(isOwnerAdminP0);
const resolutions = groups.map(group => resolveGroup(group, snapshot, latest.sha256));
const blocked = resolutions.filter(item => !item.deterministic);
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: blocked.length ? 'AUTO_RESOLUTION_BLOCKED' : 'AUTO_RESOLUTION_PASSED',
  sourceSnapshotHash: latest.sha256,
  p0ConflictCount: groups.length,
  approvedCount: resolutions.filter(item => item.deterministic).length,
  blockedCount: blocked.length,
  resolutions,
  productionChanged: false,
  firestoreWrites: 0,
  postgresWrites: 0,
  importStarted: false,
  verifyStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
};

const manifest = {
  version: 1,
  generatedAt: report.generatedAt,
  sourceSnapshotHash: latest.sha256,
  resolutionMode: 'automatic_deterministic',
  ownerAuthorization: 'granted_in_task',
  actions: resolutions.filter(item => item.deterministic).map(item => ({
    type: 'mergeLegacyIntoCanonical',
    conflictId: item.conflictId,
    resolutionId: item.resolutionId,
    selectedCanonicalAccountHash: item.canonicalAccountHash,
    legacyAccountHash: item.legacyAccountHash,
    appliedRule: item.appliedRule,
    evidenceHash: fullHash(JSON.stringify(item.accounts)),
    preservedAliases: true,
    preservedRoles: item.preservation.rolesUnion,
    preservedCabinets: true,
    sourceSnapshotHash: latest.sha256,
  })),
  blocked: blocked.map(item => ({ conflictId: item.conflictId, reason: item.appliedRule })),
  redacted: true,
  productionChanged: false,
  firestoreWrites: 0,
  postgresWrites: 0,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(FORENSIC_PATH, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(DECISION_PATH, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(FORENSIC_SUMMARY_PATH, [
  '# Account Core P0 Forensic',
  '',
  `Status: ${report.status}`,
  `Snapshot SHA256: ${report.sourceSnapshotHash}`,
  `P0 conflicts: ${report.p0ConflictCount}`,
  `Approved: ${report.approvedCount}`,
  `Blocked: ${report.blockedCount}`,
  '',
  '## Rules',
  '',
  '- Winner must already be canonical self.',
  '- Legacy duplicate must already point to winner through canonicalUserId and mergedInto.',
  '- Owner/admin privileges must be preserved.',
  '- No Firestore writes, deletions or remaps are performed.',
  '',
].join('\n'));
fs.writeFileSync(DECISION_SUMMARY_PATH, [
  '# Account Core Automatic P0 Resolution',
  '',
  `Status: ${report.status}`,
  `Approved deterministic actions: ${manifest.actions.length}`,
  `Blocked actions: ${manifest.blocked.length}`,
  '',
  'Import remains locked until conflict recheck and dry run pass.',
  '',
].join('\n'));
console.log(JSON.stringify({
  status: report.status,
  p0ConflictCount: report.p0ConflictCount,
  approvedCount: report.approvedCount,
  blockedCount: report.blockedCount,
  manifest: MANIFEST_PATH,
  productionChanged: false,
  firestoreWrites: 0,
  postgresWrites: 0,
}, null, 2));
if (report.status !== 'AUTO_RESOLUTION_PASSED') process.exit(1);
