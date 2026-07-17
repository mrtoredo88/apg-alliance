import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReferralRecoveryScanPlan, summarizeReferralRecoveryPlan } from '../server-shared/referral-state-recovery.js';

function applyPlan(referrer, users, plan) {
  const nextReferrer = {
    ...referrer,
    keys: Number(referrer.keys || 0) + Number(plan.keysAdded || 0),
    reputation: Number(referrer.reputation || 0) + Number(plan.reputationAdded || 0),
    referralCount: plan.finalReferralCount,
    referralKeys: plan.finalReferralKeys,
    referralRewardedUsers: plan.finalRewardedUsers,
  };
  const markSet = new Set(plan.usersToMarkGranted || []);
  const syncSet = new Set(plan.usersToSyncGrantedTo || []);
  const nextUsers = users.map(user => {
    if (!markSet.has(user.id) && !syncSet.has(user.id)) return { ...user };
    return {
      ...user,
      referredBy: user.referredBy || plan.referrerId,
      referralBonusGranted: true,
      referralBonusGrantedTo: plan.referrerId,
    };
  });
  return { referrer: nextReferrer, users: nextUsers };
}

const referrerId = 'tg_1670282567';

const crashBetweenCreateAndReward = buildReferralRecoveryScanPlan({
  referrerId,
  referrer: { id: referrerId, keys: 10, referralCount: 0, referralRewardedUsers: [] },
  invitedUsers: [{ id: 'email:crash@example.com', referredBy: referrerId, referralBonusGranted: false }],
});
assert.equal(crashBetweenCreateAndReward.recoveredUsers.length, 1, 'crash after user creation is recoverable');
assert.equal(crashBetweenCreateAndReward.keysAdded, 2, 'recovery grants referrer keys once');

const afterFirstRecovery = applyPlan({ id: referrerId, keys: 10, referralCount: 0, referralRewardedUsers: [] }, [{ id: 'email:crash@example.com', referredBy: referrerId, referralBonusGranted: false }], crashBetweenCreateAndReward);
const repeatRecovery = buildReferralRecoveryScanPlan({ referrerId, referrer: afterFirstRecovery.referrer, invitedUsers: afterFirstRecovery.users });
assert.equal(repeatRecovery.keysAdded, 0, 'repeat recovery is idempotent');
assert.equal(repeatRecovery.recoveredUsers.length, 0, 'already recovered user is not recovered again');
assert.equal(repeatRecovery.finalReferralCount, 1, 'repeat recovery preserves final count');
assert.equal(afterFirstRecovery.referrer.referralKeys, 2, 'recovery synchronizes referralKeys stat');

const twoTabsSecondRun = buildReferralRecoveryScanPlan({
  referrerId,
  referrer: { id: referrerId, keys: 12, referralCount: 1, referralRewardedUsers: ['email:crash@example.com'] },
  invitedUsers: [{ id: 'email:crash@example.com', referredBy: referrerId, referralBonusGranted: false }],
});
assert.equal(twoTabsSecondRun.duplicateUsers.length, 1, 'second concurrent recovery only closes invited flag');
assert.equal(twoTabsSecondRun.keysAdded, 0, 'second concurrent recovery cannot double-award keys');

const partialTransaction = buildReferralRecoveryScanPlan({
  referrerId,
  referrer: { id: referrerId, referralCount: 0, referralRewardedUsers: [] },
  invitedUsers: [{ id: 'email:partial@example.com', referredBy: referrerId, referralBonusGranted: true }],
});
assert.equal(partialTransaction.syncedUsers.length, 1, 'invitee flag without referrer array is synchronized');
assert.equal(partialTransaction.keysAdded, 0, 'syncing a flagged user does not grant keys again');
assert.equal(partialTransaction.finalReferralCount, 1, 'syncing a flagged user repairs count');

const missingReferredBy = buildReferralRecoveryScanPlan({
  referrerId,
  referrer: { id: referrerId, referralCount: 1, referralRewardedUsers: ['email:legacy@example.com'] },
  invitedUsers: [],
});
assert.equal(missingReferredBy.missingLinks.length, 1, 'rewarded user without referredBy is visible as missing link');
assert.equal(missingReferredBy.keysAdded, 0, 'missing link does not trigger blind key grant');

const multipleUsers = buildReferralRecoveryScanPlan({
  referrerId,
  referrer: { id: referrerId, referralCount: 1, referralRewardedUsers: ['email:old@example.com'] },
  invitedUsers: [
    { id: 'email:old@example.com', referredBy: referrerId, referralBonusGranted: true },
    { id: 'email:new1@example.com', referredBy: referrerId, referralBonusGranted: false },
    { id: 'email:new2@example.com', referredBy: referrerId, referralBonusGranted: false },
    { id: 'email:other@example.com', referredBy: 'tg_other', referralBonusGranted: false },
  ],
});
assert.equal(multipleUsers.recoveredUsers.length, 2, 'multiple missing users recover in one scan');
assert.equal(multipleUsers.keysAdded, 4, 'multiple recovery grants exact missing key total');
assert.equal(multipleUsers.finalReferralCount, 3, 'final count includes old and recovered users');
assert.deepEqual(summarizeReferralRecoveryPlan(multipleUsers), {
  referrerId,
  foundUsers: 3,
  rewardedUsers: 1,
  recoveredUsers: 2,
  duplicateUsers: 0,
  missingLinks: 0,
  skippedUsers: 1,
  keysAdded: 4,
  finalReferralCount: 3,
  finalReferralKeys: 6,
});

const adminActions = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
assert.ok(adminActions.includes('referrals:recoverState'), 'admin action exposes recovery scan');
assert.ok(adminActions.includes('req.body?.dryRun !== false'), 'recovery scan defaults to dry-run');
assert.ok(adminActions.includes('runTransaction'), 'apply mode is transactional');
assert.ok(adminActions.includes('referralKeys: plan.finalReferralKeys'), 'apply mode synchronizes referralKeys');

console.log('Referral recovery scan regression passed');
