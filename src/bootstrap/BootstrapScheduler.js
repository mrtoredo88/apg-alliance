import { BootstrapQueue } from './BootstrapQueue.js';
import { BOOTSTRAP_PRIORITIES } from './BootstrapTask.js';
import {
  createBootstrapMetrics,
  markBootstrapQueueEnd,
  markBootstrapQueueStart,
  markBootstrapTaskEnd,
  markBootstrapTaskStart,
  summarizeBootstrapMetrics,
} from './BootstrapMetrics.js';

let scheduler = null;

function hasWindow() {
  return typeof window !== 'undefined';
}

function timeoutPromise(ms, id) {
  if (!ms) return null;
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`bootstrap_task_timeout:${id}:${ms}`)), ms);
  });
}

export class BootstrapScheduler {
  constructor() {
    this.queue = new BootstrapQueue();
    this.metrics = createBootstrapMetrics();
    this.started = false;
    this.finished = false;
    this.taskStatus = new Map();
  }

  register(taskConfig) {
    const task = this.queue.add(taskConfig);
    if (!this.started) return task;
    if (task.priority === BOOTSTRAP_PRIORITIES.CRITICAL) this.runTask(task);
    else if (task.priority === BOOTSTRAP_PRIORITIES.INTERACTIVE) setTimeout(() => this.runTask(task), 0);
    else this.queue.runIdle(nextTask => this.runTask(nextTask));
    return task;
  }

  async runTask(task) {
    const current = this.taskStatus.get(task.id);
    if (current === 'running' || current === 'complete') return current === 'complete';
    this.taskStatus.set(task.id, 'running');
    const entry = markBootstrapTaskStart(this.metrics, task);
    try {
      const work = Promise.resolve().then(() => task.run());
      const timeout = timeoutPromise(task.timeoutMs, task.id);
      await (timeout ? Promise.race([work, timeout]) : work);
      markBootstrapTaskEnd(entry, { status: 'complete' });
      this.taskStatus.set(task.id, 'complete');
      return true;
    } catch (error) {
      markBootstrapTaskEnd(entry, { status: 'failed', error: error?.message || String(error) });
      this.taskStatus.set(task.id, 'failed');
      console.warn('[APG Bootstrap] task failed', task.id, error?.message || error);
      return false;
    }
  }

  async start() {
    if (this.started) return this.snapshot();
    this.started = true;
    this.metrics.status = 'running';
    if (hasWindow()) window.__APG_BOOTSTRAP_SCHEDULER__ = this;

    markBootstrapQueueStart(this.metrics, BOOTSTRAP_PRIORITIES.CRITICAL);
    await this.queue.runPriority(BOOTSTRAP_PRIORITIES.CRITICAL, task => this.runTask(task));
    markBootstrapQueueEnd(this.metrics, BOOTSTRAP_PRIORITIES.CRITICAL);

    setTimeout(async () => {
      markBootstrapQueueStart(this.metrics, BOOTSTRAP_PRIORITIES.INTERACTIVE);
      await this.queue.runPriority(BOOTSTRAP_PRIORITIES.INTERACTIVE, task => this.runTask(task));
      markBootstrapQueueEnd(this.metrics, BOOTSTRAP_PRIORITIES.INTERACTIVE);

      this.queue.runIdle(async (task) => {
        if (this.metrics.queues[BOOTSTRAP_PRIORITIES.IDLE]?.status !== 'running') {
          markBootstrapQueueStart(this.metrics, BOOTSTRAP_PRIORITIES.IDLE);
        }
        await this.runTask(task);
        const pending = this.queue.list(BOOTSTRAP_PRIORITIES.IDLE).filter(item => (
          !this.metrics.tasks.some(entry => entry.id === item.id && entry.status !== 'running')
        ));
        if (pending.length === 0) {
          markBootstrapQueueEnd(this.metrics, BOOTSTRAP_PRIORITIES.IDLE);
          this.metrics.status = 'complete';
          this.finished = true;
        }
      });
    }, 0);

    return this.snapshot();
  }

  snapshot() {
    return summarizeBootstrapMetrics(this.metrics);
  }
}

export function getBootstrapScheduler() {
  if (!scheduler) {
    scheduler = new BootstrapScheduler();
    if (hasWindow()) window.__APG_BOOTSTRAP_SCHEDULER__ = scheduler;
  }
  return scheduler;
}

export function registerBootstrapTask(taskConfig) {
  return getBootstrapScheduler().register(taskConfig);
}

export function startBootstrapScheduler() {
  return getBootstrapScheduler().start();
}

export function getBootstrapSnapshot() {
  return getBootstrapScheduler().snapshot();
}

export function scheduleBootstrapTask(taskConfig) {
  return registerBootstrapTask(taskConfig);
}
