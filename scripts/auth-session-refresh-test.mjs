import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
};

const { NativeApgProvider } = await import('../src/apg/identity/providers/NativeApgProvider.js');

let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  await Promise.resolve();
  return { ok: true, json: async () => ({ token: 'rotated-token', expiresAt: '2099-01-01T00:00:00.000Z' }) };
};

const provider = new NativeApgProvider();
await provider.authenticate({ uid: 'user-1', token: 'old-token', issuedAt: Date.now() - 22 * 86_400_000 });
const tokens = await Promise.all(Array.from({ length: 100 }, () => provider.getSessionToken()));

assert.equal(calls, 1, '100 parallel requests share one refresh operation');
assert.deepEqual(new Set(tokens), new Set(['rotated-token']));
assert.equal(provider.getCurrentIdentity().token, 'rotated-token');
assert.equal(JSON.parse(values.get('apg_native_identity')).token, 'rotated-token');

await provider.getSessionToken();
assert.equal(calls, 1, 'fresh token is reused without another refresh');

console.log('AUTH_SESSION_REFRESH_OK');
