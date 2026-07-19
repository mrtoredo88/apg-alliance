const VERSION_URL = '/version.json';
const SW_URL = '/sw.js';
const SW_SCOPE = '/';

const STORAGE_KEYS = {
  installedVersion: 'apg_build',
  cacheVersion: 'apg_cache_version',
  migratedVersion: 'apg_cache_migrated_to',
  pendingVersion: 'apg_pwa_pending_version',
  lastUpdateAt: 'apg_pwa_last_update_at',
  lastMigrationResult: 'apg_pwa_cache_migration_result',
};

const SESSION_KEYS = {
  reloadedForVersion: 'apg_pwa_reloaded_for',
};

const state = {
  started: false,
  startCount: 0,
  registrationCount: 0,
  cacheClearCount: 0,
  updateStatus: 'idle',
  appVersion: '',
  installedVersion: '',
  availableVersion: '',
  serviceWorkerVersion: '',
  serviceWorkerRegistered: false,
  cacheKeys: [],
  cacheVersion: '',
  cacheAge: '',
  bootstrapSource: 'initial',
  lastUpdateTime: '',
  cacheMigrationResult: 'not_started',
  pendingReload: false,
  lastError: '',
};

let registrationPromise = null;
let versionPromise = null;
let messageListenerInstalled = false;
const listeners = new Set();

function hasWindow() {
  return typeof window !== 'undefined';
}

function safeStorage(kind = 'localStorage') {
  if (!hasWindow()) return null;
  try {
    return window[kind] || null;
  } catch {
    return null;
  }
}

function readStorage(key, fallback = '') {
  try {
    return safeStorage('localStorage')?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    safeStorage('localStorage')?.setItem(key, String(value || ''));
  } catch {}
}

function removeStorage(key) {
  try {
    safeStorage('localStorage')?.removeItem(key);
  } catch {}
}

function notify() {
  const snapshot = getPwaUpdateDiagnostics();
  listeners.forEach(listener => {
    try { listener(snapshot); } catch {}
  });
}

function markPerformance(stage, detail = {}) {
  try {
    window.__APG_PERFORMANCE_MARK__?.(stage, detail, 'service_worker');
  } catch {}
}

function setState(patch = {}) {
  Object.assign(state, patch);
  notify();
}

function isSafeToReload() {
  if (!hasWindow()) return false;
  if (window.__APG_PWA_UPDATE_LOCKED === true) return false;
  if (window.__APG_CRITICAL_ACTION_ACTIVE === true) return false;
  const active = window.__APG_PWA_CRITICAL_ACTIONS__;
  if (active && typeof active.size === 'number' && active.size > 0) return false;
  return true;
}

export function setPwaCriticalAction(name, active = true) {
  if (!hasWindow()) return;
  if (!window.__APG_PWA_CRITICAL_ACTIONS__) window.__APG_PWA_CRITICAL_ACTIONS__ = new Set();
  const key = String(name || 'default');
  if (active) window.__APG_PWA_CRITICAL_ACTIONS__.add(key);
  else window.__APG_PWA_CRITICAL_ACTIONS__.delete(key);
}

export function getPwaUpdateDiagnostics() {
  return {
    ...state,
    installedVersion: state.installedVersion || readStorage(STORAGE_KEYS.installedVersion, ''),
    cacheVersion: state.cacheVersion || readStorage(STORAGE_KEYS.cacheVersion, ''),
    lastUpdateTime: state.lastUpdateTime || readStorage(STORAGE_KEYS.lastUpdateAt, ''),
    cacheMigrationResult: state.cacheMigrationResult || readStorage(STORAGE_KEYS.lastMigrationResult, 'not_started'),
  };
}

export function subscribePwaUpdate(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  try { listener(getPwaUpdateDiagnostics()); } catch {}
  return () => listeners.delete(listener);
}

export async function fetchPwaVersion({ force = false } = {}) {
  if (versionPromise && !force) return versionPromise;
  versionPromise = fetch(`${VERSION_URL}?_=${Date.now()}`, { cache: 'no-store' })
    .then(res => res.ok ? res.json() : Promise.reject(new Error(`version.json ${res.status}`)))
    .then(data => String(data?.v || '').trim() || '?')
    .catch(error => {
      setState({ lastError: error?.message || String(error), updateStatus: 'version_failed' });
      return '?';
    });
  const version = await versionPromise;
  setState({ appVersion: version, availableVersion: version });
  return version;
}

export async function getPwaVersion() {
  if (state.availableVersion) return state.availableVersion;
  return fetchPwaVersion();
}

