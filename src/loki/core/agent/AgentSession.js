import { AGENT_DECISIONS } from './AgentDecision.js';

function nowIso() {
  return new Date().toISOString();
}

function makeSessionId() {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAgentSession(patch = {}) {
  const now = nowIso();
  return {
    sessionId: patch.sessionId || makeSessionId(),
    currentGoal: patch.currentGoal || '',
    currentWorkflow: patch.currentWorkflow || null,
    currentPlan: patch.currentPlan || null,
    lastDecision: patch.lastDecision || null,
    waitingForUser: Boolean(patch.waitingForUser),
    pendingConfirmation: patch.pendingConfirmation || null,
    createdAt: patch.createdAt || now,
    updatedAt: patch.updatedAt || now,
  };
}

export function normalizeAgentSession(session = null) {
  if (!session?.sessionId) return createAgentSession();
  return createAgentSession({
    ...session,
    updatedAt: session.updatedAt || nowIso(),
  });
}

export function sessionFromMemory(memory = {}) {
  return normalizeAgentSession(memory.lastAgentSession || memory.agentSession || null);
}

export function updateAgentSession(session = {}, { decision = null, result = null, pendingConfirmation = null, waitingForUser = null } = {}) {
  const workflowContext = result?.workflowContext || decision?.targetWorkflow || session.currentWorkflow || null;
  return {
    ...normalizeAgentSession(session),
    currentGoal: result?.planContext?.goal || workflowContext?.goal || session.currentGoal || '',
    currentWorkflow: workflowContext ? {
      id: workflowContext.id,
      workflowId: workflowContext.workflowId,
      title: workflowContext.title,
      status: workflowContext.status,
      currentStep: workflowContext.progress?.currentStep || null,
    } : session.currentWorkflow || null,
    currentPlan: result?.planContext ? {
      id: result.planContext.id,
      goal: result.planContext.goal,
      status: result.planContext.status,
    } : session.currentPlan || null,
    lastDecision: decision ? { type: decision.type, mode: decision.mode, reason: decision.reason, createdAt: decision.createdAt } : session.lastDecision || null,
    waitingForUser: waitingForUser ?? (decision?.type === AGENT_DECISIONS.ASK_CONFIRMATION || decision?.type === AGENT_DECISIONS.WAIT_USER),
    pendingConfirmation: pendingConfirmation === undefined ? session.pendingConfirmation || null : pendingConfirmation,
    updatedAt: new Date().toISOString(),
  };
}
