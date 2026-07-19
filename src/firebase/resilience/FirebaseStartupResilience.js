import { FirebaseRetryQueue } from './FirebaseRetryQueue.js';
import { disposeFirebaseAvailability, isFirebaseStartupOnline } from './FirebaseAvailability.js';
import { markFirebaseStartup, resetFirebaseStartupSnapshot } from './FirebaseStartupMetrics.js';
import { clearFirebaseRecoveryTasks, runFirebaseRecovery } from './FirebaseRecovery.js';

let anonymousAuthPromise = null;
let anonymousAuthStarted = false;
const defaultAnonymousAuthQueue = new FirebaseRetryQueue();

function timeout(ms, value = null) {
  if (!ms || ms <= 0) return Promise.resolve(value);
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

export function resetFirebaseStartupResilience() {
  anonymousAuthPromise = null;
  anonymousAuthStarted = false;
  resetFirebaseStartupSnapshot();
}

export function disposeFirebaseStartupResilience() {
  defaultAnonymousAuthQueue.cancelAll();
  disposeFirebaseAvailability();
  clearFirebaseRecoveryTasks();
  anonymousAuthPromise = null;
  anonymousAuthStarted = false;
}

export function getFirebaseAnonymousStartupPromise() {
  return anonymousAuthPromise;
}

export function ensureFirebaseAnonymousAuth(auth, signInAnonymously, options = {}) {
  const {
    source = 'startup',
    waitMs = 0,
    maxAttempts = 5,
    queue = maxAttempts === 5 ? defaultAnonymousAuthQueue : new FirebaseRetryQueue({ maxAttempts }),
    restart = false,
  } = options;

  if (restart) {
    queue.cancelAll?.();
    anonymousAuthPromise = null;
  }

  if (auth?.currentUser) {
    markFirebaseStartup('firebase_auth_ready', { source, uid: auth.currentUser.uid, reused: true });
    return Promise.resolve(auth.currentUser);
  }

  if (!anonymousAuthPromise) {
    if (!anonymousAuthStarted) {
      anonymousAuthStarted = true;
      markFirebaseStartup('firebase_start', { source: 'anonymous_auth' });
    }
    anonymousAuthPromise = queue.run(async ({ attempt }) => {
      if (!isFirebaseStartupOnline()) return null;
      const credential = await signInAnonymously(auth);
      const user = credential?.user || auth?.currentUser || null;
      markFirebaseStartup('firebase_auth_ready', { source, attempt, uid: user?.uid || null });
      return user;
    }, {
      source,
      onRecovered: ({ attempt, result }) => runFirebaseRecovery({ source, attempt, uid: result?.uid || null }),
    }).then(result => result || auth?.currentUser || null).catch(error => {
      markFirebaseStartup('firebase_retry', {
        source,
        errorCode: error?.code || '',
        errorMessage: error?.message || String(error),
      });
      return null;
    }).finally(() => {
      if (!auth?.currentUser) anonymousAuthPromise = null;
    });
  }

  if (!waitMs || waitMs <= 0) return Promise.resolve(auth?.currentUser || null);
  return Promise.race([
    anonymousAuthPromise,
    timeout(waitMs, auth?.currentUser || null),
  ]);
}
