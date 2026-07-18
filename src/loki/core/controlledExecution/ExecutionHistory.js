const MAX_CONTROLLED_EXECUTION_HISTORY = 100;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addControlledExecutionHistoryItem(history = [], context = {}) {
  if (!context?.capability) return list(history).slice(0, MAX_CONTROLLED_EXECUTION_HISTORY);
  const item = {
    id: context.id || `controlled-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    capability: context.capability,
    policy: context.policy?.policy || context.policy || '',
    ready: Boolean(context.executionReady),
    confirmationRequired: Boolean(context.confirmationRequired),
    confirmationStatus: context.confirmation?.status || '',
    dispatcher: context.dispatcher?.dispatcher || '',
    resultStatus: context.result?.status || '',
    reason: context.result?.reason || context.guard?.reason || '',
    createdAt: context.createdAt || new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_CONTROLLED_EXECUTION_HISTORY);
}

export function buildControlledExecutionHistoryPatch(memory = {}, context = {}) {
  return {
    controlledExecutionHistory: addControlledExecutionHistoryItem(memory.controlledExecutionHistory, context),
  };
}

export class ExecutionHistory {
  constructor(history = []) {
    this.history = list(history).slice(0, MAX_CONTROLLED_EXECUTION_HISTORY);
  }

  add(context = {}) {
    this.history = addControlledExecutionHistoryItem(this.history, context);
    return this.history;
  }
}
