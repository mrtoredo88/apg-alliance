import { createHomeHydrationMetrics, markHomeHydrationStage, markHomeHydrationStart, summarizeHomeHydrationMetrics } from './HomeHydrationMetrics.js';
import { createHomeHydrationTask, HOME_HYDRATION_STAGE_ORDER, HOME_HYDRATION_STAGES } from './HomeHydrationTask.js';

const DEFAULT_TASKS = [
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.SHELL, priority: 1, delayMs: 0 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.NEWS, priority: 2, delayMs: 28 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.PARTNERS, priority: 3, delayMs: 36 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.EVENTS, priority: 4, delayMs: 44 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.JOURNEY, priority: 5, delayMs: 52 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.LOKI, priority: 6, delayMs: 64 }),
  createHomeHydrationTask({ stage: HOME_HYDRATION_STAGES.RECOMMENDATIONS, priority: 7, delayMs: 80, idle: true }),
];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

function waitIdle() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (typeof window.requestIdleCallback === 'function') {
    return new Promise(resolve => window.requestIdleCallback(resolve, { timeout: 260 }));
  }
  return wait(120);
}

export class HomeHydrationScheduler {
  constructor({ tasks = DEFAULT_TASKS, onStageReady, detail = {} } = {}) {
    this.tasks = tasks.slice().sort((a, b) => a.priority - b.priority);
    this.onStageReady = typeof onStageReady === 'function' ? onStageReady : () => {};
    this.detail = detail;
    this.cancelled = false;
    this.metrics = createHomeHydrationMetrics();
  }

  async start() {
    markHomeHydrationStart(this.metrics, this.detail);
    for (const task of this.tasks) {
      if (this.cancelled) break;
      if (task.idle) await waitIdle();
      if (task.delayMs) await wait(task.delayMs);
      if (this.cancelled) break;
      this.onStageReady(task.stage);
      markHomeHydrationStage(this.metrics, task.stage, this.detail);
    }
    return summarizeHomeHydrationMetrics(this.metrics);
  }

  cancel() {
    this.cancelled = true;
  }

  snapshot() {
    return summarizeHomeHydrationMetrics(this.metrics);
  }
}

export function startHomeHydration(options = {}) {
  const scheduler = new HomeHydrationScheduler(options);
  scheduler.start();
  return scheduler;
}

export function createHomeHydrationState(readyStages = []) {
  const ready = new Set(readyStages);
  return HOME_HYDRATION_STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = ready.has(stage);
    return acc;
  }, {});
}
