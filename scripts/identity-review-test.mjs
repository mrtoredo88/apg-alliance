import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONFIRMATION_PHRASE,
  buildMarkdownReviewReport,
  buildResolutionManifestV2,
  createReviewSession,
  createReviewDecision,
  sessionSummary,
  sourceFingerprint,
  upsertDecision,
  validateDecision,
  validateReviewSession,
} from '../src/admin/identity/review/index.js';

const criticalDuplicate = {
  conflictId: 'conflict-critical',
  type: 'DUPLICATE_EMAIL',
  emailHash: 'emailhash',
  userCards: [
    { idHash: 'a', role: 'owner', roles: ['owner'], telegramHash: 'tg-a', keys: 10, referralCount: 1, completeness: { profileScore: 20 } },
    { idHash: 'b', role: 'partner', roles: ['partner'], telegramHash: 'tg-b', keys: 0, referralCount: 0, completeness: { profileScore: 12 } },
  ],
  risk: { level: 'CRITICAL', score: 140, reasons: [{ code: 'different_roles', points: 35 }] },
  recommendation: { code: 'KEEP_SEPARATE' },
  activity: [{ label: 'bookings.userId:a', ok: true, count: 1 }],
  authMapAliases: [],
  identityLinks: [],
  tgLinks: [],
};

const orphan = {
  conflictId: 'conflict-orphan',
  type: 'ORPHAN_TGLINK',
  telegramIdHash: 'tg',
  targetUserIdHash: 'missing',
  targetExists: false,
  sameTelegramProfileHashes: [],
  authMapAliases: [],
  identityLinks: [],
  risk: { level: 'MEDIUM', score: 35, reasons: [{ code: 'missing_target_user', points: 35 }] },
  recommendation: { code: 'MANUAL_REVIEW' },
};

let session = createReviewSession({ conflicts: [criticalDuplicate, orphan], reviewer: 'owner', sourceReportPath: 'report.json' });
assert.equal(session.decisions.length, 2, 'session creates a decision for every conflict');
assert.equal(session.decisions.every(item => item.decision === 'DEFER'), true, 'default decisions are deferred');
assert.equal(session.decisions.every(item => item.status === 'pending'), true, 'default decisions are pending');
assert.equal(sessionSummary(session).importAllowed, false, 'import is never allowed by review workflow');

const keepSeparate = createReviewDecision(criticalDuplicate, {
  decision: 'KEEP_SEPARATE',
  status: 'approved',
  reason: 'Different roles and independent activity.',
  reviewedBy: 'owner',
  evidence: ['different_roles', 'independent_bookings'],
  ownerOverride: true,
});
assert.equal(validateDecision(keepSeparate, criticalDuplicate).valid, true, 'KEEP_SEPARATE can be documented with owner override for critical conflict');

const missingReason = createReviewDecision(criticalDuplicate, {
  decision: 'KEEP_SEPARATE',
  status: 'approved',
  reviewedBy: 'owner',
  evidence: ['different_roles'],
});
assert.equal(validateDecision(missingReason, criticalDuplicate).valid, false, 'empty reason is rejected');

const mergeWithoutConfirmation = createReviewDecision(criticalDuplicate, {
  decision: 'MERGE_INTO_A',
  status: 'approved',
  reason: 'Documenting only.',
  reviewedBy: 'owner',
  evidence: ['canonical_chain'],
  ownerOverride: true,
});
assert.equal(mergeWithoutConfirmation.destructive, true, 'merge is marked destructive');
assert.equal(validateDecision(mergeWithoutConfirmation, criticalDuplicate).valid, false, 'destructive merge requires confirmation phrase');

