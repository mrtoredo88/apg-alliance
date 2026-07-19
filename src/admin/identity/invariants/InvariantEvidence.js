import crypto from 'node:crypto';

const IDENTITY_COLLECTIONS = new Set([
  'auth_map',
  'users',
  'canonicalUsers',
  'identityLinks',
  'emailIndex',
  'tgLinks',
  'roles',
]);

export const businessReferenceCount = record => Object.entries(record?.allRelated || {})
  .filter(([collection]) => !IDENTITY_COLLECTIONS.has(collection))
  .reduce((sum, [, count]) => sum + Number(count || 0), 0);

export const hasIdentityChain = record => Boolean(
  record?.targetExists
  || record?.hasCanonical
  || record?.hasAlias
  || record?.hasTelegramIdentity
  || record?.hasEmail,
);

export const hasBusinessEvidence = record => businessReferenceCount(record) > 0
  || record?.businessImpact === 'MEDIUM'
  || record?.businessImpact === 'HIGH'
  || record?.businessImpact === 'CRITICAL'
  || record?.linkedConflict === 'YES';

export const evidenceLine = (label, value) => `${label}: ${value ? 'YES' : 'NO'}`;

export const redactValue = value => {
  if (!value) return value;
  const hash = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
  return `[redacted:${hash}]`;
};

export const redactText = value => {
  if (!value) return value;
  if (typeof value !== 'string') return value;
  if (value.includes('@')) return redactValue(value);
  if (/^(tg_|email:|[A-Za-z0-9_-]{16,})/.test(value)) return redactValue(value);
  return value;
};
