import { nowMs } from './PerformanceTimeline.js';

export const PERFORMANCE_EVENT = 'apg:performance:update';

function hasWindow() {
  return typeof window !== 'undefined';
}

export function ensurePerformanceState() {
  if (!hasWindow()) return null;
  if (!window.__APG_PERFORMANCE__) {
    window.__APG_PERFORMANCE__ = {
      startedAt: window.__APG_BOOT?.startedAt || Date.now(),
      marks: [],
      renderCounts: {},
      frames: [],
    };
  }
  return window.__APG_PERFORMANCE__;
}

export function notifyPerformanceUpdate() {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent(PERFORMANCE_EVENT, { detail: window.__APG_PERFORMANCE__ || null }));
}

export function markPerformance(stage, detail = {}, group = 'app') {
  const state = ensurePerformanceState();
  if (!state || !stage) return null;
  const mark = {
    stage: String(stage),
    group,
    detail,
    at: Date.now(),
    relativeMs: nowMs(),
  };
  state.marks.push(mark);
  state.marks = state.marks.slice(-240);
  notifyPerformanceUpdate();
  return mark;
}

export function countRender(scope) {
  const state = ensurePerformanceState();
  if (!state || !scope) return 0;
  state.renderCounts[scope] = Number(state.renderCounts[scope] || 0) + 1;
  notifyPerformanceUpdate();
  return state.renderCounts[scope];
}

export function markBootStage(stage, detail = {}) {
  if (hasWindow()) window.__APG_BOOT_MARK?.(stage, detail);
  return markPerformance(stage, detail, 'boot');
}

export function markRouteReady(route, detail = {}) {
  return markPerformance(`route_${route}_ready`, detail, 'routing');
}

export function markFirebase(stage, detail = {}) {
  return markPerformance(stage, detail, 'firebase');
}

export function markLokiStage(stage, detail = {}) {
  return markPerformance(`loki_${stage}`, detail, 'loki');
}
