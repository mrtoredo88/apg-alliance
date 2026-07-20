const DEFAULT_FLAGS = {
  ACCOUNT_STORAGE: 'firestore',
  ACCOUNT_DUAL_READ: '0',
  ACCOUNT_DUAL_WRITE: '0',
  ACCOUNT_FALLBACK: '1',
  ACCOUNT_CANARY: '0',
};

export function getAccountFlag(name, fallback = '') {
  const key = String(name || '').trim();
  return process.env[key] || DEFAULT_FLAGS[key] || fallback;
}

export function getAccountFlags(overrides = {}) {
  return {
    ...DEFAULT_FLAGS,
    ...Object.fromEntries(Object.keys(DEFAULT_FLAGS).map(key => [key, getAccountFlag(key)])),
    ...overrides,
  };
}

export function isAccountPostgresPrimary(flags = getAccountFlags()) {
  return String(flags.ACCOUNT_STORAGE || '').toLowerCase() === 'postgres';
}

export function isAccountDualReadEnabled(flags = getAccountFlags()) {
  return String(flags.ACCOUNT_DUAL_READ || '') === '1' || String(flags.ACCOUNT_DUAL_READ || '').toLowerCase() === 'true';
}

export function isAccountDualWriteEnabled(flags = getAccountFlags()) {
  return String(flags.ACCOUNT_DUAL_WRITE || '') === '1' || String(flags.ACCOUNT_DUAL_WRITE || '').toLowerCase() === 'true';
}

export function isAccountFallbackEnabled(flags = getAccountFlags()) {
  return String(flags.ACCOUNT_FALLBACK || '') !== '0' && String(flags.ACCOUNT_FALLBACK || '').toLowerCase() !== 'false';
}

export const APG_ACCOUNT_FLAGS = DEFAULT_FLAGS;
