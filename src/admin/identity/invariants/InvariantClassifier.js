import {
  classifyBrokenReference,
  classifyDuplicateEmail,
  classifyDuplicateTelegramId,
  classifyOrphanTgLink,
  classifyUnresolvedConflict,
} from './InvariantRules.js';
import { summarizeInvariants } from './InvariantSummary.js';

export function classifyIdentityInvariants({ dryRunReport = {}, brokenReferencesReport = {}, manifest = {} } = {}) {
  const duplicateEmails = dryRunReport.invariants?.duplicateEmails || [];
  const duplicateTelegramIds = dryRunReport.invariants?.duplicateTelegramIds || [];
  const orphanTgLinks = dryRunReport.invariants?.orphanTgLinks || [];
  const brokenReferences = brokenReferencesReport.records || [];
  const unresolved = manifest.unresolvedConflicts || dryRunReport.manifest?.unresolvedConflicts || [];

  const items = [
    ...duplicateEmails.map(classifyDuplicateEmail),
    ...duplicateTelegramIds.map(classifyDuplicateTelegramId),
    ...orphanTgLinks.map(classifyOrphanTgLink),
    ...unresolved.map(classifyUnresolvedConflict),
    ...brokenReferences.map(classifyBrokenReference),
  ];

  const summary = summarizeInvariants(items);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      dryRunGeneratedAt: dryRunReport.generatedAt || null,
      brokenReferencesGeneratedAt: brokenReferencesReport.generatedAt || null,
      manifestGeneratedAt: manifest.generatedAt || null,
    },
    summary,
    items,
    safety: {
      readOnly: true,
      firestoreChanged: false,
      runtimeChanged: false,
      apiChanged: false,
      securityRulesChanged: false,
      importExecuted: false,
      verifyExecuted: false,
      canaryExecuted: false,
      cutoverExecuted: false,
      rollbackExecuted: false,
      productionDeployed: false,
    },
  };
}
