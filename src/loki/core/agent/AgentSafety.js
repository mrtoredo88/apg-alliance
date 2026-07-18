import { LOKI_APP_ACTIONS, normalizeLokiActionRequest } from '../../lokiActionTypes.js';
import { validateLokiAction } from '../actions/ActionValidator.js';

const CONFIRMATION_ACTIONS = new Set([
  LOKI_APP_ACTIONS.START_EVENT_REGISTRATION,
  LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER,
  'call',
  'share',
  'copyLink',
]);

const CONFIRMATION_STEP_WORDS = ['запис', 'зарегистр', 'отправ', 'подтверд', 'отмен', 'измен', 'получить', 'приглаш'];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function stepRequiresConfirmation(step = {}) {
  const title = `${step.title || ''} ${step.id || ''}`.toLowerCase();
  return CONFIRMATION_STEP_WORDS.some(word => title.includes(word));
}

export function actionRequiresConfirmation(actionRequest = null, step = null) {
  const action = normalizeLokiActionRequest(actionRequest);
  if (action?.type && CONFIRMATION_ACTIONS.has(action.type)) return true;
  if (stepRequiresConfirmation(step || {})) return true;
  return false;
}

export function validateAgentSafety({ decision = {}, context = {}, appState = {}, appActions = null } = {}) {
  const checks = [];
  let ok = true;
  let reason = '';
  const pendingAction = decision.pendingAction?.action || null;
  if (pendingAction) {
    const validation = validateLokiAction(pendingAction, { appState, appActions, actor: context?.actor || {} });
    checks.push({ id: 'action', ok: validation.ok, reason: validation.reason || '', actionType: validation.action?.type || '' });
    if (!validation.ok) {
      ok = false;
      reason = validation.reason;
    }
  }
  if (decision.targetWorkflow?.status === 'FAILED') {
    ok = false;
    reason = decision.targetWorkflow.errorReason || 'Workflow недоступен.';
    checks.push({ id: 'workflow', ok: false, reason });
  } else if (decision.targetWorkflow) {
    checks.push({ id: 'workflow', ok: true, workflowId: decision.targetWorkflow.workflowId });
  }
  const requiresConfirmation = Boolean(decision.requiresConfirmation || actionRequiresConfirmation(pendingAction, decision.currentStep));
  checks.push({ id: 'confirmation', ok: true, required: requiresConfirmation });
  return {
    ok,
    reason,
    requiresConfirmation,
    checks: list(checks),
  };
}
