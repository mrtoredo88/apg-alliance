import crypto from 'node:crypto';

export const REVIEW_DECISIONS = new Set([
  'KEEP_SEPARATE',
  'MERGE_INTO_A',
  'MERGE_INTO_B',
  'REMAP_TG_LINK',
  'DELETE_ORPHAN_TG_LINK',
  'DEFER',
]);

export const DESTRUCTIVE_DECISIONS = new Set([
  'MERGE_INTO_A',
  'MERGE_INTO_B',
  'REMAP_TG_LINK',
  'DELETE_ORPHAN_TG_LINK',
]);

export const CONFIRMATION_PHRASE = 'I UNDERSTAND THIS IS NOT EXECUTED YET';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function fingerprint(value, length = 64) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value ?? null))).digest('hex').slice(0, length);
}

export function sourceFingerprint(conflict = {}) {
  if (conflict.type === 'DUPLICATE_EMAIL') {
    return fingerprint({
      conflictId: conflict.conflictId,
      type: conflict.type,
      emailHash: conflict.emailHash,
      users: (conflict.userCards || []).map(user => ({
        idHash: user.idHash,
        role: user.role,
        roles: user.roles || [],
        telegramHash: user.telegramHash || null,
        firebaseUidHash: user.firebaseUidHash || null,
        canonicalUserIdHash: user.canonicalUserIdHash || null,
        keys: Number(user.keys || 0),
        referralCount: Number(user.referralCount || 0),
        profileScore: Number(user.completeness?.profileScore || 0),
      })),
      risk: conflict.risk,
      activity: (conflict.activity || []).filter(item => item.ok && Number(item.count || 0) > 0).map(item => ({ label: item.label, count: item.count })),
      authMapAliases: conflict.authMapAliases || [],
      identityLinks: conflict.identityLinks || [],
      tgLinks: conflict.tgLinks || [],
    });
  }
  return fingerprint({
    conflictId: conflict.conflictId,
    type: conflict.type,
    telegramIdHash: conflict.telegramIdHash,
    targetUserIdHash: conflict.targetUserIdHash || null,
    targetExists: Boolean(conflict.targetExists),
    sameTelegramProfileHashes: conflict.sameTelegramProfileHashes || [],
    authMapAliases: conflict.authMapAliases || [],
    identityLinks: conflict.identityLinks || [],
    risk: conflict.risk,
  });
}

export function decisionFingerprint(decision = {}) {
  return fingerprint({
    conflictId: decision.conflictId,
    decision: decision.decision,
    status: decision.status,
    reason: decision.reason,
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    evidence: decision.evidence || [],
    notes: decision.notes || '',
    sourceFingerprint: decision.sourceFingerprint,
    destructive: Boolean(decision.destructive),
    confirmationPhrase: decision.confirmationPhrase || null,
    secondReviewRequired: Boolean(decision.secondReviewRequired),
    secondReviewedBy: decision.secondReviewedBy || null,
    ownerOverride: Boolean(decision.ownerOverride),
    sourceIds: decision.sourceIds || [],
    sourceUserId: decision.sourceUserId || '',
    targetCanonicalId: decision.targetCanonicalId || '',
    targetUserId: decision.targetUserId || '',
    preservationPlan: decision.preservationPlan || null,
    telegramId: decision.telegramId || '',
    currentTarget: decision.currentTarget || '',
    newTarget: decision.newTarget || '',
    evidenceForTarget: decision.evidenceForTarget || [],
    reasonNoValidTargetExists: decision.reasonNoValidTargetExists || '',
    lastKnownReferences: decision.lastKnownReferences || [],
  });
}

export function createReviewDecision(conflict, input = {}) {
  const decision = String(input.decision || 'DEFER').trim().toUpperCase();
  const destructive = DESTRUCTIVE_DECISIONS.has(decision);
  const riskLevel = conflict?.risk?.level || 'LOW';
  const record = {
    conflictId: conflict.conflictId,
    decision,
    status: decision === 'DEFER' ? 'pending' : String(input.status || 'approved').trim().toLowerCase(),
    reason: String(input.reason || '').trim(),
    reviewedBy: String(input.reviewedBy || '').trim(),
    reviewedAt: input.reviewedAt || new Date().toISOString(),
    evidence: Array.isArray(input.evidence) ? input.evidence.map(item => String(item).trim()).filter(Boolean) : String(input.evidence || '').split(',').map(item => item.trim()).filter(Boolean),
    notes: String(input.notes || '').trim(),
    sourceFingerprint: sourceFingerprint(conflict),
    destructive,
    confirmationPhrase: destructive ? String(input.confirmationPhrase || '').trim() : null,
    secondReviewRequired: destructive || riskLevel === 'CRITICAL',
    secondReviewedBy: input.secondReviewedBy ? String(input.secondReviewedBy).trim() : null,
    secondReviewedAt: input.secondReviewedAt || null,
    ownerOverride: Boolean(input.ownerOverride),
    sourceIds: Array.isArray(input.sourceIds) ? input.sourceIds.map(item => String(item).trim()).filter(Boolean) : String(input.sourceIds || '').split(',').map(item => item.trim()).filter(Boolean),
    sourceUserId: String(input.sourceUserId || '').trim(),
    targetCanonicalId: String(input.targetCanonicalId || input.targetUserId || '').trim(),
    targetUserId: String(input.targetUserId || input.targetCanonicalId || '').trim(),
    preservationPlan: input.preservationPlan && typeof input.preservationPlan === 'object' ? input.preservationPlan : null,
    telegramId: String(input.telegramId || input.tgLinkId || '').trim(),
    currentTarget: String(input.currentTarget || '').trim(),
    newTarget: String(input.newTarget || input.targetCanonicalId || input.targetUserId || '').trim(),
    evidenceForTarget: Array.isArray(input.evidenceForTarget) ? input.evidenceForTarget.map(item => String(item).trim()).filter(Boolean) : String(input.evidenceForTarget || '').split(',').map(item => item.trim()).filter(Boolean),
    reasonNoValidTargetExists: String(input.reasonNoValidTargetExists || '').trim(),
    lastKnownReferences: Array.isArray(input.lastKnownReferences) ? input.lastKnownReferences.map(item => String(item).trim()).filter(Boolean) : String(input.lastKnownReferences || '').split(',').map(item => item.trim()).filter(Boolean),
  };
  record.decisionFingerprint = decisionFingerprint(record);
  return record;
}
