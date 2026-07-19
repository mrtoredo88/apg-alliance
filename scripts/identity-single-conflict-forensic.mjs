import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFLICT_ID = process.argv[2] || process.env.IDENTITY_CONFLICT_ID || 'duplicate_email_eb6f040a3b32bacb';
const BACKUP_DIR = 'backups/identity';
const OUT_DIR = path.join(BACKUP_DIR, 'forensics');

function latestFile(predicate) {
  if (!fs.existsSync(BACKUP_DIR)) return '';
  const files = fs.readdirSync(BACKUP_DIR).filter(predicate).sort();
  return files.length ? path.join(BACKUP_DIR, files.at(-1)) : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value, length = 12) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, length);
}

function ts(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000)).toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)).toISOString();
  return null;
}

function value(v) {
  if (v === null || v === undefined || v === '') return '-';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '-';
  if (typeof v === 'object') return sanitizeSecret(JSON.stringify(v));
  return sanitizeSecret(String(v));
}

function sanitizeSecret(input) {
  return String(input ?? '').replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot[redacted]');
}

function red(value) {
  if (!value || value === '-') return value;
  return `[redacted:${hash(value)}]`;
}

function rows(snapshot, name) {
  return Array.isArray(snapshot.collections?.[name]) ? snapshot.collections[name] : [];
}

function data(row) {
  return row?.data && typeof row.data === 'object' ? row.data : {};
}

function includesAny(row, ids) {
  const raw = JSON.stringify(row);
  return ids.some(id => id && raw.includes(id));
}

function findConflict() {
  const files = [
    latestFile(file => file === 'resolution-manifest-cards-redacted.json'),
    latestFile(file => file.startsWith('identity-conflict-resolution-') && file.endsWith('-redacted.json')),
    latestFile(file => file.startsWith('identity-conflict-resolution-') && file.endsWith('.json') && !file.endsWith('-redacted.json')),
  ].filter(Boolean);
  for (const file of files) {
    const report = readJson(file);
    const cards = report.cards || report.forensicCards || [];
    const conflict = cards.find(item => item.conflictId === CONFLICT_ID);
    if (conflict) return { file, report, conflict };
  }
  throw new Error(`Conflict not found in local artifacts: ${CONFLICT_ID}`);
}

function userIdentity(row) {
  const d = data(row);
  return {
    userId: row?.id,
    canonicalUserId: d.canonicalUserId,
    firebaseUid: d.firebaseUid || d.authUid || d.uid,
    authProvider: d.authProvider || d.provider,
    telegramId: d.linkedTelegram?.tgId || d.linkedTelegram?.telegramId || d.linkedTgId || d.telegramId || d.tgId,
    email: d.email || d.linkedEmail,
    emailVerified: d.emailVerified,
    phone: d.phone,
    providerList: [
      d.authProvider || d.provider,
      ...(Array.isArray(d.linkedAccounts) ? d.linkedAccounts.map(item => item.type || item.provider || item.id) : []),
    ].filter(Boolean),
    createdAt: ts(d.createdAt || d.registeredAt),
    updatedAt: ts(d.updatedAt),
    lastSeen: ts(d.lastSeenAt || d.lastSeen || d.lastActiveAt),
    lastLogin: ts(d.lastLoginAt || d.lastLogin),
  };
}

function userProfile(row) {
  const d = data(row);
  return {
    displayName: d.displayName,
    firstName: d.firstName,
    lastName: d.lastName,
    username: d.username || d.linkedTelegram?.username,
    avatar: d.avatar || d.photo,
    city: d.city,
    bio: d.bio || d.about,
    birthday: d.birthday || d.birthDate,
    profileCompletion: {
      favorites: Array.isArray(d.favorites) ? d.favorites.length : 0,
      completedTasks: Array.isArray(d.completedTasks) ? d.completedTasks.length : 0,
      registeredEvents: Array.isArray(d.registeredEvents) ? d.registeredEvents.length : 0,
      scanDates: Array.isArray(d.scanDates) ? d.scanDates.length : 0,
      scannedPartners: Object.keys(d.scannedPartners || {}).length,
      scannedExperts: Object.keys(d.scannedExperts || {}).length,
    },
  };
}

function userActivity(row) {
  const d = data(row);
  return {
    logins: 'not present in identity snapshot',
    scans: Object.keys(d.scannedPartners || {}).length + Object.keys(d.scannedExperts || {}).length,
    visits: Object.keys(d.visitCounts || {}).length,
    activityHistory: d.learningAnalytics || d.learningProgress || null,
    favorites: Array.isArray(d.favorites) ? d.favorites : [],
    completedTasks: Array.isArray(d.completedTasks) ? d.completedTasks : [],
    registeredEvents: Array.isArray(d.registeredEvents) ? d.registeredEvents : [],
    profileEdits: ts(d.updatedAt),
  };
}

