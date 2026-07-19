import { getPwaUpdateDiagnostics } from '../pwa/PwaUpdateManager.js';
import { getBootstrapSnapshot } from '../bootstrap/index.js';
import { getHomeCacheSnapshot } from '../home/cache/index.js';
import { getFirebaseStartupSnapshot } from '../firebase/resilience/index.js';
import { collectDeviceMetrics, summarizeRuns } from './PerformanceMetrics.js';
import { readPerformanceRuns } from './PerformanceStorage.js';

function buildVersion() {
  if (typeof window === 'undefined') return 'unknown';
  return window.__APG_BUILD_VERSION__ || window.__APG_BUILD_DIAGNOSTICS__?.buildVersion || 'unknown';
}

function swVersion() {
  try {
    return getPwaUpdateDiagnostics().serviceWorkerVersion || '—';
  } catch {
    return '—';
  }
}

export function buildPerformanceExport(report) {
  const device = report?.device || collectDeviceMetrics();
  const metrics = report?.metrics || {};
  const firebaseStartup = report?.firebaseStartup || {};
  return [
    'APG Performance Report',
    `Version: ${report?.version || buildVersion()}`,
    `Build time: ${report?.buildTime || (typeof window !== 'undefined' ? window.__APG_BUILD_TIME__ : 'unknown')}`,
    `SW: ${report?.serviceWorkerVersion || swVersion()}`,
    `Device: ${device.platform || '—'}`,
    `Browser: ${device.browser || '—'}`,
    `Mode: ${device.displayMode || 'browser'}`,
    `Viewport: ${device.viewport || '—'}`,
    `Network: ${device.network || '—'}`,
    `Startup: ${metrics.startupMs || 0} ms`,
    `React: ${metrics.reactMs || 0} ms`,
    `Firebase: ${metrics.firebaseMs || 0} ms`,
    `Firebase Startup: ${firebaseStartup.status || '—'}`,
    `Firebase Attempts: ${firebaseStartup.attempts || 0}`,
    `Firebase Recovery: ${firebaseStartup.recoveryMs || metrics.firebaseRecoveryMs || 0} ms`,
    `Auth: ${metrics.authMs || 0} ms`,
    `Home: ${metrics.homeMs || 0} ms`,
    `Loki: ${metrics.lokiMs || 0} ms`,
    `SW register: ${metrics.serviceWorkerMs || 0} ms`,
    `Bootstrap Critical: ${metrics.bootstrapCriticalMs || 0} ms`,
    `Bootstrap Interactive: ${metrics.bootstrapInteractiveMs || 0} ms`,
    `Bootstrap Idle: ${metrics.bootstrapIdleMs || 0} ms`,
    `Home Shell: ${metrics.homeShellMs || 0} ms`,
    `Home News: ${metrics.homeNewsMs || 0} ms`,
    `Home Partners: ${metrics.homePartnersMs || 0} ms`,
    `Home Events: ${metrics.homeEventsMs || 0} ms`,
    `Home Journey: ${metrics.homeJourneyMs || 0} ms`,
    `Home Loki: ${metrics.homeLokiHydrationMs || 0} ms`,
    `Home Recommendations: ${metrics.homeRecommendationsMs || 0} ms`,
    `Home Cache Restore: ${metrics.homeCacheRestoreMs || 0} ms`,
    `Home Cache Refresh: ${metrics.homeCacheRefreshMs || 0} ms`,
    `FPS: ${report?.fps || 0}`,
  ].join('\n');
}

export function buildPerformanceReport({ timeline = [], metrics = {}, fps = 0, renderCounts = {}, frames = [] } = {}) {
  const history = readPerformanceRuns();
  return {
    id: `perf-${Date.now()}`,
    createdAt: new Date().toISOString(),
    version: buildVersion(),
    buildTime: typeof window !== 'undefined' ? window.__APG_BUILD_TIME__ || 'unknown' : 'unknown',
    bundleVersion: typeof window !== 'undefined' ? window.__APG_BUILD_DIAGNOSTICS__?.runningBundle || '' : '',
    serviceWorkerVersion: swVersion(),
    bootstrap: getBootstrapSnapshot(),
    homeCache: getHomeCacheSnapshot(),
    firebaseStartup: getFirebaseStartupSnapshot(),
    device: collectDeviceMetrics(),
    timeline,
    metrics,
    fps,
    renderCounts,
    frameCount: frames.length,
    summary: summarizeRuns(history),
  };
}
