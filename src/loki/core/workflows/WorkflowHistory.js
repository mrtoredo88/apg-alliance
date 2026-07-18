export const LOKI_WORKFLOW_EVENTS = {
  CREATED: 'WORKFLOW_CREATED',
  SELECTED: 'WORKFLOW_SELECTED',
  STARTED: 'WORKFLOW_STARTED',
  STEP_STARTED: 'WORKFLOW_STEP_STARTED',
  STEP_COMPLETED: 'WORKFLOW_STEP_COMPLETED',
  WAITING_USER: 'WORKFLOW_WAITING_USER',
  COMPLETED: 'WORKFLOW_COMPLETED',
  CANCELLED: 'WORKFLOW_CANCELLED',
  FAILED: 'WORKFLOW_FAILED',
};

const MAX_WORKFLOW_HISTORY = 32;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function workflowEvent(type, patch = {}) {
  return {
    type,
    status: patch.status || '',
    workflowId: patch.workflowId || '',
    workflowRunId: patch.workflowRunId || '',
    stepId: patch.stepId || '',
    reason: patch.reason || '',
    createdAt: patch.createdAt || new Date().toISOString(),
    ...patch,
  };
}

export function addWorkflowHistoryItem(history = [], workflowContext = {}) {
  if (!workflowContext?.id) return list(history).slice(0, MAX_WORKFLOW_HISTORY);
  const progress = workflowContext.progress || {};
  const item = {
    id: workflowContext.id,
    workflowId: workflowContext.workflowId,
    title: workflowContext.title,
    status: workflowContext.status,
    durationMs: Number(workflowContext.durationMs || 0),
    completed: list(progress.completedSteps).length,
    total: list(workflowContext.steps).length,
    lastSuccessfulStep: list(progress.completedSteps).at(-1) || '',
    errorReason: workflowContext.errorReason || '',
    startedAt: progress.startedAt || workflowContext.startedAt || '',
    finishedAt: progress.finishedAt || workflowContext.finishedAt || '',
    createdAt: new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_WORKFLOW_HISTORY);
}

export function buildWorkflowHistoryPatch(memory = {}, workflowContext = {}) {
  return { workflowHistory: addWorkflowHistoryItem(memory.workflowHistory, workflowContext) };
}
