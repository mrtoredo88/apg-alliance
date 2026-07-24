const DEFAULT_FLAGS = {
  IDENTITY_PROVIDER: 'native-apg',
  IDENTITY_STORAGE: 'postgres',
  IDENTITY_FALLBACK: '1',
  IDENTITY_DUAL_WRITE: '1',
  IDENTITY_DUAL_READ: '1',
  DATA_PROVIDER: 'postgres-api',
  MESSAGE_PROVIDER: 'postgres-api',
  SEARCH_PROVIDER: 'postgres-api',
  STORAGE_PROVIDER: 'yandex-s3',
  ACCOUNT_STORAGE: 'postgres',
  ACCOUNT_DUAL_READ: '0',
  ACCOUNT_DUAL_WRITE: '0',
  ACCOUNT_FALLBACK: '1',
  ACCOUNT_CANARY: '0',
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
