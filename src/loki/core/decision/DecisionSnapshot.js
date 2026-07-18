function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildDecisionSnapshot(memory = {}) {
  const source = memory.lastDecisionContext || memory.decisionSnapshot || null;
  return {
    version: 'v1',
    source: 'local',
    decisionId: source?.decisionId || '',
    intent: source?.intent || '',
    goal: source?.goal || '',
    confidence: Number(source?.confidence || 0),
    level: source?.level || '',
    reason: source?.reason || '',
    alternatives: list(source?.alternatives).slice(0, 5),
    trace: source?.trace || null,
    empty: !source?.decisionId,
  };
}
