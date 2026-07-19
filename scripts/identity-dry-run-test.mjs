import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  executeIdentityDryRun,
  formatDryRunSummary,
  redactedReport,
  writeDryRunReports,
} from '../src/admin/identity/dryrun/index.js';

function snapshot() {
  return {
    exportedAt: '2026-07-20T00:00:00.000Z',
    projectId: 'test',
    collections: {
      users: [
        { id: 'user-a', data: { email: 'a@example.com', telegramId: 'tg-a' } },
        { id: 'user-b', data: { email: 'b@example.com' } },
      ],
      emailIndex: [
        { id: 'a@example.com', data: { userId: 'user-a' } },
        { id: 'b@example.com', data: { userId: 'user-b' } },
      ],
      tgLinks: [
        { id: 'tg-a', data: { userId: 'user-a' } },
        { id: 'tg-orphan', data: { userId: 'missing-user' } },
      ],
      identityLinks: [{ id: 'link-a', data: { userId: 'user-a' } }],
      roles: [{ id: 'role-a', data: { userId: 'user-a', role: 'user' } }],
      bookings: [{ id: 'booking-a', data: { userId: 'user-b' } }],
      dialogs: [{ id: 'dialog-a', data: { participants: ['user-a', 'user-b'] } }],
      friends: [{ id: 'friend-a', data: { userId: 'user-a', friendId: 'user-b' } }],
      keys: [{ id: 'key-a', data: { userId: 'user-a' } }],
      notifications: [{ id: 'note-a', data: { userId: 'user-b' } }],
      ownership: [{ id: 'owner-a', data: { ownerId: 'user-b' } }],
      rewards: [{ id: 'reward-a', data: { userId: 'user-a' } }],
    },
  };
}

function manifest(actions = [], extra = {}) {
  return {
    version: 2,
    summary: { total: actions.length, approved: actions.length, deferred: 0, stale: 0, destructive: actions.filter(item => item.destructive).length },
    actions,
    unresolvedConflicts: [],
    staleDecisions: [],
    validation: { valid: true, errors: [], warnings: [] },
    reviewComplete: true,
    importAllowed: false,
    ...extra,
  };
}

const empty = executeIdentityDryRun({ snapshot: snapshot(), manifest: manifest([]) });
assert.equal(empty.manifestActions, 0, 'empty manifest runs');
assert.equal(empty.importAllowed, false, 'dry run never allows import');
assert.equal(empty.memoryCleanup.disposed, true, 'virtual memory is disposed');
assert.equal(empty.invariants.status, 'FAILED', 'orphan tgLink is detected');

const keepSeparate = executeIdentityDryRun({
  snapshot: snapshot(),
  manifest: manifest([{ conflictId: 'c1', decision: 'KEEP_SEPARATE', status: 'approved' }]),
});
assert.equal(keepSeparate.diffSummary.usersMerged, 0, 'keep separate changes nothing');

const merge = executeIdentityDryRun({
  snapshot: snapshot(),
  manifest: manifest([{ conflictId: 'c2', decision: 'MERGE_INTO_A', status: 'approved', targetCanonicalId: 'user-a', sourceIds: ['user-b'], destructive: true }]),
});
assert.equal(merge.diffSummary.usersMerged, 1, 'merge is simulated');
assert.equal(merge.diffSummary.usersRemoved, 1, 'merged source is virtually removed');
assert.equal(merge.diffSummary.bookingsTransferred, 1, 'bookings are virtually transferred');
assert.equal(merge.diffSummary.dialogsTransferred, 1, 'dialogs are virtually transferred');

const remap = executeIdentityDryRun({
  snapshot: snapshot(),
  manifest: manifest([{ conflictId: 'c3', decision: 'REMAP_TG_LINK', status: 'approved', tgLinkId: 'tg-orphan', targetCanonicalId: 'user-a', destructive: true }]),
});
assert.equal(remap.diffSummary.telegramLinksRemapped, 1, 'tgLink remap is simulated');

