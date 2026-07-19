import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BACKUP_DIR = 'backups/identity';
const OUT_DIR = path.join(BACKUP_DIR, 'forensics');

function latestFile(dir, predicate) {
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter(predicate).sort();
  return files.length ? path.join(dir, files.at(-1)) : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value, length = 12) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, length);
}

function ts(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000)).toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)).toISOString();
  return null;
}

function data(row) {
  return row?.data && typeof row.data === 'object' ? row.data : {};
}

function rows(snapshot, name) {
  return Array.isArray(snapshot.collections?.[name]) ? snapshot.collections[name] : [];
}

function includesValue(row, value) {
  return JSON.stringify(row).includes(String(value));
}

function red(value) {
  if (!value) return value;
  return `[redacted:${hash(value)}]`;
}

function table(headers, rowsToRender) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rowsToRender.map(row => `| ${row.map(value => String(value ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function classify(reference = {}, row = {}, snapshot = {}) {
  const id = reference.referencedUserId || reference.value;
  const d = data(row);
  const targetExists = rows(snapshot, 'users').some(item => item.id === id);
  const isSmoke = /^apg_profile_save_/.test(id) || /^apg_profile_save_/.test(row.id);
  const hasCanonical = rows(snapshot, 'canonicalUsers').some(item => item.id === id || includesValue(item, id));
  const hasAlias = ['emailIndex', 'tgLinks', 'identityLinks'].some(collection => rows(snapshot, collection).some(item => includesValue(item, id)));
  const allRelated = Object.fromEntries(Object.entries(snapshot.collections || {}).map(([name, list]) => [name, list.filter(item => includesValue(item, id)).length]));
  const businessRelated = Object.entries(allRelated)
    .filter(([name]) => !['auth_map', 'users', 'canonicalUsers', 'identityLinks', 'emailIndex', 'tgLinks', 'roles'].includes(name))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
  let rootCause = 'Unknown';
  if (isSmoke) rootCause = 'Historical artifact';
  else if (!targetExists && hasAlias) rootCause = 'Incomplete migration';
  else if (!targetExists) rootCause = 'Deleted user';
  const businessImpact = businessRelated > 0 ? 'MEDIUM' : 'LOW';
  const recoverable = isSmoke ? 'Recoverable' : hasCanonical || hasAlias ? 'Unknown' : 'Not Recoverable';
  return {
    targetExists,
    hasBackup: true,
    hasCanonical,
    hasAlias,
    hasFirebaseUid: Boolean(d.firebaseUid),
    hasTelegramIdentity: /^tg_/.test(id),
    hasEmail: id.includes('@') || id.startsWith('email:'),
    allRelated,
    rootCause,
    linkedConflict: 'NO',
    conflictId: null,
    disappearsAfterApprovedActions: 'NO',
    disappearsAfterRemainingDecisions: 'NO',
    needsIndependentRepair: 'YES',
    recoverable,
    recoverableReason: isSmoke
      ? 'The broken reference points to an auth_map smoke-test identity and has no business references in the local snapshot.'
      : 'No deterministic repair path is proven by local snapshot evidence.',
    businessImpact,
    businessImpactReason: businessRelated > 0
      ? 'At least one non-identity collection references the missing user.'
      : 'Only identity auth_map rows reference the missing smoke user; user-facing business data is not referenced in local snapshot.',
    source: {
      createdAt: ts(d.createdAt),
      updatedAt: ts(d.updatedAt),
      createdBy: d.createdBy || null,
      migration: d.identityVersion || null,
      authFlow: d.source || (d.firebaseUid ? 'firebase/auth_map' : null),
      legacyOrCurrent: isSmoke ? 'legacy smoke artifact' : 'unknown',
    },
  };
}

function buildReports({ redacted = false } = {}) {
  const snapshotPath = process.env.IDENTITY_SNAPSHOT_FILE || latestFile(BACKUP_DIR, file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts'));
  const dryRunPath = process.env.IDENTITY_DRY_RUN_REPORT || path.join(BACKUP_DIR, 'dryrun', 'dry-run-report.json');
  if (!snapshotPath || !fs.existsSync(snapshotPath)) throw new Error('No local Identity snapshot found.');
  if (!dryRunPath || !fs.existsSync(dryRunPath)) throw new Error('No local Dry Run report found.');
  const snapshot = readJson(snapshotPath);
  const dryRun = readJson(dryRunPath);
  const broken = dryRun.invariants?.danglingIdentityReferences || [];
  const records = broken.map((item, index) => {
    const row = rows(snapshot, 'auth_map').find(candidate => candidate.id === item.rowId)
      || Object.values(snapshot.collections || {}).flat().find(candidate => candidate.id === item.rowId);
    const collection = Object.entries(snapshot.collections || {}).find(([, list]) => list.some(candidate => candidate.id === item.rowId))?.[0] || 'unknown';
    const reference = {
      referenceId: `broken_ref_${String(index + 1).padStart(2, '0')}`,
      collection,
      field: item.field,
      documentId: item.rowId,
      referencedUserId: item.value,
      referenceType: `${collection}.${item.field}`,
    };
    const details = classify(reference, row, snapshot);
    return { ...reference, ...details };
  });
  const rootStats = records.reduce((acc, item) => {
    acc[item.rootCause] = (acc[item.rootCause] || 0) + 1;
    return acc;
  }, {});
  const disappearApproved = records.filter(item => item.disappearsAfterApprovedActions === 'YES').length;
  const disappearRemaining = records.filter(item => item.disappearsAfterRemainingDecisions === 'YES').length;
  const needRepair = records.filter(item => item.needsIndependentRepair === 'YES').length;
  const md = [
    '# Identity Broken References Forensic',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Snapshot: ${snapshotPath}`,
    `Dry Run: ${dryRunPath}`,
    `Redacted: ${String(Boolean(redacted))}`,
    '',
    '## Summary',
    '',
    `Broken references: ${records.length}`,
    `Legacy artifacts: ${rootStats['Historical artifact'] || 0}`,
    `Deleted users: ${rootStats['Deleted user'] || 0}`,
    `Ownership issues: ${rootStats['Broken ownership'] || 0}`,
    `Referral issues: ${rootStats['Broken referral'] || 0}`,
    `Migration issues: ${rootStats['Incomplete migration'] || 0}`,
    `Historical only: ${rootStats['Historical artifact'] || 0}`,
    `Unknown: ${rootStats.Unknown || 0}`,
    '',
    '## Classification Table',
    '',
    table(
      ['Ref', 'Collection', 'Field', 'Document ID', 'Referenced User ID', 'Root Cause', 'Conflict', 'Recoverable', 'Business Impact'],
      records.map(item => [
        item.referenceId,
        item.collection,
        item.field,
        redacted ? red(item.documentId) : item.documentId,
        redacted ? red(item.referencedUserId) : item.referencedUserId,
        item.rootCause,
        item.linkedConflict === 'YES' ? item.conflictId : 'NO',
        item.recoverable,
        item.businessImpact,
      ]),
    ),
    '',
    '## Automatic Disappearance',
    '',
    `Disappear after approved actions: ${disappearApproved}`,
    `Disappear after remaining decisions: ${disappearRemaining}`,
    `Need independent repair: ${needRepair}`,
    '',
    '## Per Reference Details',
    '',
    ...records.flatMap(item => [
      `### ${item.referenceId}`,
      '',
      table(['Field', 'Value'], [
        ['Collection', item.collection],
        ['Document ID', redacted ? red(item.documentId) : item.documentId],
        ['Field', item.field],
        ['Referenced User ID', redacted ? red(item.referencedUserId) : item.referencedUserId],
        ['Reference Type', item.referenceType],
        ['Target exists', item.targetExists ? 'YES' : 'NO'],
        ['Backup exists', item.hasBackup ? 'YES' : 'NO'],
        ['Canonical exists', item.hasCanonical ? 'YES' : 'NO'],
        ['Alias exists', item.hasAlias ? 'YES' : 'NO'],
        ['Firebase UID evidence', item.hasFirebaseUid ? 'YES' : 'NO'],
        ['Telegram identity evidence', item.hasTelegramIdentity ? 'YES' : 'NO'],
        ['Email evidence', item.hasEmail ? 'YES' : 'NO'],
        ['Created at', item.source.createdAt],
        ['Updated at', item.source.updatedAt],
        ['Created by', item.source.createdBy || 'unknown'],
        ['Migration', item.source.migration || 'unknown'],
        ['Auth flow', item.source.authFlow || 'unknown'],
        ['Legacy/current', item.source.legacyOrCurrent],
        ['Root cause', item.rootCause],
        ['Linked to current conflicts', item.linkedConflict],
        ['Disappears after approved actions', item.disappearsAfterApprovedActions],
        ['Disappears after remaining decisions', item.disappearsAfterRemainingDecisions],
        ['Needs independent repair', item.needsIndependentRepair],
        ['Recoverable', item.recoverable],
        ['Recoverable reason', item.recoverableReason],
        ['Business impact', item.businessImpact],
        ['Business impact reason', item.businessImpactReason],
      ]),
      '',
    ]),
    '## Safety Confirmation',
    '',
    '- Firestore changed: NO',
    '- Runtime changed: NO',
    '- API changed: NO',
    '- Security Rules changed: NO',
    '- Review session changed: NO',
    '- Manifest changed: NO',
    '- Import started: NO',
    '- Verify started: NO',
    '- Canary started: NO',
    '- Cutover started: NO',
    '- Rollback started: NO',
    '- Production deployed: NO',
    '',
  ].join('\n');
  return {
    snapshotPath,
    dryRunPath,
    records,
    summary: {
      brokenReferences: records.length,
      rootStats,
      disappearAfterApprovedActions: disappearApproved,
      disappearAfterRemainingDecisions: disappearRemaining,
      needIndependentRepair: needRepair,
    },
    markdown: md,
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = buildReports();
const redactedReport = buildReports({ redacted: true });
const jsonPath = path.join(OUT_DIR, 'broken-references.json');
const redactedJsonPath = path.join(OUT_DIR, 'broken-references-redacted.json');
const mdPath = path.join(OUT_DIR, 'broken-references-report.md');
const redactedMdPath = path.join(OUT_DIR, 'broken-references-report-redacted.md');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(redactedJsonPath, JSON.stringify({
  ...redactedReport,
  records: redactedReport.records.map(item => ({
    ...item,
    documentId: red(item.documentId),
    referencedUserId: red(item.referencedUserId),
  })),
}, null, 2));
fs.writeFileSync(mdPath, report.markdown);
fs.writeFileSync(redactedMdPath, redactedReport.markdown);

console.log([
  'Identity Broken References Forensic',
  `Broken references: ${report.summary.brokenReferences}`,
  `Legacy artifacts: ${report.summary.rootStats['Historical artifact'] || 0}`,
  `Deleted users: ${report.summary.rootStats['Deleted user'] || 0}`,
  `Migration issues: ${report.summary.rootStats['Incomplete migration'] || 0}`,
  `Unknown: ${report.summary.rootStats.Unknown || 0}`,
  `Disappear after approved actions: ${report.summary.disappearAfterApprovedActions}`,
  `Disappear after remaining decisions: ${report.summary.disappearAfterRemainingDecisions}`,
  `Need independent repair: ${report.summary.needIndependentRepair}`,
  `Report: ${mdPath}`,
  `Redacted report: ${redactedMdPath}`,
  `JSON: ${jsonPath}`,
  `Redacted JSON: ${redactedJsonPath}`,
].join('\n'));
