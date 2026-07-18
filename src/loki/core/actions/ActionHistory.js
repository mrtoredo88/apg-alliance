import { LOKI_ACTION_CENTER_EVENTS } from './ActionRegistry.js';

const MAX_ITEMS = 30;

function nowIso() {
  return new Date().toISOString();
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeEvent(event = {}) {
  return {
    id: event.id || `loki-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: event.type || LOKI_ACTION_CENTER_EVENTS.SUGGESTED,
    actionType: event.actionType || event.action?.type || '',
    actionId: event.actionId || '',
    status: event.status || 'recorded',
    createdAt: event.createdAt || nowIso(),
    payload: event.payload || event.action?.payload || {},
    reason: event.reason || '',
    source: event.source || 'loki_action_center',
  };
}

export function addActionHistoryItem(history = [], event = {}) {
  return [normalizeEvent(event), ...list(history)].slice(0, MAX_ITEMS);
}

export function buildActionHistoryPatch(memory = {}, event = {}) {
  const nextHistory = addActionHistoryItem(memory.actionHistory, event);
  const actionType = event.actionType || event.action?.type || '';
  const recent = nextHistory.filter(item => item.actionType === actionType);
  const frequentlyUsed = list(memory.frequentlyUsedActions)
    .filter(item => item.actionType !== actionType)
    .concat(actionType ? [{ actionType, count: recent.length, lastUsedAt: nowIso() }] : [])
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, 8);
  return {
    actionHistory: nextHistory,
    frequentlyUsedActions: frequentlyUsed,
    lastActionEvent: nextHistory[0] || null,
  };
}

export function summarizeActionHistory(memory = {}) {
  const rows = list(memory.actionHistory);
  return {
    recent: rows.slice(0, 5),
    frequent: list(memory.frequentlyUsedActions).slice(0, 5),
    lastOpenedCards: rows.filter(row => ['openPartner', 'openEvent', 'openNews', 'openPrize', 'openExperts'].includes(row.actionType)).slice(0, 5),
  };
}
