import { summarizeWorkflowSnapshot } from './WorkflowSnapshot.js';
import { WORKFLOW_STEP_STATES } from './WorkflowState.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function paramsForStep(step = {}, question = '') {
  if (step.params) return { ...step.params };
  if (step.paramsFromQuestion) return { query: question };
  return {};
}

export function buildWorkflowPlan({ workflow = {}, question = '', plannerResult = null, snapshot = null } = {}) {
  const previous = snapshot?.active?.workflowId === workflow.id ? new Set(snapshot.completedSteps || []) : new Set();
  const steps = list(workflow.steps).map(step => ({
    id: step.id,
    title: step.title,
    kind: step.kind,
    tool: step.kind === 'tool' ? step.toolId : '',
    toolId: step.toolId || '',
    actionId: step.actionId || '',
    status: previous.has(step.id) ? WORKFLOW_STEP_STATES.SKIPPED : WORKFLOW_STEP_STATES.PENDING,
    dependencies: list(step.dependencies),
    optional: Boolean(step.optional),
    result: previous.has(step.id) ? { skipped: true, source: 'workflowSnapshot' } : null,
    params: paramsForStep(step, question),
  }));
  return {
    id: `workflow-${workflow.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workflowId: workflow.id,
    title: workflow.title,
    goal: plannerResult?.planContext?.goal || workflow.goals?.[0] || 'GENERAL',
    plannerId: plannerResult?.planContext?.id || '',
    query: question,
    snapshot: summarizeWorkflowSnapshot(snapshot),
    steps,
    createdAt: new Date().toISOString(),
  };
}
