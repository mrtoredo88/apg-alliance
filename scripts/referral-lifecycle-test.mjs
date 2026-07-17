import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectReferralFromLocation, normalizeReferralValue, readPendingReferral, savePendingReferral } from '../src/referralDiagnostics.js';
import { buildReferralRecoveryDecision } from '../server-shared/referral-recovery.js';

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
assert.ok(userApp.includes("refLog('recovery completed'"), 'referral recovery completion must be diagnostically visible');
assert.ok(userApp.includes("refLog('already rewarded'"), 'idempotent repeat must be diagnostically visible');
assert.ok(userApp.includes("refLog('duplicate prevented'"), 'duplicate prevention must be diagnostically visible');
assert.ok(userApp.includes("refLog('retry after reconnect'"), 'network retry state must be diagnostically visible');

const emailCrashRecovery = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: [],
});
assert.equal(emailCrashRecovery.status, 'recovery_completed', 'partial email user is recovered on next profile:sync');
assert.equal(emailCrashRecovery.grantReferrerReward, true, 'recovery grants referrer once');
assert.equal(emailCrashRecovery.grantInviteeReward, false, 'recovery does not grant invitee keys twice when referredBy already exists');
assert.equal(emailCrashRecovery.markInvitedRewarded, true, 'recovery closes invited user flag');

const repeatLogin = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: true,
  referrerExists: true,
  referrerRewardedUsers: ['email:new@example.com'],
});
assert.equal(repeatLogin.status, 'already_rewarded', 'repeat login is idempotent');
assert.equal(repeatLogin.grantReferrerReward, false, 'repeat login cannot grant referrer twice');

const twoTabsSecondTransaction = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: ['email:new@example.com'],
});
assert.equal(twoTabsSecondTransaction.status, 'duplicate_prevented', 'second concurrent tab does not increment counters again');
assert.equal(twoTabsSecondTransaction.markInvitedRewarded, true, 'second tab can close invited flag without awarding again');
assert.equal(twoTabsSecondTransaction.grantReferrerReward, false, 'second concurrent tab cannot double-award referrer');

const freshEmailRegistration = buildReferralRecoveryDecision({
  userId: 'email:fresh@example.com',
  requestedReferrerId: 'tg_1670282567',
  currentReferredBy: '',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: [],
});
assert.equal(freshEmailRegistration.status, 'completed', 'fresh registration attaches referral');
assert.equal(freshEmailRegistration.grantInviteeReward, true, 'fresh registration grants invitee keys');

const reconnectRecovery = buildReferralRecoveryDecision({
  userId: 'email:offline@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
});
assert.equal(reconnectRecovery.status, 'recovery_completed', 'reconnect profile:sync recovers unfinished referral');

console.log('Referral lifecycle regression passed');
