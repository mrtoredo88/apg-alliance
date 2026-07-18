export function validateDecision(decision = {}) {
  if (!decision.decisionId) return { ok: false, reason: 'missing_decision_id' };
  if (!decision.intent) return { ok: false, reason: 'missing_intent' };
  if (!decision.trace?.engines?.length) return { ok: false, reason: 'missing_trace' };
  if (!Number.isFinite(Number(decision.confidence))) return { ok: false, reason: 'invalid_confidence' };
  return { ok: true, reason: '' };
}
