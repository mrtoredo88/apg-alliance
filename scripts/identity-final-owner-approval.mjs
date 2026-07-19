import fs from 'node:fs';
import path from 'node:path';
import {
  appendReviewAudit,
  CONFIRMATION_PHRASE,
  ensureReviewDir,
  REVIEW_DIR,
  sourceFingerprint,
  upsertDecision,
} from '../src/admin/identity/review/index.js';

const REVIEW_SESSION_PREFIX = 'identity-review-session-';

function latestFile(dir, predicate) {
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter(predicate).sort();
  return files.length ? path.join(dir, files.at(-1)) : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  ensureReviewDir();
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

function writeSession(session) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REVIEW_DIR, `${REVIEW_SESSION_PREFIX}${stamp}.json`);
  const redacted = path.join(REVIEW_DIR, `${REVIEW_SESSION_PREFIX}${stamp}-redacted.json`);
  writeJson(file, session);
  writeJson(redacted, {
    version: session.version,
    generatedAt: session.generatedAt,
    updatedAt: session.updatedAt || null,
    reviewer: session.reviewer,
    conflicts: (session.conflicts || []).map(item => ({
      conflictId: item.conflictId,
      type: item.type,
      risk: item.risk,
      recommendation: item.recommendation,
    })),
    decisions: (session.decisions || []).map(item => ({
      conflictId: item.conflictId,
      decision: item.decision,
      status: item.status,
      reviewedBy: item.reviewedBy,
      reviewedAt: item.reviewedAt,
      evidence: item.evidence,
      sourceIds: item.sourceIds,
      sourceUserId: item.sourceUserId,
      targetCanonicalId: item.targetCanonicalId,
      targetUserId: item.targetUserId,
      preservationPlan: item.preservationPlan ? Object.keys(item.preservationPlan) : null,
      telegramId: item.telegramId ? '[redacted]' : '',
      currentTarget: item.currentTarget ? '[redacted]' : '',
      newTarget: item.newTarget ? '[redacted]' : '',
      reasonNoValidTargetExists: item.reasonNoValidTargetExists,
      lastKnownReferences: item.lastKnownReferences,
      destructive: item.destructive,
      secondReviewRequired: item.secondReviewRequired,
      secondReviewedBy: item.secondReviewedBy,
      ownerOverride: item.ownerOverride,
      sourceFingerprint: item.sourceFingerprint,
      decisionFingerprint: item.decisionFingerprint,
    })),
    validation: session.validation,
    importAllowed: false,
  });
  return { file, redacted };
}

function latestSessionFile() {
  return latestFile(REVIEW_DIR, file => file.startsWith(REVIEW_SESSION_PREFIX) && file.endsWith('.json') && !file.includes('-redacted'));
}

function assertFresh(session, conflictId) {
  const conflict = (session.conflicts || []).find(item => item.conflictId === conflictId);
  const decision = (session.decisions || []).find(item => item.conflictId === conflictId);
  if (!conflict) throw new Error(`Missing conflict: ${conflictId}`);
  if (!decision) throw new Error(`Missing decision: ${conflictId}`);
  const current = sourceFingerprint(conflict);
  if (decision.sourceFingerprint !== current) {
    throw new Error(`STALE fingerprint for ${conflictId}: ${decision.sourceFingerprint} != ${current}`);
  }
  return conflict;
}

function preservationPlan(extra = {}) {
  return {
    roles: 'Preserve union of roles on canonical target; never downgrade owner/admin/partner flags.',
    ownership: 'Transfer ownership references from source user ids to canonical target in simulation only.',
    bookings: 'Preserve all booking references by remapping source user ids to canonical target in simulation only.',
    dialogs: 'Preserve dialogs and participants by replacing source user ids with canonical target in simulation only.',
    friends: 'Preserve contacts, friend links and pending requests by remapping source user ids.',
    keys: 'Preserve keys, balances, achievements and reputation on canonical target; no runtime write in this stage.',
    rewards: 'Preserve reward history, prize claims and referral rewards by remapping source references.',
    notifications: 'Preserve notification history and unread counters by remapping source user ids.',
    referrals: 'Preserve referredBy, invitedUsers, referral rewards and referral event references.',
    profileFields: 'Keep richer non-empty canonical profile fields; source-only profile fields must be reviewed during execution.',
    telegramIdentity: 'Preserve Telegram identity and tgLinks; remap source-linked Telegram references to canonical target in simulation only.',
    authProviders: 'Preserve Firebase/email/Telegram aliases and provider links on canonical target.',
    ...extra,
  };
}

function applyDecision(session, conflictId, input) {
  assertFresh(session, conflictId);
  const previous = (session.decisions || []).find(item => item.conflictId === conflictId) || null;
  const next = upsertDecision(session, conflictId, input);
  const current = next.decisions.find(item => item.conflictId === conflictId);
  appendReviewAudit({
    event: previous ? 'DECISION_UPDATED' : 'DECISION_CREATED',
    conflictId,
    reviewedBy: current.reviewedBy,
    decision: current.decision,
    previousDecision: previous?.decision || null,
    fingerprint: current.decisionFingerprint,
  });
  if (current.ownerOverride) {
    appendReviewAudit({
      event: 'OWNER_OVERRIDE_RECORDED',
      conflictId,
      reviewedBy: current.reviewedBy,
      decision: current.decision,
      previousDecision: previous?.decision || null,
      fingerprint: current.decisionFingerprint,
    });
  }
  return next;
}

