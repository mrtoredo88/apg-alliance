function linesForRisk(risk = {}) {
  return (risk.reasons || []).map(reason => `  - ${reason.code}: +${reason.points} (${reason.label})`);
}

function duplicateLines(conflict = {}) {
  const lines = [
    `Conflict ID: ${conflict.conflictId}`,
    'Type: Duplicate Email',
    `Email hash: ${conflict.emailHash}`,
  ];
  (conflict.userCards || []).forEach((user, index) => {
    lines.push(`User ${index + 1}:`);
    lines.push(`  uid hash: ${user.idHash}`);
    lines.push(`  createdAt: ${user.createdAt || '-'}`);
    lines.push(`  lastLogin/lastSeen: ${user.lastSeen || '-'}`);
    lines.push(`  roles: ${(user.roles || [user.role]).join(', ')}`);
    lines.push(`  provider: ${user.authProvider || '-'}`);
    lines.push(`  telegram hash: ${user.telegramHash || '-'}`);
    lines.push(`  keys: ${user.keys || 0}`);
    lines.push(`  referralCount: ${user.referralCount || 0}`);
    lines.push(`  profileScore: ${user.completeness?.profileScore || 0}`);
  });
  lines.push(`Risk: ${conflict.risk.level} (${conflict.risk.score})`);
  lines.push('Risk reasons:');
  lines.push(...linesForRisk(conflict.risk));
  lines.push(`Recommendation: ${conflict.recommendation.code}`);
  lines.push(`Reason: ${conflict.recommendation.explanation}`);
  return lines;
}

function orphanLines(conflict = {}) {
  const lines = [
    `Conflict ID: ${conflict.conflictId}`,
    'Type: Orphan Telegram Link',
    `Telegram hash: ${conflict.telegramIdHash}`,
    `tgLink target hash: ${conflict.targetUserIdHash || '-'}`,
    `Target exists: ${String(conflict.targetExists)}`,
    `Possible candidates: ${(conflict.sameTelegramProfileHashes || []).join(', ') || '-'}`,
    `Risk: ${conflict.risk.level} (${conflict.risk.score})`,
    'Risk reasons:',
    ...linesForRisk(conflict.risk),
    `Recommendation: ${conflict.recommendation.code}`,
    `Reason: ${conflict.recommendation.explanation}`,
  ];
  return lines;
}

export function formatConflictCard(conflict = {}) {
  return (conflict.type === 'DUPLICATE_EMAIL' ? duplicateLines(conflict) : orphanLines(conflict)).join('\n');
}

export function formatConflictCenterReport(analysis = {}, manifestPath = '') {
  const summary = analysis.summary || {};
  const risk = summary.riskCounts || {};
  return [
    'Identity Conflict Center',
    `Conflicts: ${summary.total || 0}`,
    `CRITICAL: ${risk.CRITICAL || 0}`,
    `HIGH: ${risk.HIGH || 0}`,
    `MEDIUM: ${risk.MEDIUM || 0}`,
    `LOW: ${risk.LOW || 0}`,
    `Approved: ${summary.approved || 0}`,
    `Pending: ${summary.pending || 0}`,
    `Manifest: ${manifestPath}`,
  ].join('\n');
}
