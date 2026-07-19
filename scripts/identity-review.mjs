import fs from 'node:fs';
import path from 'node:path';
import {
  appendReviewAudit,
  buildMarkdownReviewReport,
  buildResolutionManifestV2,
  createReviewSession,
  ensureReviewDir,
  formatReviewSummary,
  REVIEW_DIR,
  sessionSummary,
  upsertDecision,
} from '../src/admin/identity/review/index.js';

const args = process.argv.slice(2);
const command = args[0] || 'summary';
const REVIEW_SESSION_PREFIX = 'identity-review-session-';

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1] || fallback;
  return fallback;
}

function latestFile(dir, predicate) {
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter(predicate).sort();
  return files.length ? path.join(dir, files.at(-1)) : '';
}

function latestConflictCardsFile() {
  return latestFile('backups/identity', file => file === 'resolution-manifest-cards-redacted.json')
    || latestFile('backups/identity', file => file.startsWith('identity-conflict-resolution-') && file.endsWith('-redacted.json'));
}

function latestSessionFile() {
  return latestFile(REVIEW_DIR, file => file.startsWith(REVIEW_SESSION_PREFIX) && file.endsWith('.json') && !file.includes('-redacted'));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  ensureReviewDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

function writeSession(session) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REVIEW_DIR, `${REVIEW_SESSION_PREFIX}${stamp}.json`);
  const redacted = path.join(REVIEW_DIR, `${REVIEW_SESSION_PREFIX}${stamp}-redacted.json`);
  writeJson(file, session);
  writeJson(redacted, {
    version: session.version,
    generatedAt: session.generatedAt,
    updatedAt: session.updatedAt || null,
    reviewer: session.reviewer,
    conflicts: (session.conflicts || []).map(item => ({ conflictId: item.conflictId, type: item.type, risk: item.risk, recommendation: item.recommendation })),
    decisions: (session.decisions || []).map(item => ({
      conflictId: item.conflictId,
      decision: item.decision,
      status: item.status,
      reviewedBy: item.reviewedBy,
      reviewedAt: item.reviewedAt,
      evidence: item.evidence,
      destructive: item.destructive,
      secondReviewRequired: item.secondReviewRequired,
      ownerOverride: item.ownerOverride,
      sourceFingerprint: item.sourceFingerprint,
      decisionFingerprint: item.decisionFingerprint,
    })),
    validation: session.validation,
    importAllowed: false,
  });
  return { file, redacted };
}

function loadConflictAnalysis() {
  const file = latestConflictCardsFile();
  if (!file) throw new Error('No conflict center report found. Run npm run identity:conflicts first.');
  const data = readJson(file);
  const conflicts = data.cards || data.forensicCards || [];
  return { file, conflicts };
}

function loadOrCreateSession() {
  const explicit = option('session');
  const file = explicit || latestSessionFile();
  if (file && fs.existsSync(file)) return { file, session: readJson(file), created: false };
  const { file: sourceReportPath, conflicts } = loadConflictAnalysis();
  const reviewer = option('reviewedBy') || option('reviewer') || '';
  const session = createReviewSession({ conflicts, reviewer, sourceReportPath });
  const written = writeSession(session);
  appendReviewAudit({ event: 'REVIEW_STARTED', reviewedBy: reviewer || 'system:pending-review', conflictId: null, decision: null, previousDecision: null, fingerprint: null });
  return { file: written.file, session, created: true };
}

function printConflict(conflict) {
  console.log(JSON.stringify({
    conflictId: conflict.conflictId,
    type: conflict.type,
    risk: conflict.risk,
    recommendation: conflict.recommendation,
    userHashes: conflict.userCards?.map(user => user.idHash) || [],
    telegramIdHash: conflict.telegramIdHash || null,
    targetUserIdHash: conflict.targetUserIdHash || null,
  }, null, 2));
}

function requiredDecisionInput() {
  const reason = option('reason');
  const reviewedBy = option('reviewedBy') || option('reviewer');
  const evidence = option('evidence');
  if (!reason.trim()) throw new Error('reason is required');
  if (!reviewedBy.trim()) throw new Error('reviewedBy is required');
  if (!evidence.trim()) throw new Error('evidence is required');
  return { reason, reviewedBy, evidence };
}

