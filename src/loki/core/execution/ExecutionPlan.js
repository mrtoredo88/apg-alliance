function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function planStep(id, title, kind, payload = {}) {
  return { id, title, kind, status: 'planned', ...payload };
}

export function buildExecutionPlan(resolution = {}) {
  const rows = list(resolution.executionOrder);
  const steps = rows.flatMap(row => {
    const prefix = `${row.order}-${row.capability}`;
    return [
      row.plannerGoal ? planStep(`${prefix}-planner`, 'Planner', 'planner', { plannerGoal: row.plannerGoal }) : null,
      row.workflowId ? planStep(`${prefix}-workflow`, 'Workflow', 'workflow', { workflowId: row.workflowId }) : null,
      ...list(row.toolIds).map(toolId => planStep(`${prefix}-tool-${toolId}`, 'Tool', 'tool', { toolId })),
      row.navigation ? planStep(`${prefix}-navigation`, 'Navigation', 'navigation', { navigation: row.navigation }) : null,
      row.actionId || row.actionType ? planStep(`${prefix}-action`, 'Action Center', 'actionCenter', { actionId: row.actionId, actionType: row.actionType }) : null,
      row.missingParameters?.length ? planStep(`${prefix}-clarify`, 'Clarification', 'clarification', { missingParameters: row.missingParameters }) : null,
    ].filter(Boolean);
  });
  return {
    capability: resolution.capability || '',
    ready: Boolean(resolution.ready),
    reason: resolution.reason || '',
    clarificationQuestion: resolution.clarificationQuestion || '',
    steps,
    order: rows.map(row => row.capability),
  };
}

export class ExecutionPlan {
  constructor(resolution = {}) {
    Object.assign(this, buildExecutionPlan(resolution));
  }
}
