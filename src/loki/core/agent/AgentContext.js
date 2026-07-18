import { summarizeAgentSnapshot } from './AgentSnapshot.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildAgentContext({ question = '', result = null, snapshot = null, continuation = null } = {}) {
  const workflowContext = result?.workflowContext || continuation?.workflowContext || null;
  const planContext = result?.planContext || null;
  const toolContext = result?.toolContext || null;
  const pending = list(workflowContext?.expectedUserActions)[0] || null;
  return {
    version: 'v1',
    question,
    snapshot: summarizeAgentSnapshot(snapshot),
    workflowContext,
    planContext,
    toolContext,
    pendingAction: pending ? { label: pending.title, actionId: pending.actionId, action: null, stepId: pending.id } : null,
    continuation,
  };
}
