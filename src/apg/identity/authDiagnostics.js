const STORAGE_KEY = 'apg_auth_session_diagnostics';

const initialState = {
  lastRefreshAt: null,
  last401At: null,
  refreshCount: 0,
  lokiAuthStatus: 'unknown',
  lastAuthError: null,
};

export function readAuthSessionDiagnostics() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...initialState };
  }
}

export function updateAuthSessionDiagnostics(patch = {}) {
  const next = { ...readAuthSessionDiagnostics(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function getAuthSessionHealth(identity = null) {
  const diagnostics = readAuthSessionDiagnostics();
  const expiresAtMs = identity?.expiresAt ? new Date(identity.expiresAt).getTime() : 0;
  return {
    ...diagnostics,
    accessExpiresAt: identity?.expiresAt || null,
    accessExpiresInMs: Number.isFinite(expiresAtMs) && expiresAtMs > 0 ? expiresAtMs - Date.now() : null,
    refreshExpiresAt: identity?.refreshExpiresAt || identity?.expiresAt || null,
    refreshExpiresInMs: Number.isFinite(expiresAtMs) && expiresAtMs > 0 ? expiresAtMs - Date.now() : null,
  };
}