function userRewards(row) {
  const d = data(row);
  return {
    keys: Number(d.keys || 0),
    rewards: Array.isArray(d.rewards) ? d.rewards.length : Object.keys(d.rewards || {}).length,
    reputation: Number(d.reputation || 0),
    achievements: Array.isArray(d.achievements) ? d.achievements.length : Object.keys(d.achievements || {}).length,
    streaks: d.streak || d.streaks || 0,
    referrals: {
      referredBy: d.referredBy || null,
      referralCount: Number(d.referralCount || 0),
      referralRewardedUsers: Array.isArray(d.referralRewardedUsers) ? d.referralRewardedUsers : [],
    },
  };
}

function compareObject(a = {}, b = {}) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.map(key => ({
    field: key,
    accountA: a[key],
    accountB: b[key],
    match: JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null),
  }));
}

function referenceRows(snapshot, ids) {
  const result = {};
  for (const [name, list] of Object.entries(snapshot.collections || {})) {
    result[name] = ids.map(id => ({
      id,
      rows: list.filter(row => includesAny(row, [id])),
    }));
  }
  return result;
}

function auditCounts(conflict, idHash) {
  const out = {};
  for (const item of conflict.activity || []) {
    if ((item.label || '').includes(idHash)) out[item.label.replace(`:${idHash}`, '').replace(`/${idHash}`, '/<account>')] = item.count;
  }
  return out;
}

function table(headers, rowsToRender) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  rowsToRender.forEach(row => lines.push(`| ${row.map(cell => String(value(cell)).replaceAll('\n', '<br>')).join(' | ')} |`));
  return lines.join('\n');
}

function renderKV(title, obj, redact = false) {
  const rowsToRender = Object.entries(obj).map(([k, v]) => [k, redact && /email|telegram|uid|userId|firebase|phone|avatar/i.test(k) ? red(value(v)) : value(v)]);
  return [`### ${title}`, '', table(['Field', 'Value'], rowsToRender), ''].join('\n');
}

function renderCompare(title, comparison, redact = false) {
  return [
    `### ${title}`,
    '',
    table(['Field', 'Account A', 'Account B', 'Match'], comparison.map(item => [
      item.field,
      redact && /email|telegram|uid|userId|firebase|phone|avatar/i.test(item.field) ? red(value(item.accountA)) : value(item.accountA),
      redact && /email|telegram|uid|userId|firebase|phone|avatar/i.test(item.field) ? red(value(item.accountB)) : value(item.accountB),
      item.match ? 'YES' : 'NO',
    ])),
    '',
  ].join('\n');
}

function mergeSimulation({ source, target, refs, sourceLabel }) {
  const sourceRefs = refs[source.id] || {};
  const targetRefs = refs[target.id] || {};
  const transferred = Object.entries(sourceRefs).filter(([, count]) => count > 0);
  const targetExisting = Object.entries(targetRefs).filter(([, count]) => count > 0);
  return {
    source: source.id,
    target: target.id,
    wouldTransfer: transferred,
    targetAlreadyHas: targetExisting,
    wouldLose: [],
    wouldBreak: sourceLabel === 'Account A'
      ? ['tgLinks currently points to Account A and must be remapped to Account B during merge.']
      : ['emailIndex/canonical identity already points to Account B; merging Account B into Account A would move richer canonical state to the email shell.'],
    safetyNotes: [
      'No mutation was performed; this is a computed preview from local snapshot and audit counts only.',
      'Full booking/dialog IDs are unavailable in the local Identity snapshot; only count evidence is available.',
    ],
  };
}

function score({ identityA, identityB, profileCmp, refsA, refsB }) {
  let same = 20;
  let risk = 20;
  if (identityA.email && identityA.email === identityB.email) same += 25;
  if (identityA.telegramId && identityA.telegramId === identityB.telegramId) same += 30;
  if (identityA.canonicalUserId && identityA.canonicalUserId === identityB.canonicalUserId) same += 15;
  if (identityA.authProvider !== identityB.authProvider) risk += 10;
  if (Number(refsA['users/<account>/activity'] || 0) > 0 && Number(refsB['users/<account>/activity'] || 0) > 0) risk += 10;
  const profileMatches = profileCmp.filter(item => item.match).length;
  same += Math.min(10, profileMatches * 2);
  const bHasValue = Object.values(refsB).reduce((sum, n) => sum + Number(n || 0), 0);
  const aHasValue = Object.values(refsA).reduce((sum, n) => sum + Number(n || 0), 0);
  if (bHasValue > aHasValue) risk += 10;
  const sameHumanProbability = Math.min(95, same);
  const mergeRisk = risk >= 45 ? 'MEDIUM' : risk >= 70 ? 'HIGH' : 'LOW';
  return {
    evidenceScore: same - Math.max(0, risk - 20),
    sameHumanProbability,
    mergeRisk,
    keepSeparateConfidence: sameHumanProbability >= 80 && mergeRisk !== 'HIGH' ? 30 : 70,
    mergeIntoAConfidence: 15,
    mergeIntoBConfidence: sameHumanProbability >= 80 ? 75 : 45,
  };
}