export async function clearPwaCaches({ reason = 'manual' } = {}) {
  const result = { reason, cacheKeys: [], cleared: 0, ok: true };
  try {
    if (hasWindow() && 'caches' in window) {
      const keys = await caches.keys();
      result.cacheKeys = keys;
      await Promise.all(keys.map(key => caches.delete(key)));
      result.cleared = keys.length;
    }
    state.cacheClearCount += 1;
    writeStorage(STORAGE_KEYS.lastMigrationResult, `ok:${reason}:${result.cleared}`);
    setState({ cacheKeys: [], cacheMigrationResult: `ok:${reason}:${result.cleared}` });
  } catch (error) {
    result.ok = false;
    result.error = error?.message || String(error);
    writeStorage(STORAGE_KEYS.lastMigrationResult, `failed:${reason}`);
    setState({ cacheMigrationResult: `failed:${reason}`, lastError: result.error });
  }
  return result;
}

async function migrateCacheForVersion(nextVersion) {
  const migrated = readStorage(STORAGE_KEYS.migratedVersion, '');
  if (migrated === nextVersion) {
    setState({ cacheMigrationResult: `skipped:${nextVersion}` });
    return { migrated: false, reason: 'already_migrated' };
  }
  const result = await clearPwaCaches({ reason: `version:${nextVersion}` });
  writeStorage(STORAGE_KEYS.migratedVersion, nextVersion);
  writeStorage(STORAGE_KEYS.cacheVersion, nextVersion);
  setState({ cacheVersion: nextVersion, cacheAge: 'fresh' });
  return { migrated: result.ok, result };
}

function installServiceWorkerListener() {
  if (!hasWindow() || messageListenerInstalled || !navigator.serviceWorker) return;
  messageListenerInstalled = true;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'APG_SW_DIAGNOSTICS_RESULT') {
      setState({
        serviceWorkerVersion: event.data.version || state.serviceWorkerVersion || '—',
        cacheKeys: Array.isArray(event.data.cacheKeys) ? event.data.cacheKeys : [],
      });
    }
    if (event.data?.type === 'APG_SW_CACHE_CLEARED') {
      setState({
        serviceWorkerVersion: event.data.version || state.serviceWorkerVersion || '—',
        cacheKeys: [],
      });
    }
  });
}

export async function requestPwaDiagnostics() {
  if (!hasWindow()) return getPwaUpdateDiagnostics();
  markPerformance('cache_ready_start', {});
  await fetchPwaVersion({ force: true });
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'APG_SW_DIAGNOSTICS' });
    } else {
      const reg = await Promise.race([
        registrationPromise || Promise.resolve(null),
        new Promise(resolve => setTimeout(() => resolve(null), 250)),
      ]);
      reg?.active?.postMessage?.({ type: 'APG_SW_DIAGNOSTICS' });
    }
  } catch {}
  markPerformance('cache_ready', {
    cacheKeys: state.cacheKeys.length,
    sw: state.serviceWorkerVersion || '',
  });
  return getPwaUpdateDiagnostics();
}

async function unregisterServiceWorkers() {
  if (!hasWindow() || !('serviceWorker' in navigator)) return [];
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(reg => reg.unregister().catch(() => false)));
  return regs;
}

export async function registerPwaServiceWorker({ noServiceWorker = false } = {}) {
  if (!hasWindow() || !('serviceWorker' in navigator)) {
    setState({ updateStatus: 'sw_unavailable', serviceWorkerRegistered: false });
    return null;
  }
  installServiceWorkerListener();
  if (noServiceWorker) {
    setState({ updateStatus: 'sw_disabled' });
    await unregisterServiceWorkers();
    await clearPwaCaches({ reason: 'no-sw' });
    return null;
  }
  if (!registrationPromise) {
    window.__APG_BOOT_MARK?.('pwa_update_sw_register_start');
    markPerformance('sw_register_start', {});
    state.registrationCount += 1;
    registrationPromise = navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
      .then(reg => {
        window.__APG_BOOT_MARK?.('pwa_update_sw_registered');
        markPerformance('sw_register', { active: Boolean(reg?.active), waiting: Boolean(reg?.waiting), installing: Boolean(reg?.installing) });
        window.__swRegPromise = registrationPromise;
        setState({ serviceWorkerRegistered: true, updateStatus: 'sw_registered' });
        return reg;
      })
      .catch(error => {
        setState({ serviceWorkerRegistered: false, updateStatus: 'sw_failed', lastError: error?.message || String(error) });
        return null;
      });
  }
  return registrationPromise;
}

