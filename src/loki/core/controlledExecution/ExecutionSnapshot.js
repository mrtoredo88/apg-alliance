export function buildControlledExecutionSnapshot(context = {}) {
  return {
    version: 'v1',
    source: 'local',
    Capability: context.capability || '',
    Ready: Boolean(context.executionReady),
    Policy: context.policy?.policy || '',
    Confirmation: Boolean(context.confirmationRequired),
    ConfirmationStatus: context.confirmation?.status || '',
    ConfirmationExecutionId: context.confirmation?.executionId || '',
    Dispatcher: context.dispatcher?.dispatcher || '',
    Preview: context.preview?.text || '',
    Result: context.result?.status || '',
    Reason: context.result?.reason || context.guard?.reason || '',
    ActionType: context.dispatcher?.action?.type || '',
    createdAt: context.createdAt || new Date().toISOString(),
    empty: !context.capability,
  };
}

export class ExecutionSnapshot {
  constructor(context = {}) {
    Object.assign(this, buildControlledExecutionSnapshot(context));
  }
}
