import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const BACKUP_DIR = 'backups/identity';
const SNAPSHOT_FILE = process.env.IDENTITY_SNAPSHOT_FILE || latestSnapshotFile();
const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json', 'utf8'));

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

function latestSnapshotFile() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'))
    .sort();
  if (!files.length) throw new Error('No Identity snapshot backup found.');
  return path.join(BACKUP_DIR, files.at(-1));
}

function hash(value, length = 16) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, length);
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function ts(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000)).toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)).toISOString();
  return null;
}

function userEmail(user = {}) {
  return normalizeEmail(user.email || user.linkedEmail);
}

function telegramId(user = {}) {
  return safeString(user.linkedTelegram?.tgId || user.linkedTelegram?.telegramId || user.linkedTgId || user.telegramId || user.tgId, 120);
}

function firebaseUid(user = {}) {
  return safeString(user.firebaseUid || user.authUid || user.uid, 260);
}

function completeness(user = {}) {
  const fields = [
    'name', 'displayName', 'firstName', 'lastName', 'photo', 'email', 'linkedEmail',
    'phone', 'city', 'role', 'authProvider', 'createdAt', 'registeredAt',
  ];
  const filled = fields.filter(field => {
    const value = user[field];
    return Array.isArray(value) ? value.length : Boolean(value);
  }).length;
  const arrays = ['favorites', 'completedTasks', 'registeredEvents', 'scanDates'].reduce((sum, field) => sum + (Array.isArray(user[field]) ? user[field].length : 0), 0);
  const objects = ['scannedPartners', 'scannedExperts', 'visitCounts'].reduce((sum, field) => sum + Object.keys(user[field] || {}).length, 0);
  return {
    filledFields: filled,
    profileScore: filled + arrays + objects,
    favorites: Array.isArray(user.favorites) ? user.favorites.length : 0,
    completedTasks: Array.isArray(user.completedTasks) ? user.completedTasks.length : 0,
    registeredEvents: Array.isArray(user.registeredEvents) ? user.registeredEvents.length : 0,
    scanDates: Array.isArray(user.scanDates) ? user.scanDates.length : 0,
    scannedPartners: Object.keys(user.scannedPartners || {}).length,
    scannedExperts: Object.keys(user.scannedExperts || {}).length,
  };
}

function userSummary(row) {
  const user = row.data || {};
  return {
    id: row.id,
    idHash: hash(row.id, 12),
    firestoreUserIdHash: hash(row.id, 12),
    firebaseUidHash: firebaseUid(user) ? hash(firebaseUid(user), 12) : null,
    canonicalUserIdHash: safeString(user.canonicalUserId || row.id) ? hash(user.canonicalUserId || row.id, 12) : null,
    role: safeString(user.role || user.userRole || 'user', 80) || 'user',
    roles: Array.isArray(user.roles) ? user.roles.map(item => safeString(item, 80)).filter(Boolean) : [safeString(user.role || 'user', 80) || 'user'],
    authProvider: safeString(user.authProvider || user.provider || '', 80),
    createdAt: ts(user.createdAt || user.registeredAt),
    updatedAt: ts(user.updatedAt),
    lastSeen: ts(user.lastSeenAt || user.lastSeen || user.lastLoginAt || user.lastActiveAt),
    emailVerified: Boolean(user.emailVerified),
    hasFirebaseUid: Boolean(firebaseUid(user)),
    hasTelegram: Boolean(telegramId(user)),
    telegramHash: telegramId(user) ? hash(telegramId(user), 12) : null,
    keys: Number(user.keys || 0),
    reputation: Number(user.reputation || 0),
    referralCount: Number(user.referralCount || 0),
    referredByHash: user.referredBy ? hash(user.referredBy, 12) : null,
    referralRewardedUsers: Array.isArray(user.referralRewardedUsers) ? user.referralRewardedUsers.length : 0,
    achievements: Array.isArray(user.achievements) ? user.achievements.length : Object.keys(user.achievements || {}).length,
    completeness: completeness(user),
    disabledOrDeleted: false,
  };
}

function rowsFor(snapshot, name) {
  return snapshot.collections?.[name] || [];
}

function findLinkedRows(rows, ids, extraPredicates = []) {
  const idSet = new Set(ids.filter(Boolean));
  return rows.filter(row => {
    const data = row.data || {};
    const values = [
      row.id,
      data.userId,
      data.canonicalUserId,
      data.vkId,
      data.firebaseUid,
      data.authUid,
      ...(Array.isArray(data.linkedUserDocIds) ? data.linkedUserDocIds : []),
    ].map(value => safeString(value, 260)).filter(Boolean);
    return values.some(value => idSet.has(value)) || extraPredicates.some(fn => fn(row));
  });
}

