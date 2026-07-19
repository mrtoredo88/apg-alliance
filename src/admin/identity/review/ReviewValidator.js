import { CONFIRMATION_PHRASE, DESTRUCTIVE_DECISIONS, REVIEW_DECISIONS, decisionFingerprint, sourceFingerprint } from './ReviewDecision.js';

const REQUIRED = ['conflictId', 'decision', 'status', 'reason', 'reviewedBy', 'reviewedAt', 'evidence', 'sourceFingerprint', 'decisionFingerprint'];

export function validateDecision(decision = {}, conflict = null) {
  const errors = [];
  const warnings = [];
  REQUIRED.forEach(field => {
    const value = decision[field];
    if (Array.isArray(value) ? value.length === 0 : !value) errors.push(`${decision.conflictId || 'unknown'} missing ${field}`);
  });
  if (!REVIEW_DECISIONS.has(decision.decision)) errors.push(`${decision.conflictId || 'unknown'} unknown decision type`);
  if (decision.decision === 'DEFER' && decision.status !== 'pending') errors.push(`${decision.conflictId} DEFER must stay pending`);
  if (decision.decision !== 'DEFER' && decision.status !== 'approved') errors.push(`${decision.conflictId} non-DEFER decision must be approved`);
  if (conflict) {
    const currentSource = sourceFingerprint(conflict);
    if (decision.sourceFingerprint !== currentSource) errors.push(`${decision.conflictId} sourceFingerprint mismatch`);
    if (decision.decisionFingerprint !== decisionFingerprint(decision)) errors.push(`${decision.conflictId} decisionFingerprint mismatch`);
    if ((conflict.risk?.level || '') === 'CRITICAL' && decision.decision !== 'DEFER' && !decision.secondReviewedBy && !decision.ownerOverride) {
      errors.push(`${decision.conflictId} CRITICAL conflict requires second review or owner override`);
    }
  }
  if (DESTRUCTIVE_DECISIONS.has(decision.decision)) {
    if (decision.confirmationPhrase !== CONFIRMATION_PHRASE) errors.push(`${decision.conflictId} destructive decision missing confirmation phrase`);
    if (!decision.secondReviewRequired) errors.push(`${decision.conflictId} destructive decision must require second review`);
  }
  if (decision.decision === 'REMAP_TG_LINK' && !decision.targetCanonicalId) errors.push(`${decision.conflictId} tgLink remap requires targetCanonicalId`);
  if ((decision.decision === 'MERGE_INTO_A' || decision.decision === 'MERGE_INTO_B') && decision.targetCanonicalId && (decision.sourceIds || []).includes(decision.targetCanonicalId)) {
    errors.push(`${decision.conflictId} merge target cannot also be listed as source`);
  }
  if (decision.status === 'stale') errors.push(`${decision.conflictId} stale decision cannot be exported`);
  if (errors.length && decision.decision !== 'DEFER') warnings.push(`${decision.conflictId} decision is not executable and remains documentation only`);
  return { valid: errors.length === 0, errors, warnings };
}

export function validateReviewSession(session = {}) {
  const errors = [];
  const warnings = [];
  const conflicts = new Map((session.conflicts || []).map(conflict => [conflict.conflictId, conflict]));
  const seen = new Set();
  for (const decision of session.decisions || []) {
    if (seen.has(decision.conflictId)) errors.push(`${decision.conflictId} duplicate decision`);
    seen.add(decision.conflictId);
    const conflict = conflicts.get(decision.conflictId);
    if (!conflict) {
      errors.push(`${decision.conflictId} unknown conflictId`);
      continue;
    }
    const result = validateDecision(decision, conflict);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  for (const conflict of conflicts.values()) {
    if (!seen.has(conflict.conflictId)) errors.push(`${conflict.conflictId} unresolved conflict`);
  }
  for (const decision of session.decisions || []) {
    if (decision.decision === 'DEFER' || decision.status === 'pending') errors.push(`${decision.conflictId} unresolved conflict`);
  }
  const approved = (session.decisions || []).filter(item => item.status === 'approved');
  const bySource = new Map();
  for (const action of approved) {
    for (const source of action.sourceIds || []) {
      const previous = bySource.get(source);
      if (previous && previous !== action.targetCanonicalId) errors.push(`${action.conflictId} source user directed to multiple targets`);
      bySource.set(source, action.targetCanonicalId);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unresolvedConflicts: (session.decisions || []).filter(item => item.decision === 'DEFER' || item.status !== 'approved').map(item => item.conflictId),
    staleDecisions: (session.decisions || []).filter(item => {
      const conflict = conflicts.get(item.conflictId);
      return conflict && item.sourceFingerprint !== sourceFingerprint(conflict);
    }).map(item => item.conflictId),
  };
}
