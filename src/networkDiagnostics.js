import { API_BASE_URL } from './constants.js';

const MAX_LOGS = 140;
const DEBUG_STORAGE_KEY = 'apg_network_diagnostics';

function getSafeUrl(input) {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    const url = new URL(raw, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(input ?? '').split('?')[0].slice(0, 180);
  }
}

function pushNetworkLog(entry) {
  if (typeof window === 'undefined') return;
  const logs = window.__APG_NETWORK_LOGS__ || [];
  logs.push({ ts: Date.now(), ...entry });
  window.__APG_NETWORK_LOGS__ = logs.slice(-MAX_LOGS);
  window.dispatchEvent(new CustomEvent('apg:network-log', { detail: entry }));
  if (window.localStorage?.getItem(DEBUG_STORAGE_KEY) === '1') {
    console.info('[APG-NET]', entry);
  }
}

export function installNetworkDiagnostics() {
  if (typeof window === 'undefined' || window.__APG_NETWORK_DIAGNOSTICS_INSTALLED__) return;
  if (typeof window.fetch !== 'function') return;
  window.__APG_NETWORK_DIAGNOSTICS_INSTALLED__ = true;
  window.__APG_NETWORK_LOGS__ = window.__APG_NETWORK_LOGS__ || [];

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const startedAt = performance.now();
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const url = getSafeUrl(input);
    try {
      const response = await originalFetch(input, init);
      pushNetworkLog({
        type: 'http',
        method,
        url,
        status: response.status || 0,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt),
        online: navigator.onLine,
      });
      return response;
    } catch (error) {
      pushNetworkLog({
        type: 'http',
        method,
        url,
        status: 0,
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
        online: navigator.onLine,
        errorName: error?.name || 'Error',
        errorMessage: error?.message || String(error),
      });
      throw error;
    }
  };
}

export function getNetworkLogs() {
  if (typeof window === 'undefined') return [];
  return [...(window.__APG_NETWORK_LOGS__ || [])].reverse();
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

export const NETWORK_DIAGNOSTIC_TARGETS = [
  {
    id: 'app',
    title: 'Сайт myapg.ru',
    url: '/version.json',
    mode: 'cors',
    required: true,
    recommendation: 'Если недоступно, проблема в DNS, CDN, SSL или доступности домена myapg.ru.',
  },
  {
    id: 'api',
    title: 'Yandex API',
    url: `${API_BASE_URL}/health`,
    mode: 'cors',
    required: true,
    recommendation: 'Если недоступно, проверьте Yandex Container, DNS, CORS и мобильную доступность API.',
  },
  {
    id: 'public-data',
    title: 'Публичные данные АПГ',
    url: `${API_BASE_URL}/api/public-data?resources=partners,experts,news,events`,
    mode: 'cors',
    required: true,
    recommendation: 'Если недоступно, главная не сможет получить данные без прямого Firestore fallback.',
  },
  {
    id: 'firebase-auth-domain',
    title: 'Firebase Auth Domain',
    url: 'https://project-apg-bbfc8.firebaseapp.com/__/auth/handler',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно без VPN, Firebase Auth может не работать у части пользователей.',
  },
  {
    id: 'firebase-identity',
    title: 'Google Identity Toolkit',
    url: 'https://identitytoolkit.googleapis.com/',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, Firebase email/anonymous/custom token auth может ломаться без VPN.',
  },
  {
    id: 'firestore',
    title: 'Firestore API',
    url: 'https://firestore.googleapis.com/',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, прямые чтения Firestore на клиенте требуют VPN. Критичные чтения надо вести через backend.',
  },
  {
    id: 'firebase-storage',
    title: 'Firebase Storage API',
    url: 'https://firebasestorage.googleapis.com/',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, любые Firebase Storage ресурсы могут не грузиться без VPN.',
  },
  {
    id: 'gstatic',
    title: 'Google Static',
    url: 'https://www.gstatic.com/firebasejs/',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, внешние Google static ресурсы нельзя использовать в критичном пути.',
  },
  {
    id: 'yandex-storage',
    title: 'Yandex Object Storage',
    url: 'https://storage.yandexcloud.net/',
    mode: 'no-cors',
    required: true,
    recommendation: 'Если недоступно, могут не открываться изображения, файлы и frontend-артефакты.',
  },
  {
    id: 'vk-api',
    title: 'VK API',
    url: 'https://api.vk.com/method/users.get?v=5.199',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, VK-сценарии и внешние новости могут работать нестабильно.',
  },
  {
    id: 'telegram-api',
    title: 'Telegram API',
    url: 'https://api.telegram.org/',
    mode: 'no-cors',
    required: false,
    recommendation: 'Если недоступно, Telegram auth и бот могут работать только через backend fallback.',
  },
];

export async function checkNetworkTarget(target, timeoutMs = 6500) {
  const startedAt = performance.now();
  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const response = await fetch(target.url, {
      method: target.mode === 'no-cors' ? 'GET' : 'GET',
      mode: target.mode || 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return {
      ...target,
      ok: target.mode === 'no-cors' ? true : response.ok,
      reachable: true,
      status: response.status || (response.type === 'opaque' ? 'opaque' : 0),
      responseType: response.type,
      durationMs: Math.round(performance.now() - startedAt),
      checkedAt: Date.now(),
    };
  } catch (error) {
    return {
      ...target,
      ok: false,
      reachable: false,
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      checkedAt: Date.now(),
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runNetworkDiagnostics(onResult) {
  const results = [];
  for (const target of NETWORK_DIAGNOSTIC_TARGETS) {
    const result = await checkNetworkTarget(target);
    results.push(result);
    if (onResult) onResult(result, [...results]);
  }
  return results;
}

export function getRuntimeNetworkInfo() {
  const nav = navigator;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone === true;
  return {
    online: nav.onLine,
    userAgent: nav.userAgent,
    language: nav.language,
    platform: nav.platform,
    standalone,
    route: `${window.location.pathname}${window.location.hash}`,
    connection: nav.connection ? {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
      saveData: nav.connection.saveData,
    } : null,
  };
}
