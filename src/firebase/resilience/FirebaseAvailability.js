import { markFirebaseStartup } from './FirebaseStartupMetrics.js';

const onlineWaiters = new Set();

export function isFirebaseStartupOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function waitForFirebaseOnline({ timeoutMs = 0 } = {}) {
  if (isFirebaseStartupOnline()) return Promise.resolve(true);
  markFirebaseStartup('firebase_offline', { source: 'availability' });
  return new Promise(resolve => {
    let timer = 0;
    const cleanup = () => {
      if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline);
      if (timer) clearTimeout(timer);
      onlineWaiters.delete(cancel);
    };
    const handleOnline = () => {
      cleanup();
      markFirebaseStartup('firebase_online', { source: 'availability' });
      resolve(true);
    };
    const cancel = () => {
      cleanup();
      resolve(false);
    };
    onlineWaiters.add(cancel);
    if (typeof window !== 'undefined') window.addEventListener('online', handleOnline, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
    }
  });
}

export function disposeFirebaseAvailability() {
  [...onlineWaiters].forEach(cancel => cancel());
  onlineWaiters.clear();
}
