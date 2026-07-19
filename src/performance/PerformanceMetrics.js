function avg(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function min(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Math.min(...nums) : 0;
}

function max(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

export function summarizeRuns(runs = []) {
  const list = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const startup = list.map(run => run.metrics?.startupMs || 0);
  const react = list.map(run => run.metrics?.reactMs || 0);
  const firebase = list.map(run => run.metrics?.firebaseMs || 0);
  const home = list.map(run => run.metrics?.homeMs || 0);
  const loki = list.map(run => run.metrics?.lokiMs || 0);
  const sw = list.map(run => run.metrics?.serviceWorkerMs || 0);
  return {
    count: list.length,
    startup: { avg: avg(startup), min: min(startup), max: max(startup) },
    react: { avg: avg(react), min: min(react), max: max(react) },
    firebase: { avg: avg(firebase), min: min(firebase), max: max(firebase) },
    home: { avg: avg(home), min: min(home), max: max(home) },
    loki: { avg: avg(loki), min: min(loki), max: max(loki) },
    serviceWorker: { avg: avg(sw), min: min(sw), max: max(sw) },
  };
}

export function collectDeviceMetrics() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
  const nav = navigator;
  const memory = performance?.memory;
  return {
    browser: nav.userAgent || '',
    platform: nav.platform || '',
    standalone: window.matchMedia?.('(display-mode: standalone)')?.matches || nav.standalone === true,
    displayMode: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    network: nav.connection?.effectiveType || nav.connection?.type || '',
    deviceMemory: nav.deviceMemory || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    memory: memory ? {
      usedJSHeapSize: memory.usedJSHeapSize || 0,
      totalJSHeapSize: memory.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
    } : null,
  };
}

export function estimateStartupFps(frames = []) {
  const list = Array.isArray(frames) ? frames.map(Number).filter(Number.isFinite) : [];
  if (list.length < 2) return 0;
  const duration = Math.max(1, list[list.length - 1] - list[0]);
  return Math.round(((list.length - 1) / duration) * 1000);
}

export function buildStageMetrics(timeline = []) {
  const byStage = new Map(timeline.map(item => [item.stage, item.relativeMs]));
  const between = (start, end) => {
    const s = byStage.get(start);
    const e = byStage.get(end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
    return Math.max(0, Math.round(e - s));
  };
  return {
    startupMs: timeline.at(-1)?.relativeMs || 0,
    reactMs: between('react_render_start', 'react_render_complete') || between('react_render_start', 'app_mounted'),
    firebaseMs: between('firebase_start', 'firebase_ready'),
    authMs: between('auth_start', 'auth_ready'),
    homeMs: between('home_render', 'home_ready'),
    lokiMs: between('loki_ready_start', 'loki_ready'),
    serviceWorkerMs: between('pwa_update_sw_register_start', 'pwa_update_sw_registered') || between('sw_register_start', 'sw_register'),
    bootstrapCriticalMs: between('bootstrap_critical_start', 'bootstrap_critical_complete'),
    bootstrapInteractiveMs: between('bootstrap_interactive_start', 'bootstrap_interactive_complete'),
    bootstrapIdleMs: between('bootstrap_idle_start', 'bootstrap_idle_complete'),
    idleMs: byStage.get('idle_complete') || 0,
  };
}
