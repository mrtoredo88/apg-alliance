export const LOKI_DECISION_EVENTS = {
  CREATED: 'DECISION_CREATED',
  CONFIRMED: 'DECISION_CONFIRMED',
  EXPLAINED: 'DECISION_EXPLAINED',
  LOW_CONFIDENCE: 'DECISION_LOW_CONFIDENCE',
  ALTERNATIVE: 'DECISION_ALTERNATIVE',
  COMPLETED: 'DECISION_COMPLETED',
};

const MAX_DECISION_HISTORY = 80;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function decisionEvent(type, payload = {}) {
  return {
    type,
    decisionId: payload.decisionId || '',
    intent: payload.intent || '',
    confidence: Number(payload.confidence || 0),
    status: payload.status || 'ok',
    reason: payload.reason || '',
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

export function buildDecisionEvents(decision = {}) {
  const events = [
    decisionEvent(LOKI_DECISION_EVENTS.CREATED, decision),
    ...list(decision.alternatives).slice(0, 3).map(item => decisionEvent(LOKI_DECISION_EVENTS.ALTERNATIVE, { ...decision, reason: item.reason })),
  ];
  if (decision.confidence < 0.62) events.push(decisionEvent(LOKI_DECISION_EVENTS.LOW_CONFIDENCE, { ...decision, status: 'warning' }));
  if (decision.explained) events.push(decisionEvent(LOKI_DECISION_EVENTS.EXPLAINED, decision));
  events.push(decisionEvent(LOKI_DECISION_EVENTS.COMPLETED, decision));
  return events;
}

export function buildDecisionHistoryPatch(memory = {}, decisionContext = {}) {
  if (!decisionContext?.decisionId) return {};
  const item = {
    decisionId: decisionContext.decisionId,
    intent: decisionContext.intent,
    goal: decisionContext.goal,
    confidence: decisionContext.confidence,
    level: decisionContext.level,
    reason: decisionContext.reason,
    engines: decisionContext.trace?.engines || [],
    durationMs: decisionContext.duration,
    status: decisionContext.status,
    createdAt: decisionContext.createdAt,
  };
  return {
    decisionHistory: [item, ...list(memory.decisionHistory)].slice(0, MAX_DECISION_HISTORY),
  };
}
