const MAX_PLAN_HISTORY = 24;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addPlanHistoryItem(history = [], planContext = {}) {
  if (!planContext?.id) return list(history).slice(0, MAX_PLAN_HISTORY);
  const item = {
    id: planContext.id,
    goal: planContext.goal,
    status: planContext.status,
    durationMs: Number(planContext.durationMs || 0),
    completed: list(planContext.completed).length,
    failed: list(planContext.failed).length,
    createdAt: new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_PLAN_HISTORY);
}

export function buildPlanHistoryPatch(memory = {}, planContext = {}) {
  return { planHistory: addPlanHistoryItem(memory.planHistory, planContext) };
}
