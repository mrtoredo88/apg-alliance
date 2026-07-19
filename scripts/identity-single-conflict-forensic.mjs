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

function sanitizeSecret(input) {
  return String(input ?? '').replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot[redacted]');
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
  if (Array.isArray(v)) return v.length ? v.map(value).join(', ') : '-';
  if (typeof v === 'object') return sanitizeSecret(JSON.stringify(v));
  return sanitizeSecret(String(v));
}

function red(v) {
  const s = value(v);
  return !s || s === '-' ? s : `[redacted:${hash(s)}]`;
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

function findConflict(conflictId = CONFLICT_ID) {
  const files = [
    latestFile(file => file === 'resolution-manifest-cards-redacted.json'),
    latestFile(file => file.startsWith('identity-conflict-resolution-') && file.endsWith('-redacted.json')),
    latestFile(file => file.startsWith('identity-conflict-resolution-') && file.endsWith('.json') && !file.endsWith('-redacted.json')),
  ].filter(Boolean);
  for (const file of files) {
    const report = readJson(file);
    const cards = report.cards || report.forensicCards || [];
    const conflict = cards.find(item => item.conflictId === conflictId);
    if (conflict) return { file, report, conflict };
  }
  throw new Error(`Conflict not found in local artifacts: ${conflictId}`);
}

function table(headers, rowsToRender) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  rowsToRender.forEach(row => lines.push(`| ${row.map(cell => value(cell).replaceAll('\n', '<br>')).join(' | ')} |`));
  return lines.join('\n');
}

function safetyBlock() {
  return [
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
  ].join('\n');
}

