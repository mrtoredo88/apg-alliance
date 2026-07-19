import { markPerformanceStage } from '../performance/index.js';
import { HOME_HYDRATION_READY_MARKS, HOME_HYDRATION_STAGE_ORDER } from './HomeHydrationTask.js';

function hasWindow() {
  return typeof window !== 'undefined';
}

export function createHomeHydrationMetrics() {
  return {
    status: 'idle',
    startedAt: 0,
    completedAt: 0,
    stages: {},
  };
}

export function markHomeHydrationStart(metrics, detail = {}) {
  if (!metrics) return metrics;
  metrics.status = 'running';
  metrics.startedAt = Date.now();
  markPerformanceStage('home_hydration_start', detail, 'home');
  return metrics;
}

export function markHomeHydrationStage(metrics, stage, detail = {}) {
  if (!metrics || !stage) return metrics;
  const now = Date.now();
  const durationMs = metrics.startedAt ? Math.max(0, Math.round(now - metrics.startedAt)) : 0;
  metrics.stages[stage] = {
    stage,
    status: 'ready',
    readyAt: now,
    durationMs,
  };
  const mark = HOME_HYDRATION_READY_MARKS[stage];
  if (mark) markPerformanceStage(mark, { ...detail, durationMs }, 'home');
  if (stage === 'shell') markPerformanceStage('home_ready', { ...detail, source: 'incremental_hydration_shell' }, 'home');
  if (HOME_HYDRATION_STAGE_ORDER.every(item => metrics.stages[item]?.status === 'ready')) {
    metrics.status = 'complete';
    metrics.completedAt = now;
    markPerformanceStage('home_hydration_complete', { durationMs }, 'home');
  }
  if (hasWindow()) window.__APG_HOME_HYDRATION__ = summarizeHomeHydrationMetrics(metrics);
  return metrics;
}

export function summarizeHomeHydrationMetrics(metrics = {}) {
  return {
    status: metrics.status || 'idle',
    startedAt: metrics.startedAt || 0,
    completedAt: metrics.completedAt || 0,
    stages: HOME_HYDRATION_STAGE_ORDER.map(stage => metrics.stages?.[stage] || { stage, status: 'pending', durationMs: 0 }),
  };
}
