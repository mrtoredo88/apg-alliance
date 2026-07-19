export const ALLOWED_CONFLICT_TYPES = new Set(['DUPLICATE_EMAIL', 'ORPHAN_TGLINK']);
export const ALLOWED_MANIFEST_ACTIONS = new Set(['keepSeparate']);

export function validateConflictReport(report = {}) {
  const errors = [];
  if (!report || typeof report !== 'object') errors.push('report must be an object');
  if (!Array.isArray(report.forensicCards)) errors.push('forensicCards must be an array');
  (report.forensicCards || []).forEach((card, index) => {
    if (!card.conflictId) errors.push(`forensicCards[${index}].conflictId is required`);
    if (!ALLOWED_CONFLICT_TYPES.has(card.type)) errors.push(`forensicCards[${index}].type is invalid`);
  });
  return { valid: errors.length === 0, errors };
}

export function validateResolutionManifest(manifest = {}) {
  const errors = [];
  if (manifest.version !== 1) errors.push('version must be 1');
  if (!manifest.generatedAt) errors.push('generatedAt is required');
  if (!Array.isArray(manifest.actions)) errors.push('actions must be an array');
  (manifest.actions || []).forEach((action, index) => {
    if (!ALLOWED_MANIFEST_ACTIONS.has(action.type)) errors.push(`actions[${index}].type is not allowed in read-only mode`);
    if (!action.conflictId) errors.push(`actions[${index}].conflictId is required`);
    if (action.approved !== false) errors.push(`actions[${index}].approved must be false`);
  });
  return { valid: errors.length === 0, errors };
}
