import { createRoot } from 'react-dom/client';
import vkBridge from './vk.js';
import { App } from './App.jsx';
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
  vkBridge.send('VKWebAppInit').catch(() => {});

  createRoot(document.getElementById('root')).render(<App />);

  if ('serviceWorker' in navigator) {
    window.__swRegPromise = navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        if ('caches' in window) caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
        return reg;
      })
      .catch(() => null);
  }

  if (import.meta.env.MODE === 'development') {
    import('./eruda.js');
  }
}
