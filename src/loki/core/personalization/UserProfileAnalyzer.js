function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function analyzeUserProfile(userContext = {}) {
  const activityScore = Number(userContext.counts?.favorites || 0)
    + Number(userContext.counts?.bookings || 0) * 2
    + Number(userContext.counts?.visits || 0) * 2
    + Number(userContext.counts?.reviews || 0)
    + Number(userContext.level || 0);
  const experience = activityScore >= 18 ? 'experienced' : activityScore >= 6 ? 'returning' : 'new';
  const hasPersonalData = Boolean(
    userContext.role
    || userContext.keys
    || userContext.level
    || list(userContext.favoritePartners).length
    || list(userContext.favoriteExperts).length
    || list(userContext.recentBookings).length
    || list(userContext.recentVisits).length
    || list(userContext.activeBookings).length
    || list(userContext.activeEvents).length
  );
  return {
    experience,
    activityScore,
    hasPersonalData,
    shouldExplainMore: experience === 'new',
    shouldBeConcise: experience === 'experienced',
    role: userContext.role || 'user',
  };
}
