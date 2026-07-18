import { WORKFLOW_STATES } from '../workflows/WorkflowState.js';
import { detectAgentConfirmation } from './AgentConfirmation.js';

export function resolveAgentContinuation({ question = '', snapshot = null } = {}) {
  const session = snapshot?.session || null;
  const confirmation = detectAgentConfirmation(question);
  if (!session?.waitingForUser || !session?.currentWorkflow || confirmation.type === 'none') return null;
  const workflowContext = session.currentWorkflow ? {
    id: session.currentWorkflow.id,
    workflowId: session.currentWorkflow.workflowId,
    title: session.currentWorkflow.title,
    status: confirmation.type === 'cancel' ? WORKFLOW_STATES.CANCELLED : WORKFLOW_STATES.WAITING_USER,
    progress: { currentStep: session.currentWorkflow.currentStep || null },
  } : null;
  return {
    type: confirmation.type,
    confidence: confirmation.confidence,
    session,
    workflowContext,
    pendingConfirmation: session.pendingConfirmation || null,
  };
}
