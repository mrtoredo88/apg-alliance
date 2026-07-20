import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { appendReviewAudit } from '../src/admin/identity/review/index.js';
import { createImmutableVerifyPackage } from './identity-verify-lock.mjs';

const BACKUP_DIR = 'backups/identity';
const VERIFY_DIR = path.join(BACKUP_DIR, 'verify');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
  return file;
}

function hash(value, length = 16) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, length);
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function redactDeep(input) {
  if (Array.isArray(input)) return input.map(redactDeep);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|[A-Za-z0-9_-]{16,})/.test(input))) {
      return `[redacted:${crypto.createHash('sha256').update(input).digest('hex').slice(0, 12)}]`;
    }
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (/id|uid|email|telegram|source|target|canonical|user/i.test(key)) {
      if (Array.isArray(value)) return [key, value.map(item => typeof item === 'string' ? `[redacted:${crypto.createHash('sha256').update(item).digest('hex').slice(0, 12)}]` : redactDeep(item))];
      return [key, redactDeep(value)];
    }
    return [key, redactDeep(value)];
  }));
}

function check(label, ok, details = {}) {
  return { label, status: ok ? 'PASS' : 'FAIL', details };
}

function actionById(manifest, conflictId) {
  return (manifest.actions || []).find(item => item.conflictId === conflictId) || null;
}

function buildChecks({ manifest, dryRun, invariants, readiness, orchestrator, verifyPackage }) {
  const blocking = invariants.summary?.counts?.BLOCKING || 0;
  const warnings = invariants.summary?.counts?.WARNING || 0;
  const informational = invariants.summary?.counts?.INFORMATIONAL || 0;
  const owner = actionById(manifest, 'duplicate_email_d1c56991cfb3f8bb');
  const gordeeva = actionById(manifest, 'duplicate_email_f22d08b99bfcad8f');
  const orphan = actionById(manifest, 'orphan_tglink_25f7fdaf954f27a5');
  const duplicateActions = (manifest.actions || []).filter(item => String(item.type || '').includes('DUPLICATE') || String(item.conflictId || '').startsWith('duplicate_email_'));
  const orphanActions = (manifest.actions || []).filter(item => item.decision === 'DELETE_ORPHAN_TG_LINK');
  const operations = dryRun.operations || [];
  return [
    check('Review complete', manifest.reviewComplete === true, manifest.summary),
    check('Import remains disabled', manifest.importAllowed === false && dryRun.importAllowed === false, { manifestImportAllowed: manifest.importAllowed, dryRunImportAllowed: dryRun.importAllowed }),
    check('No unresolved or stale decisions', !(manifest.unresolvedConflicts || []).length && !(manifest.staleDecisions || []).length, { unresolved: manifest.unresolvedConflicts, stale: manifest.staleDecisions }),
    check('Orchestrator verify gate passed', orchestrator.pipelineStatus === 'READY_FOR_VERIFY' && orchestrator.gates?.verify === 'READY', orchestrator.gates),
    check('Verify package generated', Boolean(verifyPackage) && (verifyPackage.gates?.verify === 'READY'), verifyPackage?.gates || {}),
    check('Classified blocking invariants absent', blocking === 0, { blocking, warnings, informational }),
    check('Classified historical artifacts do not block verify', informational >= 8 && blocking === 0, invariants.summary?.counts || {}),
    check('Dry-run diff has no errors', !(dryRun.diff?.errors || []).length, { errors: dryRun.diff?.errors || [] }),
    check('Dry-run preservation passed', dryRun.preservation?.status === 'PASSED', dryRun.preservation || {}),
    check('Rollback preview available', dryRun.rollbackPreview?.generated === true, { operations: dryRun.rollbackPreview?.operations?.length || 0 }),
    check('Owner conflict target is Account A', owner?.decision === 'MERGE_INTO_A' && owner?.targetUserId === 'BxwacxEVE4ZplEDXxDQNhAvZT1M2', { decision: owner?.decision, target: owner?.targetUserId }),
    check('Owner source is Account B only', Array.isArray(owner?.sourceIds) && owner.sourceIds.includes('email:mrtoredo88@mail.ru') && !owner.sourceIds.includes('BxwacxEVE4ZplEDXxDQNhAvZT1M2'), { sourceIds: owner?.sourceIds }),
    check('Owner preservation plan complete', ['roles', 'ownership', 'bookings', 'dialogs', 'friends', 'keys', 'rewards', 'notifications', 'referrals', 'profileFields', 'telegramIdentity', 'authProviders'].every(field => Object.prototype.hasOwnProperty.call(owner?.preservationPlan || {}, field)), { fields: Object.keys(owner?.preservationPlan || {}) }),
    check('Gordeeva conflict target is Account A', gordeeva?.decision === 'MERGE_INTO_A' && gordeeva?.targetUserId === 'email:gordeeva.tatyana@mail.ru', { decision: gordeeva?.decision, target: gordeeva?.targetUserId }),
    check('Gordeeva source is Telegram Account B', Array.isArray(gordeeva?.sourceIds) && gordeeva.sourceIds.includes('tg_875814883'), { sourceIds: gordeeva?.sourceIds }),
    check('Final orphan tgLink approved for link deletion only', orphan?.decision === 'DELETE_ORPHAN_TG_LINK' && orphan?.telegramId === 'tg_1096891741' && orphan?.currentTarget === 'guest_po2visd', { decision: orphan?.decision, telegramId: orphan?.telegramId, currentTarget: orphan?.currentTarget }),
    check('All duplicate email decisions are approved actions', duplicateActions.length === 3 && duplicateActions.every(item => item.status === 'approved'), { count: duplicateActions.length }),
    check('All orphan tgLink decisions are approved actions', orphanActions.length === 3 && orphanActions.every(item => item.status === 'approved'), { count: orphanActions.length }),
    check('Dry-run executed approved operations only', operations.length === (manifest.actions || []).length && operations.every(item => (manifest.actions || []).some(action => action.conflictId === item.conflictId && action.decision === item.decision)), { operations }),
    check('Readiness report has no technical fix requirement', !String(readiness.conclusion?.variant || readiness.summary?.conclusion || '').includes('Technical Fix Required'), readiness.summary || {}),
  ];
}

