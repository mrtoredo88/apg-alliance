import { AGENT_DECISIONS } from './AgentDecision.js';
import { LOKI_AGENT_EVENTS, agentEvent } from './AgentHistory.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function eventForDecision(decision = {}, session = {}) {
  if (decision.type === AGENT_DECISIONS.CONTINUE_WORKFLOW) return LOKI_AGENT_EVENTS.CONTINUED;
  if (decision.type === AGENT_DECISIONS.ASK_CONFIRMATION) return LOKI_AGENT_EVENTS.CONFIRMATION_REQUESTED;
  if (decision.type === AGENT_DECISIONS.WAIT_USER) return LOKI_AGENT_EVENTS.WAITING;
  if (decision.type === AGENT_DECISIONS.FINISH) return LOKI_AGENT_EVENTS.FINISHED;
  return LOKI_AGENT_EVENTS.DECISION;
}

export function applyAgentDecision({ result = null, decision = {}, session = {}, safety = {} } = {}) {
  const events = [
    ...(session?.createdNow ? [agentEvent(LOKI_AGENT_EVENTS.SESSION_CREATED, { sessionId: session.sessionId, status: 'created' })] : []),
    agentEvent(eventForDecision(decision, session), {
      sessionId: session.sessionId,
      decision: decision.type,
      workflowId: decision.targetWorkflow?.workflowId || session.currentWorkflow?.workflowId || '',
      reason: decision.reason,
      status: safety.ok === false ? 'blocked' : 'ok',
      safety: list(safety.checks),
    }),
  ];
  if (safety.ok === false) {
    events.push(agentEvent(LOKI_AGENT_EVENTS.SAFETY_BLOCKED, {
      sessionId: session.sessionId,
      decision: decision.type,
      workflowId: decision.targetWorkflow?.workflowId || '',
      reason: safety.reason,
      status: 'blocked',
    }));
  }
  return {
    ...(result || {}),
    agentEvents: events,
  };
}
