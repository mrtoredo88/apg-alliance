import { fingerprint } from './ReviewDecision.js';
import { sessionSummary } from './ReviewSession.js';
import { validateReviewSession } from './ReviewValidator.js';

export function buildResolutionManifestV2(session = {}, { sourceAudit = '' } = {}) {
  const validation = validateReviewSession(session);
  const summary = sessionSummary({ ...session, validation });
  const approved = (session.decisions || []).filter(item => item.status === 'approved' && item.decision !== 'DEFER');
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceAudit,
    sourceFingerprint: fingerprint((session.conflicts || []).map(item => ({ conflictId: item.conflictId, risk: item.risk, recommendation: item.recommendation }))),
    reviewSession: session.id || session.generatedAt || '',
    summary: {
      total: summary.total,
      approved: summary.approved,
      deferred: summary.deferred,
      stale: summary.stale,
      destructive: summary.destructive,
    },
    actions: approved,
    unresolvedConflicts: validation.unresolvedConflicts || [],
    staleDecisions: validation.staleDecisions || [],
    validation,
    reviewComplete: summary.reviewComplete,
    importAllowed: false,
  };
}
