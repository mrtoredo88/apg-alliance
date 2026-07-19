import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { executeIdentityDryRun } from '../src/admin/identity/dryrun/index.js';
import { appendReviewAudit, validateReviewSession } from '../src/admin/identity/review/index.js';

const BACKUP_DIR = 'backups/identity';
const OUT_DIR = path.join(BACKUP_DIR, 'orchestrator');
const VERIFY_DIR = path.join(BACKUP_DIR, 'verify');
const REVIEW_DIR = path.join(BACKUP_DIR, 'reviews');

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

function value(input) {
  if (input === null || input === undefined || input === '') return '-';
  if (Array.isArray(input)) return input.length ? input.map(value).join(', ') : '-';
  if (typeof input === 'object') return JSON.stringify(input);
  return String(input);
}

function red(input) {
  const rendered = value(input);
  return rendered === '-' ? rendered : `[redacted:${hash(rendered)}]`;
}

function redactDeep(input) {
  if (Array.isArray(input)) return input.map(redactDeep);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|[A-Za-z0-9_-]{16,})/.test(input))) return red(input);
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, val]) => {
    if (/id|uid|email|telegram|target|canonical|user|conflict|value|source/i.test(key)) {
      if (Array.isArray(val)) return [key, val.map(red)];
      return [key, red(val)];
    }
    return [key, redactDeep(val)];
  }));
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => value(cell).replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function required(file, label) {
  if (!file || !fs.existsSync(file)) throw new Error(`${label} not found: ${file || 'missing path'}`);
  return file;
}

function sourceFiles() {
  return {
    manifestPath: required(process.env.IDENTITY_RESOLUTION_MANIFEST || path.join(BACKUP_DIR, 'resolution-manifest-v2.json'), 'resolution manifest'),
    snapshotPath: required(process.env.IDENTITY_SNAPSHOT_FILE || latestFile(BACKUP_DIR, file => file.startsWith('firestore-identity-snapshot-') && file.endsWith('.json') && !file.includes('conflicts')), 'identity snapshot'),
    reviewSessionPath: required(process.env.IDENTITY_REVIEW_SESSION || latestFile(REVIEW_DIR, file => file.startsWith('identity-review-session-') && file.endsWith('.json') && !file.includes('-redacted')), 'review session'),
    readinessPath: required(process.env.IDENTITY_READINESS_REPORT || path.join(BACKUP_DIR, 'readiness', 'final-readiness-review.json'), 'readiness report'),
    invariantsPath: required(process.env.IDENTITY_INVARIANTS_REPORT || path.join(BACKUP_DIR, 'invariants', 'invariant-classification.json'), 'invariant report'),
    brokenReferencesPath: required(process.env.IDENTITY_BROKEN_REFERENCES_REPORT || path.join(BACKUP_DIR, 'forensics', 'broken-references.json'), 'broken references report'),
    ownerForensicPath: required(process.env.IDENTITY_OWNER_FORENSIC_REPORT || path.join(BACKUP_DIR, 'forensics', 'owner-identity-deep-forensic.json'), 'owner forensic report'),
  };
}

