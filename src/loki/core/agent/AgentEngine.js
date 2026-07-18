import { nowMs } from '../tools/ToolResult.js';
import { buildAgentContext } from './AgentContext.js';
import { buildConfirmationText } from './AgentConfirmation.js';
import { resolveAgentContinuation } from './AgentContinuation.js';
import { AGENT_DECISIONS, makeAgentDecision } from './AgentDecision.js';
import { applyAgentDecision } from './AgentExecutor.js';
import { buildAgentSnapshot } from './AgentSnapshot.js';
import { sessionFromMemory, updateAgentSession } from './AgentSession.js';
import { resolveAgentDecision } from './AgentResolver.js';
import { validateAgentSafety } from './AgentSafety.js';

function continuationText(continuation = {}) {
  if (continuation.type === 'cancel') return `Остановил сценарий «${continuation.workflowContext?.title || 'АПГ'}». Если понадобится, начнём заново.`;
  return `Подтверждение принято. Продолжаю сценарий «${continuation.workflowContext?.title || 'АПГ'}».`;
}

function shapeAgentText(result = {}, agentContext = {}) {
  if (agentContext.decision?.type === AGENT_DECISIONS.ASK_CONFIRMATION) return buildConfirmationText(agentContext);
  if (agentContext.decision?.type === AGENT_DECISIONS.CONTINUE_WORKFLOW || agentContext.decision?.type === AGENT_DECISIONS.FINISH) {
    return agentContext.text || result.text;
  }
  return result.text;
}

export function runLokiAgentContinuation({ question = '', context = {} } = {}) {
  const started = nowMs();
  const snapshot = buildAgentSnapshot(context?.memory || {});
  const continuation = resolveAgentContinuation({ question, snapshot });
  if (!continuation) return null;
  const session = sessionFromMemory(context?.memory || {});
  const decision = makeAgentDecision(
    continuation.type === 'cancel' ? AGENT_DECISIONS.FINISH : AGENT_DECISIONS.CONTINUE_WORKFLOW,
    {
      mode: continuation.type === 'cancel' ? 'finished' : 'continuation',
      reason: continuation.type === 'cancel' ? 'пользователь отменил активный workflow' : 'пользователь подтвердил активный workflow',
      targetWorkflow: continuation.workflowContext,
      pendingAction: continuation.pendingConfirmation,
    },
  );
  const nextSession = updateAgentSession(session, {
    decision,
    result: { workflowContext: continuation.workflowContext },
    pendingConfirmation: null,
    waitingForUser: false,
  });
  const agentContext = {
    version: 'v1',
    decision,
    session: nextSession,
    snapshot,
    workflowContext: continuation.workflowContext,
    continuation,
    text: continuationText(continuation),
    durationMs: Math.round(nowMs() - started),
  };
  const safety = validateAgentSafety({ decision, context });
  const result = applyAgentDecision({
    result: {
      intent: `agent.${decision.type.toLowerCase()}`,
      preserveText: true,
      text: agentContext.text,
      card: null,
      cards: [],
    },
    decision,
    session: nextSession,
    safety,
  });
  return {
    ...result,
    agentContext: { ...agentContext, safety, events: result.agentEvents },
  };
}

export function runLokiAgentEngine({ question = '', result = null, context = {}, appState = {}, appActions = null } = {}) {
  if (!result) return result;
  const started = nowMs();
  const snapshot = buildAgentSnapshot(context?.memory || {});
  const baseContext = buildAgentContext({ question, result, snapshot });
  const decision = resolveAgentDecision({ result, agentContext: baseContext });
  const safety = validateAgentSafety({ decision, context, appState, appActions });
  const needsConfirmation = safety.requiresConfirmation && decision.type === AGENT_DECISIONS.ASK_CONFIRMATION;
  const session = updateAgentSession(sessionFromMemory(context?.memory || {}), {
    decision,
    result,
    pendingConfirmation: needsConfirmation ? {
      label: decision.pendingAction?.label || decision.currentStep?.title || 'Продолжить',
      actionId: decision.pendingAction?.actionId || '',
      action: decision.pendingAction?.action || null,
      workflowId: result.workflowContext?.workflowId || '',
      stepId: decision.currentStep?.id || decision.pendingAction?.stepId || '',
    } : null,
    waitingForUser: needsConfirmation || decision.type === AGENT_DECISIONS.WAIT_USER,
  });
  const agentContext = {
    ...baseContext,
    version: 'v1',
    decision,
    session,
    safety,
    durationMs: Math.round(nowMs() - started),
  };
  const applied = applyAgentDecision({ result, decision, session, safety });
  return {
    ...applied,
    text: shapeAgentText(applied, agentContext),
    agentContext: { ...agentContext, events: applied.agentEvents },
  };
}
