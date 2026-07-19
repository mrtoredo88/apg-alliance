import { markFirebaseStartup } from './FirebaseStartupMetrics.js';

const recoveryTasks = new Set();

export function registerFirebaseRecoveryTask(task) {
  if (typeof task !== 'function') return () => {};
  recoveryTasks.add(task);
  return () => recoveryTasks.delete(task);
}

export async function runFirebaseRecovery(detail = {}) {
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
