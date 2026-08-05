import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { awardVisit } from '../server-shared/reward-service.js';

const consentScreen = readFileSync(new URL('../src/ConsentScreen.jsx', import.meta.url), 'utf8');
const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const emailAuth = readFileSync(new URL('../src/EmailAuth.jsx', import.meta.url), 'utf8');
const emailAuthRoute = readFileSync(new URL('../server/src/routes/email-auth.js', import.meta.url), 'utf8');

assert.match(consentScreen, /type="checkbox"/);
assert.match(consentScreen, /onSubmit=/);
assert.match(consentScreen, /type="submit"/);
assert.match(userApp, /timeoutMs: 10000/);
assert.match(userApp, /retryOnTimeout: true/);
assert.match(userActions, /writeAccountProfileRequired\(userId, accountProfileForSync/);
assert.match(userActions, /bootstrap: \{ consentAccepted: true, created \}/);
assert.match(emailAuth, /sendInFlightRef\.current/, 'rapid repeated OTP taps are blocked synchronously');
assert.match(emailAuth, /verifyInFlightRef\.current/, 'rapid repeated OTP verification taps are blocked synchronously');
assert.match(emailAuthRoute, /reusedActiveCode: true/, 'an already-sent active OTP is reused without a false auth error');

const documents = new Map([
  ['partners/seiuna', { name: 'SEIUNA', totalVisits: 0 }],
  ['stats/global', { totalScans: 0 }],
]);
const added = [];
const store = {
  async getDocument(collection, id) { return documents.get(`${collection}/${id}`) || null; },
  async updateDocument(collection, id, patch) {
    const key = `${collection}/${id}`;
    documents.set(key, { ...(documents.get(key) || {}), ...patch });
    return documents.get(key);
  },
  async addDocument(collection, data) { added.push({ collection, data }); return data; },
};
const accountCore = {
  async awardVisit() {
    return {
      replayed: false,
      alreadyAwarded: false,
      operation: { delta: 1, balanceAfter: 54 },
      streak: 1,
      scanDates: ['2026-08-04'],
      visitCount: 1,
    };
  },
};

const result = await awardVisit(store, {
  qrValue: 'seiuna',
  scannerUserId: 'email:test@example.com',
  accountCore,
});

assert.equal(result.ok, true);
assert.equal(result.awardedKeys, 1);
assert.equal(result.balanceAfter, 54);
assert.equal(added.find(entry => entry.collection === 'scans')?.data?.isNew, true);

console.log('incident-consent-qr-regression-test: ok');
