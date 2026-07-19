import { INVARIANT_SEVERITY, calculateReadiness } from './InvariantSeverity.js';

export const summarizeInvariants = (items = []) => {
  const counts = {
    [INVARIANT_SEVERITY.BLOCKING]: 0,
    [INVARIANT_SEVERITY.WARNING]: 0,
    [INVARIANT_SEVERITY.INFORMATIONAL]: 0,
  };
  for (const item of items) {
    if (counts[item.severity] !== undefined) counts[item.severity] += 1;
  }
  const byCategory = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  return {
    total: items.length,
    counts,
    byCategory,
    readiness: calculateReadiness(items),
  };
};