function exportSession(session, sessionFile) {
  const manifest = buildResolutionManifestV2(session, { sourceAudit: 'backups/identity/reviews/identity-review-audit.jsonl' });
  const manifestPath = 'backups/identity/resolution-manifest-v2.json';
  writeJson(manifestPath, manifest);
  const reportPath = path.join(REVIEW_DIR, `identity-review-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  ensureReviewDir();
  fs.writeFileSync(reportPath, buildMarkdownReviewReport(session, manifest));
  appendReviewAudit({ event: 'MANIFEST_EXPORTED', conflictId: null, reviewedBy: session.reviewer || 'system', decision: null, previousDecision: null, fingerprint: manifest.sourceFingerprint });
  return { manifest, manifestPath, reportPath, sessionFile };
}

try {
  if (command === 'list') {
    const { session } = loadOrCreateSession();
    (session.conflicts || []).forEach(conflict => console.log(`${conflict.conflictId} ${conflict.type} risk=${conflict.risk?.level || 'LOW'} recommendation=${conflict.recommendation?.code || 'MANUAL_REVIEW'}`));
  } else if (command === 'show') {
    const conflictId = args[1];
    const { session } = loadOrCreateSession();
    const conflict = (session.conflicts || []).find(item => item.conflictId === conflictId);
    if (!conflict) throw new Error(`Unknown conflictId: ${conflictId}`);
    printConflict(conflict);
  } else if (command === 'decide') {
    const conflictId = args[1];
    const decision = args[2];
    const input = requiredDecisionInput();
    const loaded = loadOrCreateSession();
    const previous = (loaded.session.decisions || []).find(item => item.conflictId === conflictId) || null;
    const next = upsertDecision(loaded.session, conflictId, {
      decision,
      status: 'approved',
      ...input,
      notes: option('notes'),
      confirmationPhrase: option('confirmationPhrase'),
      secondReviewedBy: option('secondReviewedBy'),
      ownerOverride: option('ownerOverride') === 'true',
    });
    const written = writeSession(next);
    const current = next.decisions.find(item => item.conflictId === conflictId);
    appendReviewAudit({ event: previous ? 'DECISION_UPDATED' : 'DECISION_CREATED', conflictId, reviewedBy: current.reviewedBy, decision: current.decision, previousDecision: previous?.decision || null, fingerprint: current.decisionFingerprint });
    console.log(JSON.stringify({ ok: true, session: written.file, decision: current, validation: next.validation, importAllowed: false }, null, 2));
  } else if (command === 'defer') {
    const conflictId = args[1];
    const loaded = loadOrCreateSession();
    const previous = (loaded.session.decisions || []).find(item => item.conflictId === conflictId) || null;
    const next = upsertDecision(loaded.session, conflictId, {
      decision: 'DEFER',
      status: 'pending',
      reason: option('reason') || 'Deferred for manual review.',
      reviewedBy: option('reviewedBy') || option('reviewer') || 'system:pending-review',
      evidence: option('evidence') || 'manual_review_required',
      notes: option('notes'),
    });
    const written = writeSession(next);
    const current = next.decisions.find(item => item.conflictId === conflictId);
    appendReviewAudit({ event: 'DECISION_DEFERRED', conflictId, reviewedBy: current.reviewedBy, decision: current.decision, previousDecision: previous?.decision || null, fingerprint: current.decisionFingerprint });
    console.log(JSON.stringify({ ok: true, session: written.file, decision: current, validation: next.validation, importAllowed: false }, null, 2));
  } else if (command === 'validate') {
    const loaded = loadOrCreateSession();
    const event = loaded.session.validation?.valid ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED';
    appendReviewAudit({ event, conflictId: null, reviewedBy: loaded.session.reviewer || 'system', decision: null, previousDecision: null, fingerprint: null });
    console.log(JSON.stringify({ ok: loaded.session.validation?.valid === true, validation: loaded.session.validation, importAllowed: false }, null, 2));
    if (!loaded.session.validation?.valid) process.exitCode = 1;
  } else if (command === 'export') {
    const loaded = loadOrCreateSession();
    const exported = exportSession(loaded.session, loaded.file);
    console.log(JSON.stringify({ ok: true, manifestPath: exported.manifestPath, reportPath: exported.reportPath, summary: exported.manifest.summary, reviewComplete: exported.manifest.reviewComplete, importAllowed: false }, null, 2));
  } else if (command === 'summary') {
    const loaded = loadOrCreateSession();
    const summary = sessionSummary(loaded.session);
    console.log(formatReviewSummary(summary));
  } else {
    throw new Error(`Unknown identity review command: ${command}`);
  }
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
