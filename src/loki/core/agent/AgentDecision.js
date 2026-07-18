export const AGENT_DECISIONS = {
  RESPOND: 'RESPOND',
  RUN_TOOL: 'RUN_TOOL',
  START_WORKFLOW: 'START_WORKFLOW',
  CONTINUE_WORKFLOW: 'CONTINUE_WORKFLOW',
  ASK_CONFIRMATION: 'ASK_CONFIRMATION',
  WAIT_USER: 'WAIT_USER',
  FINISH: 'FINISH',
};

export const AGENT_MODES = {
  PASSIVE: 'passive',
  TOOL: 'tool',
  WORKFLOW: 'workflow',
  CONTINUATION: 'continuation',
  CONFIRMATION: 'confirmation',
  WAITING: 'waiting',
  FINISHED: 'finished',
};

export function makeAgentDecision(type = AGENT_DECISIONS.RESPOND, patch = {}) {
  return {
    type,
    mode: patch.mode || AGENT_MODES.PASSIVE,
    reason: patch.reason || '',
    requiresConfirmation: Boolean(patch.requiresConfirmation),
    pendingAction: patch.pendingAction || null,
    targetWorkflow: patch.targetWorkflow || null,
    safety: patch.safety || null,
    createdAt: patch.createdAt || new Date().toISOString(),
    ...patch,
  };
}