async function countQuery(label, queryFactory) {
  try {
    const snap = await queryFactory().get();
    return { label, ok: true, count: snap.size };
  } catch (error) {
    return { label, ok: false, error: String(error?.code || error?.message || error).slice(0, 160) };
  }
}

async function userActivityEvidence(userIds) {
  const evidence = [];
  for (const userId of userIds) {
    evidence.push(await countQuery(`users/${hash(userId, 12)}/bookings`, () => db.collection('users').doc(userId).collection('bookings').limit(20)));
    evidence.push(await countQuery(`users/${hash(userId, 12)}/activity`, () => db.collection('users').doc(userId).collection('activity').limit(20)));
    evidence.push(await countQuery(`users/${hash(userId, 12)}/claims`, () => db.collection('users').doc(userId).collection('claims').limit(20)));
    evidence.push(await countQuery(`bookings.userId:${hash(userId, 12)}`, () => db.collection('bookings').where('userId', '==', userId).limit(20)));
    evidence.push(await countQuery(`bookings.ownerUserIds:${hash(userId, 12)}`, () => db.collection('bookings').where('ownerUserIds', 'array-contains', userId).limit(20)));
    evidence.push(await countQuery(`partners.ownerId:${hash(userId, 12)}`, () => db.collection('partners').where('ownerId', '==', userId).limit(20)));
    evidence.push(await countQuery(`experts.ownerId:${hash(userId, 12)}`, () => db.collection('experts').where('ownerId', '==', userId).limit(20)));
    evidence.push(await countQuery(`scans.userId:${hash(userId, 12)}`, () => db.collection('scans').where('userId', '==', userId).limit(20)));
    evidence.push(await countQuery(`raffleEntries.userId:${hash(userId, 12)}`, () => db.collection('raffleEntries').where('userId', '==', userId).limit(20)));
    evidence.push(await countQuery(`prizeClaims.userId:${hash(userId, 12)}`, () => db.collection('prizeClaims').where('userId', '==', userId).limit(20)));
    evidence.push(await countQuery(`notifications.userId:${hash(userId, 12)}`, () => db.collection('notifications').where('userId', '==', userId).limit(20)));
    evidence.push(await countQuery(`contextDialogs.participants:${hash(userId, 12)}`, () => db.collection('contextDialogs').where('participants', 'array-contains', userId).limit(20)));
  }
  return evidence;
}

async function authEvidence(users, email = '') {
  const checks = [];
  const uids = users.map(row => firebaseUid(row.data || {})).filter(Boolean);
  for (const uid of uids) {
    try {
      const record = await auth.getUser(uid);
      checks.push({ type: 'firebaseUid', uidHash: hash(uid, 12), exists: true, disabled: Boolean(record.disabled), emailVerified: Boolean(record.emailVerified), creationTime: record.metadata?.creationTime || null, lastSignInTime: record.metadata?.lastSignInTime || null });
    } catch {
      checks.push({ type: 'firebaseUid', uidHash: hash(uid, 12), exists: false });
    }
  }
  if (email) {
    try {
      const record = await auth.getUserByEmail(email);
      checks.push({ type: 'email', emailHash: hash(email, 16), exists: true, uidHash: hash(record.uid, 12), disabled: Boolean(record.disabled), emailVerified: Boolean(record.emailVerified), creationTime: record.metadata?.creationTime || null, lastSignInTime: record.metadata?.lastSignInTime || null });
    } catch {
      checks.push({ type: 'email', emailHash: hash(email, 16), exists: false });
    }
  }
  return checks;
}

function classifyDuplicate(userCards) {
  const roles = new Set(userCards.map(card => card.role));
  const telegrams = new Set(userCards.map(card => card.telegramHash).filter(Boolean));
  const activeCards = userCards.filter(card => {
    const c = card.completeness || {};
    return card.keys > 0 || card.referralCount > 0 || c.profileScore > 4 || c.completedTasks > 0 || c.registeredEvents > 0 || c.scannedPartners > 0 || c.scannedExperts > 0;
  });
  if (roles.size > 1 || telegrams.size > 1 || activeCards.length > 1) {
    return {
      classification: 'E_INSUFFICIENT_DATA',
      action: 'MANUAL_REVIEW',
      confidence: 'low',
      evidence: ['Duplicate email group has independent role/telegram/activity signals; automatic merge is forbidden by preservation rules.'],
    };
  }
  return {
    classification: 'E_INSUFFICIENT_DATA',
    action: 'MANUAL_REVIEW',
    confidence: 'low',
    evidence: ['No deterministic canonical/provider-alias chain proves safe merge.'],
  };
}

