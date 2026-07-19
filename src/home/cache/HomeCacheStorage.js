import {
  HOME_CACHE_MAX_BYTES,
  HOME_CACHE_PREFIX,
  HOME_CACHE_STORAGE_KEYS,
  HOME_CACHE_TTL_MS,
  HOME_CACHE_VERSION,
  getHomeCacheBuildVersion,
  isHomeCacheSection,
} from './HomeCache.js';
import { sanitizeHomeCacheValue, validateHomeCacheRecord } from './HomeCacheValidator.js';

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

function byteSize(value) {
  return new Blob([String(value || '')]).size;
}

function readJson(key) {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

function writeJson(key, value) {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getHomeCacheKey(section) {
  return HOME_CACHE_STORAGE_KEYS[section] || '';
}

export function cleanupHomeCacheStorage(buildVersion = getHomeCacheBuildVersion()) {
  if (!hasStorage()) return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(HOME_CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach(key => {
    const section = Object.entries(HOME_CACHE_STORAGE_KEYS).find(([, value]) => value === key)?.[0];
    const record = readJson(key);
    if (!section || record?.buildVersion !== buildVersion || record?.version !== HOME_CACHE_VERSION) {
      try { localStorage.removeItem(key); } catch {}
    }
  });
}

export function readHomeCacheSection(section, options = {}) {
  if (!isHomeCacheSection(section)) return { status: 'miss', reason: 'unknown_section', value: null, count: 0 };
  const buildVersion = options.buildVersion || getHomeCacheBuildVersion();
  const key = getHomeCacheKey(section);
  const record = readJson(key);
  const ttlMs = HOME_CACHE_TTL_MS[section] || 0;
  const validated = validateHomeCacheRecord(record, { section, buildVersion, ttlMs });
  if (!validated.ok) {
    if (record) {
      try { localStorage.removeItem(key); } catch {}
    }
    return { status: 'miss', reason: validated.reason, value: null, count: 0 };
  }
  const count = Array.isArray(validated.value) ? validated.value.length : Object.keys(validated.value || {}).length;
  return {
    status: validated.expired ? 'expired' : 'hit',
    reason: validated.expired ? 'ttl_expired' : 'ok',
    value: validated.value,
    count,
    ageMs: validated.ageMs,
    savedAt: validated.savedAt,
    expired: validated.expired,
  };
}

export function estimateHomeCacheSize() {
  if (!hasStorage()) return 0;
  return Object.values(HOME_CACHE_STORAGE_KEYS).reduce((sum, key) => {
    try {
      return sum + byteSize(localStorage.getItem(key) || '');
    } catch {
      return sum;
    }
  }, 0);
}

export function writeHomeCacheSection(section, value, options = {}) {
  if (!isHomeCacheSection(section)) return { ok: false, reason: 'unknown_section', changed: false };
  const safeValue = sanitizeHomeCacheValue(section, value);
  if (safeValue == null) return { ok: false, reason: 'invalid_value', changed: false };
  const buildVersion = options.buildVersion || getHomeCacheBuildVersion();
  cleanupHomeCacheStorage(buildVersion);
  const key = getHomeCacheKey(section);
  const prevRaw = hasStorage() ? localStorage.getItem(key) : '';
  const record = {
    version: HOME_CACHE_VERSION,
    buildVersion,
    section,
    savedAt: Date.now(),
    value: safeValue,
  };
  const raw = JSON.stringify(record);
  if (byteSize(raw) > HOME_CACHE_MAX_BYTES) return { ok: false, reason: 'section_too_large', changed: false };
  const otherSize = estimateHomeCacheSize() - byteSize(prevRaw || '');
  if (otherSize + byteSize(raw) > HOME_CACHE_MAX_BYTES) cleanupHomeCacheStorage(buildVersion);
  const changed = prevRaw ? JSON.stringify(readJson(key)?.value) !== JSON.stringify(safeValue) : true;
  const ok = writeJson(key, record);
  return {
    ok,
    reason: ok ? 'ok' : 'write_failed',
    changed,
    count: Array.isArray(safeValue) ? safeValue.length : Object.keys(safeValue || {}).length,
    bytes: byteSize(raw),
  };
}

export function clearHomeCacheSection(section) {
  const key = getHomeCacheKey(section);
  if (!key || !hasStorage()) return;
  try { localStorage.removeItem(key); } catch {}
}
