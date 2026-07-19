import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function installBrowserMocks() {
  const listeners = new Map();
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  globalThis.window = {
    __APG_BOOT: { startedAt: Date.now() },
    __APG_PERFORMANCE__: null,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    dispatchEvent() {},
    __listeners: listeners,
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
}

function setOnline(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: value },
    configurable: true,
  });
}

function ok(condition, message) {
  assert.ok(condition, message);
  console.log(`✓ ${message}`);
}

installBrowserMocks();

const resilience = await import('../src/firebase/resilience/index.js');
const {
  FIREBASE_RETRY_DELAYS_MS,
  FirebaseRetryQueue,
  ensureFirebaseAnonymousAuth,
  getFirebaseAnonymousStartupPromise,
  getFirebaseStartupSnapshot,
  resetFirebaseStartupResilience,
  waitForFirebaseOnline,
} = resilience;

ok(fs.existsSync(path.join(root, 'src/firebase/resilience/FirebaseStartupResilience.js')), 'FirebaseStartupResilience exists');
ok(fs.existsSync(path.join(root, 'src/firebase/resilience/FirebaseRetryQueue.js')), 'FirebaseRetryQueue exists');
ok(fs.existsSync(path.join(root, 'src/firebase/resilience/FirebaseStartupMetrics.js')), 'FirebaseStartupMetrics exists');
ok(fs.existsSync(path.join(root, 'src/firebase/resilience/FirebaseAvailability.js')), 'FirebaseAvailability exists');
ok(fs.existsSync(path.join(root, 'src/firebase/resilience/FirebaseRecovery.js')), 'FirebaseRecovery exists');

assert.deepEqual(FIREBASE_RETRY_DELAYS_MS, [1000, 2000, 5000, 10000, 30000]);
ok(true, 'Retry backoff is 1s, 2s, 5s, 10s, 30s');

resetFirebaseStartupResilience();
let attempts = 0;
const auth = { currentUser: null };
const queue = new FirebaseRetryQueue({
  delays: [1, 1, 1, 1, 1],
  maxAttempts: 5,
  sleepFn: async () => {},
});
const signIn = async () => {
  attempts += 1;
  if (attempts < 3) {
    const error = new Error('identitytoolkit accounts:signUp 400');
    error.code = 'auth/internal-error';
    throw error;
  }
  auth.currentUser = { uid: 'anon_1' };
  return { user: auth.currentUser };
};

const first = ensureFirebaseAnonymousAuth(auth, signIn, { source: 'test', waitMs: 100, queue });
const second = ensureFirebaseAnonymousAuth(auth, signIn, { source: 'test_duplicate', waitMs: 100, queue });
ok(getFirebaseAnonymousStartupPromise() !== null, 'Anonymous auth startup promise is shared');
assert.equal(await first, auth.currentUser);
assert.equal(await second, auth.currentUser);
assert.equal(attempts, 3);
ok(true, 'Anonymous auth retries and resolves without duplicate signIn calls');

let snapshot = getFirebaseStartupSnapshot();
assert.equal(snapshot.status, 'recovered');
assert.equal(snapshot.attempts, 3);
ok(true, 'Recovery snapshot records status and attempts');

resetFirebaseStartupResilience();
setOnline(false);
const offlineWait = await waitForFirebaseOnline({ timeoutMs: 1 });
assert.equal(offlineWait, false);
snapshot = getFirebaseStartupSnapshot();
assert.equal(snapshot.offline, true);
ok(true, 'Offline mode waits without tight retry loop');

setOnline(true);
const onlinePromise = waitForFirebaseOnline({ timeoutMs: 50 });
assert.equal(await onlinePromise, true);
ok(true, 'Online mode resolves recovery wait');

const userApp = read('src/UserApp.jsx');
ok(userApp.includes('ensureFirebaseAnonymousAuth'), 'UserApp uses Firebase startup resilience');
ok(!/await\s+signInAnonymously\(auth\)/.test(userApp), 'UserApp has no direct blocking anonymous sign-in await');
ok(userApp.includes('registerFirebaseRecoveryTask'), 'UserApp registers Firebase recovery task');
ok(userApp.includes('isFirebaseStartupOnlyError'), 'UserApp prevents auth startup failures from fatal Home state');

const perfMetrics = read('src/performance/PerformanceMetrics.js');
const perfReport = read('src/performance/PerformanceReport.js');
const health = read('src/ApgHealthPage.jsx');
ok(perfMetrics.includes('firebaseRecoveryMs'), 'Performance metrics expose Firebase recovery');
ok(perfReport.includes('firebaseStartup'), 'Performance report includes Firebase startup snapshot');
ok(health.includes('Firebase Startup'), 'APG Health shows Firebase Startup');

console.log('\nFirebase startup resilience tests passed.');
