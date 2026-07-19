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
  collectPwaRuntimeDiagnostics().catch(error => {
    console.warn('[APG Runtime] Diagnostics failed:', error?.message || String(error));
  });
}
