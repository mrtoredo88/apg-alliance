import { WORKFLOW_STATES, WORKFLOW_STEP_STATES } from './WorkflowState.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function stepDone(step = {}) {
  return [WORKFLOW_STEP_STATES.COMPLETED, WORKFLOW_STEP_STATES.SKIPPED].includes(step.status);
}

export function buildWorkflowProgress({ steps = [], status = WORKFLOW_STATES.CREATED, startedAt = null, updatedAt = null, finishedAt = null } = {}) {
  const rows = list(steps);
  const completedSteps = rows.filter(stepDone).map(step => step.id);
  const remainingSteps = rows.filter(step => !stepDone(step) && step.status !== WORKFLOW_STEP_STATES.FAILED).map(step => step.id);
  const currentStep = rows.find(step => [WORKFLOW_STEP_STATES.RUNNING, WORKFLOW_STEP_STATES.WAITING_USER, WORKFLOW_STEP_STATES.FAILED].includes(step.status))
    || rows.find(step => !stepDone(step))
    || null;
  const total = Math.max(1, rows.length);
  return {
    currentStep,
    completedSteps,
    remainingSteps,
    progress: Math.round((completedSteps.length / total) * 100),
    status,
    startedAt,
    updatedAt,
    finishedAt,
  };
}
