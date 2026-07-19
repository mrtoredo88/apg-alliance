import { markFirebaseStartup } from './FirebaseStartupMetrics.js';

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
    };
    const handleOnline = () => {
      cleanup();
      markFirebaseStartup('firebase_online', { source: 'availability' });
      resolve(true);
    };
    if (typeof window !== 'undefined') window.addEventListener('online', handleOnline, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
    }
  });
}
