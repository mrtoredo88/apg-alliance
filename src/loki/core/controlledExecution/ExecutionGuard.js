import { getToolDefinition } from '../tools/ToolRegistry.js';
import { getActionDefinition } from '../actions/ActionRegistry.js';
import { validateLokiAction } from '../actions/ActionValidator.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasRole(role = 'user', required = 'user') {
  if (!required || required === 'user') return true;
  if (role === required) return true;
  if (required === 'partner' && ['partner', 'expert', 'owner', 'admin'].includes(role)) return true;
  if (required === 'admin' && role === 'admin') return true;
  return false;
}

export function guardControlledExecution({
  executionContext = {},
  policy = {},
  dispatch = {},
  context = {},
  appState = {},
  appActions = null,
} = {}) {
  const checks = [];
  const role = context?.actor?.role || appState?.user?.role || 'user';
  const requiredRole = executionContext.capabilityContext?.bestCapability?.requiredRole || executionContext.capabilityContext?.requiredRole || 'user';
  const roleOk = hasRole(role, requiredRole);
  checks.push({ id: 'role', ok: roleOk, role, requiredRole });
  const parametersOk = !executionContext.missing?.length;
  checks.push({ id: 'required_parameters', ok: parametersOk, missing: executionContext.missing || [] });
  const plannerOk = !executionContext.planner || Boolean(executionContext.planner);
  checks.push({ id: 'planner_readiness', ok: plannerOk, planner: executionContext.planner || '' });
  const workflowOk = !executionContext.workflow || Boolean(executionContext.workflow);
  checks.push({ id: 'workflow_readiness', ok: workflowOk, workflow: executionContext.workflow || '' });
  const tools = list(executionContext.tools);
  const missingTools = tools.filter(toolId => !getToolDefinition(toolId));
  checks.push({ id: 'tool_availability', ok: missingTools.length === 0, tools, missingTools });
  const navigationOk = Boolean(executionContext.navigation?.screen || dispatch.action || executionContext.capability === 'OPEN_HOME');
  checks.push({ id: 'navigation_availability', ok: navigationOk, navigation: executionContext.navigation || null });
  let actionValidation = { ok: true, reason: '' };
  if (dispatch.action) actionValidation = validateLokiAction(dispatch.action, { appState, appActions, actor: context?.actor || {} });
  else if (executionContext.actionId) actionValidation = getActionDefinition(executionContext.actionId) ? { ok: true, reason: '' } : { ok: false, reason: 'Action Center action is unavailable.' };
  if (!actionValidation.ok && dispatch.action?.type && appActions && typeof appActions[dispatch.action.type] === 'function') {
    actionValidation = { ok: true, reason: 'existing_app_action_handler', action: dispatch.action };
  }
  checks.push({ id: 'dispatcher_action', ok: actionValidation.ok, reason: actionValidation.reason || '', actionType: dispatch.action?.type || executionContext.actionType || '' });
  const policyOk = policy.policy !== 'BLOCK';
  checks.push({ id: 'policy', ok: policyOk, policy: policy.policy, reason: policy.reason });
  const failed = checks.find(item => !item.ok);
  return {
    ok: !failed,
    reason: failed?.reason || failed?.id || '',
    checks,
  };
}

export class ExecutionGuard {
  check(input = {}) {
    return guardControlledExecution(input);
  }
}
