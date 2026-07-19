const BUILD_VERSION = typeof __APG_BUILD_VERSION__ !== 'undefined' ? __APG_BUILD_VERSION__ : 'unknown';
const BUILD_TIME = typeof __APG_BUILD_TIME__ !== 'undefined' ? __APG_BUILD_TIME__ : 'unknown';

function scriptEntries() {
  return [...document.scripts]
    .map(script => script.src || '')
    .filter(Boolean)
    .map(src => {
      try {
        const url = new URL(src, window.location.href);
        return url.pathname.split('/').pop() || url.pathname;
      } catch {
        return src;
      }
    });
}

function styleEntries() {
  return [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(link => link.href || '')
    .filter(Boolean)
    .map(href => {
      try {
        const url = new URL(href, window.location.href);
        return url.pathname.split('/').pop() || url.pathname;
      } catch {
        return href;
      }
    });
}

function px(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function rectOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    centerX: Math.round(rect.left + rect.width / 2),
    centerY: Math.round(rect.top + rect.height / 2),
  };
}

function selectorLabel(element) {
  if (!element) return '';
  const marker = element.getAttribute?.('data-floating-loki-button')
    || element.getAttribute?.('data-floating-messages-button')
    || element.getAttribute?.('data-loki-floating-root')
    || element.getAttribute?.('data-apg-tab-slot')
    || '';
  const label = element.getAttribute?.('aria-label') || element.getAttribute?.('role') || '';
  const id = element.id ? `#${element.id}` : '';
  return [element.tagName, id, marker, label].filter(Boolean).join(':');
}

function elementsAt(x, y) {
  if (typeof document.elementsFromPoint !== 'function') return [];
  return document.elementsFromPoint(x, y).slice(0, 8).map(element => ({
    label: selectorLabel(element),
    pointerEvents: getComputedStyle(element).pointerEvents,
    position: getComputedStyle(element).position,
    zIndex: getComputedStyle(element).zIndex,
    transform: getComputedStyle(element).transform,
  }));
}

function safeAreaInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const result = {
    top: Math.round(px(style.paddingTop)),
    right: Math.round(px(style.paddingRight)),
    bottom: Math.round(px(style.paddingBottom)),
    left: Math.round(px(style.paddingLeft)),
  };
  probe.remove();
  return result;
}

function visualViewportState() {
  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      supported: false,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
    };
  }
  return {
    supported: true,
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
    offsetLeft: Math.round(viewport.offsetLeft),
    offsetTop: Math.round(viewport.offsetTop),
    pageLeft: Math.round(viewport.pageLeft),
    pageTop: Math.round(viewport.pageTop),
    scale: Number(viewport.scale || 1),
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight,
    bottomInset: Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)),
  };
}

function floatingLokiState() {
  const button = document.querySelector('[data-floating-loki-button="true"]');
  const root = button?.closest?.('[data-loki-floating-root]') || null;
  const messages = document.querySelector('[data-floating-messages-button="true"]');
  const buttonRect = rectOf(button);
  const rootRect = rectOf(root);
  const messagesRect = rectOf(messages);
  const safeArea = safeAreaInsets();
  const visualViewport = visualViewportState();
  const homeIndicatorRiskBottom = Math.max(24, safeArea.bottom || visualViewport.bottomInset || 0);
  const viewportHeight = visualViewport.height || window.innerHeight;
  const inSystemGestureZone = buttonRect
    ? buttonRect.bottom > viewportHeight - homeIndicatorRiskBottom
    : false;
  const centerElements = buttonRect ? elementsAt(buttonRect.centerX, buttonRect.centerY) : [];
  const lowerElements = buttonRect ? elementsAt(buttonRect.centerX, Math.max(buttonRect.top, buttonRect.bottom - 8)) : [];
  const rootStyle = root ? getComputedStyle(root) : null;
  const buttonStyle = button ? getComputedStyle(button) : null;
  return {
    found: Boolean(button),
    buttonRect,
    rootRect,
    messagesRect,
    safeArea,
    visualViewport,
    homeIndicatorRiskBottom,
    inSystemGestureZone,
    centerElements,
    lowerElements,
    rootStyle: rootStyle ? {
      position: rootStyle.position,
      zIndex: rootStyle.zIndex,
      pointerEvents: rootStyle.pointerEvents,
      transform: rootStyle.transform,
      filter: rootStyle.filter,
      bottom: rootStyle.bottom,
      right: rootStyle.right,
      left: rootStyle.left,
      width: rootStyle.width,
      height: rootStyle.height,
    } : null,
    buttonStyle: buttonStyle ? {
      position: buttonStyle.position,
      zIndex: buttonStyle.zIndex,
      pointerEvents: buttonStyle.pointerEvents,
      touchAction: buttonStyle.touchAction,
      transform: buttonStyle.transform,
      bottom: buttonStyle.bottom,
      right: buttonStyle.right,
      width: buttonStyle.width,
      height: buttonStyle.height,
    } : null,
    lastInputNearLoki: window.__APG_LAST_LOKI_INPUT__ || null,
  };
}

