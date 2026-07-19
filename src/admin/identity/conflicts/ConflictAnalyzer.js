function countActivity(card = {}, predicate = () => true) {
  return (card.activity || []).filter(item => item.ok && Number(item.count || 0) > 0 && predicate(item)).reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function addReason(reasons, code, points, label, details = {}) {
  reasons.push({ code, points, label, details });
}

export function calculateRisk(card = {}) {
  const reasons = [];
  if (card.type === 'DUPLICATE_EMAIL') {
    const users = card.userCards || [];
    const roles = unique(users.map(user => user.role));
    const telegrams = unique(users.map(user => user.telegramHash));
    const activeUsers = users.filter(user => Number(user.completeness?.profileScore || 0) > 8 || Number(user.keys || 0) > 0 || Number(user.referralCount || 0) > 0);
    const ownership = countActivity(card, item => item.label.startsWith('partners.ownerId') || item.label.startsWith('experts.ownerId'));
    const bookings = countActivity(card, item => item.label.includes('bookings'));
    const notifications = countActivity(card, item => item.label.startsWith('notifications.'));
    const dialogs = countActivity(card, item => item.startsWith?.('contextDialogs') || item.label.startsWith('contextDialogs'));
    const keys = users.reduce((sum, user) => sum + Number(user.keys || 0), 0);
    const referrals = users.reduce((sum, user) => sum + Number(user.referralCount || 0), 0);

    if (roles.length > 1) addReason(reasons, 'different_roles', 35, 'Accounts have different roles', { roles });
    if (telegrams.length > 1) addReason(reasons, 'different_telegram', 30, 'Accounts have different Telegram identities', { telegramHashes: telegrams });
    if (activeUsers.length > 1) addReason(reasons, 'independent_activity', 25, 'More than one account has independent profile/activity signals', { userCount: activeUsers.length });
    if (ownership > 0) addReason(reasons, 'ownership', 35, 'At least one account owns partner/expert records', { count: ownership });
    if (bookings > 0) addReason(reasons, 'bookings', 20, 'Bookings are attached to one or more accounts', { count: bookings });
    if (notifications > 0) addReason(reasons, 'notifications', 10, 'Notifications are attached to one or more accounts', { count: notifications });
    if (dialogs > 0) addReason(reasons, 'dialogs', 10, 'Dialogs are attached to one or more accounts', { count: dialogs });
    if (keys > 0) addReason(reasons, 'keys', 15, 'Keys/balance exist on one or more accounts', { total: keys });
    if (referrals > 0) addReason(reasons, 'referrals', 15, 'Referral relationships exist on one or more accounts', { total: referrals });
  } else if (card.type === 'ORPHAN_TGLINK') {
    if (card.targetExists === false) addReason(reasons, 'missing_target_user', 35, 'Telegram link points to a missing user document');
    if (!card.sameTelegramProfileHashes?.length) addReason(reasons, 'no_same_telegram_profile', 25, 'No existing profile with the same Telegram ID was found');
    if (!card.identityLinks?.length) addReason(reasons, 'no_identity_link', 10, 'No identityLink confirms a canonical target');
    if (!card.authMapAliases?.length) addReason(reasons, 'no_auth_alias', 10, 'No auth_map alias confirms a canonical target');
    const activity = countActivity(card);
    if (activity > 0) addReason(reasons, 'target_activity', 15, 'Activity exists for the target chain', { count: activity });
  }

  const score = reasons.reduce((sum, reason) => sum + Number(reason.points || 0), 0);
  const level = score >= 90 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
  return { level, score, reasons };
}

export function recommendResolution(card = {}, risk = calculateRisk(card)) {
  if (card.type === 'DUPLICATE_EMAIL') {
    if (risk.level === 'CRITICAL' || risk.level === 'HIGH') {
      return {
        code: 'KEEP_SEPARATE',
        explanation: 'Manual review should keep accounts separate unless an administrator proves a canonical/provider alias chain.',
      };
    }
    return {
      code: 'MANUAL_REVIEW',
      explanation: 'No deterministic merge rule is available in read-only mode.',
    };
  }
  if (card.type === 'ORPHAN_TGLINK') {
    return {
      code: 'MANUAL_REVIEW',
      explanation: 'Do not remap or delete orphan Telegram links without administrator approval.',
    };
  }
  return { code: 'MANUAL_REVIEW', explanation: 'Unknown conflict type.' };
}

export function analyzeConflict(card = {}) {
  const risk = calculateRisk(card);
  return {
    ...card,
    risk,
    recommendation: recommendResolution(card, risk),
    approved: false,
    pending: true,
  };
}

export function analyzeConflicts(report = {}) {
  const conflicts = (report.forensicCards || []).map(analyzeConflict);
  const riskCounts = conflicts.reduce((acc, conflict) => {
    acc[conflict.risk.level] = (acc[conflict.risk.level] || 0) + 1;
    return acc;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
  return {
    generatedAt: new Date().toISOString(),
    sourceSnapshot: report.sourceSnapshot || '',
    conflicts,
    summary: {
      total: conflicts.length,
      duplicateEmails: conflicts.filter(item => item.type === 'DUPLICATE_EMAIL').length,
      orphanTgLinks: conflicts.filter(item => item.type === 'ORPHAN_TGLINK').length,
      approved: conflicts.filter(item => item.approved === true).length,
      pending: conflicts.filter(item => item.approved !== true).length,
      riskCounts,
    },
  };
}
