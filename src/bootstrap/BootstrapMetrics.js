import { BOOTSTRAP_PRIORITY_ORDER } from './BootstrapTask.js';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return Math.round(performance.now());
  return Date.now();
}

function markPerformance(stage, detail = {}) {
  try {
    window.__APG_PERFORMANCE_MARK__?.(stage, detail, 'bootstrap');
  } catch {}
}

export function createBootstrapMetrics() {
  return {
    startedAt: nowMs(),
    queues: {},
    tasks: [],
    status: 'created',
  };
}

export function markBootstrapQueueStart(metrics, priority) {
  if (!metrics.queues[priority]) metrics.queues[priority] = {};
  metrics.queues[priority].startedAt = nowMs();
  metrics.queues[priority].status = 'running';
  markPerformance(`bootstrap_${priority}_start`, {});
}

export function markBootstrapQueueEnd(metrics, priority) {
  if (!metrics.queues[priority]) metrics.queues[priority] = {};
  const queue = metrics.queues[priority];
  queue.endedAt = nowMs();
  queue.durationMs = Math.max(0, Math.round(queue.endedAt - (queue.startedAt || queue.endedAt)));
  queue.status = 'complete';
  markPerformance(`bootstrap_${priority}_complete`, { durationMs: queue.durationMs });
}

export function markBootstrapTaskStart(metrics, task) {
  const entry = {
    id: task.id,
    label: task.label,
    priority: task.priority,
    startedAt: nowMs(),
    status: 'running',
  };
  metrics.tasks.push(entry);
  markPerformance(`bootstrap_task_${task.id}_start`, { priority: task.priority, label: task.label });
  return entry;
}

export function markBootstrapTaskEnd(entry, result = {}) {
  entry.endedAt = nowMs();
  entry.durationMs = Math.max(0, Math.round(entry.endedAt - (entry.startedAt || entry.endedAt)));
  entry.status = result.status || 'complete';
  if (result.error) entry.error = result.error;
  markPerformance(`bootstrap_task_${entry.id}_${entry.status}`, {
    priority: entry.priority,
    durationMs: entry.durationMs,
    error: entry.error || '',
  });
}

export function summarizeBootstrapMetrics(metrics = {}) {
  const queues = {};
  for (const priority of BOOTSTRAP_PRIORITY_ORDER) {
    const queue = metrics.queues?.[priority] || {};
    queues[priority] = {
      status: queue.status || 'pending',
      durationMs: queue.durationMs || 0,
      startedAt: queue.startedAt || 0,
      endedAt: queue.endedAt || 0,
    };
  }
  return {
    status: metrics.status || 'unknown',
    queues,
    tasks: Array.isArray(metrics.tasks) ? metrics.tasks.slice() : [],
  };
}
