import {
  HOME_CACHE_SECTIONS,
  getHomeCacheBuildVersion,
} from './HomeCache.js';
import {
  cleanupHomeCacheStorage,
  readHomeCacheSection,
  writeHomeCacheSection,
} from './HomeCacheStorage.js';
import {
  markHomeCacheHit,
  markHomeCacheMiss,
  markHomeCacheRefresh,
  markHomeCacheRestore,
  markHomeCacheUpdate,
  updateHomeCacheMetrics,
} from './HomeCacheMetrics.js';

const RESTORE_SECTIONS = [
  HOME_CACHE_SECTIONS.NEWS,
  HOME_CACHE_SECTIONS.PARTNERS,
  HOME_CACHE_SECTIONS.EVENTS,
  HOME_CACHE_SECTIONS.RECOMMENDATIONS,
  HOME_CACHE_SECTIONS.JOURNEY,
];

export function areHomeCacheValuesEqual(a, b) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

export function restoreHomeCache(options = {}) {
  const startedAt = Date.now();
  const buildVersion = options.buildVersion || getHomeCacheBuildVersion();
  cleanupHomeCacheStorage(buildVersion);
  const sections = {};
  const values = {};
  let hits = 0;
  let misses = 0;
  let expired = 0;
  RESTORE_SECTIONS.forEach(section => {
    const result = readHomeCacheSection(section, { buildVersion });
    sections[section] = {
      status: result.status,
      ttlStatus: result.expired ? 'expired' : result.status === 'hit' ? 'valid' : 'missing',
      count: result.count || 0,
      ageMs: result.ageMs || 0,
      reason: result.reason || '',
    };
    if (result.status === 'hit' || result.status === 'expired') {
      hits += 1;
      if (result.expired) expired += 1;
      values[section] = result.value;
      markHomeCacheHit(section, { count: result.count, ageMs: result.ageMs, expired: result.expired });
    } else {
      misses += 1;
      markHomeCacheMiss(section, { reason: result.reason });
    }
  });
  const durationMs = Date.now() - startedAt;
  const snapshot = {
    status: hits > 0 ? 'restored' : 'miss',
    buildVersion,
    restoredAt: new Date().toISOString(),
    durationMs,
    hits,
    misses,
    expired,
    hasRestoredData: Boolean(values.news?.length || values.partners?.length || values.events?.length),
    sections,
  };
  markHomeCacheRestore({ ...snapshot, hasHit: hits > 0 });
  return { values, snapshot };
}

export function refreshHomeCacheSection(section, value, options = {}) {
  const startedAt = Date.now();
  const result = writeHomeCacheSection(section, value, options);
  const durationMs = Date.now() - startedAt;
  markHomeCacheUpdate(section, {
    changed: result.changed,
    count: result.count || 0,
    durationMs,
    reason: result.reason,
  });
  return { ...result, durationMs };
}

export function markHomeCacheRefreshComplete(detail = {}) {
  return markHomeCacheRefresh(detail);
}

export function getHomeCacheSnapshot() {
  return updateHomeCacheMetrics({});
}

export { HOME_CACHE_SECTIONS };
