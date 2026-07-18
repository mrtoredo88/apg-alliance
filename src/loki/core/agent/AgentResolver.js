import { AGENT_DECISIONS, AGENT_MODES, makeAgentDecision } from './AgentDecision.js';

function hasWorkflow(result = {}) {
  return Boolean(result?.workflowContext?.id);
}

function hasTool(result = {}) {
  return Boolean(result?.toolContext?.call || result?.toolContext?.events?.length);
}

export function resolveAgentDecision({ result = null, agentContext = {}, continuation = null } = {}) {
  if (continuation?.type === 'confirm') {
    return makeAgentDecision(AGENT_DECISIONS.CONTINUE_WORKFLOW, {
      mode: AGENT_MODES.CONTINUATION,
      reason: 'пользователь подтвердил активный workflow',
      pendingAction: continuation.pendingConfirmation || null,
      targetWorkflow: continuation.workflowContext || null,
    });
  }
  if (continuation?.type === 'cancel') {
    return makeAgentDecision(AGENT_DECISIONS.FINISH, {
      mode: AGENT_MODES.FINISHED,
      reason: 'пользователь отменил активный workflow',
      targetWorkflow: continuation.workflowContext || null,
    });
  }
  if (hasWorkflow(result)) {
    const waiting = result.workflowContext.status === 'WAITING_USER';
    const pendingAction = agentContext.pendingAction || null;
    if (waiting) {
      return makeAgentDecision(AGENT_DECISIONS.ASK_CONFIRMATION, {
        mode: AGENT_MODES.CONFIRMATION,
        reason: 'workflow дошёл до пользовательского действия',
        requiresConfirmation: true,
        pendingAction,
        currentStep: result.workflowContext.progress?.currentStep || null,
        targetWorkflow: result.workflowContext,
      });
    }
    return makeAgentDecision(AGENT_DECISIONS.START_WORKFLOW, {
      mode: AGENT_MODES.WORKFLOW,
      reason: 'Planner выбрал workflow-сценарий',
      targetWorkflow: result.workflowContext,
    });
  }
  if (hasTool(result)) {
    return makeAgentDecision(AGENT_DECISIONS.RUN_TOOL, {
      mode: AGENT_MODES.TOOL,
      reason: 'достаточно существующего Tool Layer',
    });
  }
  return makeAgentDecision(AGENT_DECISIONS.RESPOND, {
    mode: AGENT_MODES.PASSIVE,
    reason: 'достаточно обычного ответа',
  });
}
