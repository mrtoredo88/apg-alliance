import { HOME_CACHE_SECTIONS, isHomeCacheSection } from './HomeCache.js';

const FORBIDDEN_KEYS = new Set([
  'token',
  'accessToken',
  'refreshToken',
  'auth',
  'password',
  'messages',
  'listener',
  'unsubscribe',
  'lokiContext',
  'runtimeState',
]);

function safeValue(value, depth = 0) {
  if (depth > 4) return null;
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 80).map(item => safeValue(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value !== 'object') return null;
  return Object.entries(value).reduce((acc, [key, item]) => {
    if (FORBIDDEN_KEYS.has(key)) return acc;
    const safe = safeValue(item, depth + 1);
    if (safe !== undefined) acc[key] = safe;
    return acc;
  }, {});
}

function hasIdentity(item) {
  return Boolean(String(item?.id || item?.canonicalId || item?.title || item?.name || '').trim());
}

function normalizeListSection(value) {
  if (!Array.isArray(value)) return null;
  return value.map(item => safeValue(item)).filter(item => item && typeof item === 'object' && hasIdentity(item));
}

function normalizeObjectSection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return safeValue(value);
}

export function sanitizeHomeCacheValue(section, value) {
  if (!isHomeCacheSection(section)) return null;
  if (section === HOME_CACHE_SECTIONS.JOURNEY) return normalizeObjectSection(value);
  return normalizeListSection(value);
}

export function validateHomeCacheRecord(record, { section, buildVersion, now = Date.now(), ttlMs = 0 } = {}) {
  if (!record || typeof record !== 'object') return { ok: false, reason: 'record_invalid' };
  if (record.section !== section) return { ok: false, reason: 'section_mismatch' };
  if (record.buildVersion !== buildVersion) return { ok: false, reason: 'build_mismatch' };
  const value = sanitizeHomeCacheValue(section, record.value);
  if (value == null) return { ok: false, reason: 'value_invalid' };
  const savedAt = Number(record.savedAt || 0);
  if (!Number.isFinite(savedAt) || savedAt <= 0) return { ok: false, reason: 'saved_at_invalid' };
  const ageMs = Math.max(0, now - savedAt);
  return {
    ok: true,
    value,
    savedAt,
    ageMs,
    expired: ttlMs > 0 ? ageMs > ttlMs : false,
  };
}
