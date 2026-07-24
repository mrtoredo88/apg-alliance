const STORAGE_KEY = 'apg_native_session_v1';
const listeners = new Set();

function decodePayload(token = '') {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

function buildUser(token) {
  const claims = decodePayload(token);
  if (!claims?.uid || Number(claims.exp || 0) * 1000 <= Date.now()) return null;
  return {
    uid: String(claims.uid),
    email: claims.email || null,
    displayName: claims.displayName || null,
    isAnonymous: claims.anonymous === true,
    roles: Array.isArray(claims.roles) ? claims.roles : [claims.role || 'user'],
    async getIdToken() { return token; },
    async getIdTokenResult() {
      return { token, claims, issuedAtTime: new Date(Number(claims.iat || 0) * 1000).toISOString(), expirationTime: new Date(Number(claims.exp || 0) * 1000).toISOString() };
    },
  };
}

function readStored() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

let token = readStored();
let currentUser = buildUser(token);

function emit() {
  listeners.forEach(listener => {
    try { listener(currentUser); } catch {}
  });
}

export const apgSession = {
  get currentUser() { return currentUser; },
  get token() { return token; },
  setToken(nextToken) {
    const user = buildUser(nextToken);
    if (!user) throw Object.assign(new Error('Некорректная сессия АПГ.'), { code: 'AUTH_TOKEN_INVALID' });
    token = String(nextToken);
    currentUser = user;
    try { localStorage.setItem(STORAGE_KEY, token); } catch {}
    emit();
    return user;
  },
  clear() {
    token = '';
    currentUser = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    queueMicrotask(() => listener(currentUser));
    return () => listeners.delete(listener);
  },
};
