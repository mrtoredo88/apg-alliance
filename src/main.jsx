import { createRoot } from 'react-dom/client';
import vkBridge from './vk.js';
import { App } from './App.jsx';
import { installNetworkDiagnostics } from './networkDiagnostics.js';
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
  installNetworkDiagnostics();
  window.__APG_BOOT_MARK?.('network_diagnostics_installed');
  vkBridge.send('VKWebAppInit').catch(() => {});

  window.__APG_BOOT_MARK?.('react_render_start');
  createRoot(document.getElementById('root')).render(<App />);
  window.__APG_BOOT_MARK?.('react_render_called');

  const noServiceWorker = new URLSearchParams(window.location.search).get('no-sw') === '1';
  if (noServiceWorker && 'serviceWorker' in navigator) {
    window.__APG_BOOT_MARK?.('service_worker_disabled_by_query');
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister().catch(() => {}))))
      .then(() => ('caches' in window ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))) : null))
      .catch((error) => window.__APG_BOOT_MARK?.('service_worker_disable_failed', { message: error?.message || String(error) }));
  } else if ('serviceWorker' in navigator) {
    window.__APG_BOOT_MARK?.('service_worker_register_start');
    window.__swRegPromise = navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        window.__APG_BOOT_MARK?.('service_worker_registered');
        if ('caches' in window) caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
        return reg;
      })
      .catch((error) => {
        window.__APG_BOOT_MARK?.('service_worker_register_failed', { message: error?.message || String(error) });
        return null;
      });
  }

  if (import.meta.env.MODE === 'development') {
    import('./eruda.js');
  }
}