function renderMarkdown(report, { redacted = false } = {}) {
  return [
    '# Identity Verify Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Redacted: ${String(redacted)}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    table(['Area', 'Value'], [
      ['Review complete', report.summary.reviewComplete ? 'YES' : 'NO'],
      ['Approved decisions', report.summary.approved],
      ['Deferred decisions', report.summary.deferred],
      ['Blocking invariants', report.summary.blockingInvariants],
      ['Warning invariants', report.summary.warningInvariants],
      ['Informational invariants', report.summary.informationalInvariants],
      ['Firestore writes', 0],
      ['Import executed', 'NO'],
      ['Canary started', 'NO'],
      ['Cutover started', 'NO'],
      ['Ready for Canary', report.readyForCanary],
    ]),
    '',
    '## Checks',
    '',
    table(['Check', 'Status', 'Details'], report.checks.map(item => [item.label, item.status, JSON.stringify(item.details)])),
    '',
    '## Gates',
    '',
    table(['Gate', 'Status'], Object.entries(report.gates)),
    '',
    '## Safety',
    '',
    '- Firestore changed: NO',
    '- Runtime changed: NO',
    '- API changed: NO',
    '- Security Rules changed: NO',
    '- Import started: NO',
    '- Canary started: NO',
    '- Cutover started: NO',
    '- Rollback started: NO',
    '- Production deployed: NO',
    '',
  ].join('\n');
}

