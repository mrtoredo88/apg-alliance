const MAX_EXECUTION_HISTORY = 100;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addExecutionHistoryItem(history = [], executionContext = {}) {
  if (!executionContext?.capability) return list(history).slice(0, MAX_EXECUTION_HISTORY);
  const item = {
    id: executionContext.id || `execution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    capability: executionContext.capability,
    execution: executionContext.execution || '',
    planner: executionContext.planner || '',
    workflow: executionContext.workflow || '',
    navigation: executionContext.navigation?.screen || '',
    ready: Boolean(executionContext.validation?.ready ?? executionContext.ready),
    missing: list(executionContext.missing),
    order: list(executionContext.executionOrder).map(row => row.capability).filter(Boolean),
    createdAt: executionContext.createdAt || new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_EXECUTION_HISTORY);
}

export function buildExecutionHistoryPatch(memory = {}, executionContext = {}) {
  return {
    executionHistory: addExecutionHistoryItem(memory.executionHistory, executionContext),
  };
}

export class ExecutionHistory {
  constructor(history = []) {
    this.history = list(history).slice(0, MAX_EXECUTION_HISTORY);
  }

  add(context = {}) {
    this.history = addExecutionHistoryItem(this.history, context);
    return this.history;
  }
}
