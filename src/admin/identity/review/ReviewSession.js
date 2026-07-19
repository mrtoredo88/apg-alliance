import { createReviewDecision } from './ReviewDecision.js';
import { validateReviewSession } from './ReviewValidator.js';

export function createReviewSession({ conflicts = [], reviewer = '', sourceReportPath = '' } = {}) {
  const generatedAt = new Date().toISOString();
  const decisions = conflicts.map(conflict => createReviewDecision(conflict, {
    decision: 'DEFER',
    status: 'pending',
    reason: 'Awaiting explicit owner decision.',
    reviewedBy: reviewer || 'system:pending-review',
    reviewedAt: generatedAt,
    evidence: ['manual_review_required'],
  }));
  const session = {
    version: 1,
    generatedAt,
    sourceReportPath,
    reviewer: reviewer || null,
    conflicts,
    decisions,
    importAllowed: false,
  };
  session.validation = validateReviewSession(session);
  return session;
}

export function upsertDecision(session = {}, conflictId = '', input = {}) {
  const conflict = (session.conflicts || []).find(item => item.conflictId === conflictId);
  if (!conflict) throw new Error(`Unknown conflictId: ${conflictId}`);
  const decision = createReviewDecision(conflict, input);
  const decisions = (session.decisions || []).filter(item => item.conflictId !== conflictId);
  const next = { ...session, decisions: [...decisions, decision], updatedAt: new Date().toISOString(), importAllowed: false };
  next.validation = validateReviewSession(next);
  return next;
}

export function sessionSummary(session = {}) {
  const decisions = session.decisions || [];
  const validation = session.validation || validateReviewSession(session);
  const approved = decisions.filter(item => item.status === 'approved').length;
  const deferred = decisions.filter(item => item.decision === 'DEFER' || item.status === 'pending').length;
  const destructive = decisions.filter(item => item.destructive).length;
  const stale = validation.staleDecisions?.length || 0;
  const reviewComplete = decisions.length === (session.conflicts || []).length
    && deferred === 0
    && stale === 0
    && validation.valid;
  return {
    total: (session.conflicts || []).length,
    approved,
    deferred,
    pending: deferred,
    stale,
    destructive,
    reviewComplete,
    importAllowed: false,
  };
}