function renderCompare(title, comparison, redact = false) {
  return [
    `### ${title}`,
    '',
    table(['Field', 'Account A', 'Account B', 'Match'], comparison.map(item => [
      item.field,
      redact && /email|telegram|uid|userId|firebase|phone|avatar/i.test(item.field) ? red(item.accountA) : item.accountA,
      redact && /email|telegram|uid|userId|firebase|phone|avatar/i.test(item.field) ? red(item.accountB) : item.accountB,
      item.match ? 'YES' : 'NO',
    ])),
    '',
  ].join('\n');
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

function referenceRows(snapshot, ids) {
  return Object.fromEntries(Object.entries(snapshot.collections || {}).map(([name, list]) => [
    name,
    ids.map(id => ({ id, rows: list.filter(row => includesAny(row, [id])) })),
  ]));
}

function auditCounts(conflict, idHash) {
  const out = {};
  for (const item of conflict.activity || []) {
    if ((item.label || '').includes(idHash)) out[item.label.replace(`:${idHash}`, '').replace(`/${idHash}`, '/<account>')] = item.count;
  }
  return out;
}

function scoreDuplicate({ identityA, identityB, profileCmp, refsA, refsB, conflict }) {
  let same = 20;
  let risk = 20;
  if (identityA.email && identityA.email === identityB.email) same += 25;
  if (identityA.telegramId && identityA.telegramId === identityB.telegramId) same += 30;
  if (identityA.canonicalUserId && identityA.canonicalUserId === identityB.canonicalUserId) same += 15;
  if (identityA.authProvider !== identityB.authProvider) risk += 10;
  if (Number(refsA['users/<account>/activity'] || 0) > 0 && Number(refsB['users/<account>/activity'] || 0) > 0) risk += 10;
  if (conflict.risk?.level === 'CRITICAL') risk += 30;
  if (conflict.risk?.level === 'HIGH') risk += 15;
  const profileMatches = profileCmp.filter(item => item.match).length;
  same += Math.min(10, profileMatches * 2);
  const sameHumanProbability = Math.min(95, same);
  const mergeRisk = risk >= 70 ? 'HIGH' : risk >= 45 ? 'MEDIUM' : 'LOW';
  return {
    evidenceScore: same - Math.max(0, risk - 20),
    sameHumanProbability,
    mergeRisk,
    keepSeparateConfidence: mergeRisk === 'HIGH' ? 80 : sameHumanProbability >= 80 ? 30 : 70,
    mergeIntoAConfidence: 15,
    mergeIntoBConfidence: mergeRisk === 'HIGH' ? 35 : sameHumanProbability >= 80 ? 75 : 45,
  };
}

function mergeSimulation({ sourceId, targetId, refs, note }) {
  const sourceRefs = refs[sourceId] || {};
  const targetRefs = refs[targetId] || {};
  return {
    source: sourceId,
    target: targetId,
    wouldTransfer: Object.entries(sourceRefs).filter(([, count]) => Number(count || 0) > 0),
    targetAlreadyHas: Object.entries(targetRefs).filter(([, count]) => Number(count || 0) > 0),
    wouldLose: [],
    wouldBreak: [note],
    safetyNotes: [
      'No mutation was performed; this is a computed preview from local snapshot and audit counts only.',
      'Full business document IDs are unavailable in the local Identity snapshot; only count evidence is available.',
    ],
  };
}

function duplicateReport({ snapshot, snapshotPath, conflictPath, conflict, redact = false }) {
  const ids = (conflict.userCards || []).map(card => card.id);
  const userRows = ids.map(id => rows(snapshot, 'users').find(row => row.id === id));
  if (ids.length !== 2 || userRows.some(row => !row)) throw new Error(`Snapshot is missing duplicate users for ${CONFLICT_ID}`);
  const [aId, bId] = ids;
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
  const scoring = scoreDuplicate({ identityA, identityB, profileCmp: compareObject(profileA, profileB), refsA, refsB, conflict });
  const hasRoleOrOwnershipRisk = ['CRITICAL', 'HIGH'].includes(conflict.risk?.level) || (conflict.risk?.reasons || []).some(item => ['different_roles', 'ownership', 'bookings'].includes(item.code));
  const recommended = hasRoleOrOwnershipRisk
    ? 'KEEP_SEPARATE or DEFER until owner confirms canonical login path and preservation plan'
    : scoring.sameHumanProbability >= 80 && scoring.mergeRisk !== 'HIGH'
      ? 'MERGE_INTO_B, after explicit owner approval and preservation plan'
      : 'KEEP_SEPARATE until additional evidence is collected';
  const refRows = Object.entries(refs).map(([collection, list]) => [collection, list[0]?.rows.length || 0, list[1]?.rows.length || 0]);
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
    `- Risk: ${conflict.risk?.level || 'UNKNOWN'} (${conflict.risk?.score || 0})`,
    `- Evidence completeness: PARTIAL: identity documents and audit counts are available; full business document lists are not in the local Identity snapshot.`,
    `- Account A: ${redact ? red(aId) : aId}`,
    `- Account B: ${redact ? red(bId) : bId}`,
    `- Final recommendation: ${recommended}`,
    '',
    renderCompare('Identity Comparison', compareObject(identityA, identityB), redact),
    renderCompare('Profile Comparison', compareObject(profileA, profileB), redact),
    renderCompare('Activity Comparison', compareObject(activityA, activityB), redact),
    renderCompare('Rewards Comparison', compareObject(rewardsA, rewardsB), redact),
    '## Auth Comparison',
    '',
    table(['Source', 'Evidence'], [
      ['emailIndex', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'emailIndex').filter(row => includesAny(row, ids.concat([identityA.email, identityB.email]))))],
      ['tgLinks', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'tgLinks').filter(row => includesAny(row, ids.concat([identityA.telegramId, identityB.telegramId]))))],
      ['canonicalUsers', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'canonicalUsers').filter(row => includesAny(row, ids)))],
      ['identityLinks', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'identityLinks').filter(row => includesAny(row, ids.concat([identityA.email, identityB.email]))))],
      ['auth_map', redact ? '[redacted]' : JSON.stringify(rows(snapshot, 'auth_map').filter(row => includesAny(row, ids)).slice(0, 60))],
    ]),
    '',
    '## Business References',
    '',
    table(['Collection', 'Account A references', 'Account B references'], refRows),
    '',
    '## Reference Counts From Conflict Audit',
    '',
    table(['Reference', 'Account A count', 'Account B count'], auditRows),
    '',
    '## Unique Data',
    '',
    table(['Area', 'Account A', 'Account B'], [
      ['keys', rewardsA.keys, rewardsB.keys],
      ['reputation', rewardsA.reputation, rewardsB.reputation],
      ['referrals', rewardsA.referrals.referralCount, rewardsB.referrals.referralCount],
      ['favorites', activityA.favorites.length, activityB.favorites.length],
      ['completedTasks', activityA.completedTasks.length, activityB.completedTasks.length],
      ['registeredEvents', activityA.registeredEvents.length, activityB.registeredEvents.length],
      ['scans', activityA.scans, activityB.scans],
    ]),
    '',
    '## Decision Options',
    '',
    table(['Decision', 'Forensic view'], [
      ['KEEP_SEPARATE', hasRoleOrOwnershipRisk ? 'Strongly safe default while owner/login-path evidence is incomplete.' : 'Preserves both records but leaves duplicate invariant unresolved.'],
      ['MERGE_INTO_A', 'Not recommended unless owner proves Account A is current login/canonical target.'],
      ['MERGE_INTO_B', hasRoleOrOwnershipRisk ? 'Possible only with explicit owner approval, role preservation and login-path proof.' : 'Best merge target if owner approves; Account B appears more current/canonical.'],
    ]),
    '',
    '## Preservation Requirements',
    '',
    '- roles',
    '- ownership',
    '- bookings',
    '- dialogs',
    '- friends',
    '- keys',
    '- rewards',
    '- notifications',
    '- referrals',
    '- profile fields',
    '- Telegram identity',
    '- auth providers',
    '- owner/admin access checks',
    '- Security Rules assumptions for userId/canonicalUserId',
    '',
    '## Merge Simulation: MERGE_INTO_A',
    '',
    table(['Field', 'Value'], Object.entries(mergeSimulation({ sourceId: bId, targetId: aId, refs: { [aId]: refsA, [bId]: refsB }, note: 'May move canonical/current state into legacy/email record.' }))),
    '',
    '## Merge Simulation: MERGE_INTO_B',
    '',
    table(['Field', 'Value'], Object.entries(mergeSimulation({ sourceId: aId, targetId: bId, refs: { [aId]: refsA, [bId]: refsB }, note: 'Requires preserving all source references and validating current login path.' }))),
    '',
    '## Final Recommendation',
    '',
    `Evidence Score: ${scoring.evidenceScore}`,
    `Same Human Probability: ${scoring.sameHumanProbability}%`,
    `Action Risk: ${scoring.mergeRisk}`,
    `Confidence: ${recommended.startsWith('MERGE_INTO_B') ? scoring.mergeIntoBConfidence : scoring.keepSeparateConfidence}%`,
    `Recommendation: ${recommended}`,
    '',
    'Evidence limitations:',
    '- Local Identity snapshot does not include complete bookings/dialogs/friends/meetings/business collections.',
    '- Recommendations are based only on local snapshot rows plus previous conflict-audit counts.',
    '- No owner decision was recorded.',
    '',
    safetyBlock(),
    '',
  ];
  return {
    text: lines.join('\n'),
    meta: {
      conflictId: CONFLICT_ID,
      type: conflict.type,
      recommendation: recommended,
      confidence: recommended.startsWith('MERGE_INTO_B') ? scoring.mergeIntoBConfidence : scoring.keepSeparateConfidence,
      risk: conflict.risk?.level || 'UNKNOWN',
      blockingEvidence: hasRoleOrOwnershipRisk ? 'role/ownership/login-path evidence requires owner confirmation' : 'full business document IDs unavailable',
    },
  };
}

