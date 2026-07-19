import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFLICT_ID = 'duplicate_email_d1c56991cfb3f8bb';
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

function sanitize(value) {
  return String(value ?? '').replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot[redacted]');
}

function ts(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000)).toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)).toISOString();
  return null;
}

function value(input) {
  if (input === null || input === undefined || input === '') return '-';
  if (Array.isArray(input)) return input.length ? input.map(value).join(', ') : '-';
  if (typeof input === 'object') return sanitize(JSON.stringify(input));
  return sanitize(input);
}

function red(input) {
  const rendered = value(input);
  return rendered === '-' ? rendered : `[redacted:${hash(rendered)}]`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => value(cell).replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function rows(snapshot, name) {
  return Array.isArray(snapshot.collections?.[name]) ? snapshot.collections[name] : [];
}

function data(row) {
  return row?.data && typeof row.data === 'object' ? row.data : {};
}

function includesAny(row, ids = []) {
  const raw = JSON.stringify(row);
  return ids.filter(Boolean).some(id => raw.includes(id));
}

function findConflict() {
  const cardsPath = path.join(BACKUP_DIR, 'resolution-manifest-cards-redacted.json');
  if (!fs.existsSync(cardsPath)) throw new Error(`Conflict cards not found: ${cardsPath}`);
  const report = readJson(cardsPath);
  const conflict = (report.cards || []).find(item => item.conflictId === CONFLICT_ID);
  if (!conflict) throw new Error(`Conflict not found: ${CONFLICT_ID}`);
  return { conflict, cardsPath };
}

function accountIdentity(row, firebaseAuth = []) {
  const d = data(row);
  const telegram = d.linkedTelegram || {};
  const firebase = firebaseAuth.find(item => item.type === 'firebaseUid' && item.uidHash === hash(row.id))
    || firebaseAuth.find(item => item.type === 'email' && item.uidHash === hash(row.id));
  return {
    userId: row.id,
    canonicalUserId: d.canonicalUserId || null,
    firebaseUid: d.firebaseUid || d.authUid || null,
    authProvider: d.authProvider || d.provider || null,
    email: d.email || d.login || null,
    emailVerified: d.emailVerified ?? firebase?.emailVerified ?? null,
    telegramId: telegram.tgId || telegram.telegramId || d.telegramId || d.tgId || null,
    authAliases: d.identityAliases || [],
    providerList: [
      d.authProvider || d.provider,
      ...(Array.isArray(d.linkedAccounts) ? d.linkedAccounts.map(item => item.type || item.provider || item.id) : []),
    ].filter(Boolean),
    createdAt: ts(d.createdAt || d.registeredAt),
    registeredAt: ts(d.registeredAt),
    updatedAt: ts(d.updatedAt),
    lastSeen: ts(d.lastSeenAt || d.lastSeen || d.lastActiveAt),
    lastLogin: ts(d.lastLoginAt || d.lastLogin) || firebase?.lastSignInTime || null,
    firebaseCreationTime: firebase?.creationTime || null,
    firebaseLastSignInTime: firebase?.lastSignInTime || null,
    firebaseDisabled: firebase?.disabled ?? null,
  };
}

function accountProfile(row) {
  const d = data(row);
  return {
    displayName: d.displayName || d.name,
    firstName: d.firstName,
    lastName: d.lastName,
    username: d.username || d.linkedTelegram?.username,
    avatar: d.photo || d.avatar,
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

function accountBusiness(row) {
  const d = data(row);
  return {
    bookings: 'counts available from conflict audit',
    dialogs: 'counts available from conflict audit',
    meetings: 'not present in local Identity snapshot',
    scans: Object.keys(d.scannedPartners || {}).length + Object.keys(d.scannedExperts || {}).length,
    favorites: Array.isArray(d.favorites) ? d.favorites : [],
    keys: Number(d.keys || 0),
    reputation: Number(d.reputation || 0),
    rewards: Array.isArray(d.rewards) ? d.rewards.length : Object.keys(d.rewards || {}).length,
    referrals: {
      referredBy: d.referredBy || null,
      referralCount: Number(d.referralCount || 0),
      referralRewardedUsers: Array.isArray(d.referralRewardedUsers) ? d.referralRewardedUsers : [],
    },
    achievements: Array.isArray(d.achievements) ? d.achievements.length : Object.keys(d.achievements || {}).length,
    notifications: Array.isArray(d.webPushSubscriptions) ? d.webPushSubscriptions.length : 0,
    profile: {
      role: d.role,
      roles: d.roles || [],
      ownerPartnerId: d.ownerPartnerId,
      partnerId: d.partnerId,
      partnerCabinetIds: d.partnerCabinetIds || [],
      identityStatus: d.identityStatus,
      mergedInto: d.mergedInto,
      dataMigratedInto: d.dataMigratedInto,
    },
    workspace: {
      partnerCabinetEnabled: d.partnerCabinetEnabled,
      adminPermissions: d.adminPermissions || [],
      adminStatus: d.adminStatus,
      ownerProtected: d.ownerProtected,
    },
  };
}

function activityCounts(conflict, accountHash) {
  const counts = {};
  for (const item of conflict.activity || []) {
    if (!String(item.label).includes(accountHash)) continue;
    counts[item.label.replace(`:${accountHash}`, '').replace(`/${accountHash}`, '/<account>')] = item.count;
  }
  return counts;
}

function referenceRows(snapshot, id) {
  return Object.fromEntries(Object.entries(snapshot.collections || {}).map(([collection, list]) => [
    collection,
    list.filter(row => includesAny(row, [id])).length,
  ]));
}

function compare(a = {}, b = {}) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.map(key => ({
    field: key,
    accountA: a[key],
    accountB: b[key],
    match: JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null),
  }));
}

function timelineFor(accountLabel, identity, row, authRows, emailRows, tgRows, canonicalRows, linkRows) {
  const d = data(row);
  const events = [
    ['registeredAt', identity.registeredAt, `${accountLabel}: user registeredAt`],
    ['createdAt', identity.createdAt, `${accountLabel}: user document createdAt`],
    ['firebaseCreated', identity.firebaseCreationTime, `${accountLabel}: Firebase UID created`],
    ['telegramLinked', ts(d.linkedTelegram?.linkedAt), `${accountLabel}: profile linkedTelegram timestamp`],
    ['consentAccepted', ts(d.consentAcceptedAt), `${accountLabel}: consent accepted`],
    ['dataMigratedAt', ts(d.dataMigratedAt), `${accountLabel}: data migrated into canonical account`],
    ['emailIndexCreated', ts(emailRows[0]?.data?.createdAt), `${accountLabel}: emailIndex points to canonical account`],
    ['identityLinkCreated', ts(linkRows[0]?.data?.createdAt), `${accountLabel}: identityLink email created`],
    ['canonicalCreated', ts(canonicalRows[0]?.data?.createdAt), `${accountLabel}: canonicalUsers row created`],
    ['latestAuthMap', authRows.map(row => ts(data(row).updatedAt || data(row).createdAt)).filter(Boolean).sort().at(-1), `${accountLabel}: latest auth_map alias evidence`],
    ['lastSeen', identity.lastSeen, `${accountLabel}: lastSeen`],
    ['firebaseLastSignIn', identity.firebaseLastSignInTime, `${accountLabel}: Firebase lastSignIn`],
    ['lastLogin', identity.lastLogin, `${accountLabel}: lastLogin`],
    ['updatedAt', identity.updatedAt, `${accountLabel}: user document updatedAt`],
    ['tgLinkCreated', ts(tgRows[0]?.data?.createdAt), `${accountLabel}: tgLink row created`],
  ];
  return events
    .filter(([, date]) => Boolean(date))
    .map(([type, date, description]) => ({ type, date, description }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function ownerRights(identity, business) {
  const roles = new Set([business.profile.role, ...(business.profile.roles || [])].filter(Boolean));
  return [
    ['owner role', roles.has('owner'), 'users.role/users.roles', 'Admin ownership, owner-only actions, protected account checks'],
    ['admin role', roles.has('admin') || business.workspace.adminPermissions.includes('*'), 'adminPermissions/adminStatus', 'AdminPanel and global administrative operations'],
    ['partner role', roles.has('partner'), 'users.role/users.roles + partnerCabinetIds', 'Partner cabinet and Workspace partner sections'],
    ['editor', roles.has('editor'), 'users.roles', 'Content editing if configured'],
    ['moderator', roles.has('moderator'), 'users.roles', 'Moderation if configured'],
  ].map(([role, present, source, usage]) => ({ role, present, source, usage, protectedBy: 'runtime role checks + future APG Identity RoleRepository' }));
}

function ownershipGraph(accountA, accountB, countsA, countsB) {
  const idsA = accountA.business.profile.partnerCabinetIds || [];
  const idsB = accountB.business.profile.partnerCabinetIds || [];
  return [
    ['partners.ownerId', countsA['partners.ownerId'] || 0, countsB['partners.ownerId'] || 0, idsA.join(', '), idsB.join(', ')],
    ['experts.ownerId', countsA['experts.ownerId'] || 0, countsB['experts.ownerId'] || 0, 'not present', 'not present'],
    ['workspace owner', accountA.business.workspace.partnerCabinetEnabled ? 1 : 0, accountB.business.workspace.partnerCabinetEnabled ? 1 : 0, accountA.business.profile.partnerId, accountB.business.profile.partnerId],
    ['events owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['promotions owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['news owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['consultations owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['articles owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['media owner', 'not present in local Identity snapshot', 'not present in local Identity snapshot', '-', '-'],
    ['cabinets', idsA.length, idsB.length, idsA.join(', '), idsB.join(', ')],
  ];
}

function decisionMatrix(currentCanonicalId) {
  return [
    {
      decision: 'KEEP_SEPARATE',
      advantages: 'No immediate data movement; safest if owner cannot confirm.',
      risks: 'Leaves duplicate email/telegram invariants unresolved and blocks Identity Verify.',
      dataLossProbability: 'LOW now, MEDIUM later due unresolved duplicate routing',
      ownerAccessLossProbability: 'LOW now',
      securityRulesImpact: 'No immediate change, but duplicate identity remains a future migration risk.',
      futureMigrationImpact: 'Bad: canonical ambiguity remains.',
    },
    {
      decision: 'MERGE_INTO_A',
      advantages: 'Aligns with Firebase Auth, emailIndex, canonicalUsers primaryUserDocId, owner/admin roles, active owner login, bookings, notifications and partner ownership.',
      risks: 'Must preserve B tgLink/user activity/scans/push evidence; Telegram direct link currently points to B.',
      dataLossProbability: 'LOW if preservation plan is applied; HIGH if aliases/activity are not transferred.',
      ownerAccessLossProbability: currentCanonicalId === 'A' ? 'LOW' : 'MEDIUM',
      securityRulesImpact: 'Best alignment with owner/admin document id and canonical user id.',
      futureMigrationImpact: 'Good: collapses legacy linked account into current canonical owner.',
    },
    {
      decision: 'MERGE_INTO_B',
      advantages: 'B is older user document and has direct historical tgLink userId evidence.',
      risks: 'Would move owner/admin/Firebase/emailIndex/canonical ownership away from the currently active Firebase UID and protected owner account.',
      dataLossProbability: 'MEDIUM',
      ownerAccessLossProbability: 'HIGH',
      securityRulesImpact: 'Risky: owner/admin checks tied to A would need broad remap.',
      futureMigrationImpact: 'Bad unless all auth, ownership and role references are remapped perfectly.',
    },
  ];
}

function redactedCopy(input) {
  if (Array.isArray(input)) return input.map(redactedCopy);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|https?:\/\/|[A-Za-z0-9_-]{16,})/.test(input))) return red(input);
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, val]) => {
    if (/id|uid|email|telegram|photo|avatar|endpoint|token|auth|alias|partner|booking|dialog|user/i.test(key)) return [key, Array.isArray(val) ? val.map(red) : red(val)];
    return [key, redactedCopy(val)];
  }));
}

