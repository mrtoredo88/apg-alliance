import { isFirebaseStartupOnline, waitForFirebaseOnline } from './FirebaseAvailability.js';
import { markFirebaseStartup } from './FirebaseStartupMetrics.js';

export const FIREBASE_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class FirebaseRetryQueue {
  constructor({ delays = FIREBASE_RETRY_DELAYS_MS, maxAttempts = 5, sleepFn = sleep } = {}) {
    this.delays = delays;
    this.maxAttempts = maxAttempts;
    this.sleep = sleepFn;
    this.running = false;
  }

  async run(task, { source = 'firebase', onRecovered } = {}) {
    if (this.running) return null;
    this.running = true;
    const startedAt = Date.now();
    try {
      for (let index = 0; index < this.maxAttempts; index += 1) {
        const attempt = index + 1;
        if (!isFirebaseStartupOnline()) {
          await waitForFirebaseOnline();
        }
        if (attempt > 1) markFirebaseStartup('firebase_retry', { source, attempt, delayMs: this.delays[index - 1] || 0 });
        try {
          const result = await task({ attempt });
          if (attempt > 1) {
            markFirebaseStartup('firebase_recovered', { source, attempt, recoveryMs: Date.now() - startedAt });
            await onRecovered?.({ source, attempt, result });
          }
          return result;
        } catch (error) {
          markFirebaseStartup('firebase_retry', {
            source,
            attempt,
            errorCode: error?.code || '',
            errorMessage: error?.message || String(error),
          });
          const delay = this.delays[index] || this.delays.at(-1) || 30000;
          if (attempt < this.maxAttempts) await this.sleep(delay);
        }
      }
      return null;
    } finally {
      this.running = false;
    }
  }
}
