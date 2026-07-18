import { LOKI_MESSAGE_PRIORITY } from '../../lokiActionTypes.js';
import { getSilentModeMultiplier, isOpportunityAlreadyShown, isOpportunityDismissed } from './DismissManager.js';

const STARTUP_SILENCE_MS = 1000 * 10;
const USER_ACTIVE_SILENCE_MS = 1000 * 8;
const PANEL_CHANGE_SILENCE_MS = 1000 * 8;
const BASE_BETWEEN_OPPORTUNITIES_MS = 1000 * 60 * 7;
const BLOCKED_PANELS = new Set([
  'scanner',
  'partner-cabinet',
  'expert-cabinet',
  'partnership',
]);

function nowMs() {
  return Date.now();
}

function appStartedAt(appState = {}, memory = {}) {
  const raw = appState.sessionStartedAt || memory.sessionStartedAt || appState.appStartedAt;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) && ms ? ms : nowMs();
}

function hasBlockingWork(appState = {}) {
  return Boolean(
    appState.bookingRequest
    || appState.isScannerOpen
    || appState.consentRequest
    || appState.publicSubmitRoute
    || appState.formDirty
    || appState.editorOpen
    || appState.workspace?.editing
    || appState.workspace?.draftDirty
  );
}

export function canShowOpportunity({
  opportunity,
  appState = {},
  memory = {},
  history = [],
  opportunityHistory = [],
  lastUserActionAt = 0,
  lastPanelChangeAt = 0,
} = {}) {
  if (!opportunity) return { ok: false, reason: 'missing_opportunity' };
  const now = nowMs();
  const startedAt = appStartedAt(appState, memory);
  if (now - startedAt < STARTUP_SILENCE_MS) return { ok: false, reason: 'startup_silence' };
  if (hasBlockingWork(appState)) return { ok: false, reason: 'blocking_work' };
  if (BLOCKED_PANELS.has(String(appState.activePanel || ''))) return { ok: false, reason: 'blocked_panel' };
  if (opportunity.suppressedPanels?.includes(appState.activePanel)) return { ok: false, reason: 'suppressed_panel' };
  if (now - lastUserActionAt < USER_ACTIVE_SILENCE_MS && opportunity.priority < LOKI_MESSAGE_PRIORITY.HIGH) return { ok: false, reason: 'user_active' };
  if (now - lastPanelChangeAt < PANEL_CHANGE_SILENCE_MS && opportunity.priority < LOKI_MESSAGE_PRIORITY.HIGH) return { ok: false, reason: 'panel_changed' };
  if (isOpportunityDismissed(opportunity, opportunityHistory)) return { ok: false, reason: 'dismissed_cooldown' };
  if (isOpportunityAlreadyShown(opportunity, opportunityHistory)) return { ok: false, reason: 'shown_cooldown' };

  const multiplier = getSilentModeMultiplier(opportunityHistory);
  const lastProactive = history.find(item => item.kind === 'proactive');
  if (lastProactive && now - Number(lastProactive.ts || 0) < BASE_BETWEEN_OPPORTUNITIES_MS * multiplier && opportunity.priority < LOKI_MESSAGE_PRIORITY.HIGH) {
    return { ok: false, reason: 'global_cooldown' };
  }
  return { ok: true, reason: 'ready' };
}
