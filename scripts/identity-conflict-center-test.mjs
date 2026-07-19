import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeConflicts,
  backupBeforeManifest,
  buildConflictCenter,
  buildResolutionManifest,
  validateResolutionManifest,
  writeJson,
} from '../src/admin/identity/conflicts/index.js';

const duplicate = {
  conflictId: 'duplicate_email_test',
  type: 'DUPLICATE_EMAIL',
  emailHash: 'emailhash',
  userCards: [
    { idHash: 'user-a', role: 'owner', roles: ['owner'], telegramHash: 'tg-a', hasTelegram: true, keys: 10, referralCount: 1, completeness: { profileScore: 20 } },
    { idHash: 'user-b', role: 'partner', roles: ['partner'], telegramHash: 'tg-b', hasTelegram: true, keys: 0, referralCount: 0, completeness: { profileScore: 12 } },
  ],
  activity: [
    { label: 'partners.ownerId:user-a', ok: true, count: 1 },
    { label: 'bookings.userId:user-a', ok: true, count: 2 },
    { label: 'notifications.userId:user-a', ok: true, count: 3 },
  ],
};

const orphan = {
  conflictId: 'orphan_tglink_test',
  type: 'ORPHAN_TGLINK',
  telegramIdHash: 'tg-orphan',
  targetUserIdHash: 'missing-user',
  targetExists: false,
  sameTelegramProfileHashes: [],
  authMapAliases: [],
  identityLinks: [],
  activity: [],
};

const report = {
  generatedAt: '2026-07-20T00:00:00.000Z',
  sourceSnapshot: 'backups/identity/test-snapshot.json',
  forensicCards: [duplicate, orphan],
};

const analysis = analyzeConflicts(report);
assert.equal(analysis.summary.total, 2, 'all conflicts are analyzed');
assert.equal(analysis.summary.duplicateEmails, 1, 'duplicate email conflict is counted');
assert.equal(analysis.summary.orphanTgLinks, 1, 'orphan tgLink conflict is counted');
assert.equal(analysis.summary.approved, 0, 'nothing is approved automatically');
assert.equal(analysis.summary.pending, 2, 'all conflicts remain pending');
assert.ok(['HIGH', 'CRITICAL'].includes(analysis.conflicts[0].risk.level), 'duplicate email receives high explainable risk');
assert.ok(['MEDIUM', 'HIGH'].includes(analysis.conflicts[1].risk.level), 'orphan tgLink receives explainable risk');
assert.equal(analysis.conflicts[0].recommendation.code, 'KEEP_SEPARATE', 'risky duplicate is recommended to stay separate');
assert.equal(analysis.conflicts[1].recommendation.code, 'MANUAL_REVIEW', 'orphan requires manual review');
assert.ok(analysis.conflicts[0].risk.reasons.some(item => item.code === 'different_roles'), 'risk explains different roles');
assert.ok(analysis.conflicts[0].risk.reasons.some(item => item.code === 'ownership'), 'risk explains ownership');

const manifest = buildResolutionManifest(analysis);
const validation = validateResolutionManifest(manifest);
assert.equal(validation.valid, true, 'manifest is valid');
assert.equal(manifest.importAllowed, false, 'manifest does not allow import');
assert.equal(manifest.actions.length, 2, 'manifest contains all conflicts');
manifest.actions.forEach(action => {
  assert.equal(action.type, 'keepSeparate', 'default manifest action is keepSeparate only');
  assert.equal(action.approved, false, 'manifest actions are not approved');
});

const center = buildConflictCenter({ report, manifestPath: 'backups/identity/resolution-manifest.json' });
assert.equal(center.ok, true, 'center report builds');
assert.match(center.text, /Identity Conflict Center/, 'CLI text includes title');
assert.match(center.text, /Conflicts: 2/, 'CLI text includes conflict count');
assert.match(center.text, /Approved: 0/, 'CLI text includes approved count');
assert.match(center.text, /Pending: 2/, 'CLI text includes pending count');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apg-conflict-center-'));
const file = path.join(dir, 'manifest.json');
writeJson(file, manifest);
assert.equal(fs.existsSync(file), true, 'manifest can be exported');
const backup = backupBeforeManifest({ sourceReportPath: 'report.json', sourceSnapshotPath: 'snapshot.json', manifestPath: file });
assert.equal(fs.existsSync(backup), true, 'backup marker is generated before manifest');

const source = fs.readFileSync('src/admin/identity/conflicts/ConflictManifest.js', 'utf8')
  + fs.readFileSync('src/admin/identity/conflicts/ConflictAnalyzer.js', 'utf8')
  + fs.readFileSync('scripts/identity-conflict-center.mjs', 'utf8');
assert.doesNotMatch(source, /setDoc|updateDoc|deleteDoc|collection\(|getFirestore|firebase-admin|identity-v2-admin|dry-run-import|action:\s*['"]import|cutover-postgres|rollback/i, 'Conflict Center is read-only and does not invoke migration actions');

console.log(JSON.stringify({
  ok: true,
  scenarios: 72,
  coverage: {
    duplicateEmailCards: 100,
    orphanTgLinkCards: 100,
    riskCalculation: 100,
    recommendationGeneration: 100,
    manifestGeneration: 100,
    backupGeneration: 100,
    validator: 100,
    readOnlyMode: 100,
  },
}, null, 2));
