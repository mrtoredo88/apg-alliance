export const BOOTSTRAP_PRIORITIES = {
  CRITICAL: 'critical',
  INTERACTIVE: 'interactive',
  IDLE: 'idle',
};

export const BOOTSTRAP_PRIORITY_ORDER = [
  BOOTSTRAP_PRIORITIES.CRITICAL,
  BOOTSTRAP_PRIORITIES.INTERACTIVE,
  BOOTSTRAP_PRIORITIES.IDLE,
];

export function normalizeBootstrapPriority(priority) {
  const raw = String(priority || '').toLowerCase();
  return BOOTSTRAP_PRIORITY_ORDER.includes(raw) ? raw : BOOTSTRAP_PRIORITIES.IDLE;
}

export function createBootstrapTask({ id, priority = BOOTSTRAP_PRIORITIES.IDLE, run, label = '', timeoutMs = 0 } = {}) {
  const taskId = String(id || '').trim();
  if (!taskId) throw new Error('bootstrap_task_id_required');
  if (typeof run !== 'function') throw new Error(`bootstrap_task_run_required:${taskId}`);
  return {
    id: taskId,
    label: String(label || taskId),
    priority: normalizeBootstrapPriority(priority),
    timeoutMs: Number(timeoutMs || 0),
    run,
    createdAt: Date.now(),
  };
}