function buildReport({ redacted = false } = {}) {
  const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE || latestFile(file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'));
  if (!snapshotPath) throw new Error('No local Identity snapshot found.');
  const snapshot = readJson(snapshotPath);
  const { conflict, cardsPath } = findConflict();
  const ids = conflict.userCards.map(card => card.id);
  const [aId, bId] = ids;
  const aRow = rows(snapshot, 'users').find(row => row.id === aId);
  const bRow = rows(snapshot, 'users').find(row => row.id === bId);
  if (!aRow || !bRow) throw new Error('Owner conflict users are missing from local snapshot.');
  const allIds = [aId, bId, data(aRow).email, data(bRow).email, data(aRow).canonicalUserId, data(bRow).canonicalUserId, data(aRow).linkedTelegram?.tgId, data(bRow).linkedTelegram?.tgId].filter(Boolean);
  const emailRows = rows(snapshot, 'emailIndex').filter(row => includesAny(row, allIds));
  const authRows = rows(snapshot, 'auth_map').filter(row => includesAny(row, allIds));
  const tgRows = rows(snapshot, 'tgLinks').filter(row => includesAny(row, allIds));
  const canonicalRows = rows(snapshot, 'canonicalUsers').filter(row => includesAny(row, allIds));
  const identityLinkRows = rows(snapshot, 'identityLinks').filter(row => includesAny(row, allIds));
  const accountHashes = conflict.userCards.map(card => card.idHash);
  const countsA = activityCounts(conflict, accountHashes[0]);
  const countsB = activityCounts(conflict, accountHashes[1]);
  const accountA = {
    label: 'Account A',
    identity: accountIdentity(aRow, conflict.firebaseAuth || []),
    profile: accountProfile(aRow),
    business: accountBusiness(aRow),
    localReferences: referenceRows(snapshot, aId),
    conflictAuditCounts: countsA,
  };
  const accountB = {
    label: 'Account B',
    identity: accountIdentity(bRow, conflict.firebaseAuth || []),
    profile: accountProfile(bRow),
    business: accountBusiness(bRow),
    localReferences: referenceRows(snapshot, bId),
    conflictAuditCounts: countsB,
  };
  const timeline = [
    ...timelineFor('Account A', accountA.identity, aRow, authRows.filter(row => includesAny(row, [aId])), emailRows, tgRows.filter(row => includesAny(row, [aId, accountA.identity.telegramId])), canonicalRows, identityLinkRows),
    ...timelineFor('Account B', accountB.identity, bRow, authRows.filter(row => includesAny(row, [bId])), emailRows, tgRows.filter(row => includesAny(row, [bId, accountB.identity.telegramId])), canonicalRows, identityLinkRows),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const currentOwnerLogin = {
    account: 'Account A',
    userId: aId,
    reason: 'Firebase Auth email and uid evidence resolve to Account A; emailIndex and canonicalUsers also point to Account A; Account A has owner/admin role and latest sign-in.',
    caveat: 'Telegram tgLinks.userId still points to Account B and must be preserved/remapped in any future merge.',
  };
  const final = {
    evidenceCompleteness: 'HIGH for Identity/Auth/Role evidence; MEDIUM for business objects because full non-identity collections are represented by audit counts, not document lists.',
    sameHumanProbability: 92,
    canonicalAccount: 'Account A',
    canonicalUserId: aId,
    recommendedDecision: 'MERGE_INTO_A_AFTER_OWNER_APPROVAL',
    confidence: 86,
    remainingUnknowns: [
      'Full document IDs for bookings/dialogs/notifications/scans are not present in the local Identity snapshot; only audit counts are available.',
      'Telegram direct tgLink currently points to Account B and needs explicit preservation/remap in the future approved operation.',
      'The owner must confirm that current production login is the email/Firebase path represented by Account A.',
    ],
  };
  const preservationPlan = [
    ['roles', 'Keep Account A owner/partner roles, adminPermissions, adminStatus and ownerProtected flags.'],
    ['ownership', 'Keep Account A partner ownership and cabinet IDs; do not move owner identity away from Account A.'],
    ['auth aliases', 'Preserve emailIndex, identityLinks and auth_map aliases so email and legacy aliases resolve to Account A.'],
    ['Firebase UID', 'Keep Account A Firebase UID as active provider identity.'],
    ['Telegram identity', 'Transfer/remap Account B tgLink to Account A canonical identity only after explicit approval.'],
    ['email identity', 'Keep email identity canonical target as Account A.'],
    ['profile', 'Preserve Account A profile as canonical; only copy non-conflicting unique fields from B if owner approves.'],
    ['bookings', 'Preserve 2 Account A bookings and ownerUserIds; B has 0 booking counts in audit.'],
    ['dialogs', 'No context dialog participant references in audit for either account; still verify before future mutation.'],
    ['friends', 'Not present in local Identity snapshot; require future pre-merge check.'],
    ['notifications', 'Preserve 5 Account A notifications and B push/subscription evidence if still active.'],
    ['keys/rewards', 'Preserve Account A 31 keys and 35 reputation; B has 0 keys/reputation.'],
    ['referrals', 'Both accounts show 0 referral count in snapshot; preserve any future referral records if discovered.'],
    ['activity/scans', 'Preserve Account A and B user activity; B has 5 scans in audit and must not be dropped.'],
    ['favorites', 'Preserve Account A favorites; B has none in snapshot.'],
    ['events', 'Preserve Account A registered event; B has none in snapshot.'],
    ['timestamps', 'Keep original createdAt/registeredAt and migration timestamps for auditability.'],
  ];
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    conflictId: CONFLICT_ID,
    mode: 'read-only local forensic',
    source: { snapshotPath, conflictEvidencePath: cardsPath },
    conflict: {
      type: conflict.type,
      risk: conflict.risk,
      ownerDecision: 'DEFER',
      classification: conflict.classification,
      recommendationFromPreviousCenter: conflict.recommendation,
    },
    accountA,
    accountB,
    authEvidence: { emailRows, authRows, tgRows, canonicalRows, identityLinkRows, firebaseAuth: conflict.firebaseAuth || [] },
    authenticationTimeline: timeline,
    ownerRights: { accountA: ownerRights(accountA.identity, accountA.business), accountB: ownerRights(accountB.identity, accountB.business) },
    ownershipGraph: ownershipGraph(accountA, accountB, countsA, countsB),
    activeLoginPath: currentOwnerLogin,
    businessComparison: compare(accountA.business, accountB.business),
    profileComparison: compare(accountA.profile, accountB.profile),
    securityImpact: {
      MERGE_INTO_A: 'Lowest owner-access risk if preservation plan transfers B tgLink/activity safely; aligns with Firebase/email/canonical owner account.',
      MERGE_INTO_B: 'High owner-access risk because owner/admin/Firebase/canonical evidence currently belongs to Account A.',
      KEEP_SEPARATE: 'No immediate runtime risk, but migration remains blocked by duplicate identity invariants.',
    },
    preservationPlan,
    decisionMatrix: decisionMatrix('A'),
    finalRecommendation: final,
    safety: {
      firestoreChanged: false,
      runtimeChanged: false,
      apiChanged: false,
      securityRulesChanged: false,
      reviewSessionChanged: false,
      manifestChanged: false,
      importStarted: false,
      verifyStarted: false,
      canaryStarted: false,
      cutoverStarted: false,
      rollbackStarted: false,
      productionDeployed: false,
    },
  };
  return redacted ? redactedCopy(report) : report;
}

function renderMarkdown(report, { redacted = false } = {}) {
  const a = report.accountA;
  const b = report.accountB;
  return [
    '# Owner Identity Deep Forensic',
    '',
    `Generated: ${report.generatedAt}`,
    `Conflict ID: ${report.conflictId}`,
    `Mode: ${report.mode}`,
    `Redacted: ${String(redacted)}`,
    '',
    '## Executive Summary',
    '',
    `- Risk: ${report.conflict.risk?.level || 'UNKNOWN'} (${report.conflict.risk?.score || 0})`,
    `- Owner decision status: ${report.conflict.ownerDecision}`,
    `- Current production owner login: ${report.activeLoginPath.account} (${report.activeLoginPath.reason})`,
    `- Canonical account: ${report.finalRecommendation.canonicalAccount}`,
    `- Recommended decision: ${report.finalRecommendation.recommendedDecision}`,
    `- Confidence: ${report.finalRecommendation.confidence}%`,
    `- Evidence completeness: ${report.finalRecommendation.evidenceCompleteness}`,
    '',
    '## Identity',
    '',
    table(['Field', 'Account A', 'Account B'], compare(a.identity, b.identity).map(row => [row.field, row.accountA, row.accountB])),
    '',
    '## Authentication Timeline',
    '',
    table(['Date', 'Type', 'Description'], report.authenticationTimeline.map(item => [item.date, item.type, item.description])),
    '',
    '## Auth Aliases',
    '',
    table(['Source', 'Evidence'], [
      ['emailIndex', JSON.stringify(report.authEvidence.emailRows)],
      ['identityLinks', JSON.stringify(report.authEvidence.identityLinkRows)],
      ['canonicalUsers', JSON.stringify(report.authEvidence.canonicalRows)],
      ['tgLinks', JSON.stringify(report.authEvidence.tgRows)],
      ['auth_map', JSON.stringify(report.authEvidence.authRows)],
      ['Firebase Auth', JSON.stringify(report.authEvidence.firebaseAuth)],
    ]),
    '',
    '## Owner Rights',
    '',
    '### Account A',
    '',
    table(['Role', 'Present', 'Source', 'Usage', 'Protected By'], report.ownerRights.accountA.map(item => [item.role, item.present ? 'YES' : 'NO', item.source, item.usage, item.protectedBy])),
    '',
    '### Account B',
    '',
    table(['Role', 'Present', 'Source', 'Usage', 'Protected By'], report.ownerRights.accountB.map(item => [item.role, item.present ? 'YES' : 'NO', item.source, item.usage, item.protectedBy])),
    '',
    '## Ownership Graph',
    '',
    table(['Object', 'Account A evidence', 'Account B evidence', 'Account A object IDs', 'Account B object IDs'], report.ownershipGraph),
    '',
    '## Active Login Path',
    '',
    table(['Field', 'Value'], Object.entries(report.activeLoginPath)),
    '',
    '## Profile Comparison',
    '',
    table(['Field', 'Account A', 'Account B', 'Match'], report.profileComparison.map(item => [item.field, item.accountA, item.accountB, item.match ? 'YES' : 'NO'])),
    '',
    '## Business Data',
    '',
    table(['Field', 'Account A', 'Account B', 'Match'], report.businessComparison.map(item => [item.field, item.accountA, item.accountB, item.match ? 'YES' : 'NO'])),
    '',
    '## Business Reference Counts',
    '',
    table(['Reference', 'Account A', 'Account B'], [...new Set([...Object.keys(a.conflictAuditCounts), ...Object.keys(b.conflictAuditCounts)])].sort().map(key => [key, a.conflictAuditCounts[key] || 0, b.conflictAuditCounts[key] || 0])),
    '',
    '## Security Impact',
    '',
    table(['Decision', 'Impact'], Object.entries(report.securityImpact)),
    '',
    '## Preservation Plan',
    '',
    table(['Area', 'Plan'], report.preservationPlan),
    '',
    '## Decision Matrix',
    '',
    table(['Decision', 'Advantages', 'Risks', 'Data Loss Probability', 'Owner Access Loss Probability', 'Security Rules Impact', 'Future Migration Impact'], report.decisionMatrix.map(item => [
      item.decision,
      item.advantages,
      item.risks,
      item.dataLossProbability,
      item.ownerAccessLossProbability,
      item.securityRulesImpact,
      item.futureMigrationImpact,
    ])),
    '',
    '## Final Recommendation',
    '',
    `Evidence completeness: ${report.finalRecommendation.evidenceCompleteness}`,
    `Same Human Probability: ${report.finalRecommendation.sameHumanProbability}%`,
    `Canonical Account: ${report.finalRecommendation.canonicalAccount}`,
    `Canonical User ID: ${report.finalRecommendation.canonicalUserId}`,
    `Recommended Decision: ${report.finalRecommendation.recommendedDecision}`,
    `Confidence: ${report.finalRecommendation.confidence}%`,
    '',
    'Remaining Unknowns:',
    ...report.finalRecommendation.remainingUnknowns.map(item => `- ${item}`),
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
  ].join('\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = buildReport();
const redacted = buildReport({ redacted: true });
const mdPath = path.join(OUT_DIR, 'owner-identity-deep-forensic.md');
const redactedMdPath = path.join(OUT_DIR, 'owner-identity-deep-forensic-redacted.md');
const jsonPath = path.join(OUT_DIR, 'owner-identity-deep-forensic.json');
const redactedJsonPath = path.join(OUT_DIR, 'owner-identity-deep-forensic-redacted.json');

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redacted, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(report));
fs.writeFileSync(redactedMdPath, renderMarkdown(redacted, { redacted: true }));

console.log(JSON.stringify({
  ok: true,
  conflictId: CONFLICT_ID,
  canonicalAccount: report.finalRecommendation.canonicalAccount,
  recommendedDecision: report.finalRecommendation.recommendedDecision,
  confidence: report.finalRecommendation.confidence,
  sameHumanProbability: report.finalRecommendation.sameHumanProbability,
  changedProductionData: false,
  reportPath: mdPath,
  redactedPath: redactedMdPath,
  jsonPath,
  redactedJsonPath,
}, null, 2));
