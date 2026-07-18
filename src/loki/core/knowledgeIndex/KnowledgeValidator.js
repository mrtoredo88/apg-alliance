export function validateKnowledgeIndex(index = {}) {
  const issues = [];
  if (!Array.isArray(index.entities)) issues.push('entities_missing');
  if (!Array.isArray(index.relations)) issues.push('relations_missing');
  const seen = new Set();
  (index.entities || []).forEach(entity => {
    if (!entity.id || !entity.type || !entity.title) issues.push(`invalid_entity:${entity.key || entity.id || 'unknown'}`);
    if (seen.has(entity.key)) issues.push(`duplicate_entity:${entity.key}`);
    seen.add(entity.key);
  });
  return { valid: issues.length === 0, issues };
}