function classifyOrphan(orphan, snapshot) {
  const target = safeString(orphan.data?.userId || orphan.data?.canonicalUserId, 260);
  const users = rowsFor(snapshot, 'users');
  const targetExists = users.some(row => row.id === target);
  const sameTelegramProfiles = users.filter(row => telegramId(row.data || {}) && telegramId(row.data || {}) === orphan.id);
  if (!targetExists && sameTelegramProfiles.length === 1) {
    return {
      classification: 'B_USER_EXISTS_UNDER_LEGACY_ID',
      action: 'MANUAL_REVIEW',
      confidence: 'medium',
      evidence: ['A profile with the same Telegram ID exists, but the orphan target does not; admin must approve remap.'],
    };
  }
  if (!targetExists) {
    return {
      classification: 'E_INSUFFICIENT_DATA',
      action: 'MANUAL_REVIEW',
      confidence: 'low',
      evidence: ['Target user does not exist and no deterministic canonical/legacy chain proves a remap.'],
    };
  }
  return {
    classification: 'E_INSUFFICIENT_DATA',
    action: 'MANUAL_REVIEW',
    confidence: 'low',
    evidence: ['Orphan classification requires human review before import mapping can change.'],
  };
}

async function run() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  const users = rowsFor(snapshot, 'users');
  const authMap = rowsFor(snapshot, 'auth_map');
  const identityLinks = rowsFor(snapshot, 'identityLinks');
  const tgLinks = rowsFor(snapshot, 'tgLinks');
  const emailIndex = rowsFor(snapshot, 'emailIndex');
  const usersByEmail = new Map();

  for (const row of users) {
    const email = userEmail(row.data || {});
    if (!email) continue;
    if (!usersByEmail.has(email)) usersByEmail.set(email, []);
    usersByEmail.get(email).push(row);
  }

  const conflicts = [];
  const forensicCards = [];

  for (const [email, rows] of [...usersByEmail.entries()].filter(([, group]) => group.length > 1)) {
    const sourceIds = rows.map(row => row.id);
    const cards = rows.map(userSummary);
    const linkedAuthMap = findLinkedRows(authMap, sourceIds, [
      row => sourceIds.some(id => firebaseUid(rows.find(user => user.id === id)?.data || {}) && row.id === firebaseUid(rows.find(user => user.id === id)?.data || {})),
    ]);
    const linkedIdentityLinks = findLinkedRows(identityLinks, sourceIds, [
      row => String(row.id || '').includes(hash(email, 4)) && false,
      row => normalizeEmail(row.data?.value || row.data?.providerUserId) === email,
    ]);
    const linkedTg = findLinkedRows(tgLinks, sourceIds);
    const linkedEmailIndex = (emailIndex || []).filter(row => normalizeEmail(row.id) === email || sourceIds.includes(safeString(row.data?.userId || row.data?.canonicalUserId, 260)));
    const activity = await userActivityEvidence(sourceIds);
    const authChecks = await authEvidence(rows, email);
    const decision = classifyDuplicate(cards);
    const conflictId = `duplicate_email_${hash(email, 16)}`;
    conflicts.push({
      conflictId,
      type: 'DUPLICATE_EMAIL',
      classification: decision.classification,
      action: decision.action,
      sourceIds,
      sourceIdHashes: sourceIds.map(id => hash(id, 12)),
      targetCanonicalId: null,
      evidence: decision.evidence,
      confidence: decision.confidence,
      approved: false,
    });
    forensicCards.push({
      conflictId,
      type: 'DUPLICATE_EMAIL',
      emailHash: hash(email, 16),
      userCards: cards,
      authMapAliases: linkedAuthMap.map(row => ({ idHash: hash(row.id, 12), userIdHash: hash(row.data?.userId || '', 12), canonicalUserIdHash: hash(row.data?.canonicalUserId || '', 12), vkIdHash: row.data?.vkId ? hash(row.data.vkId, 12) : null })),
      identityLinks: linkedIdentityLinks.map(row => ({ idHash: hash(row.id, 12), type: safeString(row.data?.type || row.data?.provider || '', 80), userIdHash: hash(row.data?.userId || '', 12), canonicalUserIdHash: hash(row.data?.canonicalUserId || '', 12), linkedUserDocIdHashes: (row.data?.linkedUserDocIds || []).map(id => hash(id, 12)) })),
      tgLinks: linkedTg.map(row => ({ idHash: hash(row.id, 12), userIdHash: hash(row.data?.userId || '', 12), canonicalUserIdHash: hash(row.data?.canonicalUserId || '', 12), usernameHash: row.data?.username ? hash(row.data.username, 12) : null })),
      emailIndex: linkedEmailIndex.map(row => ({ idHash: hash(row.id, 16), userIdHash: hash(row.data?.userId || '', 12), canonicalUserIdHash: hash(row.data?.canonicalUserId || '', 12), linkedUserDocIdHashes: (row.data?.linkedUserDocIds || []).map(id => hash(id, 12)) })),
      activity,
      firebaseAuth: authChecks,
      classification: decision.classification,
      recommendedAction: decision.action,
      confidence: decision.confidence,
      evidence: decision.evidence,
    });
  }

  const userIds = new Set(users.map(row => row.id));
  const orphanTgLinks = tgLinks.filter(row => {
    const target = safeString(row.data?.userId || row.data?.canonicalUserId, 260);
    return target && !userIds.has(target);
  });

  for (const row of orphanTgLinks) {
    const target = safeString(row.data?.userId || row.data?.canonicalUserId, 260);
    const sameTelegramProfiles = users.filter(user => telegramId(user.data || {}) && telegramId(user.data || {}) === row.id);
    const authAliases = findLinkedRows(authMap, [target, row.id]);
    const identityAliases = findLinkedRows(identityLinks, [target, row.id]);
    const activity = await userActivityEvidence([target]);
    const decision = classifyOrphan(row, snapshot);
    const conflictId = `orphan_tglink_${hash(row.id, 16)}`;
    conflicts.push({
      conflictId,
      type: 'ORPHAN_TGLINK',
      classification: decision.classification,
      action: decision.action,
      sourceIds: [row.id],
      sourceIdHashes: [hash(row.id, 12)],
      targetCanonicalId: null,
      evidence: decision.evidence,
      confidence: decision.confidence,
      approved: false,
    });
    forensicCards.push({
      conflictId,
      type: 'ORPHAN_TGLINK',
      telegramIdHash: hash(row.id, 12),
      usernameHash: row.data?.username ? hash(row.data.username, 12) : null,
      targetUserIdHash: target ? hash(target, 12) : null,
      targetExists: userIds.has(target),
      sameTelegramProfileHashes: sameTelegramProfiles.map(user => hash(user.id, 12)),
      authMapAliases: authAliases.map(alias => ({ idHash: hash(alias.id, 12), userIdHash: hash(alias.data?.userId || '', 12), canonicalUserIdHash: hash(alias.data?.canonicalUserId || '', 12) })),
      identityLinks: identityAliases.map(link => ({ idHash: hash(link.id, 12), type: safeString(link.data?.type || link.data?.provider || '', 80), userIdHash: hash(link.data?.userId || '', 12), canonicalUserIdHash: hash(link.data?.canonicalUserId || '', 12) })),
      firebaseAuth: row.data?.firebaseUid ? await authEvidence([{ id: target, data: { firebaseUid: row.data.firebaseUid } }]) : [],
      activity,
      classification: decision.classification,
      recommendedAction: decision.action,
      confidence: decision.confidence,
      evidence: decision.evidence,
    });
  }

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const manifest = {
    generatedAt,
    sourceSnapshot: SNAPSHOT_FILE,
    mode: 'non_destructive_snapshot_mapping_only',
    approvedBy: null,
    approvedAt: null,
    applyToFirestore: false,
    importAllowed: false,
    conflicts,
  };
  const redacted = {
    generatedAt,
    sourceSnapshot: SNAPSHOT_FILE,
    totals: {
      conflicts: conflicts.length,
      duplicateEmails: conflicts.filter(item => item.type === 'DUPLICATE_EMAIL').length,
      orphanTgLinks: conflicts.filter(item => item.type === 'ORPHAN_TGLINK').length,
      manualReview: conflicts.filter(item => item.action === 'MANUAL_REVIEW').length,
      approved: conflicts.filter(item => item.approved === true).length,
    },
    forensicCards,
    importAllowed: false,
    nextStep: 'Admin must approve deterministic MERGE/REMAP/IGNORE_STALE decisions in Migration Center before normalized dry-run can reach conflicts: 0.',
  };
  const manifestPath = path.join(BACKUP_DIR, `identity-conflict-resolution-${stamp}.json`);
  const reportPath = path.join(BACKUP_DIR, `identity-conflict-resolution-${stamp}-redacted.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(reportPath, JSON.stringify(redacted, null, 2));
  console.log(JSON.stringify({
    ok: false,
    manifestPath,
    reportPath,
    totals: redacted.totals,
    importAllowed: false,
  }, null, 2));
  process.exitCode = conflicts.some(item => item.action === 'MANUAL_REVIEW') ? 1 : 0;
}

run().catch(error => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error).slice(0, 500) }, null, 2));
  process.exit(1);
});
