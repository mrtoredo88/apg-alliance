import { INVARIANT_SEVERITY } from './InvariantSeverity.js';
import {
  businessReferenceCount,
  evidenceLine,
  hasBusinessEvidence,
  hasIdentityChain,
} from './InvariantEvidence.js';

const item = ({
  id,
  category,
  severity,
  evidence,
  businessImpact,
  blockingReason,
  explanation,
  source,
  payload = {},
}) => ({
  id,
  category,
  severity,
  evidence,
  businessImpact,
  blockingReason,
  explanation,
  source,
  payload,
});

export const classifyDuplicateEmail = (record = {}, index = 0) => item({
  id: `duplicate_email_${index + 1}`,
  category: 'DUPLICATE_EMAIL',
  severity: INVARIANT_SEVERITY.BLOCKING,
  evidence: [
    `Email value is attached to ${record.ids?.length || 0} identity records.`,
    `Identity records: ${(record.ids || []).join(', ') || 'unknown'}`,
  ],
  businessImpact: 'HIGH',
  blockingReason: 'Duplicate email can route one login to multiple identities and corrupt canonical user resolution.',
  explanation: 'Verify must not proceed until the owner decides whether these identities stay separate or are merged.',
  source: 'dry-run.invariants.duplicateEmails',
  payload: record,
});

export const classifyDuplicateTelegramId = (record = {}, index = 0) => item({
  id: `duplicate_telegram_${index + 1}`,
  category: 'DUPLICATE_TELEGRAM_ID',
  severity: INVARIANT_SEVERITY.BLOCKING,
  evidence: [
    `Telegram identity is attached to ${record.ids?.length || 0} identity records.`,
    `Identity records: ${(record.ids || []).join(', ') || 'unknown'}`,
  ],
  businessImpact: 'HIGH',
  blockingReason: 'Duplicate Telegram identity can create double authorization and incorrect identity linking.',
  explanation: 'Verify must not proceed while the same Telegram principal can resolve to more than one account.',
  source: 'dry-run.invariants.duplicateTelegramIds',
  payload: record,
});

export const classifyOrphanTgLink = (record = {}, index = 0) => item({
  id: `orphan_tglink_${index + 1}`,
  category: 'ORPHAN_TG_LINK',
  severity: INVARIANT_SEVERITY.BLOCKING,
  evidence: [
    `tgLink row: ${record.rowId || 'unknown'}`,
    `Target user: ${record.target || 'unknown'}`,
    'Target user is absent from the virtual identity state.',
  ],
  businessImpact: 'HIGH',
  blockingReason: 'An orphan tgLink can send Telegram login to a missing or wrong identity.',
  explanation: 'Verify must not proceed until the tgLink is manually deleted, remapped, or deferred with an explicit owner decision.',
  source: 'dry-run.invariants.orphanTgLinks',
  payload: record,
});

export const classifyUnresolvedConflict = (conflictId, index = 0) => item({
  id: `unresolved_conflict_${index + 1}`,
  category: 'UNRESOLVED_OWNER_DECISION',
  severity: INVARIANT_SEVERITY.BLOCKING,
  evidence: [
    `Conflict ID: ${conflictId}`,
    'Resolution manifest marks this conflict as pending/deferred.',
  ],
  businessImpact: 'HIGH',
  blockingReason: 'The migration contract requires explicit owner decisions before verification can trust the virtual identity state.',
  explanation: 'Verify must wait for a manual decision because automatic selection of a winning identity is forbidden.',
  source: 'resolution-manifest-v2.unresolvedConflicts',
  payload: { conflictId },
});

export const classifyBrokenReference = (record = {}, index = 0) => {
  const relatedBusinessRefs = businessReferenceCount(record);
  const evidence = [
    `Collection: ${record.collection || 'unknown'}`,
    `Field: ${record.field || 'unknown'}`,
    evidenceLine('Target user exists', record.targetExists),
    evidenceLine('Canonical chain exists', record.hasCanonical),
    evidenceLine('Alias chain exists', record.hasAlias),
    evidenceLine('Linked to current conflict', record.linkedConflict === 'YES'),
    `Business references: ${relatedBusinessRefs}`,
    `Business impact from forensic: ${record.businessImpact || 'unknown'}`,
    `Root cause from forensic: ${record.rootCause || 'unknown'}`,
  ];

  if (hasBusinessEvidence(record) || hasIdentityChain(record)) {
    return item({
      id: record.referenceId || `broken_reference_${index + 1}`,
      category: 'DANGLING_IDENTITY_REFERENCE',
      severity: INVARIANT_SEVERITY.BLOCKING,
      evidence,
      businessImpact: record.businessImpact || 'UNKNOWN',
      blockingReason: 'The broken reference still has identity-chain or business-reference evidence and can affect data integrity.',
      explanation: 'Verify must not proceed until this reference is repaired or manually classified with stronger evidence.',
      source: 'broken-references-forensic.records',
      payload: record,
    });
  }

  return item({
    id: record.referenceId || `broken_reference_${index + 1}`,
    category: 'DANGLING_IDENTITY_REFERENCE',
    severity: INVARIANT_SEVERITY.INFORMATIONAL,
    evidence,
    businessImpact: record.businessImpact || 'LOW',
    blockingReason: null,
    explanation: 'This does not block Verify because forensic evidence shows no target user, no canonical/alias chain, no linked conflict, and no business references.',
    source: 'broken-references-forensic.records',
    payload: record,
  });
};
