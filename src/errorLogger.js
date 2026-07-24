import { auth } from './firebase.js';
import { signInAnonymously } from './auth/apgAuthCompat.js';
import { userAction } from './userApi.js';
import { getPwaVersion } from './pwa/PwaUpdateManager.js';

let _userId = null;
let _version = '?';
const _seen = new Set();
let _count = 0;
const MAX = 15;
let _initialized = false;

getPwaVersion().then(v => { _version = v || '?'; }).catch(() => {});

export function setErrorLoggerUser(uid) {
  _userId = uid;
}

function deviceInfo() {
  const ua = navigator.userAgent;
  let device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Unknown';
  let browser = /VKAndroidApp|VKiOSApp/.test(ua) ? 'VK Mini App' : /TelegramWebApp/.test(ua) ? 'Telegram' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : 'Unknown';
  let os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  return { device, browser, os };
}

function shouldIgnore(message, source, errorName = '') {
  const text = `${message} ${source} ${errorName}`.toLowerCase();
  return !message
    || /script error|resizeobserver|chrome-extension|moz-extension/.test(text)
    || /aborterror|the operation was aborted|signal is aborted|fetch is aborted|fetch.*cancelled|fetch.*canceled/.test(text)
    || /auth_timeout|_timeout\b|timeout \d+ms|public_data_missing_/.test(text)
    || /notification permission:\s*(denied|default)/.test(text)
    || /действие доступно только авторизованному пользователю|требуется авторизация|неверный email или пароль/.test(text)
    || /этот telegram уже связан с другим аккаунтом/.test(text)
    || /telegram не привязан к профилю/.test(text)
    || /missing or insufficient permissions/.test(text) && /loaduserbookings/.test(text);
}

function relatedActions() {
  const rows = Array.isArray(window.__APG_NETWORK_LOGS__) ? window.__APG_NETWORK_LOGS__ : [];
  return rows.slice(-8).map(item => ({
    at: item.ts || null,
    type: String(item.type || 'http').slice(0, 40),
    method: String(item.method || '').slice(0, 12),
    url: String(item.url || '').slice(0, 180),
    status: Number(item.status || 0),
    ok: item.ok !== false,
  }));
}

async function log(message, stack, source, errorName = '') {
  if (_count >= MAX) return;
  if (shouldIgnore(message, source, errorName)) return;

  const transientNetworkError = /failed to fetch|networkerror|load failed/i.test(String(message));
  const key = transientNetworkError
    ? `network|${String(message).slice(0, 120)}`
    : String(message).slice(0, 120) + '|' + String(source).slice(0, 80);
  if (_seen.has(key)) return;
  _seen.add(key);
  _count++;

  if (!auth.currentUser) {
    await signInAnonymously(auth).catch(() => {});
  }
  if (!auth.currentUser) return;

  const { device, browser, os } = deviceInfo();
  const route = `${window.location.pathname}${window.location.hash || ''}`.slice(0, 300);
  try {
    await userAction('log:error', {
      payload: {
        message: String(message).slice(0, 500),
        stack:   String(stack  ?? '').slice(0, 3000),
        source:  String(source ?? '').slice(0, 300),
        userId:  _userId,
        device, browser, os,
        url:     window.location.href.slice(0, 300),
        route,
        page: window.location.pathname.slice(0, 160),
        component: String(source ?? '').split(':')[0].slice(0, 160),
        userAgent: navigator.userAgent.slice(0, 300),
        relatedActions: relatedActions(),
        version: _version,
        build: _version,
        level: String(source || '').startsWith('ErrorBoundary:') ? 'critical' : transientNetworkError ? 'warning' : 'error',
        resolved: false,
      },
    });
  } catch { /* не логируем ошибки логгера */ }
}

export function logError(error, source) {
  const msg = error?.message ?? String(error);
  const stack = error?.stack ?? String(source ?? '');
  log(msg, stack, String(source ?? '').slice(0, 300), error?.name ?? '');
}

export function initErrorLogger() {
  if (_initialized || window.__APG_ERROR_LOGGER_INSTALLED__) return;
  _initialized = true;
  window.__APG_ERROR_LOGGER_INSTALLED__ = true;
  window.onerror = (msg, src, line, col, err) => {
    log(msg, err?.stack ?? `${src}:${line}:${col}`, src, err?.name ?? '');
    return false;
  };
  window.addEventListener('unhandledrejection', e => {
    const err = e.reason;
    log('Unhandled: ' + (err?.message ?? String(err)), err?.stack, window.location.pathname, err?.name ?? '');
  });
}