function stopped(stage, reason, details = {}) {
  return {
    stage,
    status: 'STOP',
    reason,
    details,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function passed(stage, details = {}) {
  return {
    stage,
    status: 'PASS',
    reason: null,
    details,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function notRun(stage, reason) {
  return { stage, status: 'NOT_RUN', reason, details: {}, startedAt: null, completedAt: null };
}

function buildVerifyPackage({ manifest, reviewValidation, dryRun, invariants, readiness, brokenReferences, ownerForensic, sources }) {
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
  const classifiedBlocking = invariants.summary?.counts?.BLOCKING || 0;
  const classifiedWarnings = invariants.summary?.counts?.WARNING || 0;
  const classifiedVerifyReady = classifiedBlocking === 0;
  const dryRunOperationallyReady = Boolean(
    !manifest.unresolvedConflicts?.length
    && !manifest.staleDecisions?.length
    && manifest.reviewComplete === true
    && reviewValidation.valid === true
    && !dryRun.diff?.errors?.length
  );
  const readyForVerify = dryRunOperationallyReady && classifiedVerifyReady;
  const checklist = [
    ['Owner decisions completed', manifest.reviewComplete === true],
    ['Review validation passed', reviewValidation.valid === true],
    ['Dry Run operational checks passed', dryRunOperationallyReady],
    ['Blocking invariants absent', classifiedBlocking === 0],
    ['Rollback available', Boolean(dryRun.rollbackPreview)],
    ['Backups available', Boolean(sources.snapshotPath)],
    ['Manifest signed', Boolean(manifest.sourceFingerprint)],
    ['Ready for Verify', readyForVerify],
  ];
  const pkg = {
    version: 1,
    generatedAt: new Date().toISOString(),
    reviewSummary: { reviewComplete: manifest.reviewComplete, validation: reviewValidation },
    manifestSummary: manifest.summary,
    dryRunSummary: {
      rawReadyForVerify: dryRun.readyForVerify,
      finalReadyForVerify: readyForVerify,
      importAllowed: dryRun.importAllowed,
      diffSummary: dryRun.diffSummary,
      preservation: dryRun.preservation,
      rawInvariantStatus: dryRun.invariants?.status,
      classifiedBlocking,
      classifiedWarnings,
    },
    invariantSummary: invariants.summary,
    forensicSummary: {
      brokenReferences: brokenReferences.summary,
      ownerForensic: ownerForensic.finalRecommendation,
      readiness: readiness.summary,
    },
    rollbackSummary: dryRun.rollbackPreview,
    preservationPlans: (manifest.actions || []).map(item => ({
      conflictId: item.conflictId,
      type: item.type,
      decision: item.decision,
      preservationPlan: item.preservationPlan || null,
    })),
    checklist: checklist.map(([label, ok]) => ({ label, ok })),
    gates: {
      verify: readyForVerify ? 'READY' : 'LOCKED',
      canary: 'LOCKED',
      cutover: 'LOCKED',
    },
    safety: safety(),
  };
  const verifyPackagePath = path.join(VERIFY_DIR, 'verify-package.json');
  const verifySummaryPath = path.join(VERIFY_DIR, 'verify-summary.md');
  const verifyChecklistPath = path.join(VERIFY_DIR, 'verify-checklist.md');
  fs.writeFileSync(verifyPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(verifySummaryPath, [
    '# Identity Verify Package',
    '',
    `Generated: ${pkg.generatedAt}`,
    `Verify Gate: ${pkg.gates.verify}`,
    `Canary: ${pkg.gates.canary}`,
    `Cutover: ${pkg.gates.cutover}`,
    '',
    '## Summary',
    '',
    table(['Area', 'Status'], [
      ['Review complete', manifest.reviewComplete ? 'YES' : 'NO'],
      ['Review validation', reviewValidation.valid ? 'PASS' : 'FAILED'],
      ['Dry Run operational checks', dryRunOperationallyReady ? 'PASS' : 'FAILED'],
      ['Raw dry-run invariant status', dryRun.invariants?.status || 'UNKNOWN'],
      ['Classified blocking invariants', classifiedBlocking],
      ['Classified warning invariants', classifiedWarnings],
      ['Import allowed', String(false)],
    ]),
    '',
  ].join('\n'));
  fs.writeFileSync(verifyChecklistPath, [
    '# Identity Verify Checklist',
    '',
    table(['Item', 'Status'], pkg.checklist.map(item => [item.label, item.ok ? 'YES' : 'NO'])),
    '',
    'No Verify, Canary, Cutover or production deploy was executed.',
    '',
  ].join('\n'));
  return { verifyPackagePath, verifySummaryPath, verifyChecklistPath };
}

function safety() {
  return {
    dataChanged: false,
    firestoreChanged: false,
    runtimeChanged: false,
    apiChanged: false,
    securityRulesChanged: false,
    reviewSessionChangedAutomatically: false,
    manifestChangedAutomatically: false,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
    productionDeployed: false,
  };
}

function runOrchestrator() {
  const sources = sourceFiles();
  const manifest = readJson(sources.manifestPath);
  const reviewSession = readJson(sources.reviewSessionPath);
  const readiness = readJson(sources.readinessPath);
  const invariants = readJson(sources.invariantsPath);
  const brokenReferences = readJson(sources.brokenReferencesPath);
  const ownerForensic = readJson(sources.ownerForensicPath);
  const pipeline = [];
  const deferred = Number(manifest.summary?.deferred || 0);
  const pending = (manifest.unresolvedConflicts || []).length;
  const stale = (manifest.staleDecisions || []).length;

  if (!manifest.reviewComplete || deferred || pending || stale) {
    pipeline.push(stopped('Review', 'Owner decisions incomplete', {
      approved: manifest.summary?.approved || 0,
      deferred,
      pending,
      stale,
      reviewComplete: manifest.reviewComplete === true,
      unresolvedConflicts: manifest.unresolvedConflicts || [],
    }));
    pipeline.push(notRun('Validation', 'Review gate failed.'));
    pipeline.push(notRun('Dry Run', 'Review gate failed.'));
    pipeline.push(notRun('Verify Package', 'Review gate failed.'));
    return finish({ pipeline, sources, manifest, readiness, invariants, brokenReferences, ownerForensic, verifyPackage: null });
  }

  pipeline.push(passed('Review', {
    approved: manifest.summary?.approved || 0,
    deferred,
    pending,
    stale,
    reviewComplete: true,
  }));

  const validation = validateReviewSession(reviewSession);
  if (!validation.valid) {
    pipeline.push(stopped('Validation', 'Review validation failed', validation));
    pipeline.push(notRun('Dry Run', 'Validation gate failed.'));
    pipeline.push(notRun('Verify Package', 'Validation gate failed.'));
    return finish({ pipeline, sources, manifest, readiness, invariants, brokenReferences, ownerForensic, reviewValidation: validation, verifyPackage: null });
  }

  pipeline.push(passed('Validation', validation));

  const snapshot = readJson(sources.snapshotPath);
  const dryRun = executeIdentityDryRun({ snapshot, manifest, source: { snapshotPath: sources.snapshotPath, manifestPath: sources.manifestPath } });
  const blocking = invariants.summary?.counts?.BLOCKING || 0;
  appendReviewAudit({
    event: 'FINAL_DRY_RUN_EXECUTED',
    conflictId: null,
    reviewedBy: 'system:orchestrator',
    decision: null,
    previousDecision: null,
    fingerprint: manifest.sourceFingerprint || null,
  });
  const dryRunOperationallyReady = Boolean(
    !manifest.unresolvedConflicts?.length
    && !manifest.staleDecisions?.length
    && manifest.reviewComplete === true
    && validation.valid === true
    && !dryRun.diff?.errors?.length
    && dryRun.preservation?.status !== 'FAILED'
  );
  if (!dryRunOperationallyReady || blocking > 0) {
    pipeline.push(stopped('Dry Run', 'Dry Run gate failed', {
      rawReadyForVerify: dryRun.readyForVerify,
      operationalReadyForVerify: dryRunOperationallyReady,
      dryRunImportAllowed: dryRun.importAllowed,
      blockingInvariants: blocking,
      invariantStatus: dryRun.invariants?.status,
      classifiedInvariantReadiness: invariants.summary?.readiness?.verifyReadiness || 'NO',
    }));
    pipeline.push(notRun('Verify Package', 'Dry Run gate failed.'));
    return finish({ pipeline, sources, manifest, readiness, invariants, brokenReferences, ownerForensic, reviewValidation: validation, dryRun, verifyPackage: null });
  }

  pipeline.push(passed('Dry Run', {
    rawReadyForVerify: dryRun.readyForVerify,
    operationalReadyForVerify: dryRunOperationallyReady,
    invariantStatus: dryRun.invariants?.status,
    blockingInvariants: blocking,
    classifiedInvariantReadiness: invariants.summary?.readiness?.verifyReadiness || 'YES',
  }));

  const verifyPackage = buildVerifyPackage({ manifest, reviewValidation: validation, dryRun, invariants, readiness, brokenReferences, ownerForensic, sources });
  pipeline.push(passed('Verify Package', verifyPackage));
  appendReviewAudit({
    event: 'ORCHESTRATOR_GATE_PASSED',
    conflictId: null,
    reviewedBy: 'system:orchestrator',
    decision: null,
    previousDecision: null,
    fingerprint: manifest.sourceFingerprint || null,
  });
  return finish({ pipeline, sources, manifest, readiness, invariants, brokenReferences, ownerForensic, reviewValidation: validation, dryRun, verifyPackage });
}

function finish({ pipeline, sources, manifest, readiness, invariants, brokenReferences, ownerForensic, reviewValidation = null, dryRun = null, verifyPackage = null }) {
  const stoppedStage = pipeline.find(item => item.status === 'STOP');
  const verifyReady = !stoppedStage && Boolean(verifyPackage);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'gate-based read-only orchestrator',
    sources,
    pipelineStatus: stoppedStage ? 'STOPPED' : 'READY_FOR_VERIFY',
    stopReason: stoppedStage?.reason || null,
    pipeline,
    gates: {
      review: pipeline.find(item => item.stage === 'Review')?.status || 'NOT_RUN',
      validation: pipeline.find(item => item.stage === 'Validation')?.status || 'NOT_RUN',
      dryRun: pipeline.find(item => item.stage === 'Dry Run')?.status || 'NOT_RUN',
      verify: verifyReady ? 'READY' : 'LOCKED',
      canary: 'LOCKED',
      cutover: 'LOCKED',
    },
    summaries: {
      review: {
        approved: manifest.summary?.approved || 0,
        deferred: manifest.summary?.deferred || 0,
        stale: manifest.summary?.stale || 0,
        reviewComplete: manifest.reviewComplete === true,
        importAllowed: manifest.importAllowed === true,
      },
      validation: reviewValidation,
      dryRun: dryRun ? {
        rawReadyForVerify: dryRun.readyForVerify,
        operationalReadyForVerify: pipeline.find(item => item.stage === 'Dry Run')?.details?.operationalReadyForVerify || false,
        importAllowed: dryRun.importAllowed,
        invariantStatus: dryRun.invariants?.status,
      } : null,
      invariants: invariants.summary,
      readiness: readiness.summary,
      brokenReferences: brokenReferences.summary,
      ownerForensic: ownerForensic.finalRecommendation,
    },
    verifyPackage,
    safety: safety(),
  };
}

function writeReports(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'orchestrator-report.json');
  const mdPath = path.join(OUT_DIR, 'orchestrator-report.md');
  const redactedJsonPath = path.join(OUT_DIR, 'orchestrator-report-redacted.json');
  const redactedMdPath = path.join(OUT_DIR, 'orchestrator-report-redacted.md');
  const redacted = redactDeep(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redacted, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report));
  fs.writeFileSync(redactedMdPath, renderMarkdown(redacted, { redacted: true }));
  return { jsonPath, mdPath, redactedJsonPath, redactedMdPath };
}

function renderMarkdown(report, { redacted = false } = {}) {
  return [
    '# Identity Migration Orchestrator',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Redacted: ${String(redacted)}`,
    '',
    '## Pipeline Status',
    '',
    `Status: ${report.pipelineStatus}`,
    `Stop reason: ${report.stopReason || '-'}`,
    `Verify Gate: ${report.gates.verify}`,
    `Canary: ${report.gates.canary}`,
    `Cutover: ${report.gates.cutover}`,
    '',
    table(['Stage', 'Status', 'Reason', 'Details'], report.pipeline.map(item => [item.stage, item.status, item.reason || '-', item.details])),
    '',
    '## Gate Summary',
    '',
    table(['Gate', 'Status'], Object.entries(report.gates)),
    '',
    '## Review Summary',
    '',
    table(['Field', 'Value'], Object.entries(report.summaries.review)),
    '',
    '## Invariant Summary',
    '',
    table(['Field', 'Value'], Object.entries(report.summaries.invariants?.counts || {})),
    '',
    '## Verify Package',
    '',
    report.verifyPackage
      ? table(['File', 'Path'], Object.entries(report.verifyPackage))
      : 'Verify Package: NOT GENERATED',
    '',
    '## Safety Confirmation',
    '',
    '- Orchestrator changed data: NO',
    '- Firestore changed: NO',
    '- Runtime changed: NO',
    '- API changed: NO',
    '- Security Rules changed: NO',
    '- Review session changed automatically: NO',
    '- Manifest changed automatically: NO',
    '- Import started: NO',
    '- Verify started: NO',
    '- Canary started: NO',
    '- Cutover started: NO',
    '- Production deployed: NO',
    '',
  ].join('\n');
}

const report = runOrchestrator();
const files = writeReports(report);
console.log('Identity Migration Orchestrator');
console.log(`Review: ${report.gates.review}`);
if (report.pipelineStatus === 'STOPPED') {
  console.log('Reason:');
  console.log(report.stopReason);
  const review = report.summaries.review;
  if (review.deferred || !review.reviewComplete) console.log(`${review.deferred} deferred owner decisions`);
  console.log('Pipeline stopped.');
} else {
  console.log(`Validation: ${report.gates.validation}`);
  console.log(`Dry Run: ${report.gates.dryRun}`);
  console.log('Verify Package: GENERATED');
  console.log('Verify Gate: READY');
}
console.log(`Canary: ${report.gates.canary}`);
console.log(`Cutover: ${report.gates.cutover}`);
console.log('Production unchanged.');
console.log(`Report: ${files.mdPath}`);
console.log(`JSON: ${files.jsonPath}`);
console.log(`Redacted report: ${files.redactedMdPath}`);
console.log(`Redacted JSON: ${files.redactedJsonPath}`);
