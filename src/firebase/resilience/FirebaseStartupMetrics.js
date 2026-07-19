import { markPerformance } from '../../performance/PerformanceMarks.js';

const INITIAL_SNAPSHOT = {
  status: 'idle',
  attempts: 0,
  maxAttempts: 5,
  startedAt: 0,
  recoveredAt: 0,
  startupMs: 0,
  recoveryMs: 0,
  lastError: null,
  lastStage: '',
  offline: false,
};

function hasWindow() {
  return typeof window !== 'undefined';
}

export function getFirebaseStartupSnapshot() {
  if (!hasWindow()) return { ...INITIAL_SNAPSHOT };
  if (!window.__APG_FIREBASE_STARTUP__) window.__APG_FIREBASE_STARTUP__ = { ...INITIAL_SNAPSHOT };
  return window.__APG_FIREBASE_STARTUP__;
}

export function updateFirebaseStartupSnapshot(patch = {}) {
  if (!hasWindow()) return { ...INITIAL_SNAPSHOT, ...patch };
  const current = getFirebaseStartupSnapshot();
  window.__APG_FIREBASE_STARTUP__ = {
    ...current,
    ...patch,
  };
  return window.__APG_FIREBASE_STARTUP__;
}

export function markFirebaseStartup(stage, detail = {}) {
  const snapshot = getFirebaseStartupSnapshot();
  const now = Date.now();
  const startedAt = snapshot.startedAt || now;
  const patch = {
    lastStage: stage,
    startedAt,
    startupMs: Math.max(0, now - startedAt),
  };
  if (stage === 'firebase_retry') patch.attempts = Number(detail.attempt || snapshot.attempts || 0);
  if (stage === 'firebase_offline') patch.offline = true;
  if (stage === 'firebase_online') patch.offline = false;
  if (stage === 'firebase_auth_ready') patch.status = 'auth_ready';
  if (stage === 'firebase_recovered') {
    patch.status = 'recovered';
    patch.recoveredAt = now;
    patch.recoveryMs = Math.max(0, now - startedAt);
  }
  if (detail.error || detail.errorCode || detail.errorMessage) {
    patch.status = 'degraded';
    patch.lastError = {
      code: detail.errorCode || detail.code || '',
      message: detail.errorMessage || detail.error || '',
      at: new Date().toISOString(),
      source: detail.source || '',
    };
  }
  markPerformance(stage, detail, 'firebase');
  return updateFirebaseStartupSnapshot(patch);
}

export function resetFirebaseStartupSnapshot() {
  return updateFirebaseStartupSnapshot({ ...INITIAL_SNAPSHOT, startedAt: Date.now() });
}