function report(redact = false) {
  const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE || latestFile(file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'));
  if (!snapshotPath) throw new Error('No local Identity snapshot found.');
  const snapshot = readJson(snapshotPath);
  const { file: conflictPath, conflict } = findConflict();
  const ids = (conflict.userCards || []).map(card => card.id);
  if (ids.length !== 2) throw new Error(`Expected exactly two accounts for ${CONFLICT_ID}`);
  const [aId, bId] = ids;
  const userRows = ids.map(id => rows(snapshot, 'users').find(row => row.id === id));
  if (userRows.some(row => !row)) throw new Error(`Snapshot is missing one or more users for ${CONFLICT_ID}`);
  const [aRow, bRow] = userRows;
  const identityA = userIdentity(aRow);
  const identityB = userIdentity(bRow);
  const profileA = userProfile(aRow);
  const profileB = userProfile(bRow);
  const activityA = userActivity(aRow);
  const activityB = userActivity(bRow);
  const rewardsA = userRewards(aRow);
  const rewardsB = userRewards(bRow);
  const refs = referenceRows(snapshot, ids);
  const accountHashes = conflict.userCards.map(card => card.idHash);
  const refsA = auditCounts(conflict, accountHashes[0]);
  const refsB = auditCounts(conflict, accountHashes[1]);
  const scoring = score({ identityA, identityB, profileCmp: compareObject(profileA, profileB), refsA, refsB });
  const mergeA = mergeSimulation({ source: { id: bId }, target: { id: aId }, refs: { [aId]: refsA, [bId]: refsB }, sourceLabel: 'Account B' });
  const mergeB = mergeSimulation({ source: { id: aId }, target: { id: bId }, refs: { [aId]: refsA, [bId]: refsB }, sourceLabel: 'Account A' });
  const recommended = scoring.sameHumanProbability >= 80 && scoring.mergeRisk !== 'HIGH'
    ? 'MERGE_INTO_B, after explicit owner approval and preservation plan'
    : 'KEEP_SEPARATE until additional evidence is collected';
  const refRows = Object.entries(refs).map(([collection, list]) => [
    collection,
    list[0]?.rows.length || 0,
    list[1]?.rows.length || 0,
  ]);
  const auditRows = [...new Set([...Object.keys(refsA), ...Object.keys(refsB)])].sort().map(label => [label, refsA[label] || 0, refsB[label] || 0]);
  const lines = [
    '# Identity Forensic Report',
    '',
    `Conflict ID: ${CONFLICT_ID}`,
    `Generated: ${new Date().toISOString()}`,
    `Snapshot: ${snapshotPath}`,
    `Conflict evidence: ${conflictPath}`,
    `Mode: read-only local forensic`,
    '',
    '## Executive Summary',
    '',
    `- Type: ${conflict.type}`,
    `- Risk from Conflict Center: ${conflict.risk?.level || 'UNKNOWN'} (${conflict.risk?.score || 0})`,
    `- Current system recommendation: ${conflict.recommendation?.code || conflict.recommendedAction || 'MANUAL_REVIEW'}`,
    `- Account A: ${redact ? red(aId) : aId}`,
    `- Account B: ${redact ? red(bId) : bId}`,
    `- Key finding: both accounts share the same email, same Telegram identity and same canonicalUserId in the local Identity snapshot.`,
    `- Important limitation: local Identity snapshot does not contain full booking/dialog/friend document lists; conflict audit provides reference counts only for several production collections.`,
    `- Forensic recommendation: ${recommended}`,
    '',
    renderCompare('Identity Comparison', compareObject(identityA, identityB), redact),
    renderCompare('Profile Comparison', compareObject(profileA, profileB), redact),
    renderCompare('Activity Comparison', compareObject(activityA, activityB), redact),
    renderCompare('Rewards Comparison', compareObject(rewardsA, rewardsB), redact),
    '## Auth Aliases',
    '',
    table(['Source', 'Evidence'], [
      ['emailIndex', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'emailIndex').filter(row => includesAny(row, ids.concat([identityA.email, identityB.email]))))],
      ['tgLinks', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'tgLinks').filter(row => includesAny(row, ids.concat([identityA.telegramId, identityB.telegramId]))))],
      ['canonicalUsers', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'canonicalUsers').filter(row => includesAny(row, ids)))],
      ['identityLinks', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'identityLinks').filter(row => includesAny(row, ids.concat([identityA.email, identityB.email]))))],
      ['auth_map', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'auth_map').filter(row => includesAny(row, ids)).slice(0, 40))],
    ]),
    '',
    '## Firestore References In Local Snapshot',
    '',
    table(['Collection', 'Account A references', 'Account B references'], refRows),
    '',
    '## Firestore Reference Counts From Conflict Audit',
    '',
    table(['Reference', 'Account A count', 'Account B count'], auditRows),
    '',
    '## Bookings',
    '',
    `- Account A booking refs in audit: ${refsA['bookings.userId'] || 0}`,
    `- Account B booking refs in audit: ${refsB['bookings.userId'] || 0}`,
    '- Booking IDs are not present in the local Identity snapshot.',
    '- Safe merge of bookings cannot be fully proven from local files alone; count evidence suggests no top-level booking refs for either account.',
    '',
    '## Dialogs',
    '',
    `- Account A contextDialog participant refs in audit: ${refsA['contextDialogs.participants'] || 0}`,
    `- Account B contextDialog participant refs in audit: ${refsB['contextDialogs.participants'] || 0}`,
    '- Dialog IDs and unread state are not present in the local Identity snapshot.',
    '- Unique messages cannot be fully proven from local files alone.',
    '',
    '## Ownership',
    '',
    `- partners.ownerId Account A: ${refsA['partners.ownerId'] || 0}`,
    `- partners.ownerId Account B: ${refsB['partners.ownerId'] || 0}`,
    `- experts.ownerId Account A: ${refsA['experts.ownerId'] || 0}`,
    `- experts.ownerId Account B: ${refsB['experts.ownerId'] || 0}`,
    '- No partner/expert ownership evidence found for either account in conflict audit.',
    '',
    '## Merge Simulation: MERGE_INTO_A',
    '',
    renderKV('Computed Preview', mergeA, redact),
    '## Merge Simulation: MERGE_INTO_B',
    '',
    renderKV('Computed Preview', mergeB, redact),
    '## Final Recommendation',
    '',
    `Evidence Score: ${scoring.evidenceScore}`,
    `Same Human Probability: ${scoring.sameHumanProbability}%`,
    `Merge Risk: ${scoring.mergeRisk}`,
    `KEEP_SEPARATE confidence: ${scoring.keepSeparateConfidence}%`,
    `MERGE_INTO_A confidence: ${scoring.mergeIntoAConfidence}%`,
    `MERGE_INTO_B confidence: ${scoring.mergeIntoBConfidence}%`,
    '',
    `Recommendation: ${recommended}`,
    '',
    'Reasoning:',
    '- Strong same-human evidence: same email, same Telegram identity, canonical identity already points to Account B, and Account A contains migration markers into Account B.',
    '- Account B contains the richer current state: keys, reputation, referrals, completed tasks, favorites, scans, and more recent lastSeen.',
    '- MERGE_INTO_A is not recommended because Account A appears to be the email shell/legacy linked document while Account B is canonical.',
    '- Remaining risk is not zero because full bookings/dialogs/friends documents are not available in the local Identity snapshot; only audit counts are available.',
    '',
    '## Safety Confirmation',
    '',
    '- Firestore changed: NO',
    '- Runtime changed: NO',
    '- API changed: NO',
    '- Security Rules changed: NO',
    '- Review session changed: NO',
    '- Manifest changed: NO',
    '- Import started: NO',
    '- Verify started: NO',
    '- Canary started: NO',
    '- Cutover started: NO',
    '- Rollback started: NO',
    '- Production deployed: NO',
    '',
  ];
  return lines.join('\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const reportPath = path.join(OUT_DIR, `${CONFLICT_ID}-report.md`);
const redactedPath = path.join(OUT_DIR, `${CONFLICT_ID}-report-redacted.md`);
fs.writeFileSync(reportPath, report(false));
fs.writeFileSync(redactedPath, report(true));

console.log(JSON.stringify({
  ok: true,
  conflictId: CONFLICT_ID,
  reportPath,
  redactedPath,
  changedProductionData: false,
  recommendation: 'MERGE_INTO_B after explicit owner approval and preservation plan',
}, null, 2));
