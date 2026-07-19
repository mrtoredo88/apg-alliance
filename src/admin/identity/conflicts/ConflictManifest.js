export function buildResolutionManifest(analysis = {}) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'read_only_manual_resolution',
    sourceSnapshot: analysis.sourceSnapshot || '',
    approvedBy: null,
    approvedAt: null,
    importAllowed: false,
    actions: (analysis.conflicts || []).map(conflict => ({
      conflictId: conflict.conflictId,
      type: 'keepSeparate',
      reason: 'Default manual-resolution placeholder. No administrator decision has been approved yet.',
      users: conflict.type === 'DUPLICATE_EMAIL'
        ? (conflict.userCards || []).map(user => user.idHash)
        : [],
      tgLink: conflict.type === 'ORPHAN_TGLINK' ? conflict.telegramIdHash : null,
      risk: conflict.risk?.level || 'LOW',
      recommendation: conflict.recommendation?.code || 'MANUAL_REVIEW',
      approved: false,
    })),
  };
}
