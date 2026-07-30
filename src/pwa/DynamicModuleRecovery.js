import { recoverPwaAndReload } from './PwaUpdateManager.js';

const RECOVERY_KEY = 'apg_dynamic_module_recovery_at';
const RECOVERY_COOLDOWN_MS = 60_000;
const MODULE_ERROR_PATTERN = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|load failed/i;

export function isDynamicModuleLoadError(error) {
  return MODULE_ERROR_PATTERN.test(String(error?.message || error || ''));
}

export function recoverDynamicModuleFailure(error, source = 'unknown') {
  if (!isDynamicModuleLoadError(error) || typeof window === 'undefined') return false;
  let previous = 0;
  try {
    previous = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Date.now() - previous < RECOVERY_COOLDOWN_MS) return false;
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch {}
  window.__APG_BOOT_MARK?.('dynamic_module_recovery', {
    source,
    message: String(error?.message || error || '').slice(0, 300),
  });
  void recoverPwaAndReload();
  return true;
}

export function installDynamicModuleRecovery() {
  if (typeof window === 'undefined' || window.__APG_DYNAMIC_MODULE_RECOVERY_INSTALLED__) return;
  window.__APG_DYNAMIC_MODULE_RECOVERY_INSTALLED__ = true;
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault?.();
    recoverDynamicModuleFailure(event.payload || new Error('Failed to fetch dynamically imported module'), 'vite:preloadError');
  });
}
