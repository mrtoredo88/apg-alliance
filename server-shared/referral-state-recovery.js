const REFERRAL_REWARD_KEYS = 2;
const REFERRAL_REWARD_REPUTATION = 8;

function cleanId(value) {
  return String(value ?? '').trim().slice(0, 180);
}

function uniqueList(values = []) {
  return [...new Set(values.map(cleanId).filter(Boolean))];
}

function canUseReferral(referrerId, userId) {
  return !!referrerId && !!userId && referrerId !== userId && !referrerId.startsWith('guest_') && !userId.startsWith('guest_');
}

export function buildReferralRecoveryScanPlan({ referrerId, referrer = {}, invitedUsers = [] } = {}) {
  const safeReferrerId = cleanId(referrerId);
  const currentRewardedUsers = uniqueList(referrer.referralRewardedUsers || []);
  const currentRewardedSet = new Set(currentRewardedUsers);
  const rows = uniqueList(invitedUsers.map(user => user?.id))
    .map(id => invitedUsers.find(user => cleanId(user?.id) === id))
    .filter(Boolean)
    .map(user => ({ ...user, id: cleanId(user.id), referredBy: cleanId(user.referredBy), referralBonusGrantedTo: cleanId(user.referralBonusGrantedTo) }));

  const linkedUsers = rows.filter(user => user.referredBy === safeReferrerId && canUseReferral(safeReferrerId, user.id));
  const linkedIds = uniqueList(linkedUsers.map(user => user.id));
  const linkedIdSet = new Set(linkedIds);
  const recoveredUsers = [];
  const duplicateUsers = [];
  const syncedUsers = [];
  const skippedUsers = [];

  linkedUsers.forEach(user => {
    const inRewardedArray = currentRewardedSet.has(user.id);
    const hasInviteeFlag = user.referralBonusGranted === true;
    const grantedToThisReferrer = !user.referralBonusGrantedTo || user.referralBonusGrantedTo === safeReferrerId;
    if (hasInviteeFlag && grantedToThisReferrer && !inRewardedArray) {
      syncedUsers.push({ id: user.id, reason: 'invitee_flag_present_missing_referrer_array' });
      return;
    }
    if (hasInviteeFlag && grantedToThisReferrer) {
      skippedUsers.push({ id: user.id, reason: 'already_rewarded' });
      return;
    }
    if (inRewardedArray) {
      duplicateUsers.push({ id: user.id, reason: 'referrer_array_already_contains_user' });
      return;
    }
    if (user.referralBonusGrantedTo && user.referralBonusGrantedTo !== safeReferrerId) {
      skippedUsers.push({ id: user.id, reason: 'different_granted_referrer', referralBonusGrantedTo: user.referralBonusGrantedTo });
      return;
    }
    recoveredUsers.push({ id: user.id, reason: 'missing_invitee_reward_flag_and_referrer_reward' });
  });

  const missingLinks = currentRewardedUsers
    .filter(id => !linkedIdSet.has(id))
    .map(id => ({ id, reason: 'rewarded_user_without_referredBy_link' }));
  const usersToMarkGranted = uniqueList([...recoveredUsers, ...duplicateUsers].map(user => user.id));
  const usersToSyncGrantedTo = uniqueList(syncedUsers.map(user => user.id));
  const finalRewardedUsers = uniqueList([...currentRewardedUsers, ...linkedIds]);

  return {
    referrerId: safeReferrerId,
    foundUsers: linkedUsers.length,
    rewardedUsers: linkedUsers.filter(user => user.referralBonusGranted === true || currentRewardedSet.has(user.id)).length,
    recoveredUsers,
    duplicateUsers,
    syncedUsers,
    skippedUsers,
    missingLinks,
    usersToMarkGranted,
    usersToSyncGrantedTo,
    finalRewardedUsers,
    keysAdded: recoveredUsers.length * REFERRAL_REWARD_KEYS,
    reputationAdded: recoveredUsers.length * REFERRAL_REWARD_REPUTATION,
    finalReferralCount: finalRewardedUsers.length,
    finalReferralKeys: finalRewardedUsers.length * REFERRAL_REWARD_KEYS,
    currentReferralCount: Number(referrer.referralCount || 0),
    currentReferralKeys: Number(referrer.referralKeys || 0),
    currentRewardedUsers,
  };
}

export function summarizeReferralRecoveryPlan(plan = {}) {
  return {
    referrerId: plan.referrerId || '',
    foundUsers: Number(plan.foundUsers || 0),
    rewardedUsers: Number(plan.rewardedUsers || 0),
    recoveredUsers: Array.isArray(plan.recoveredUsers) ? plan.recoveredUsers.length : 0,
    duplicateUsers: Array.isArray(plan.duplicateUsers) ? plan.duplicateUsers.length : 0,
    missingLinks: Array.isArray(plan.missingLinks) ? plan.missingLinks.length : 0,
    skippedUsers: Array.isArray(plan.skippedUsers) ? plan.skippedUsers.length : 0,
    keysAdded: Number(plan.keysAdded || 0),
    finalReferralCount: Number(plan.finalReferralCount || 0),
    finalReferralKeys: Number(plan.finalReferralKeys || 0),
  };
}
