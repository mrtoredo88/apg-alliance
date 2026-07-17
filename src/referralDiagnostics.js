export const PENDING_REF_STORAGE_KEY = 'apg_pending_ref';
const REF_TRACE_KEY = 'apg_ref_trace';
const REF_FLOW_KEY = 'apg_ref_flow_id';
const REF_FLOW_REF_KEY = 'apg_ref_flow_ref';
const REF_DEVICE_KEY = 'apg_ref_device_id';
const REF_EVENT_QUEUE_KEY = 'apg_ref_events_queue';
const REF_LOCAL_SESSION_KEY = 'apg_ref_local_session_id';
const REF_SERVER_SESSION_KEY = 'apg_referral_session_id';

const STAGE_EVENT_TYPES = {
  'query detected': 'REF_QUERY_DETECTED',
  saved: 'REF_QUERY_SAVED',
  'auth start': 'REF_AUTH_STARTED',
  'auth success': 'REF_AUTH_COMPLETED',
  'auth error': 'REFERRAL_FAILED',
  'user created': 'REF_USER_CREATED',
  'profile sync started': 'PROFILE_SYNC_STARTED',
  'recovery completed': 'REFERRAL_RECOVERY_COMPLETED',
  'already rewarded': 'REFERRAL_ALREADY_GRANTED',
  'duplicate prevented': 'REFERRAL_DUPLICATE_PREVENTED',
  'recovery skipped': 'REFERRAL_FAILED',
  'retry after reconnect': 'REFERRAL_FAILED',
  'friend added': 'REFERRAL_ATTACHED',
  'reward granted': 'REFERRAL_REWARD_GRANTED',
  'session created': 'REF_SESSION_CREATED',
  'session restored': 'REF_SESSION_RESTORED',
  'session missing': 'REF_SESSION_MISSING',
};

