import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT_DIR = 'backups/identity/forensics';
const REMAINING = [
  'duplicate_email_d1c56991cfb3f8bb',
  'duplicate_email_f22d08b99bfcad8f',
  'orphan_tglink_25f7fdaf954f27a5',
  'orphan_tglink_01af2a8ca8b67964',
  'orphan_tglink_b27afa1eddb5a6ab',
];

function runConflict(conflictId) {
  const output = execFileSync(process.execPath, ['scripts/identity-single-conflict-forensic.mjs', conflictId], { encoding: 'utf8' });
  return JSON.parse(output);
}

function category(row = {}) {
  const rec = row.recommendation || '';
  if (rec.startsWith('MERGE')) return 'merge';
  if (rec.startsWith('KEEP_SEPARATE')) return 'keepSeparate';
  if (rec.startsWith('DELETE_ORPHAN_TG_LINK')) return 'deleteOrphan';
  if (rec.startsWith('REMAP_TG_LINK')) return 'remap';
  return 'defer';
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(value => String(value ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function buildSummary(results = [], { redacted = false } = {}) {
  const counts = results.reduce((acc, row) => {
    acc[category(row)] = (acc[category(row)] || 0) + 1;
    if (/not available|unavailable|requires owner|no deterministic|incomplete/i.test(row.blockingEvidence || '')) acc.evidenceIncomplete += 1;
    return acc;
  }, { merge: 0, keepSeparate: 0, deleteOrphan: 0, remap: 0, defer: 0, evidenceIncomplete: 0 });
  return [
    '# Identity Remaining Conflicts Forensic Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Redacted: ${String(Boolean(redacted))}`,
    '',
    `Conflicts analyzed: ${results.length}`,
    `Merge candidates: ${counts.merge}`,
    `Keep separate candidates: ${counts.keepSeparate}`,
    `Delete orphan candidates: ${counts.deleteOrphan}`,
    `Remap candidates: ${counts.remap}`,
    `Deferred: ${counts.defer}`,
    `Evidence incomplete: ${counts.evidenceIncomplete}`,
    '',
    table(['Conflict', 'Type', 'Recommendation', 'Confidence', 'Risk', 'Blocking evidence'], results.map(row => [
      redacted ? '[redacted]' : row.conflictId,
      row.type,
      row.recommendation,
      `${row.confidence}%`,
      row.risk,
      row.blockingEvidence,
    ])),
    '',
    '## Safety Confirmation',
    '',
    '- Owner decisions recorded: 0',
    '- Manifest changed: NO',
    '- Review session changed: NO',
    '- Firestore changed: NO',
    '- Runtime changed: NO',
    '- API changed: NO',
    '- Security Rules changed: NO',
    '- Import started: NO',
    '- Verify started: NO',
    '- Canary started: NO',
    '- Cutover started: NO',
    '- Rollback started: NO',
    '- Production deployed: NO',
    '',
  ].join('\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const results = REMAINING.map(runConflict);
const summaryPath = path.join(OUT_DIR, 'remaining-conflicts-forensic-summary.md');
const redactedPath = path.join(OUT_DIR, 'remaining-conflicts-forensic-summary-redacted.md');
fs.writeFileSync(summaryPath, buildSummary(results));
fs.writeFileSync(redactedPath, buildSummary(results, { redacted: true }));

console.log([
  'Identity Remaining Conflicts Forensic Pack',
  `Conflicts analyzed: ${results.length}`,
  `Reports generated: ${results.length}`,
  'Owner decisions recorded: 0',
  'Manifest changed: NO',
  'Review session changed: NO',
  'Firestore changed: NO',
  'Ready for owner decisions: YES',
  'Ready for Verify: NO',
  'Import allowed: false',
  `Summary: ${summaryPath}`,
  `Redacted summary: ${redactedPath}`,
].join('\n'));