const sessionPath = process.env.IDENTITY_REVIEW_SESSION || latestSessionFile();
if (!sessionPath || !fs.existsSync(sessionPath)) {
  console.error('Identity Final Owner Approval: latest review session not found.');
  process.exit(1);
}

let session = readJson(sessionPath);

session = applyDecision(session, 'duplicate_email_d1c56991cfb3f8bb', {
  decision: 'MERGE_INTO_A',
  status: 'approved',
  reason: 'Owner approves Account A as canonical after deep forensic: active Firebase/email login, owner role, richer activity, same canonical chain and same Telegram evidence.',
  reviewedBy: 'owner',
  evidence: [
    'owner_deep_forensic_same_human_probability_92',
    'owner_deep_forensic_canonical_account_a',
    'active_login_path_account_a',
    'same_telegram_hash',
    'same_canonical_hash',
  ],
  sourceIds: ['email:mrtoredo88@mail.ru'],
  sourceUserId: 'email:mrtoredo88@mail.ru',
  targetCanonicalId: 'BxwacxEVE4ZplEDXxDQNhAvZT1M2',
  targetUserId: 'BxwacxEVE4ZplEDXxDQNhAvZT1M2',
  preservationPlan: preservationPlan({
    ownerAccess: 'Preserve Account A owner access as canonical production login path.',
    virtualRemaps: ['tgLinks.userId: email:mrtoredo88@mail.ru -> BxwacxEVE4ZplEDXxDQNhAvZT1M2'],
  }),
  confirmationPhrase: CONFIRMATION_PHRASE,
  secondReviewedBy: 'owner',
  ownerOverride: true,
  notes: 'Read-only approval only. No merge, remap, Firestore write, import, verify, canary or cutover is executed by this command.',
});

session = applyDecision(session, 'duplicate_email_f22d08b99bfcad8f', {
  decision: 'MERGE_INTO_A',
  status: 'approved',
  reason: 'Owner approves email Account A as canonical; Account B is Telegram legacy/source doc with matching canonical/email identity chain in conflict card.',
  reviewedBy: 'owner',
  evidence: [
    'same_canonical_hash',
    'same_identity_link',
    'same_telegram_hash',
    'account_a_has_firebase_uid',
    'account_a_email_login_target',
  ],
  sourceIds: ['tg_875814883'],
  sourceUserId: 'tg_875814883',
  targetCanonicalId: 'email:gordeeva.tatyana@mail.ru',
  targetUserId: 'email:gordeeva.tatyana@mail.ru',
  preservationPlan: preservationPlan({
    virtualRemaps: ['tgLinks.userId: tg_875814883 -> email:gordeeva.tatyana@mail.ru'],
  }),
  confirmationPhrase: CONFIRMATION_PHRASE,
  secondReviewedBy: 'owner',
  ownerOverride: false,
  notes: 'Read-only approval only. Execution remains locked behind later gates.',
});

session = applyDecision(session, 'orphan_tglink_25f7fdaf954f27a5', {
  decision: 'DELETE_ORPHAN_TG_LINK',
  status: 'approved',
  reason: 'Owner approves deletion of orphan tgLink only: target user is missing, no same Telegram profile, no identityLink target and no business references in forensic activity checks.',
  reviewedBy: 'owner',
  evidence: [
    'missing_target_user',
    'no_same_telegram_profile',
    'no_identity_link',
    'business_reference_count_zero',
  ],
  telegramId: 'tg_1096891741',
  currentTarget: 'guest_po2visd',
  reasonNoValidTargetExists: 'The target guest user document does not exist and no deterministic canonical, Firebase, identityLink or business reference chain proves a valid remap target.',
  lastKnownReferences: [
    'tgLinks/tg_1096891741 -> guest_po2visd',
    'users/guest_po2visd/bookings:0',
    'users/guest_po2visd/activity:0',
    'users/guest_po2visd/claims:0',
    'bookings.userId:guest_po2visd:0',
    'partners.ownerId:guest_po2visd:0',
    'experts.ownerId:guest_po2visd:0',
    'notifications.userId:guest_po2visd:0',
    'contextDialogs.participants:guest_po2visd:0',
  ],
  confirmationPhrase: CONFIRMATION_PHRASE,
  secondReviewedBy: 'owner',
  ownerOverride: true,
  notes: 'Delete only the orphan tgLink in a later approved execution. Do not delete users, auth history, referrals, roles, bookings or forensic evidence.',
});

const written = writeSession(session);

console.log('Identity Final Owner Approval');
console.log(`Review session: ${written.file}`);
console.log(`Redacted session: ${written.redacted}`);
console.log(`Approved: ${session.decisions.filter(item => item.status === 'approved').length}`);
console.log(`Deferred: ${session.decisions.filter(item => item.status !== 'approved' || item.decision === 'DEFER').length}`);
console.log(`Validation: ${session.validation?.valid ? 'PASS' : 'FAILED'}`);
console.log(`Import allowed: ${String(false)}`);
if (!session.validation?.valid) {
  console.log(JSON.stringify(session.validation, null, 2));
  process.exitCode = 1;
}