function getLocalStorage() {
  try {
    return globalThis?.localStorage || null;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  try {
    return globalThis?.sessionStorage || null;
  } catch {
    return null;
  }
}

function createId(prefix) {
  try {
    const bytes = new Uint8Array(8);
    globalThis?.crypto?.getRandomValues?.(bytes);
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex) return `${prefix}_${hex}`;
  } catch {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
  const hasUnsafeChars = Array.from(clean).some(char => {
    const code = char.charCodeAt(0);
    return code < 32 || char === '<' || char === '>';
  });
  return clean && !hasUnsafeChars ? clean : '';
}

function getOrCreateStorageId(storage, key, prefix) {
  const current = normalizeReferralValue(storage?.getItem?.(key));
  if (current) return current;
  const id = createId(prefix);
  storage?.setItem?.(key, id);
  return id;
}

export function getReferralContext({ ref = '', source = 'unknown' } = {}) {
  const local = getLocalStorage();
  const session = getSessionStorage();
  const pendingRef = normalizeReferralValue(ref || local?.getItem?.(PENDING_REF_STORAGE_KEY));
  const serverSessionId = normalizeReferralValue(local?.getItem?.(REF_SERVER_SESSION_KEY));
  const storedFlowRef = normalizeReferralValue(local?.getItem?.(REF_FLOW_REF_KEY));
  if (pendingRef && storedFlowRef && storedFlowRef !== pendingRef) {
    local?.removeItem?.(REF_FLOW_KEY);
  }
  const flowId = getOrCreateStorageId(local, REF_FLOW_KEY, 'ref_flow');
  if (pendingRef) local?.setItem?.(REF_FLOW_REF_KEY, pendingRef);
  return {
    referralFlowId: flowId,
    sessionId: serverSessionId || getOrCreateStorageId(session || local, REF_LOCAL_SESSION_KEY, 'ref_session'),
    referralSessionId: serverSessionId,
    deviceId: getOrCreateStorageId(local, REF_DEVICE_KEY, 'ref_device'),
    platform: [
      globalThis?.matchMedia?.('(display-mode: standalone)')?.matches || globalThis?.navigator?.standalone === true ? 'pwa' : 'browser',
      globalThis?.navigator?.userAgentData?.platform || globalThis?.navigator?.platform || '',
    ].filter(Boolean).join(':').slice(0, 120),
    referralCode: pendingRef,
    source,
  };
}

export function getStoredReferralSessionId(storage = getLocalStorage()) {
  return normalizeReferralValue(storage?.getItem?.(REF_SERVER_SESSION_KEY));
}

export function saveReferralSessionId(value, storage = getLocalStorage()) {
  const id = normalizeReferralValue(value);
  if (!id || !storage) return '';
  storage.setItem(REF_SERVER_SESSION_KEY, id);
  return id;
}

export async function ensureServerReferralSession({ apiBaseUrl = '', ref = '', source = 'client' } = {}) {
  const local = getLocalStorage();
  const currentRef = readPendingReferral({ source, storage: local });
  const referralCode = normalizeReferralValue(ref || currentRef);
  const referralSessionId = getStoredReferralSessionId(local);
  if (!apiBaseUrl || (!referralCode && !referralSessionId)) return null;
  const context = getReferralContext({ ref: referralCode, source });
  const body = {
    ref: referralCode || undefined,
    referralCode: referralCode || undefined,
    referralSessionId: referralSessionId || undefined,
    referralFlowId: context.referralFlowId,
    referralDeviceId: context.deviceId,
    referralPlatform: context.platform,
    source,
  };
  const response = await fetch(`${apiBaseUrl}/api/referral-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  const id = data?.session?.id || data?.referralSessionId || '';
  if (response.ok && id) {
    saveReferralSessionId(id, local);
    refLog(data.created ? 'session created' : 'session restored', { value: referralCode || data.session?.referrerId || '', referralCode: referralCode || data.session?.referrerId || '', source, referralSessionId: id });
    return { ...data, referralSessionId: id };
  }
  if (referralSessionId) refLog('session missing', { source, referralSessionId, referralCode });
  return data;
}

function appendReferralEvent(type, status, details = {}) {
  const storage = getLocalStorage();
  if (!storage || !type) return null;
  const context = getReferralContext({ ref: details.value || details.referrerId || details.referralCode, source: details.source || details.stage || 'client' });
  const event = {
    id: createId('ref_event'),
    timestamp: new Date().toISOString(),
    type,
    status,
    referrerId: String(details.referrerId || details.value || details.referralCode || context.referralCode || '').trim(),
    referredUserId: String(details.userId || '').trim(),
    referralCode: String(details.value || details.referralCode || context.referralCode || '').trim(),
    referralFlowId: context.referralFlowId,
    sessionId: context.sessionId,
    deviceId: context.deviceId,
    platform: context.platform,
    source: String(details.source || details.stage || context.source || 'client').slice(0, 120),
    attempt: 1,
    metadata: safeDetails(details),
  };
  try {
    const current = JSON.parse(storage.getItem(REF_EVENT_QUEUE_KEY) || '[]');
    storage.setItem(REF_EVENT_QUEUE_KEY, JSON.stringify([...current.slice(-79), event]));
  } catch {}
  return event;
}

export function drainReferralEventQueue(storage = getLocalStorage()) {
  try {
    const current = JSON.parse(storage?.getItem?.(REF_EVENT_QUEUE_KEY) || '[]');
    storage?.removeItem?.(REF_EVENT_QUEUE_KEY);
    return Array.isArray(current) ? current.slice(-80) : [];
  } catch {
    return [];
  }
}

export function refLog(stage, details = {}) {
  try {
    const entry = { at: new Date().toISOString(), stage, ...safeDetails(details) };
    console.info('[REF]', stage, entry);
    const storage = getLocalStorage();
    if (storage) {
      const current = JSON.parse(storage.getItem(REF_TRACE_KEY) || '[]');
      storage.setItem(REF_TRACE_KEY, JSON.stringify([...current.slice(-39), entry]));
    }
    const type = STAGE_EVENT_TYPES[stage] || '';
    if (type) appendReferralEvent(type, type === 'REFERRAL_FAILED' ? 'error' : 'info', details);
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
  if (normalizeReferralValue(storage.getItem(REF_FLOW_REF_KEY)) !== ref) {
    storage.removeItem(REF_FLOW_KEY);
    storage.setItem(REF_FLOW_REF_KEY, ref);
  }
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
