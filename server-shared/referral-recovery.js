function cleanUserId(value) {
  return String(value ?? '').trim().slice(0, 180);
}

function canUseReferral(referrerId, userId) {
  return !!referrerId && referrerId !== userId && !referrerId.startsWith('guest_') && !userId.startsWith('guest_');
}

export function buildReferralRecoveryDecision({
  userId,
  requestedReferrerId = '',
  currentReferredBy = '',
  referralBonusGranted = false,
  referrerExists = false,
  referrerRewardedUsers = [],
} = {}) {
  const safeUserId = cleanUserId(userId);
  const requestedRef = cleanUserId(requestedReferrerId);
  const currentRef = cleanUserId(currentReferredBy);
  const effectiveReferrerId = currentRef || requestedRef;
  const hasExistingReferral = !!currentRef;
  const canAttachReferral = canUseReferral(requestedRef, safeUserId) && !hasExistingReferral;
  const validEffectiveReferral = canUseReferral(effectiveReferrerId, safeUserId);
  const alreadyRewardedByReferrer = Array.isArray(referrerRewardedUsers)
    && referrerRewardedUsers.map(String).includes(safeUserId);

  if (referralBonusGranted === true) {
    return {
      status: 'already_rewarded',
      reason: 'invited_user_already_marked',
      effectiveReferrerId,
      canAttachReferral: false,
      markInvitedRewarded: false,
      grantReferrerReward: false,
      grantInviteeReward: false,
      alreadyRewardedByReferrer,
    };
  }

  if (!effectiveReferrerId) {
    return {
      status: 'skipped',
      reason: 'no_referrer',
      effectiveReferrerId: '',
      canAttachReferral: false,
      markInvitedRewarded: false,
      grantReferrerReward: false,
      grantInviteeReward: false,
      alreadyRewardedByReferrer: false,
    };
  }

  if (!validEffectiveReferral) {
    return {
      status: 'skipped',
      reason: 'invalid_referrer',
      effectiveReferrerId,
      canAttachReferral: false,
      markInvitedRewarded: false,
      grantReferrerReward: false,
      grantInviteeReward: false,
      alreadyRewardedByReferrer,
    };
  }

  if (!referrerExists) {
    return {
      status: 'skipped',
      reason: 'referrer_not_found',
      effectiveReferrerId,
      canAttachReferral,
      markInvitedRewarded: false,
      grantReferrerReward: false,
      grantInviteeReward: false,
      alreadyRewardedByReferrer,
    };
  }

  if (alreadyRewardedByReferrer) {
    return {
      status: 'duplicate_prevented',
      reason: 'referrer_already_contains_invited_user',
      effectiveReferrerId,
      canAttachReferral,
      markInvitedRewarded: true,
      grantReferrerReward: false,
      grantInviteeReward: false,
      alreadyRewardedByReferrer: true,
    };
  }

  return {
    status: hasExistingReferral ? 'recovery_completed' : 'completed',
    reason: hasExistingReferral ? 'existing_referredBy_recovered' : 'new_referral_attached',
    effectiveReferrerId,
    canAttachReferral,
    markInvitedRewarded: true,
    grantReferrerReward: true,
    grantInviteeReward: canAttachReferral,
    alreadyRewardedByReferrer: false,
  };
}
