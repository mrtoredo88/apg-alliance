import { getCapabilityById } from '../capabilities/CapabilityRegistry.js';
import { getToolDefinition } from '../tools/ToolRegistry.js';
import { getWorkflowDefinition } from '../workflows/WorkflowRegistry.js';
import { getActionDefinition } from '../actions/ActionRegistry.js';
import { PLANNER_GOALS } from '../planner/GoalResolver.js';
import { getExecutionDefinition } from './ExecutionRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

const PLANNER_GOAL_VALUES = new Set(Object.values(PLANNER_GOALS));

export function validateExecutionContext(executionContext = {}) {
  const errors = [];
  const warnings = [];
  const capability = getCapabilityById(executionContext.capability);
  const execution = getExecutionDefinition(executionContext.capability);
  if (!capability) errors.push('capability_missing');
  if (!execution) errors.push('execution_definition_missing');
  if (execution && execution.navigation && !execution.navigation.screen) errors.push('route_missing');
  list(executionContext.tools).forEach(toolId => {
    if (!getToolDefinition(toolId)) errors.push(`tool_missing:${toolId}`);
  });
  if (executionContext.workflow && !getWorkflowDefinition(executionContext.workflow)) errors.push(`workflow_missing:${executionContext.workflow}`);
  if (executionContext.planner && !PLANNER_GOAL_VALUES.has(executionContext.planner)) errors.push(`planner_missing:${executionContext.planner}`);
  if (executionContext.actionId && !getActionDefinition(executionContext.actionId)) errors.push(`action_missing:${executionContext.actionId}`);
  if (executionContext.missing?.length) warnings.push(`missing_parameters:${executionContext.missing.join(',')}`);
  return {
    ok: errors.length === 0,
    ready: errors.length === 0 && !executionContext.missing?.length && Boolean(executionContext.ready),
    errors,
    warnings,
  };
}

export class ExecutionValidator {
  validate(context = {}) {
    return validateExecutionContext(context);
  }
}
