import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

let _userId = null;
let _version = '?';
const _seen = new Set();
let _count = 0;
const MAX = 15;

fetch('/version.json').then(r => r.json()).then(d => { _version = d.v ?? '?'; }).catch(() => {});

export function setErrorLoggerUser(uid) {
  _userId = uid;
}

function deviceInfo() {
  const ua = navigator.userAgent;
  let device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Unknown';
  let browser = /VKAndroidApp|VKiOSApp/.test(ua) ? 'VK Mini App' : /TelegramWebApp/.test(ua) ? 'Telegram' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : 'Unknown';
  return { device, browser };
}

async function log(message, stack, source) {
  if (_count >= MAX) return;
  if (!message || /Script error|ResizeObserver|chrome-extension|moz-extension/.test(String(message) + String(source))) return;

  const key = String(message).slice(0, 120) + '|' + String(source).slice(0, 80);
  if (_seen.has(key)) return;
  _seen.add(key);
  _count++;

  const { device, browser } = deviceInfo();
  try {
    await addDoc(collection(db, 'errorLogs'), {
      message: String(message).slice(0, 500),
      stack:   String(stack  ?? '').slice(0, 3000),
      source:  String(source ?? '').slice(0, 300),
      userId:  _userId,
      device, browser,
      url:     window.location.href.slice(0, 300),
      version: _version,
      timestamp: serverTimestamp(),
      resolved: false,
    });
  } catch { /* не логируем ошибки логгера */ }
}

export function logError(error, source) {
  const msg = error?.message ?? String(error);
  const stack = error?.stack ?? String(source ?? '');
  log(msg, stack, String(source ?? '').slice(0, 300));
}

export function initErrorLogger() {
  window.onerror = (msg, src, line, col, err) => {
    log(msg, err?.stack ?? `${src}:${line}:${col}`, src);
    return false;
  };
  window.addEventListener('unhandledrejection', e => {
    const err = e.reason;
    log('Unhandled: ' + (err?.message ?? String(err)), err?.stack, window.location.pathname);
  });
}
