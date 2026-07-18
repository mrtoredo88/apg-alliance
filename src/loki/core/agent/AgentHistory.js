export const LOKI_AGENT_EVENTS = {
  SESSION_CREATED: 'AGENT_SESSION_CREATED',
  DECISION: 'AGENT_DECISION',
  CONTINUED: 'AGENT_CONTINUED',
  WAITING: 'AGENT_WAITING',
  CONFIRMATION_REQUESTED: 'AGENT_CONFIRMATION_REQUESTED',
  CONFIRMED: 'AGENT_CONFIRMED',
  CANCELLED: 'AGENT_CANCELLED',
  FINISHED: 'AGENT_FINISHED',
  SAFETY_BLOCKED: 'AGENT_SAFETY_BLOCKED',
};

const MAX_AGENT_HISTORY = 40;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function agentEvent(type, patch = {}) {
  return {
    type,
    sessionId: patch.sessionId || '',
    decision: patch.decision || '',
    workflowId: patch.workflowId || '',
    reason: patch.reason || '',
    status: patch.status || '',
    createdAt: patch.createdAt || new Date().toISOString(),
    ...patch,
  };
}

export function addAgentHistoryItem(history = [], agentContext = {}) {
  if (!agentContext?.session?.sessionId && !agentContext?.decision?.type) return list(history).slice(0, MAX_AGENT_HISTORY);
  const item = {
    id: `${agentContext.session?.sessionId || 'agent'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: agentContext.session?.sessionId || '',
    decision: agentContext.decision?.type || '',
    mode: agentContext.decision?.mode || '',
    workflowId: agentContext.session?.currentWorkflow?.workflowId || agentContext.workflowContext?.workflowId || '',
    waitingForUser: Boolean(agentContext.session?.waitingForUser),
    reason: agentContext.decision?.reason || '',
    durationMs: Number(agentContext.durationMs || 0),
    createdAt: new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_AGENT_HISTORY);
}

export function buildAgentHistoryPatch(memory = {}, agentContext = {}) {
  return { agentHistory: addAgentHistoryItem(memory.agentHistory, agentContext) };
}
