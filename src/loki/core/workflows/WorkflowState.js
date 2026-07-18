export const WORKFLOW_STATES = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  WAITING_USER: 'WAITING_USER',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export const WORKFLOW_STEP_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  WAITING_USER: 'waiting_user',
};

export function isTerminalWorkflowState(status) {
  return [WORKFLOW_STATES.COMPLETED, WORKFLOW_STATES.FAILED, WORKFLOW_STATES.CANCELLED].includes(status);
}