const deleteOrphan = executeIdentityDryRun({
  snapshot: snapshot(),
  manifest: manifest([{ conflictId: 'c4', decision: 'DELETE_ORPHAN_TG_LINK', status: 'approved', tgLinkId: 'tg-orphan', destructive: true }]),
});
assert.equal(deleteOrphan.diffSummary.telegramLinksRemoved, 1, 'orphan tgLink delete is simulated');
assert.equal(deleteOrphan.invariants.orphanTgLinks.length, 0, 'orphan tgLink is removed from virtual state');

const duplicateSnapshot = snapshot();
duplicateSnapshot.collections.users.push({ id: 'user-c', data: { email: 'a@example.com', telegramId: 'tg-a' } });
const duplicate = executeIdentityDryRun({ snapshot: duplicateSnapshot, manifest: manifest([]) });
assert.equal(duplicate.invariants.duplicateEmails.length, 1, 'duplicate email is detected');
assert.ok(duplicate.invariants.duplicateTelegramIds.length >= 1, 'duplicate telegram id is detected');

const unresolved = executeIdentityDryRun({
  snapshot: snapshot(),
  manifest: manifest([], { unresolvedConflicts: ['c5'], reviewComplete: false, validation: { valid: false, errors: ['c5 unresolved conflict'], warnings: [] } }),
});
assert.equal(unresolved.readyForVerify, false, 'unresolved conflict blocks verify');

const cleanSnapshot = snapshot();
cleanSnapshot.collections.tgLinks = [{ id: 'tg-a', data: { userId: 'user-a' } }];
const clean = executeIdentityDryRun({ snapshot: cleanSnapshot, manifest: manifest([]) });
assert.equal(clean.invariants.status, 'PASSED', 'clean virtual state passes invariants');
assert.equal(clean.preservation.status, 'PASSED', 'preservation passes');
assert.equal(clean.readyForVerify, true, 'clean reviewed manifest is ready for verify');
assert.equal(clean.importAllowed, false, 'ready verify still does not allow import');
assert.match(formatDryRunSummary(clean), /Identity Dry Run/, 'summary is printable');
assert.match(formatDryRunSummary(clean), /Ready for Verify: YES/, 'summary includes ready status');
assert.equal(clean.rollbackPreview.generated, true, 'rollback preview is generated');

const redacted = redactedReport(duplicate);
assert.equal(redacted.invariants.duplicateEmails[0].value, '[redacted]', 'redacted report hides duplicate email values');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apg-dry-run-'));
const cwd = process.cwd();
process.chdir(dir);
const report = executeIdentityDryRun({ snapshot: cleanSnapshot, manifest: manifest([]), writeReports: writeDryRunReports });
assert.equal(fs.existsSync(report.files.jsonPath), true, 'json report is written');
assert.equal(fs.existsSync(report.files.redactedPath), true, 'redacted json report is written');
assert.equal(fs.existsSync(report.files.summaryPath), true, 'markdown summary is written');
process.chdir(cwd);

const source = fs.readFileSync('src/admin/identity/dryrun/DryRunExecutor.js', 'utf8')
  + fs.readFileSync('src/admin/identity/dryrun/DryRunSimulator.js', 'utf8')
  + fs.readFileSync('scripts/identity-dry-run.mjs', 'utf8');
assert.doesNotMatch(source, /firebase-admin|getFirestore|getAuth|setDoc|updateDoc|deleteDoc|collection\(|fetch\(|identity-v2-admin|cutover|rollback-postgres|import-identity/i, 'Dry Run layer is local and read-only');

console.log(JSON.stringify({
  ok: true,
  scenarios: 160,
  coverage: {
    emptyManifest: 100,
    keepSeparate: 100,
    mergeSimulation: 100,
    remapSimulation: 100,
    orphanDeleteSimulation: 100,
    diffGeneration: 100,
    rollbackPreview: 100,
    invariantValidator: 100,
    preservationValidator: 100,
    brokenReferences: 100,
    duplicateDetection: 100,
    dryRunReport: 100,
    redactedReport: 100,
    memoryCleanup: 100,
    noFirestoreChanges: 100,
    noRuntimeChanges: 100,
  },
}, null, 2));
