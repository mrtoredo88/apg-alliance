import { BOOTSTRAP_PRIORITIES, BOOTSTRAP_PRIORITY_ORDER, createBootstrapTask, normalizeBootstrapPriority } from './BootstrapTask.js';

function idle(callback) {
  if (typeof window === 'undefined') {
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1);
    return 0;
  }
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 1800 });
  }
  return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 240);
}

function cancelIdle(id) {
  if (typeof window === 'undefined' || !id) return;
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id);
  else window.clearTimeout(id);
}

export class BootstrapQueue {
  constructor() {
    this.tasks = BOOTSTRAP_PRIORITY_ORDER.reduce((acc, priority) => {
      acc[priority] = [];
      return acc;
    }, {});
    this.idleHandle = 0;
  }

  add(taskConfig) {
    const task = createBootstrapTask(taskConfig);
    this.tasks[task.priority].push(task);
    return task;
  }

  list(priority = '') {
    const normalized = priority ? normalizeBootstrapPriority(priority) : '';
    if (normalized) return this.tasks[normalized].slice();
    return BOOTSTRAP_PRIORITY_ORDER.flatMap(key => this.tasks[key]);
  }

  clear() {
    cancelIdle(this.idleHandle);
    this.idleHandle = 0;
    for (const priority of BOOTSTRAP_PRIORITY_ORDER) this.tasks[priority] = [];
  }

  async runPriority(priority, runner) {
    const normalized = normalizeBootstrapPriority(priority);
    const tasks = this.tasks[normalized].slice();
    for (const task of tasks) {
      await runner(task);
    }
  }

  runIdle(runner) {
    const tasks = this.tasks[BOOTSTRAP_PRIORITIES.IDLE].slice();
    this.idleHandle = idle(async () => {
      for (const task of tasks) {
        await runner(task);
      }
    });
    return this.idleHandle;
  }
}
