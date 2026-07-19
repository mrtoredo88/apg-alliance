export const INVARIANT_SEVERITY = Object.freeze({
  BLOCKING: 'BLOCKING',
  WARNING: 'WARNING',
  INFORMATIONAL: 'INFORMATIONAL',
});

export const severityRank = severity => {
  if (severity === INVARIANT_SEVERITY.BLOCKING) return 3;
  if (severity === INVARIANT_SEVERITY.WARNING) return 2;
  if (severity === INVARIANT_SEVERITY.INFORMATIONAL) return 1;
  return 0;
};

export const calculateReadiness = (items = []) => {
  const hasBlocking = items.some(item => item.severity === INVARIANT_SEVERITY.BLOCKING);
  const hasWarning = items.some(item => item.severity === INVARIANT_SEVERITY.WARNING);
  return {
    migrationReadiness: hasBlocking ? 'NO' : hasWarning ? 'CONDITIONAL' : 'YES',
    verifyReadiness: hasBlocking ? 'NO' : hasWarning ? 'CONDITIONAL' : 'YES',
    importAllowed: false,
    importAllowedReason: 'Identity invariant classification is read-only and never enables import.',
  };
};
