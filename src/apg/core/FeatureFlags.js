const DEFAULT_FLAGS = {
  IDENTITY_PROVIDER: 'firebase',
  DATA_PROVIDER: 'firestore',
  MESSAGE_PROVIDER: 'firestore',
  SEARCH_PROVIDER: 'firestore',
  STORAGE_PROVIDER: 'yandex-s3',
};

function readEnvFlag(name) {
  try {
    return import.meta.env?.[`VITE_${name}`] || '';
  } catch {
    return '';
  }
}

function readStorageFlag(name) {
  try {
    return localStorage.getItem(`apg_${name.toLowerCase()}`) || '';
  } catch {
    return '';
  }
}

export function getFoundationFlag(name, fallback = '') {
  const key = String(name || '').trim();
  if (!key) return fallback;
  return readEnvFlag(key) || readStorageFlag(key) || DEFAULT_FLAGS[key] || fallback;
}

export function getFoundationFlags() {
  return Object.fromEntries(Object.keys(DEFAULT_FLAGS).map(key => [key, getFoundationFlag(key)]));
}

export const APG_FOUNDATION_FLAGS = DEFAULT_FLAGS;