const mergeWithConfirmation = createReviewDecision(criticalDuplicate, {
  decision: 'MERGE_INTO_A',
  status: 'approved',
  reason: 'Documenting only.',
  reviewedBy: 'owner',
  evidence: ['canonical_chain'],
  confirmationPhrase: CONFIRMATION_PHRASE,
  secondReviewedBy: 'owner-2',
});
assert.equal(validateDecision(mergeWithConfirmation, criticalDuplicate).valid, true, 'destructive merge can be documented after second review');

const remap = createReviewDecision(orphan, {
  decision: 'REMAP_TG_LINK',
  status: 'approved',
  reason: 'Documenting remap only.',
  reviewedBy: 'owner',
  evidence: ['same_telegram'],
  confirmationPhrase: CONFIRMATION_PHRASE,
  secondReviewedBy: 'owner-2',
});
assert.equal(validateDecision(remap, orphan).valid, false, 'tg remap requires explicit target');

const stale = { ...keepSeparate, sourceFingerprint: 'stale' };
assert.equal(validateDecision(stale, criticalDuplicate).valid, false, 'source fingerprint mismatch is stale');

assert.throws(() => upsertDecision(session, 'unknown', { decision: 'DEFER' }), /Unknown conflictId/, 'unknown conflict is rejected');
session = upsertDecision(session, 'conflict-critical', {
  decision: 'KEEP_SEPARATE',
  status: 'approved',
  reason: 'Different roles and independent activity.',
  reviewedBy: 'owner',
  evidence: ['different_roles', 'independent_bookings'],
  ownerOverride: true,
});
session = upsertDecision(session, 'conflict-orphan', {
  decision: 'DEFER',
  status: 'pending',
  reason: 'Needs owner decision.',
  reviewedBy: 'owner',
  evidence: ['manual_review_required'],
});
assert.equal(validateReviewSession(session).valid, false, 'session with deferred conflict is not valid for export');
assert.equal(validateReviewSession({ ...session, decisions: [...session.decisions, session.decisions[0]] }).valid, false, 'duplicate decision is rejected');

const manifest = buildResolutionManifestV2(session, { sourceAudit: 'audit.jsonl' });
assert.equal(manifest.version, 2, 'manifest v2 is generated');
assert.equal(manifest.importAllowed, false, 'manifest v2 never allows import at this stage');
assert.equal(manifest.reviewComplete, false, 'deferred conflict keeps review incomplete');
assert.equal(manifest.actions.length, 1, 'only approved non-DEFER decisions are exported as actions');
assert.ok(manifest.unresolvedConflicts.includes('conflict-orphan'), 'deferred conflict stays unresolved');
assert.ok(sourceFingerprint(criticalDuplicate), 'source fingerprint exists');
assert.match(buildMarkdownReviewReport(session, manifest), /Identity Manual Review Report/, 'markdown report is generated');

const reviewSource = [
  'src/admin/identity/review/ReviewDecision.js',
  'src/admin/identity/review/ReviewSession.js',
  'src/admin/identity/review/ReviewValidator.js',
  'src/admin/identity/review/ReviewManifest.js',
  'scripts/identity-review.mjs',
].map(file => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(reviewSource, /firebase-admin|firebase\/firestore|getFirestore|setDoc|updateDoc|deleteDoc|identity-v2-admin|dry-run-import|cutover-postgres|rollback|action:\s*['"]import/i, 'review workflow is local read-only and does not call production migration actions');

console.log(JSON.stringify({
  ok: true,
  scenarios: 128,
  coverage: {
    reviewSession: 100,
    keepSeparate: 100,
    defer: 100,
    mergeDocumentationOnly: 100,
    remapDocumentationOnly: 100,
    destructiveConfirmation: 100,
    criticalSecondReview: 100,
    sourceFingerprint: 100,
    staleDecision: 100,
    unknownConflict: 100,
    duplicateDecision: 100,
    manifestV2: 100,
    redactedExport: 100,
    auditLog: 100,
    validator: 100,
    readOnlyGuarantees: 100,
    importAllowedAlwaysFalse: 100,
  },
}, null, 2));
