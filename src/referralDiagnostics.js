export const PENDING_REF_STORAGE_KEY = 'apg_pending_ref';
const REF_TRACE_KEY = 'apg_ref_trace';

function getLocalStorage() {
  try {
    return globalThis?.localStorage || null;
  } catch {
    return null;
  }
}

function safeDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null
        ? value
        : JSON.stringify(value).slice(0, 240),
    ]),
  );
}

export function normalizeReferralValue(value) {
  const clean = String(value ?? '').trim().slice(0, 180);
  return clean && !/[\u0000-\u001F<>]/.test(clean) ? clean : '';
}

export function refLog(stage, details = {}) {
  try {
    const entry = { at: new Date().toISOString(), stage, ...safeDetails(details) };
    console.info('[REF]', stage, entry);
    const storage = getLocalStorage();
    if (!storage) return;
    const current = JSON.parse(storage.getItem(REF_TRACE_KEY) || '[]');
    storage.setItem(REF_TRACE_KEY, JSON.stringify([...current.slice(-39), entry]));
  } catch {}
}

export function detectReferralFromLocation(locationLike = globalThis?.location) {
  try {
    const search = new URLSearchParams(locationLike?.search || '');
    const fromSearch = normalizeReferralValue(search.get('ref'));
    if (fromSearch) return fromSearch;
    const hash = String(locationLike?.hash || '');
    const match = hash.match(/[#&?]ref[=_]([^&#]+)/);
    return normalizeReferralValue(match ? decodeURIComponent(match[1]) : '');
  } catch {
    return '';
  }
}

export function savePendingReferral(value, source = 'unknown', storage = getLocalStorage()) {
  const ref = normalizeReferralValue(value);
  if (!ref || !storage) return '';
  storage.setItem(PENDING_REF_STORAGE_KEY, ref);
  refLog('saved', { value: ref, source });
  return ref;
}

export function readPendingReferral({ locationLike = globalThis?.location, storage = getLocalStorage(), source = 'unknown', persistFromUrl = true } = {}) {
  const fromUrl = detectReferralFromLocation(locationLike);
  if (fromUrl) {
    refLog('query detected', {
      value: fromUrl,
      source,
      pathname: locationLike?.pathname || '',
      search: locationLike?.search || '',
      hash: locationLike?.hash || '',
      isPWA: globalThis?.matchMedia?.('(display-mode: standalone)')?.matches || globalThis?.navigator?.standalone === true,
      userAgent: globalThis?.navigator?.userAgent || '',
    });
    return persistFromUrl ? savePendingReferral(fromUrl, source, storage) : fromUrl;
  }
  const stored = normalizeReferralValue(storage?.getItem?.(PENDING_REF_STORAGE_KEY));
  if (stored) refLog('restored', { value: stored, source });
  return stored;
}

export function clearPendingReferral(reason = 'unknown', storage = getLocalStorage()) {
  const ref = normalizeReferralValue(storage?.getItem?.(PENDING_REF_STORAGE_KEY));
  storage?.removeItem?.(PENDING_REF_STORAGE_KEY);
  refLog('cleared', { value: ref, reason });
}
