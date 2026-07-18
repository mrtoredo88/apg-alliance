import { sessionFromMemory } from './AgentSession.js';

export function buildAgentSnapshot(memory = {}) {
  const session = sessionFromMemory(memory);
  return {
    version: 'v1',
    source: 'local',
    empty: !memory?.lastAgentSession && !memory?.agentSession,
    session: {
      sessionId: session.sessionId,
      currentGoal: session.currentGoal,
      currentWorkflow: session.currentWorkflow,
      currentPlan: session.currentPlan,
      lastDecision: session.lastDecision,
      waitingForUser: session.waitingForUser,
      pendingConfirmation: session.pendingConfirmation,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
  };
}

export function summarizeAgentSnapshot(snapshot = null) {
  if (!snapshot || snapshot.empty) return null;
  return {
    sessionId: snapshot.session?.sessionId || '',
    currentGoal: snapshot.session?.currentGoal || '',
    workflowId: snapshot.session?.currentWorkflow?.workflowId || '',
    waitingForUser: Boolean(snapshot.session?.waitingForUser),
    pendingAction: snapshot.session?.pendingConfirmation?.action?.type || '',
  };
}