export async function checkPwaUpdate({ autoReload = true } = {}) {
  markPerformance('update_check_start', {});
  const availableVersion = await fetchPwaVersion({ force: true });
  const installedVersion = readStorage(STORAGE_KEYS.installedVersion, '');
  const pendingVersion = readStorage(STORAGE_KEYS.pendingVersion, '');
  const sessionStorage = safeStorage('sessionStorage');
  const reloadedFor = sessionStorage?.getItem?.(SESSION_KEYS.reloadedForVersion) || '';
  setState({ installedVersion, availableVersion, bootstrapSource: installedVersion ? 'stored-version' : 'first-install' });
  if (!availableVersion || availableVersion === '?') {
    markPerformance('update_check', { status: 'version_unavailable' });
    return getPwaUpdateDiagnostics();
  }
  if (pendingVersion === availableVersion && reloadedFor === availableVersion) {
    writeStorage(STORAGE_KEYS.installedVersion, availableVersion);
    writeStorage(STORAGE_KEYS.cacheVersion, availableVersion);
    removeStorage(STORAGE_KEYS.pendingVersion);
    setState({ installedVersion: availableVersion, cacheVersion: availableVersion, updateStatus: 'current', pendingReload: false });
    markPerformance('update_check', { status: 'current_after_reload', version: availableVersion });
    return getPwaUpdateDiagnostics();
  }
  if (!installedVersion) {
    writeStorage(STORAGE_KEYS.installedVersion, availableVersion);
    writeStorage(STORAGE_KEYS.cacheVersion, availableVersion);
    removeStorage(STORAGE_KEYS.pendingVersion);
    setState({ installedVersion: availableVersion, cacheVersion: availableVersion, updateStatus: 'current' });
    markPerformance('update_check', { status: 'first_install', version: availableVersion });
    return getPwaUpdateDiagnostics();
  }
  if (installedVersion === availableVersion && pendingVersion !== availableVersion) {
    setState({ updateStatus: 'current', cacheVersion: readStorage(STORAGE_KEYS.cacheVersion, installedVersion) });
    markPerformance('update_check', { status: 'current', version: availableVersion });
    return getPwaUpdateDiagnostics();
  }

  setState({ updateStatus: 'update_available', pendingReload: true });
  await migrateCacheForVersion(availableVersion);
  writeStorage(STORAGE_KEYS.pendingVersion, availableVersion);
  writeStorage(STORAGE_KEYS.lastUpdateAt, new Date().toISOString());
  setState({ installedVersion, updateStatus: 'updated_pending_reload', lastUpdateTime: readStorage(STORAGE_KEYS.lastUpdateAt, ''), pendingReload: true });

  if (autoReload && reloadedFor !== availableVersion && isSafeToReload()) {
    sessionStorage?.setItem?.(SESSION_KEYS.reloadedForVersion, availableVersion);
    window.__APG_PWA_RELOAD_REQUESTED = true;
    window.__APG_BOOT_MARK?.('pwa_update_reload_requested', { from: installedVersion, to: availableVersion });
    window.location.reload();
    return getPwaUpdateDiagnostics();
  }
  if (autoReload && reloadedFor === availableVersion) {
    writeStorage(STORAGE_KEYS.installedVersion, availableVersion);
    writeStorage(STORAGE_KEYS.cacheVersion, availableVersion);
    removeStorage(STORAGE_KEYS.pendingVersion);
    setState({ installedVersion: availableVersion, cacheVersion: availableVersion, updateStatus: 'current', pendingReload: false });
  }
  markPerformance('update_check', { status: getPwaUpdateDiagnostics().updateStatus, version: availableVersion });
  return getPwaUpdateDiagnostics();
}

export async function startPwaUpdateManager({ noServiceWorker = false, autoReload = true } = {}) {
  state.startCount += 1;
  if (state.started) return getPwaUpdateDiagnostics();
  state.started = true;
  setState({ updateStatus: 'starting', bootstrapSource: 'pwa-update-manager' });
  await registerPwaServiceWorker({ noServiceWorker });
  await checkPwaUpdate({ autoReload });
  if (window.__APG_PWA_RELOAD_REQUESTED !== true) {
    window.__APG_BOOT_MARK?.('pwa_update_background_diagnostics_start');
    requestPwaDiagnostics()
      .then(() => window.__APG_BOOT_MARK?.('pwa_update_background_diagnostics_ready'))
      .catch(error => {
        window.__APG_BOOT_MARK?.('pwa_update_background_diagnostics_failed', { message: error?.message || String(error) });
      });
  }
  return getPwaUpdateDiagnostics();
}

export async function recoverPwaAndReload() {
  await unregisterServiceWorkers();
  await clearPwaCaches({ reason: 'recovery' });
  removeStorage(STORAGE_KEYS.installedVersion);
  removeStorage(STORAGE_KEYS.cacheVersion);
  removeStorage(STORAGE_KEYS.migratedVersion);
  removeStorage(STORAGE_KEYS.pendingVersion);
  if (hasWindow()) window.location.reload();
}
