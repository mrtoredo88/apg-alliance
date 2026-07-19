import fs from 'node:fs';
import path from 'node:path';
import { sourceFingerprint } from './ReviewDecision.js';
import { ensureReviewDir, REVIEW_DIR } from './ReviewAuditLog.js';

const DECISIONS_BY_TYPE = {
  DUPLICATE_EMAIL: ['KEEP_SEPARATE', 'MERGE_INTO_A', 'MERGE_INTO_B', 'DEFER'],
  ORPHAN_TGLINK: ['REMAP_TG_LINK -> candidate', 'DELETE_ORPHAN_TG_LINK', 'DEFER'],
};

function value(value, fallback = '-') {
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function maybeRedact(value, redacted = false) {
  if (!redacted) return value;
  return value && value !== '-' ? '[redacted]' : value;
}

function activityCount(conflict = {}, pattern) {
  return (conflict.activity || [])
    .filter(item => item.ok && pattern.test(item.label || ''))
    .reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function systemRecommendation(conflict = {}) {
  const code = conflict.recommendation?.code || conflict.recommendedAction || 'MANUAL_REVIEW';
  if (code === 'KEEP_SEPARATE') return 'KEEP_SEPARATE';
  if (conflict.type === 'DUPLICATE_EMAIL') return 'MERGE_REVIEW_REQUIRED';
  if (conflict.type === 'ORPHAN_TGLINK') return 'REMAP_REVIEW_REQUIRED';
  return 'DEFER';
}

function decisionFor(session = {}, conflictId = '') {
  return (session.decisions || []).find(item => item.conflictId === conflictId) || {};
}

function cardForDuplicate(conflict = {}, session = {}) {
  const decision = decisionFor(session, conflict.conflictId);
  const users = conflict.userCards || [];
  const userCards = users.map((user, index) => ({
    label: `Account ${String.fromCharCode(65 + index)}`,
    userId: user.id || user.idHash || '-',
    userIdHash: user.idHash || '-',
    createdAt: user.createdAt || null,
    lastActivity: user.lastSeen || user.updatedAt || null,
    roles: user.roles || [user.role || 'user'],
    providerIdentities: {
      authProvider: user.authProvider || null,
      firebaseUidHash: user.firebaseUidHash || null,
      canonicalUserIdHash: user.canonicalUserIdHash || null,
      emailVerified: Boolean(user.emailVerified),
    },
    telegramIdentity: user.telegramHash || null,
    bookingsCount: activityCount(conflict, new RegExp(user.idHash ? `bookings.*${user.idHash}|${user.idHash}.*bookings` : 'bookings')),
    dialogsCount: activityCount(conflict, new RegExp(user.idHash ? `dialogs|contextDialogs.*${user.idHash}|${user.idHash}.*contextDialogs` : 'dialogs|contextDialogs')),
    friendsCount: activityCount(conflict, /friends/i),
    keysRewards: { keys: Number(user.keys || 0), rewards: Number(user.achievements || 0), reputation: Number(user.reputation || 0) },
    notifications: activityCount(conflict, /notifications/i),
    ownership: activityCount(conflict, /ownerId|ownership|partners|experts/i),
    scansActivity: activityCount(conflict, /scans|activity/i),
    profileCompleteness: user.completeness || {},
  }));
  return {
    conflictId: conflict.conflictId,
    type: conflict.type,
    risk: conflict.risk || { level: 'LOW', score: 0, reasons: [] },
    email: conflict.emailHash ? `hash:${conflict.emailHash}` : '-',
    currentRecommendation: conflict.recommendation?.code || 'MANUAL_REVIEW',
    systemRecommendation: systemRecommendation(conflict),
    ownerDecision: decision.decision === 'DEFER' || decision.status === 'pending' ? 'UNDECIDED' : decision.decision,
    sourceFingerprint: sourceFingerprint(conflict),
    decisionSourceFingerprint: decision.sourceFingerprint || null,
    stale: Boolean(decision.sourceFingerprint && decision.sourceFingerprint !== sourceFingerprint(conflict)),
    accounts: userCards,
    sharedEvidence: conflict.evidence || [],
    independentEvidence: (conflict.risk?.reasons || []).map(item => item.code || item.reason || String(item)),
    potentialDataLoss: conflict.risk?.reasons || [],
    potentialOwnershipRisk: userCards.some(user => user.ownership > 0),
    potentialAuthRisk: users.some(user => user.hasFirebaseUid || user.authProvider || user.emailVerified),
    potentialReferralRisk: users.some(user => Number(user.referralCount || 0) > 0),
    potentialBookingRisk: userCards.some(user => user.bookingsCount > 0),
    potentialMessagingRisk: userCards.some(user => user.dialogsCount > 0),
    availableDecisions: DECISIONS_BY_TYPE.DUPLICATE_EMAIL,
  };
}

function cardForOrphan(conflict = {}, session = {}) {
  const decision = decisionFor(session, conflict.conflictId);
  return {
    conflictId: conflict.conflictId,
    type: conflict.type,
    risk: conflict.risk || { level: 'LOW', score: 0, reasons: [] },
    telegramId: conflict.telegramIdHash ? `hash:${conflict.telegramIdHash}` : '-',
    currentTgLinkTarget: conflict.targetUserIdHash ? `hash:${conflict.targetUserIdHash}` : '-',
    targetUserExists: Boolean(conflict.targetExists),
    candidateUsers: conflict.sameTelegramProfileHashes || [],
    evidenceForEachCandidate: conflict.evidence || [],
    lastRelatedActivity: conflict.activity || [],
    authHistory: conflict.firebaseAuth || [],
    referralHistory: conflict.authMapAliases || [],
    profileReferences: conflict.identityLinks || [],
    potentialRemapRisk: conflict.risk?.reasons || [],
    currentRecommendation: conflict.recommendation?.code || 'MANUAL_REVIEW',
    systemRecommendation: systemRecommendation(conflict),
    ownerDecision: decision.decision === 'DEFER' || decision.status === 'pending' ? 'UNDECIDED' : decision.decision,
    sourceFingerprint: sourceFingerprint(conflict),
    decisionSourceFingerprint: decision.sourceFingerprint || null,
    stale: Boolean(decision.sourceFingerprint && decision.sourceFingerprint !== sourceFingerprint(conflict)),
    availableDecisions: DECISIONS_BY_TYPE.ORPHAN_TGLINK,
  };
}

export function buildDecisionCards(session = {}) {
  return (session.conflicts || []).map(conflict => (
    conflict.type === 'DUPLICATE_EMAIL'
      ? cardForDuplicate(conflict, session)
      : cardForOrphan(conflict, session)
  ));
}

export function nextPendingConflict(session = {}) {
  const decisions = new Map((session.decisions || []).map(item => [item.conflictId, item]));
  return (session.conflicts || []).find(conflict => {
    const decision = decisions.get(conflict.conflictId);
    return !decision || decision.decision === 'DEFER' || decision.status !== 'approved';
  }) || null;
}

function renderCard(card = {}, { redacted = false } = {}) {
  const lines = [
    `## ${card.conflictId}`,
    '',
    `Conflict ID: ${card.conflictId}`,
    `Type: ${card.type}`,
    `Risk: ${card.risk?.level || 'LOW'} (${card.risk?.score || 0})`,
    `Current recommendation: ${card.currentRecommendation}`,
    `System recommendation: ${card.systemRecommendation}`,
    `Owner decision: ${card.ownerDecision || 'UNDECIDED'}`,
    `Stale: ${String(Boolean(card.stale))}`,
    `Source fingerprint: ${card.sourceFingerprint}`,
    '',
  ];
  if (card.type === 'DUPLICATE_EMAIL') {
    lines.push(`Email: ${maybeRedact(card.email, redacted)}`, '');
    for (const account of card.accounts || []) {
      lines.push(`### ${account.label}`);
      lines.push(`- userId: ${maybeRedact(account.userId, redacted)}`);
      lines.push(`- createdAt: ${value(account.createdAt)}`);
      lines.push(`- last activity: ${value(account.lastActivity)}`);
      lines.push(`- roles: ${value(account.roles)}`);
      lines.push(`- provider identities: ${redacted ? '[redacted]' : JSON.stringify(account.providerIdentities)}`);
      lines.push(`- Telegram identity: ${maybeRedact(value(account.telegramIdentity), redacted)}`);
      lines.push(`- bookings count: ${account.bookingsCount}`);
      lines.push(`- dialogs count: ${account.dialogsCount}`);
      lines.push(`- friends count: ${account.friendsCount}`);
      lines.push(`- keys/rewards: ${JSON.stringify(account.keysRewards)}`);
      lines.push(`- notifications: ${account.notifications}`);
      lines.push(`- ownership: ${account.ownership}`);
      lines.push(`- scans/activity: ${account.scansActivity}`);
      lines.push(`- profile completeness: ${JSON.stringify(account.profileCompleteness)}`);
      lines.push('');
    }
    lines.push(`Shared evidence: ${value(card.sharedEvidence)}`);
    lines.push(`Independent evidence: ${value(card.independentEvidence)}`);
    lines.push(`Potential data loss: ${value((card.potentialDataLoss || []).map(item => item.code || item.reason || JSON.stringify(item)))}`);
    lines.push(`Potential ownership risk: ${String(Boolean(card.potentialOwnershipRisk))}`);
    lines.push(`Potential auth risk: ${String(Boolean(card.potentialAuthRisk))}`);
    lines.push(`Potential referral risk: ${String(Boolean(card.potentialReferralRisk))}`);
    lines.push(`Potential booking risk: ${String(Boolean(card.potentialBookingRisk))}`);
    lines.push(`Potential messaging risk: ${String(Boolean(card.potentialMessagingRisk))}`);
  } else {
    lines.push(`Telegram ID: ${maybeRedact(card.telegramId, redacted)}`);
    lines.push(`Current tgLink target: ${maybeRedact(card.currentTgLinkTarget, redacted)}`);
    lines.push(`Target user exists: ${String(Boolean(card.targetUserExists))}`);
    lines.push(`Candidate users: ${redacted && card.candidateUsers?.length ? '[redacted]' : value(card.candidateUsers)}`);
    lines.push(`Evidence for each candidate: ${value(card.evidenceForEachCandidate)}`);
    lines.push(`Last related activity: ${value((card.lastRelatedActivity || []).map(item => `${item.label}:${item.count}`))}`);
    lines.push(`Auth history: ${value(card.authHistory.map ? card.authHistory.map(item => JSON.stringify(item)) : card.authHistory)}`);
    lines.push(`Referral history: ${value(card.referralHistory)}`);
    lines.push(`Profile references: ${value(card.profileReferences)}`);
    lines.push(`Potential remap risk: ${value((card.potentialRemapRisk || []).map(item => item.code || item.reason || JSON.stringify(item)))}`);
  }
  lines.push('');
  lines.push('Available decisions:');
  (card.availableDecisions || []).forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push('');
  lines.push('Owner decision: UNDECIDED');
  lines.push('Reason:');
  lines.push('Notes:');
  lines.push('');
  return lines.join('\n');
}

export function buildOwnerDecisionPack(session = {}, { redacted = false } = {}) {
  const cards = buildDecisionCards(session);
  const riskCounts = cards.reduce((acc, card) => {
    const level = card.risk?.level || 'LOW';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  const pending = cards.filter(card => card.ownerDecision === 'UNDECIDED').length;
  const lines = [
    '# Identity Owner Decision Pack',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Redacted: ${String(Boolean(redacted))}`,
    '',
    '## Summary',
    '',
    `Total conflicts: ${cards.length}`,
    `Critical: ${riskCounts.CRITICAL || 0}`,
    `High: ${riskCounts.HIGH || 0}`,
    `Medium: ${riskCounts.MEDIUM || 0}`,
    `Decided: ${cards.length - pending}`,
    `Pending: ${pending}`,
    `Ready for Dry Run: ${pending === 0 ? 'YES' : 'NO'}`,
    `Import allowed: false`,
    '',
  ];
  cards.forEach(card => lines.push(renderCard(card, { redacted })));
  return `${lines.join('\n')}\n`;
}

export function writeOwnerDecisionPack(session = {}) {
  ensureReviewDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REVIEW_DIR, `identity-owner-decision-pack-${stamp}.md`);
  const redacted = path.join(REVIEW_DIR, `identity-owner-decision-pack-${stamp}-redacted.md`);
  fs.writeFileSync(file, buildOwnerDecisionPack(session, { redacted: false }));
  fs.writeFileSync(redacted, buildOwnerDecisionPack(session, { redacted: true }));
  return { file, redacted, cards: buildDecisionCards(session) };
}

export function formatDecisionSessionSummary(session = {}) {
  const cards = buildDecisionCards(session);
  const stale = cards.filter(card => card.stale).length;
  const pending = cards.filter(card => card.ownerDecision === 'UNDECIDED').length;
  return [
    'Identity Conflict Decision Session',
    `Conflicts: ${cards.length}`,
    `Decision cards generated: ${cards.length}`,
    `Owner decisions recorded: ${cards.length - pending}`,
    `Pending: ${pending}`,
    `Stale: ${stale}`,
    `Review complete: false`,
    `Dry Run rerun: NO`,
    `Ready for Verify: NO`,
    `Import allowed: false`,
  ].join('\n');
}
