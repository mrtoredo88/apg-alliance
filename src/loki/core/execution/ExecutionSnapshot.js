function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildExecutionSnapshot(executionContext = {}) {
  return {
    version: 'v1',
    source: 'local',
    Capability: executionContext.capability || '',
    ExecutionPlan: executionContext.executionPlan?.order || [],
    Planner: executionContext.planner || '',
    Workflow: executionContext.workflow || '',
    Navigation: executionContext.navigation?.screen || '',
    NavigationPath: executionContext.navigation?.path || '',
    Tools: list(executionContext.tools),
    ActionCenter: executionContext.actionId || executionContext.actionType || '',
    ResolvedParameters: executionContext.resolved || {},
    Missing: list(executionContext.missing),
    Ready: Boolean(executionContext.validation?.ready ?? executionContext.ready),
    Reason: executionContext.reason || '',
    Clarification: executionContext.clarificationQuestion || '',
    HistoryReady: true,
    createdAt: executionContext.createdAt || new Date().toISOString(),
    empty: !executionContext.capability,
  };
}

export class ExecutionSnapshot {
  constructor(context = {}) {
    Object.assign(this, buildExecutionSnapshot(context));
  }
}
