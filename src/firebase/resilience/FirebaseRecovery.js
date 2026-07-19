import { markFirebaseStartup } from './FirebaseStartupMetrics.js';

const recoveryTasks = new Set();
let disposed = false;

export function registerFirebaseRecoveryTask(task) {
  if (typeof task !== 'function') return () => {};
  disposed = false;
  recoveryTasks.add(task);
  return () => recoveryTasks.delete(task);
}

export function clearFirebaseRecoveryTasks() {
  recoveryTasks.clear();
  disposed = true;
}

export async function runFirebaseRecovery(detail = {}) {
  if (disposed) return [];
  markFirebaseStartup('firebase_recovered', { ...detail, tasks: recoveryTasks.size });
  const results = [];
  for (const task of [...recoveryTasks]) {
    try {
      results.push(await task(detail));
    } catch (error) {
      markFirebaseStartup('firebase_retry', {
        source: 'recovery_task',
        errorCode: error?.code || '',
        errorMessage: error?.message || String(error),
      });
    }
  }
  return results;
}
