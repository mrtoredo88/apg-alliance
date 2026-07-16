function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

export function stableAutosaveValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(stableAutosaveValue);
  if (isPlainObject(value)) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableAutosaveValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function stableAutosaveString(value) {
  return JSON.stringify(stableAutosaveValue(value));
}

export function valuesEqual(a, b) {
  return stableAutosaveString(a) === stableAutosaveString(b);
}

export function buildChangedPatch(next = {}, base = {}) {
  return Object.keys(next || {}).reduce((patch, key) => {
    if (!valuesEqual(next[key], base?.[key])) patch[key] = next[key];
    return patch;
  }, {});
}

export function hasChangedFields(next = {}, base = {}) {
  return Object.keys(buildChangedPatch(next, base)).length > 0;
}

export function profileTimestampMillis(profile = {}) {
  const source = profile.profileUpdatedAt || profile.updatedAt || profile.modifiedAt || profile.createdAt;
  if (!source) return 0;
  if (typeof source.toMillis === 'function') return source.toMillis();
  if (typeof source.seconds === 'number') return source.seconds * 1000 + Math.floor((source.nanoseconds || 0) / 1000000);
  if (typeof source === 'number') return source;
  const parsed = Date.parse(String(source));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldOfferDraftRecovery({ draftUpdatedAt = 0, serverProfile = {}, draftData = {}, serverData = {} } = {}) {
  if (!draftData || !Object.keys(draftData).length) return false;
  if (!hasChangedFields(draftData, serverData)) return false;
  const serverMillis = profileTimestampMillis(serverProfile);
  return !serverMillis || Number(draftUpdatedAt || 0) >= serverMillis;
}

export function findAutosaveConflictFields({ base = {}, server = {}, next = {} } = {}) {
  const patch = buildChangedPatch(next, base);
  return Object.keys(patch).filter(key => !valuesEqual(server?.[key], base?.[key]) && !valuesEqual(server?.[key], next?.[key]));
}
