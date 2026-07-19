import { db } from './firebase.js';
import { API_BASE_URL } from './constants.js';
import { doc, getDoc } from 'firebase/firestore';
import { userAction } from './userApi.js';
import { getPwaVersion } from './pwa/PwaUpdateManager.js';
import { apgIdentity } from './apg/index.js';

let _version = '?';
getPwaVersion().then(v => { _version = v || '?'; }).catch(() => {});

export function getDeviceInfo() {
  const ua = navigator.userAgent;

  let browser = 'Unknown';
  if (/YaBrowser/.test(ua))            browser = 'Yandex';
  else if (/SamsungBrowser/.test(ua))  browser = 'Samsung';
  else if (/VKAndroidApp|VKiOSApp/.test(ua)) browser = 'VK App';
  else if (/Edg\//.test(ua))           browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua))     browser = 'Opera';
  else if (/Firefox\//.test(ua))       browser = 'Firefox';
  else if (/Chrome\//.test(ua))        browser = 'Chrome';
  else if (/Safari\//.test(ua))        browser = 'Safari';

  let os = 'Unknown';
  if (/Android/.test(ua))              os = 'Android';
  else if (/iPhone|iPod/.test(ua))     os = 'iOS';
  else if (/iPad/.test(ua))            os = 'iPadOS';
  else if (/Windows/.test(ua))         os = 'Windows';
  else if (/Macintosh/.test(ua))       os = 'macOS';
  else if (/Linux/.test(ua))           os = 'Linux';

  let device = 'Desktop';
  if ((/Mobi|Android/.test(ua)) && !/iPad/.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/.test(ua))     device = 'Tablet';

  return { browser, os, device, appVersion: _version, online: navigator.onLine };
}

async function checkWithTimeout(fn, ms = 8000) {
  const start = performance.now();
  try {
    await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
    return { ok: true, ms: Math.round(performance.now() - start) };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - start), error: e.message ?? 'error' };
  }
}

export async function runServiceChecks() {
  const [authCheck, firestoreCheck, backendCheck] = await Promise.all([
    checkWithTimeout(async () => {
      if (!apgIdentity.getCurrentIdentity()) await apgIdentity.authenticate({ provider: 'anonymous' });
    }),
    checkWithTimeout(() => getDoc(doc(db, 'config', 'health'))),
    checkWithTimeout(() =>
      fetch(`${API_BASE_URL}/api/vk-news?health`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
    ),
  ]);
  return { auth: authCheck, firestore: firestoreCheck, backend: backendCheck };
}

export async function sendDiagReport({
  checks = {},
  errorText = '',
  timeout = 0,
  stack = null,
  manual = false,
  userId = null,
} = {}) {
  try {
    if (!apgIdentity.getCurrentIdentity()) await apgIdentity.authenticate({ provider: 'anonymous' }).catch(() => {});
    if (!apgIdentity.getCurrentIdentity()) return;
    await userAction('log:diagnostic', {
      payload: {
        ...getDeviceInfo(),
        userId: userId != null ? String(userId) : null,
        checks,
        errorText: errorText || null,
        timeout,
        stack: stack || null,
        manual,
      },
    });
  } catch {}
}