function runVerify() {
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
  const sources = {
    manifestPath: requireFile(path.join(BACKUP_DIR, 'resolution-manifest-v2.json'), 'resolution manifest'),
    dryRunPath: requireFile(path.join(BACKUP_DIR, 'dryrun', 'dry-run-report.json'), 'dry run report'),
    invariantsPath: requireFile(path.join(BACKUP_DIR, 'invariants', 'invariant-classification.json'), 'invariant report'),
    readinessPath: requireFile(path.join(BACKUP_DIR, 'readiness', 'final-readiness-review.json'), 'readiness report'),
    orchestratorPath: requireFile(path.join(BACKUP_DIR, 'orchestrator', 'orchestrator-report.json'), 'orchestrator report'),
    verifyPackagePath: requireFile(path.join(VERIFY_DIR, 'verify-package.json'), 'verify package'),
  };
  appendReviewAudit({ event: 'VERIFY_STARTED', conflictId: null, reviewedBy: 'system:verify', decision: null, previousDecision: null, fingerprint: null });
  const manifest = readJson(sources.manifestPath);
  const dryRun = readJson(sources.dryRunPath);
  const invariants = readJson(sources.invariantsPath);
  const readiness = readJson(sources.readinessPath);
  const orchestrator = readJson(sources.orchestratorPath);
  const verifyPackage = readJson(sources.verifyPackagePath);
  const checks = buildChecks({ manifest, dryRun, invariants, readiness, orchestrator, verifyPackage });
  const failed = checks.filter(item => item.status === 'FAIL');
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'read_only_local_identity_verify',
    status: failed.length ? 'VERIFY_FAILED' : 'VERIFY_PASSED',
    sources,
    sourceHashes: Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, hash(readJson(file))])),
    summary: {
      reviewComplete: manifest.reviewComplete === true,
      approved: manifest.summary?.approved || 0,
      deferred: manifest.summary?.deferred || 0,
      blockingInvariants: invariants.summary?.counts?.BLOCKING || 0,
      warningInvariants: invariants.summary?.counts?.WARNING || 0,
      informationalInvariants: invariants.summary?.counts?.INFORMATIONAL || 0,
      rawDryRunReadyForVerify: dryRun.readyForVerify === true,
      finalVerifyGate: orchestrator.gates?.verify || 'LOCKED',
      importAllowed: false,
    },
    checks,
    failed,
    gates: {
      verify: failed.length ? 'FAILED' : 'PASSED',
      canary: 'LOCKED',
      cutover: 'LOCKED',
    },
    readyForCanary: failed.length ? 'NO' : 'READY_AFTER_EXPLICIT_OWNER_APPROVAL',
    safety: {
      dataChanged: false,
      firestoreChanged: false,
      runtimeChanged: false,
      apiChanged: false,
      securityRulesChanged: false,
      importStarted: false,
      verifyReadOnly: true,
      canaryStarted: false,
      cutoverStarted: false,
      rollbackStarted: false,
      productionDeployed: false,
    },
  };
  const jsonPath = path.join(VERIFY_DIR, 'verify-report.json');
  const redactedJsonPath = path.join(VERIFY_DIR, 'verify-report-redacted.json');
  const mdPath = path.join(VERIFY_DIR, 'verify-report.md');
  const redactedMdPath = path.join(VERIFY_DIR, 'verify-report-redacted.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redactDeep(report), null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report));
  fs.writeFileSync(redactedMdPath, renderMarkdown(redactDeep(report), { redacted: true }));
  const summaryPath = path.join(VERIFY_DIR, 'verify-summary.md');
  const checklistPath = path.join(VERIFY_DIR, 'verify-checklist.md');
  fs.writeFileSync(summaryPath, [
    '# Identity Verify Summary',
    '',
    `Status: ${report.status}`,
    `Ready for Canary: ${report.readyForCanary}`,
    `Blocking invariants: ${report.summary.blockingInvariants}`,
    `Import allowed: false`,
    '',
  ].join('\n'));
  fs.writeFileSync(checklistPath, [
    '# Identity Verify Checklist',
    '',
    table(['Item', 'Status'], report.checks.map(item => [item.label, item.status])),
    '',
  ].join('\n'));
  let immutablePackage = null;
  if (!failed.length) immutablePackage = createImmutableVerifyPackage();
  appendReviewAudit({
    event: failed.length ? 'VERIFY_FAILED' : 'VERIFY_PASSED',
    conflictId: null,
    reviewedBy: 'system:verify',
    decision: null,
    previousDecision: null,
    fingerprint: report.sourceHashes.manifestPath,
  });
  return { report, immutablePackage, files: { jsonPath, redactedJsonPath, mdPath, redactedMdPath, summaryPath, checklistPath } };
}

try {
  const { report, immutablePackage, files } = runVerify();
  console.log('Identity Verify');
  console.log(`Status: ${report.status}`);
  console.log(`Checks: ${report.checks.filter(item => item.status === 'PASS').length}/${report.checks.length}`);
  console.log(`Ready for Canary: ${report.readyForCanary}`);
  console.log(`Canary: ${report.gates.canary}`);
  console.log(`Cutover: ${report.gates.cutover}`);
  if (immutablePackage) {
    console.log(`Immutable Package: ${immutablePackage.packageDir}`);
    console.log(`Signature: ${immutablePackage.lock.signatureHash}`);
  }
  console.log(`Report: ${files.mdPath}`);
  console.log(`JSON: ${files.jsonPath}`);
  console.log(`Redacted report: ${files.redactedMdPath}`);
  console.log(`Redacted JSON: ${files.redactedJsonPath}`);
  if (report.status !== 'VERIFY_PASSED') process.exitCode = 1;
} catch (error) {
  appendReviewAudit({ event: 'VERIFY_FAILED', conflictId: null, reviewedBy: 'system:verify', decision: null, previousDecision: null, fingerprint: null });
  console.error(String(error?.message || error));
  process.exit(1);
}
