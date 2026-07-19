import { diffSummary } from './DryRunDiff.js';
import { simulateDryRun } from './DryRunSimulator.js';
import { createDryRunState, disposeDryRunState, snapshotCounts } from './DryRunState.js';
import { buildRollbackPreview, readyForVerify } from './DryRunReporter.js';
import { validateInvariants, validatePreservation } from './DryRunValidator.js';

export function executeIdentityDryRun({ snapshot = {}, manifest = {}, source = {}, writeReports = null } = {}) {
  const state = createDryRunState(snapshot);
  const startedAt = new Date().toISOString();
  const diff = simulateDryRun(state, manifest);
  const after = snapshotCounts(state);
  const invariants = validateInvariants(state, manifest, diff);
  const preservation = validatePreservation(state.before, after);
  const rollbackPreview = buildRollbackPreview(diff);
  const report = {
    version: 1,
    mode: 'read_only_memory_simulation',
    generatedAt: new Date().toISOString(),
    startedAt,
    completedAt: new Date().toISOString(),
    source,
    scanned: {
      users: state.before.users,
      identityIndex: state.before.identityIndex,
      telegramLinks: state.before.telegramLinks,
    },
    conflictsProcessed: manifest.summary?.total || manifest.unresolvedConflicts?.length || manifest.actions?.length || 0,
    manifestActions: manifest.actions?.length || 0,
    operations: state.operations,
    before: state.before,
    after,
    diff,
    diffSummary: diffSummary(diff),
    invariants,
    preservation,
    rollbackPreview,
    readyForVerify: readyForVerify({ manifest, invariants, diff }),
    importAllowed: false,
  };
  const memory = disposeDryRunState(state);
  report.memoryCleanup = { disposed: memory.disposed === true };
  if (writeReports) report.files = writeReports(report);
  return report;
}