function installLokiInputProbe() {
  if (window.__APG_LOKI_INPUT_PROBE_INSTALLED__) return;
  window.__APG_LOKI_INPUT_PROBE_INSTALLED__ = true;
  const record = (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0] || null;
    const x = touch?.clientX ?? event.clientX;
    const y = touch?.clientY ?? event.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const button = document.querySelector('[data-floating-loki-button="true"]');
    const rect = button?.getBoundingClientRect?.();
    const near = rect
      ? x >= rect.left - 28 && x <= rect.right + 28 && y >= rect.top - 28 && y <= rect.bottom + 28
      : false;
    if (!near) return;
    window.__APG_LAST_LOKI_INPUT__ = {
      type: event.type,
      x: Math.round(x),
      y: Math.round(y),
      target: selectorLabel(event.target),
      currentTarget: selectorLabel(event.currentTarget),
      path: typeof event.composedPath === 'function' ? event.composedPath().slice(0, 8).map(selectorLabel) : [],
      atPoint: elementsAt(x, y),
      time: new Date().toISOString(),
    };
    console.info('[APG Loki Hit] Input near Loki:', window.__APG_LAST_LOKI_INPUT__);
  };
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach(type => {
    document.addEventListener(type, record, { capture: true, passive: true });
  });
}

async function versionJson() {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, version: '' };
    const data = await res.json();
    return { ok: true, status: res.status, version: String(data?.v || '') };
  } catch (error) {
    return { ok: false, status: 0, version: '', error: error?.message || String(error) };
  }
}

async function serviceWorkerState() {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  return {
    supported: true,
    controller: Boolean(navigator.serviceWorker.controller),
    controllerScript: navigator.serviceWorker.controller?.scriptURL || '',
    registrations: registrations.map(reg => ({
      scope: reg.scope,
      active: reg.active ? { scriptURL: reg.active.scriptURL, state: reg.active.state } : null,
      waiting: reg.waiting ? { scriptURL: reg.waiting.scriptURL, state: reg.waiting.state } : null,
      installing: reg.installing ? { scriptURL: reg.installing.scriptURL, state: reg.installing.state } : null,
    })),
  };
}

async function cacheStorageState() {
  if (!('caches' in window)) return { supported: false, names: [], entries: [] };
  const names = await caches.keys().catch(() => []);
  const entries = [];
  for (const name of names) {
    const cache = await caches.open(name).catch(() => null);
    if (!cache) continue;
    const requests = await cache.keys().catch(() => []);
    entries.push({
      name,
      js: requests.map(req => req.url).filter(url => /\.js($|\?)/.test(url)),
      css: requests.map(req => req.url).filter(url => /\.css($|\?)/.test(url)),
      html: requests.map(req => req.url).filter(url => /\/$|\.html($|\?)/.test(url)),
      otherCount: requests.filter(req => !/\.(js|css|html)($|\?)/.test(req.url)).length,
    });
  }
  return { supported: true, names, entries };
}

export async function collectPwaRuntimeDiagnostics() {
  const [version, serviceWorker, cacheStorage] = await Promise.all([
    versionJson(),
    serviceWorkerState(),
    cacheStorageState(),
  ]);
  const loadedScripts = scriptEntries();
  const loadedStyles = styleEntries();
  const diagnostics = {
    runningBundle: loadedScripts.find(name => /^index-|^UserApp-|^main-/.test(name)) || loadedScripts[0] || '',
    buildVersion: BUILD_VERSION,
    buildTime: BUILD_TIME,
    commit: BUILD_VERSION,
    versionJson: version,
    versionMismatch: Boolean(version.version && version.version !== BUILD_VERSION),
    loadedScripts,
    loadedStyles,
    serviceWorker,
    cacheStorage,
    floatingLoki: floatingLokiState(),
    manifestHref: document.querySelector('link[rel="manifest"]')?.href || '/manifest.json',
    standalone: window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true,
    userAgent: navigator.userAgent,
    checkedAt: new Date().toISOString(),
  };
  window.__APG_BUILD_DIAGNOSTICS__ = diagnostics;
  console.info('[APG Runtime] Running bundle:', diagnostics.runningBundle);
  console.info('[APG Runtime] Build version:', diagnostics.buildVersion);
  console.info('[APG Runtime] Build time:', diagnostics.buildTime);
  console.info('[APG Runtime] Commit:', diagnostics.commit);
  console.info('[APG Runtime] version.json:', diagnostics.versionJson.version || diagnostics.versionJson.status);
  if (diagnostics.versionMismatch) console.warn('[APG Runtime] Version mismatch:', diagnostics);
  else console.info('[APG Runtime] Diagnostics:', diagnostics);
  return diagnostics;
}

export function installPwaRuntimeDiagnostics() {
  if (typeof window === 'undefined') return;
  window.__APG_BUILD_VERSION__ = BUILD_VERSION;
  window.__APG_BUILD_TIME__ = BUILD_TIME;
  window.__APG_COLLECT_PWA_DIAGNOSTICS__ = collectPwaRuntimeDiagnostics;
  window.__APG_LOKI_PWA_HIT_DIAGNOSTICS__ = floatingLokiState;
  installLokiInputProbe();
  collectPwaRuntimeDiagnostics().catch(error => {
    console.warn('[APG Runtime] Diagnostics failed:', error?.message || String(error));
  });
}
