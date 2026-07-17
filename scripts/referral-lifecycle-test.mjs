import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectReferralFromLocation, normalizeReferralValue, readPendingReferral, savePendingReferral } from '../src/referralDiagnostics.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
  };
}

assert.equal(detectReferralFromLocation({ search: '?ref=tg_1670282567', hash: '' }), 'tg_1670282567');
assert.equal(detectReferralFromLocation({ search: '', hash: '#/home&ref=tg_1670282567' }), 'tg_1670282567');
assert.equal(normalizeReferralValue(' tg_1670282567 '), 'tg_1670282567');
assert.equal(normalizeReferralValue('user 42'), 'user 42');
assert.equal(normalizeReferralValue('bad<value'), '');

const storage = makeStorage();
assert.equal(readPendingReferral({ locationLike: { search: '?ref=tg_1670282567', hash: '', pathname: '/' }, storage, source: 'test' }), 'tg_1670282567');
assert.equal(storage.getItem('apg_pending_ref'), 'tg_1670282567');
assert.equal(readPendingReferral({ locationLike: { search: '', hash: '', pathname: '/' }, storage, source: 'test.restore' }), 'tg_1670282567');
savePendingReferral('tg_42', 'test.save', storage);
assert.equal(storage.getItem('apg_pending_ref'), 'tg_42');

const userApp = fs.readFileSync('src/UserApp.jsx', 'utf8');
const emailAuth = fs.readFileSync('src/EmailAuth.jsx', 'utf8');

const storageKeysBlock = userApp.match(/const USER_AUTH_STORAGE_KEYS = \[[\s\S]*?\];/)?.[0] || '';
assert.ok(!storageKeysBlock.includes('apg_pending_ref'), 'auth cleanup must not wipe pending referral');
assert.ok(emailAuth.includes("onSuccess(data.user, { ...data, ref, referrerId: ref })"), 'EmailAuth must pass referral to UserApp');
assert.ok(!emailAuth.includes("localStorage.removeItem('apg_pending_ref')"), 'EmailAuth must not clear referral before profile:sync confirms reward');
assert.ok(userApp.includes('...(authRefId ? { referrerId: authRefId } : {})'), 'email profile:sync must include referrerId');
assert.ok(userApp.includes('profileResult?.referralBonusAwarded'), 'email auth flow must wait for server referral award');
assert.ok(userApp.includes('syncResult?.referralBonusAwarded'), 'new user flow must clear referral only after server award');
assert.ok(userApp.includes("refLog('reward skipped'"), 'referral skips must be diagnostically visible');

console.log('Referral lifecycle regression passed');
