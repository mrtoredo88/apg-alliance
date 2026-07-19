import fs from 'node:fs';
import path from 'node:path';
import { redactText, redactValue } from './InvariantEvidence.js';

const OUT_DIR = 'backups/identity/invariants';

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(value => String(value ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function redactedItem(item) {
  return {
    ...item,
    evidence: (item.evidence || []).map(redactText),
    payload: redactPayload(item.payload),
  };
}

function redactPayload(value) {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (!value || typeof value !== 'object') return redactText(value);
  return Object.fromEntries(Object.entries(value).map(([key, val]) => {
    if (['email', 'value', 'id', 'ids', 'rowId', 'target', 'documentId', 'referencedUserId', 'firebaseUid', 'telegramId', 'conflictId'].includes(key)) {
      if (Array.isArray(val)) return [key, val.map(redactValue)];
      return [key, redactValue(val)];
    }
    return [key, redactPayload(val)];
  }));
}

function markdown(report, { redacted = false } = {}) {
  const items = redacted ? report.items.map(redactedItem) : report.items;
  const counts = report.summary.counts;
  return [
    '# Identity Invariant Classification',
    '',
    `Generated: ${report.generatedAt}`,
    `Redacted: ${String(Boolean(redacted))}`,
    '',
    '## Summary',
    '',
    `BLOCKING: ${counts.BLOCKING}`,
    `WARNING: ${counts.WARNING}`,
    `INFORMATIONAL: ${counts.INFORMATIONAL}`,
    `Migration readiness: ${report.summary.readiness.migrationReadiness}`,
    `Verify readiness: ${report.summary.readiness.verifyReadiness}`,
    `Import allowed: ${String(report.summary.readiness.importAllowed)}`,
    `Import reason: ${report.summary.readiness.importAllowedReason}`,
    '',
    '## Classification Table',
    '',
    table(
      ['Invariant ID', 'Category', 'Severity', 'Business Impact', 'Blocking Reason'],
      items.map(item => [
        item.id,
        item.category,
        item.severity,
        item.businessImpact,
        item.blockingReason || 'Does not block Verify',
      ]),
    ),
    '',
    '## Evidence',
    '',
    ...items.flatMap(item => [
      `### ${item.id}`,
      '',
      table(['Field', 'Value'], [
        ['Category', item.category],
        ['Severity', item.severity],
        ['Business Impact', item.businessImpact],
        ['Blocking Reason', item.blockingReason || 'Does not block Verify'],
        ['Explanation', item.explanation],
        ['Source', item.source],
        ['Evidence', (item.evidence || []).join('<br>')],
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
    '- Import executed: NO',
    '- Verify executed: NO',
    '- Canary executed: NO',
    '- Cutover executed: NO',
    '- Rollback executed: NO',
    '- Production deployed: NO',
    '',
  ].join('\n');
}

export function writeInvariantReports(report, { outDir = OUT_DIR } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'invariant-classification.json');
  const mdPath = path.join(outDir, 'invariant-classification.md');
  const redactedJsonPath = path.join(outDir, 'invariant-classification-redacted.json');
  const redactedMdPath = path.join(outDir, 'invariant-classification-redacted.md');
  const redactedReport = { ...report, items: report.items.map(redactedItem) };

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown(report));
  fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redactedReport, null, 2)}\n`);
  fs.writeFileSync(redactedMdPath, markdown(report, { redacted: true }));

  return { jsonPath, mdPath, redactedJsonPath, redactedMdPath };
}
