import { buildStageMetrics, estimateStartupFps } from './PerformanceMetrics.js';
import { buildPerformanceReport } from './PerformanceReport.js';
import { appendPerformanceRun, readPerformanceRuns } from './PerformanceStorage.js';
import { buildTimeline } from './PerformanceTimeline.js';
import { ensurePerformanceState, markPerformance } from './PerformanceMarks.js';

let installed = false;
let finalized = false;
let frameRaf = 0;
let idleTimer = 0;

function hasWindow() {
  return typeof window !== 'undefined';
}

function bootMarks() {
  if (!hasWindow()) return [];
  const boot = window.__APG_BOOT;
  return Array.isArray(boot?.stages)
    ? boot.stages.map(item => ({
      stage: item.stage,
      group: 'boot',
      at: item.at,
      relativeMs: Math.max(0, Math.round(Number(item.at || 0) - Number(boot.startedAt || item.at || 0))),
      detail: item.detail || null,
    }))
    : [];
}

function mergedMarks() {
  const state = ensurePerformanceState();
  const own = Array.isArray(state?.marks) ? state.marks : [];
  const all = [...bootMarks(), ...own];
  const seen = new Set();
  return all.filter(item => {
    const key = `${item.stage}:${item.relativeMs}:${JSON.stringify(item.detail || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectFrames(deadlineMs = 4500) {
  if (!hasWindow() || !window.requestAnimationFrame) return;
  const state = ensurePerformanceState();
  const started = performance.now();
  const tick = (ts) => {
    state.frames.push(Math.round(ts));
    if (ts - started < deadlineMs && !finalized) frameRaf = window.requestAnimationFrame(tick);
  };
  frameRaf = window.requestAnimationFrame(tick);
}

export function installPerformanceObservatory() {
  if (!hasWindow() || installed) return;
  installed = true;
  const state = ensurePerformanceState();
  window.__APG_PERFORMANCE_MARK__ = markPerformance;
  collectFrames();
  markPerformance('performance_observatory_installed', {}, 'boot');
  idleTimer = window.setTimeout(() => finalizePerformanceRun('idle_timeout'), 6500);
  window.addEventListener('load', () => markPerformance('window_load', {}, 'boot'), { once: true });
  window.addEventListener('pagehide', () => finalizePerformanceRun('pagehide'), { once: true });
  state.history = readPerformanceRuns();
}

export function markPerformanceStage(stage, detail = {}, group = 'app') {
  return markPerformance(stage, detail, group);
}

export function getCurrentPerformanceReport() {
  const state = ensurePerformanceState() || {};
  const timeline = buildTimeline(mergedMarks(), 0);
  const metrics = buildStageMetrics(timeline);
  const fps = estimateStartupFps(state.frames || []);
  return buildPerformanceReport({
    timeline,
    metrics,
    fps,
    renderCounts: state.renderCounts || {},
    frames: state.frames || [],
  });
}

export function finalizePerformanceRun(reason = 'manual') {
  if (!hasWindow() || finalized) return getCurrentPerformanceReport();
  finalized = true;
  if (frameRaf) window.cancelAnimationFrame?.(frameRaf);
  if (idleTimer) window.clearTimeout(idleTimer);
  markPerformance('idle_complete', { reason }, 'boot');
  const report = getCurrentPerformanceReport();
  appendPerformanceRun(report);
  const state = ensurePerformanceState();
  state.lastReport = report;
  state.history = readPerformanceRuns();
  return report;
}

export function forcePerformanceSnapshot(reason = 'manual') {
  markPerformance('performance_snapshot', { reason }, 'diagnostics');
  const report = getCurrentPerformanceReport();
  const state = ensurePerformanceState();
  state.lastReport = report;
  state.history = readPerformanceRuns();
  return report;
}
