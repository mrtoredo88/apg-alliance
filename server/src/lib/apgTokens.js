import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = String(process.env.APG_SESSION_SECRET || '');
  if (value.length >= 32) return value;
  if (process.env.NODE_ENV === 'test') return 'apg-test-session-secret-change-me-0001';
  throw Object.assign(new Error('APG session secret is not configured.'), { code: 'APG_SESSION_SECRET_NOT_CONFIGURED' });
}

function encode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(input) {
  return createHmac('sha256', secret()).update(input).digest('base64url');
}

export function createApgAccessToken(uid, claims = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const safeClaims = { ...(claims || {}) };
  for (const key of ['iss', 'aud', 'sub', 'uid', 'iat', 'exp', 'jti']) delete safeClaims[key];
  const header = encode({ alg: 'HS256', typ: 'APG' });
  const payload = encode({
    iss: 'apg',
    aud: 'ru.myapg.app',
    sub: String(uid),
    uid: String(uid),
    iat: now,
    exp: now + Number(options.ttlSeconds || ACCESS_TTL_SECONDS),
    jti: randomBytes(12).toString('hex'),
    ...safeClaims,
  });
  const input = `${header}.${payload}`;
  return `${input}.${signature(input)}`;
}

export function verifyApgAccessToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Invalid APG token.'), { code: 'AUTH_TOKEN_INVALID' });
  const input = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(input));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw Object.assign(new Error('Invalid APG token signature.'), { code: 'AUTH_TOKEN_INVALID' });
  }
  const payload = decode(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'apg' || payload.aud !== 'ru.myapg.app' || !payload.uid || Number(payload.exp || 0) <= now) {
    throw Object.assign(new Error('Expired or invalid APG token.'), { code: 'AUTH_TOKEN_EXPIRED' });
  }
  return payload;
}

export const apgTokenAuth = {
  createCustomToken(uid, claims = {}) {
    return Promise.resolve(createApgAccessToken(uid, claims));
  },
  verifyIdToken(token) {
    return Promise.resolve(verifyApgAccessToken(token));
  },
  revokeRefreshTokens() {
    return Promise.resolve();
  },
  updateUser(uid, patch = {}) {
    return Promise.resolve({ uid: String(uid), ...patch });
  },
  setCustomUserClaims() {
    return Promise.resolve();
  },
  createUser(input = {}) {
    const uid = String(input.uid || `email:${String(input.email || '').trim().toLowerCase()}`);
    return Promise.resolve({ uid, ...input });
  },
};
