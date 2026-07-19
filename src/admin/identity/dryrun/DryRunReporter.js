import fs from 'node:fs';
import path from 'node:path';
import { redactDiff } from './DryRunDiff.js';

export const DRY_RUN_DIR = 'backups/identity/dryrun';

export function ensureDryRunDir() {
  fs.mkdirSync(DRY_RUN_DIR, { recursive: true });
}

function statusFor(checks = [], name = '') {
  return checks.find(item => item.name === name)?.status || 'PASSED';
}

export function buildRollbackPreview(diff = {}) {
  const operations = [];
  for (const item of diff.usersRemoved || []) operations.push({ type: 'RESTORE_USER', userId: item.userId, from: item.mergedInto });
  for (const item of diff.telegramLinksRemapped || []) operations.push({ type: 'RESTORE_TG_LINK', telegramId: item.telegramId });
  for (const item of diff.telegramLinksRemoved || []) operations.push({ type: 'RESTORE_TG_LINK', telegramId: item.telegramId });
  for (const item of diff.ownershipTransferred || []) operations.push({ type: 'RESTORE_OWNERSHIP', rowId: item.rowId });
  for (const item of diff.bookingsTransferred || []) operations.push({ type: 'RESTORE_BOOKING', rowId: item.rowId });
  for (const item of diff.identityIndexUpdated || []) operations.push({ type: 'RESTORE_IDENTITY_INDEX', rowId: item.rowId });
  return { generated: true, operations };
}

export function readyForVerify({ manifest = {}, invariants = {}, diff = {} } = {}) {
  return Boolean(
    invariants.status === 'PASSED'
    && !manifest.unresolvedConflicts?.length
    && !manifest.staleDecisions?.length
    && manifest.reviewComplete === true
    && manifest.validation?.valid === true
    && !diff.errors?.length
  );
}

export function formatDryRunSummary(report = {}) {
  const p = report.preservation?.checks || [];
  return [
    'Identity Dry Run',
    `Users scanned: ${report.scanned?.users || 0}`,
    `Conflicts processed: ${report.conflictsProcessed || 0}`,
    `Manifest actions: ${report.manifestActions || 0}`,
    `Users modified: ${report.diffSummary?.usersModified || 0}`,
    `Merge operations: ${report.diffSummary?.usersMerged || 0}`,
    `Remap operations: ${report.diffSummary?.telegramLinksRemapped || 0}`,
    `Deleted orphan links: ${report.diffSummary?.telegramLinksRemoved || 0}`,
    `Bookings preserved: ${statusFor(p, 'bookings preserved')}`,
    `Dialogs preserved: ${statusFor(p, 'dialogs preserved')}`,
    `Friends preserved: ${statusFor(p, 'friends preserved')}`,
    `Keys preserved: ${statusFor(p, 'keys preserved')}`,
    `Notifications preserved: ${statusFor(p, 'notifications preserved')}`,
    `Ownership preserved: ${statusFor(p, 'ownership preserved')}`,
    `Duplicate emails: ${report.invariants?.duplicateEmails?.length || 0}`,
    `Duplicate telegram ids: ${report.invariants?.duplicateTelegramIds?.length || 0}`,
    `Orphan tgLinks: ${report.invariants?.orphanTgLinks?.length || 0}`,
    `Broken references: ${report.invariants?.danglingIdentityReferences?.length || 0}`,
    `Identity invariants: ${report.invariants?.status || 'FAILED'}`,
    `Rollback preview generated: ${report.rollbackPreview?.generated ? 'YES' : 'NO'}`,
    `Ready for Verify: ${report.readyForVerify ? 'YES' : 'NO'}`,
    `Import allowed: ${report.importAllowed ? 'true' : 'false'}`,
  ].join('\n');
}

export function buildMarkdownDryRunSummary(report = {}) {
  return [
    '# Identity Dry Run',
    '',
    '```txt',
    formatDryRunSummary(report),
    '```',
    '',
    '## Files',
    '',
    `- Snapshot: ${report.source?.snapshotPath || ''}`,
    `- Manifest: ${report.source?.manifestPath || ''}`,
    '',
    '## Invariants',
    '',
    ...(report.invariants?.checks || []).map(item => `- ${item.status}: ${item.name}`),
    '',
    '## Preservation',
    '',
    ...(report.preservation?.checks || []).map(item => `- ${item.status}: ${item.name}`),
  ].join('\n');
}

export function redactedReport(report = {}) {
  return {
    ...report,
    diff: redactDiff(report.diff || {}),
    invariants: {
      ...report.invariants,
      duplicateEmails: (report.invariants?.duplicateEmails || []).map(item => ({ value: '[redacted]', count: item.ids?.length || 0 })),
      duplicateTelegramIds: (report.invariants?.duplicateTelegramIds || []).map(item => ({ value: '[redacted]', count: item.ids?.length || 0 })),
      orphanTgLinks: (report.invariants?.orphanTgLinks || []).map(() => ({ rowId: '[redacted]', target: '[redacted]' })),
      danglingIdentityReferences: (report.invariants?.danglingIdentityReferences || []).map(item => ({ rowId: '[redacted]', field: item.field, value: '[redacted]' })),
    },
    rollbackPreview: {
      generated: report.rollbackPreview?.generated === true,
      operations: (report.rollbackPreview?.operations || []).map(item => ({ type: item.type })),
    },
  };
}

export function writeDryRunReports(report = {}) {
  ensureDryRunDir();
  const jsonPath = path.join(DRY_RUN_DIR, 'dry-run-report.json');
  const redactedPath = path.join(DRY_RUN_DIR, 'dry-run-report-redacted.json');
  const summaryPath = path.join(DRY_RUN_DIR, 'dry-run-summary.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(redactedPath, JSON.stringify(redactedReport(report), null, 2));
  fs.writeFileSync(summaryPath, buildMarkdownDryRunSummary(report));
  return { jsonPath, redactedPath, summaryPath };
}
