import { normalizeLokiActionRequest } from '../../lokiActionTypes.js';
import { LOKI_ACTION_CENTER_EVENTS } from './ActionRegistry.js';
import { validateLokiAction } from './ActionValidator.js';

export async function executeLokiAction(actionRequest, { appActions = {}, appState = {}, actor = {}, onEvent = null } = {}) {
  const action = normalizeLokiActionRequest(actionRequest);
  const validation = validateLokiAction(action, { appActions, appState, actor });
  if (!validation.ok) {
    onEvent?.({ type: LOKI_ACTION_CENTER_EVENTS.FAILED, action, actionType: action?.type || '', status: 'failed', reason: validation.reason });
    return { ok: false, reason: validation.reason, action };
  }
  onEvent?.({ type: LOKI_ACTION_CENTER_EVENTS.STARTED, action, actionType: action.type, status: 'started' });
  try {
    const handler = appActions[action.type];
    if (typeof handler === 'function') {
      await handler(action.payload || {});
    } else if (action.type === 'call' && action.payload?.phone && typeof window !== 'undefined') {
      window.location.href = `tel:${String(action.payload.phone).replace(/[^\d+]/g, '')}`;
    } else if (action.type === 'share' && typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: action.payload?.title || 'АПГ', text: action.payload?.text || '', url: action.payload?.url || undefined });
    } else if (action.type === 'copyLink' && typeof navigator !== 'undefined' && navigator.clipboard && action.payload?.url) {
      await navigator.clipboard.writeText(action.payload.url);
    } else {
      throw new Error(`Loki action handler is unavailable: ${action.type}`);
    }
    onEvent?.({ type: LOKI_ACTION_CENTER_EVENTS.COMPLETED, action, actionType: action.type, status: 'completed' });
    return { ok: true, action };
  } catch (error) {
    onEvent?.({ type: LOKI_ACTION_CENTER_EVENTS.FAILED, action, actionType: action.type, status: 'failed', reason: error?.message || 'Action failed' });
    return { ok: false, reason: error?.message || 'Не удалось выполнить действие.', action, error };
  }
}
