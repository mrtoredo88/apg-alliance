export function formatReviewSummary(summary = {}) {
  return [
    'Identity Manual Review Workflow',
    `Conflicts: ${summary.total || 0}`,
    `Approved: ${summary.approved || 0}`,
    `Deferred/Pending: ${summary.deferred ?? summary.pending ?? 0}`,
    `Stale: ${summary.stale || 0}`,
    `Destructive decisions: ${summary.destructive || 0}`,
    `Review complete: ${String(Boolean(summary.reviewComplete))}`,
    `Import allowed: ${String(false)}`,
  ].join('\n');
}

export function buildMarkdownReviewReport(session = {}, manifest = {}) {
  const lines = [
    '# Identity Manual Review Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Review complete: ${String(Boolean(manifest.reviewComplete))}`,
    `Import allowed: ${String(false)}`,
    '',
    '## Summary',
    '',
    `- Total: ${manifest.summary?.total || 0}`,
    `- Approved: ${manifest.summary?.approved || 0}`,
    `- Deferred: ${manifest.summary?.deferred || 0}`,
    `- Stale: ${manifest.summary?.stale || 0}`,
    `- Destructive: ${manifest.summary?.destructive || 0}`,
    '',
    '## Conflicts',
    '',
  ];
  for (const conflict of session.conflicts || []) {
    const decision = (session.decisions || []).find(item => item.conflictId === conflict.conflictId) || {};
    lines.push(`### ${conflict.conflictId}`);
    lines.push('');
    lines.push(`- Type: ${conflict.type}`);
    lines.push(`- Risk: ${conflict.risk?.level || 'LOW'} (${conflict.risk?.score || 0})`);
    lines.push(`- Recommendation: ${conflict.recommendation?.code || 'MANUAL_REVIEW'}`);
    lines.push(`- Manual decision: ${decision.decision || 'DEFER'}`);
    lines.push(`- Status: ${decision.status || 'pending'}`);
    lines.push(`- Reason: ${decision.reason || '-'}`);
    lines.push(`- Reviewer: ${decision.reviewedBy || '-'}`);
    lines.push(`- Source fingerprint: ${decision.sourceFingerprint ? 'present' : 'missing'}`);
    lines.push(`- Destructive: ${String(Boolean(decision.destructive))}`);
    lines.push(`- Second review required: ${String(Boolean(decision.secondReviewRequired))}`);
    lines.push('');
  }
  if (manifest.validation?.errors?.length) {
    lines.push('## Validation Errors', '');
    manifest.validation.errors.forEach(error => lines.push(`- ${error}`));
  }
  return `${lines.join('\n')}\n`;
}
