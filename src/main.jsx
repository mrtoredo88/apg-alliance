import { createRoot } from 'react-dom/client';
import vkBridge from './vk.js';
import { App } from './App.jsx';
import { installNetworkDiagnostics } from './networkDiagnostics.js';
import { startPwaUpdateManager } from './pwa/PwaUpdateManager.js';
import { installPwaRuntimeDiagnostics } from './pwa/PwaRuntimeDiagnostics.js';
import { API_BASE_URL } from './constants.js';
import { ensureServerReferralSession } from './referralDiagnostics.js';
import './fonts.css';
import './index.css';

// VK OAuth popup: if hash has access_token and window has an opener,
// relay the token back to the parent and close — skip app render entirely
const _vkHash = window.location.hash;
if (_vkHash.includes('access_token=') && window.opener) {
  const _p = new URLSearchParams(_vkHash.replace(/^#/, ''));
  try {
    window.opener.postMessage({
      type: 'vk_auth_callback',
      access_token: _p.get('access_token'),
      user_id: _p.get('user_id'),
    }, window.location.origin);
  } catch {}
  setTimeout(() => window.close(), 300);
} else {
  if (/^#\//.test(window.location.hash || '')) {
    const legacy = window.location.hash.slice(1);
    const [path, hashQuery = ''] = legacy.split('?');
    const currentQuery = window.location.search || '';
    const query = currentQuery || (hashQuery ? `?${hashQuery}` : '');
    window.history.replaceState({}, '', `${path || '/'}${query}`);
  }

  window.__APG_BOOT_MARK?.('main_module_loaded');
  installPwaRuntimeDiagnostics();
  installNetworkDiagnostics();
  window.__APG_BOOT_MARK?.('network_diagnostics_installed');
  window.__APG_REFERRAL_SESSION_PROMISE__ = ensureServerReferralSession({ apiBaseUrl: API_BASE_URL, source: 'main_bootstrap' }).catch((error) => {
    console.info('[REF] session bootstrap skipped', { message: error?.message || String(error) });
    return null;
  });
  vkBridge.send('VKWebAppInit').catch(() => {});
  const noServiceWorker = new URLSearchParams(window.location.search).get('no-sw') === '1';
  const renderApp = () => {
    if (window.__APG_PWA_RELOAD_REQUESTED === true) {
      window.__APG_BOOT_MARK?.('react_render_skipped_for_pwa_reload');
      return;
    }
    window.__APG_BOOT_MARK?.('react_render_start');
    createRoot(document.getElementById('root')).render(<App />);
    window.__APG_BOOT_MARK?.('react_render_called');
  };
  window.__APG_BOOT_MARK?.('pwa_update_manager_start');
  window.__APG_PWA_UPDATE_PROMISE__ = startPwaUpdateManager({ noServiceWorker, autoReload: true })
    .then(() => window.__APG_BOOT_MARK?.('pwa_update_manager_ready'))
    .catch((error) => window.__APG_BOOT_MARK?.('pwa_update_manager_failed', { message: error?.message || String(error) }))
    .finally(renderApp);

  if (import.meta.env.MODE === 'development') {
    import('./eruda.js');
  }
}