function findByHash(list = [], expectedHash = '') {
  return list.find(row => hash(row.id) === expectedHash || hash(data(row).userId) === expectedHash || hash(data(row).canonicalUserId) === expectedHash) || null;
}

function orphanReport({ snapshot, snapshotPath, conflictPath, conflict, redact = false }) {
  const tgRow = findByHash(rows(snapshot, 'tgLinks'), conflict.telegramIdHash);
  const telegramId = tgRow?.id || `hash:${conflict.telegramIdHash}`;
  const target = data(tgRow).userId || data(tgRow).canonicalUserId || `hash:${conflict.targetUserIdHash}`;
  const targetExists = rows(snapshot, 'users').some(row => row.id === target);
  const candidates = rows(snapshot, 'users').filter(row => {
    const d = data(row);
    const values = [d.linkedTelegram?.tgId, d.linkedTelegram?.telegramId, d.telegramId, d.tgId, d.linkedTgId, d.username, d.linkedTelegram?.username].filter(Boolean);
    return values.includes(telegramId) || values.some(item => hash(item) === conflict.telegramIdHash || hash(item) === conflict.usernameHash);
  });
  const targetRefs = Object.fromEntries(Object.entries(snapshot.collections || {}).map(([name, list]) => [name, list.filter(row => includesAny(row, [target, telegramId])).length]));
  const auditRefTotal = (conflict.activity || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
  const hasAliases = Boolean(conflict.authMapAliases?.length || conflict.identityLinks?.length || candidates.length);
  const validTargetProbability = candidates.length ? 70 : hasAliases ? 35 : 5;
  const actionRisk = auditRefTotal || hasAliases ? 'MEDIUM' : 'LOW';
  const recommendation = !targetExists && !candidates.length && !conflict.identityLinks?.length && !conflict.authMapAliases?.length && auditRefTotal === 0
    ? 'DELETE_ORPHAN_TG_LINK, after owner approval confirming no valid target exists'
    : 'DEFER until a deterministic Telegram -> canonical user chain is available';
  const confidence = recommendation.startsWith('DELETE') && actionRisk === 'LOW' ? 70 : 45;
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
    `- Risk: ${conflict.risk?.level || 'UNKNOWN'} (${conflict.risk?.score || 0})`,
    `- Evidence completeness: ${tgRow ? 'PARTIAL: tgLink row found locally; target user is missing.' : 'LOW: tgLink row not found locally by hash.'}`,
    `- Telegram ID: ${redact ? red(telegramId) : telegramId}`,
    `- Current target: ${redact ? red(target) : target}`,
    `- Target user exists: ${String(targetExists)}`,
    `- Candidate users found: ${candidates.length}`,
    `- Final recommendation: ${recommendation}`,
    '',
    '## Source tgLink',
    '',
    table(['Field', 'Value'], [
      ['telegramId', redact ? red(telegramId) : telegramId],
      ['createdAt', ts(data(tgRow).createdAt)],
      ['updatedAt', ts(data(tgRow).updatedAt)],
      ['source', data(tgRow).source || 'not present in local snapshot'],
      ['auth flow', 'not present in local Identity snapshot'],
      ['referral flow', 'not present in local Identity snapshot'],
      ['username', redact ? red(data(tgRow).username) : data(tgRow).username],
      ['targetUserId', redact ? red(target) : target],
    ]),
    '',
    '## Candidate Search',
    '',
    table(['Signal', 'Result'], [
      ['same Telegram ID', candidates.length],
      ['same email', 'not available for orphan tgLink evidence'],
      ['firebaseUid', 'not found'],
      ['canonicalUserId', conflict.identityLinks?.length || 0],
      ['auth session', 'not present in local Identity snapshot'],
      ['referral session', 'not present in local Identity snapshot'],
      ['username', data(tgRow).username ? 'present on tgLink' : 'not present'],
      ['phone', 'not present'],
      ['profile name', 'not sufficient evidence'],
    ]),
    '',
    '## Business References',
    '',
    table(['Collection', 'Target/Telegram references'], Object.entries(targetRefs)),
    '',
    '## Reference Counts From Conflict Audit',
    '',
    table(['Reference', 'Count'], (conflict.activity || []).map(item => [item.label, item.ok ? item.count : `FAILED: ${item.error || 'unknown'}`])),
    '',
    '## Decision Options',
    '',
    table(['Decision', 'Forensic view'], [
      ['REMAP_TG_LINK', candidates.length ? 'Possible only if owner confirms candidate canonical chain.' : 'Not supported: no deterministic candidate in local evidence.'],
      ['DELETE_ORPHAN_TG_LINK', recommendation.startsWith('DELETE') ? 'Candidate if owner confirms no valid target exists and no recovery flow depends on this link.' : 'Not recommended from current evidence.'],
      ['DEFER', recommendation.startsWith('DEFER') ? 'Recommended until stronger evidence exists.' : 'Acceptable if owner wants more evidence.'],
    ]),
    '',
    '## Preservation Requirements',
    '',
    '- Preserve tgLink backup before any future delete operation.',
    '- Confirm no auth/session/referral recovery path still points to this tgLink.',
    '- Do not remap without Telegram ID -> auth/session -> canonical user proof.',
    '',
    '## Final Recommendation',
    '',
    `Evidence Score: ${Math.max(0, 100 - (conflict.risk?.score || 0))}`,
    `Valid Target Probability: ${validTargetProbability}%`,
    `Action Risk: ${actionRisk}`,
    `Confidence: ${confidence}%`,
    `Recommendation: ${recommendation}`,
    '',
    'Evidence limitations:',
    '- Local Identity snapshot does not include telegramAuthSessions, emailAuthSessions, referralSessions, dialogs, meetings, or full business collections.',
    '- Recommendations are based only on local snapshot rows plus previous conflict-audit counts.',
    '- No owner decision was recorded.',
    '',
    safetyBlock(),
    '',
  ];
  return {
    text: lines.join('\n'),
    meta: {
      conflictId: CONFLICT_ID,
      type: conflict.type,
      recommendation,
      confidence,
      risk: conflict.risk?.level || 'UNKNOWN',
      blockingEvidence: candidates.length ? 'candidate requires owner verification' : 'no deterministic canonical target found',
    },
  };
}

function buildReport(redact = false) {
  const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE || latestFile(file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'));
  if (!snapshotPath) throw new Error('No local Identity snapshot found.');
  const snapshot = readJson(snapshotPath);
  const { file: conflictPath, conflict } = findConflict();
  if (conflict.type === 'ORPHAN_TGLINK') return orphanReport({ snapshot, snapshotPath, conflictPath, conflict, redact });
  return duplicateReport({ snapshot, snapshotPath, conflictPath, conflict, redact });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const reportPath = path.join(OUT_DIR, `${CONFLICT_ID}-report.md`);
const redactedPath = path.join(OUT_DIR, `${CONFLICT_ID}-report-redacted.md`);
const full = buildReport(false);
const redacted = buildReport(true);
fs.writeFileSync(reportPath, full.text);
fs.writeFileSync(redactedPath, redacted.text);

console.log(JSON.stringify({
  ok: true,
  conflictId: CONFLICT_ID,
  type: full.meta.type,
  reportPath,
  redactedPath,
  changedProductionData: false,
  recommendation: full.meta.recommendation,
  confidence: full.meta.confidence,
  risk: full.meta.risk,
  blockingEvidence: full.meta.blockingEvidence,
}, null, 2));
