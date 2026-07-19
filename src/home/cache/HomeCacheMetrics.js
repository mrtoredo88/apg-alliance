import { markPerformance } from '../../performance/PerformanceMarks.js';

const INITIAL_METRICS = {
  status: 'idle',
  lastRestoreMs: 0,
  lastRefreshMs: 0,
  lastUpdateMs: 0,
  hits: 0,
  misses: 0,
  expired: 0,
  updates: 0,
  sections: {},
};

function hasWindow() {
  return typeof window !== 'undefined';
}

export function getHomeCacheMetrics() {
  if (!hasWindow()) return { ...INITIAL_METRICS };
  if (!window.__APG_HOME_CACHE__) window.__APG_HOME_CACHE__ = { ...INITIAL_METRICS, sections: {} };
  return window.__APG_HOME_CACHE__;
}

export function updateHomeCacheMetrics(patch = {}) {
  if (!hasWindow()) return { ...INITIAL_METRICS, ...patch };
  const current = getHomeCacheMetrics();
  window.__APG_HOME_CACHE__ = {
    ...current,
    ...patch,
    sections: {
      ...(current.sections || {}),
      ...(patch.sections || {}),
    },
  };
  return window.__APG_HOME_CACHE__;
}

export function markHomeCacheRestore(detail = {}) {
  markPerformance('home_cache_restore', detail, 'home');
  return updateHomeCacheMetrics({
    status: detail.hasHit ? 'restored' : 'miss',
    lastRestoreMs: Math.round(detail.durationMs || 0),
    hits: Number(detail.hits || 0),
    misses: Number(detail.misses || 0),
    expired: Number(detail.expired || 0),
    sections: detail.sections || {},
  });
}

export function markHomeCacheHit(section, detail = {}) {
  markPerformance('home_cache_hit', { section, ...detail }, 'home');
  const current = getHomeCacheMetrics();
  return updateHomeCacheMetrics({
    hits: (current.hits || 0) + 1,
    sections: {
      [section]: {
        ...(current.sections?.[section] || {}),
        status: detail.expired ? 'expired_hit' : 'hit',
        ttlStatus: detail.expired ? 'expired' : 'valid',
        count: detail.count || 0,
        ageMs: detail.ageMs || 0,
      },
    },
  });
}

export function markHomeCacheMiss(section, detail = {}) {
  markPerformance('home_cache_miss', { section, ...detail }, 'home');
  const current = getHomeCacheMetrics();
  return updateHomeCacheMetrics({
    misses: (current.misses || 0) + 1,
    sections: {
      [section]: {
        ...(current.sections?.[section] || {}),
        status: 'miss',
        ttlStatus: 'missing',
        count: 0,
        reason: detail.reason || 'missing',
      },
    },
  });
}

export function markHomeCacheRefresh(detail = {}) {
  markPerformance('home_cache_refresh', detail, 'home');
  return updateHomeCacheMetrics({
    status: 'refreshed',
    lastRefreshMs: Math.round(detail.durationMs || 0),
  });
}

export function markHomeCacheUpdate(section, detail = {}) {
  markPerformance('home_cache_update', { section, ...detail }, 'home');
  const current = getHomeCacheMetrics();
  return updateHomeCacheMetrics({
    updates: (current.updates || 0) + 1,
    lastUpdateMs: Math.round(detail.durationMs || 0),
    sections: {
      [section]: {
        ...(current.sections?.[section] || {}),
        status: detail.changed ? 'updated' : 'unchanged',
        ttlStatus: 'valid',
        count: detail.count || 0,
        changed: Boolean(detail.changed),
      },
    },
  });
}
