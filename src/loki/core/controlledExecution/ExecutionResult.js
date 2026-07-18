export const CONTROLLED_EXECUTION_STATUS = {
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  PENDING_CONFIRMATION: 'pending_confirmation',
};

export function buildControlledExecutionResult({ ready = false, blocked = false, confirmationRequired = false, reason = '', dispatch = null } = {}) {
  const status = blocked
    ? CONTROLLED_EXECUTION_STATUS.BLOCKED
    : confirmationRequired
      ? CONTROLLED_EXECUTION_STATUS.PENDING_CONFIRMATION
      : ready
        ? CONTROLLED_EXECUTION_STATUS.READY
        : CONTROLLED_EXECUTION_STATUS.BLOCKED;
  return {
    status,
    completed: false,
    cancelled: false,
    blocked: status === CONTROLLED_EXECUTION_STATUS.BLOCKED,
    failed: false,
    reason,
    dispatch,
    createdAt: new Date().toISOString(),
  };
}

export function completeControlledExecutionResult(previous = {}, patch = {}) {
  const status = patch.status || (patch.ok ? CONTROLLED_EXECUTION_STATUS.COMPLETED : CONTROLLED_EXECUTION_STATUS.FAILED);
  return {
    ...previous,
    ...patch,
    status,
    completed: status === CONTROLLED_EXECUTION_STATUS.COMPLETED,
    blocked: status === CONTROLLED_EXECUTION_STATUS.BLOCKED,
    failed: status === CONTROLLED_EXECUTION_STATUS.FAILED,
    cancelled: status === CONTROLLED_EXECUTION_STATUS.CANCELLED,
    completedAt: new Date().toISOString(),
  };
}

export class ExecutionResult {
  build(input = {}) {
    return buildControlledExecutionResult(input);
  }
}
