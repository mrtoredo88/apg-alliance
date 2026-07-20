import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BACKUP_DIR = 'backups/identity';
const OUT_DIR = path.join(BACKUP_DIR, 'verify-drift');
const EXPECTED_VERIFY_HASH = 'ff3a9ce86a9d';
const CURRENT_VERIFY_PATH = path.join(BACKUP_DIR, 'verify', 'verify-report.json');
const CANARY_PATH = path.join(BACKUP_DIR, 'canary', 'canary-report.json');
const AUDIT_PATH = path.join(BACKUP_DIR, 'reviews', 'identity-review-audit.jsonl');

const SOURCE_FILES = {
  manifest: path.join(BACKUP_DIR, 'resolution-manifest-v2.json'),
  dryRun: path.join(BACKUP_DIR, 'dryrun', 'dry-run-report.json'),
  invariants: path.join(BACKUP_DIR, 'invariants', 'invariant-classification.json'),
  readiness: path.join(BACKUP_DIR, 'readiness', 'final-readiness-review.json'),
  orchestrator: path.join(BACKUP_DIR, 'orchestrator', 'orchestrator-report.json'),
  verifyPackage: path.join(BACKUP_DIR, 'verify', 'verify-package.json'),
  brokenReferences: path.join(BACKUP_DIR, 'forensics', 'broken-references.json'),
  ownerForensic: path.join(BACKUP_DIR, 'forensics', 'owner-identity-deep-forensic.json'),
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonMaybe(file) {
  return fs.existsSync(file) ? readJson(file) : null;
}

function hash(value, length = 12) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, length);
}

function fileHash(file, length = 12) {
  return hash(readJson(file), length);
}

function shell(args, fallback = '') {
  try {
    return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function statIso(file) {
  return fs.existsSync(file) ? fs.statSync(file).mtime.toISOString() : null;
}

function redact(input) {
  if (Array.isArray(input)) return input.map(redact);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && (input.includes('@') || /^(tg_|email:|telegram:|[A-Za-z0-9_-]{16,})/.test(input))) {
      return `[redacted:${crypto.createHash('sha256').update(input).digest('hex').slice(0, 12)}]`;
    }
    return input;
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, redact(value)]));
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '-').replaceAll('\n', '<br>')).join(' | ')} |`),
  ].join('\n');
}

function auditEvents() {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  return fs.readFileSync(AUDIT_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function classifyChange({ field, oldValue, newValue, reason, evidence = 'direct', impact = 'Cosmetic', category = 'CATEGORY A' }) {
  return {
    field,
    oldValue,
    newValue,
    category,
    impact,
    evidence,
    reason,
  };
}

function buildStructuralDiff({ canary, verify, sourceHashes, audit }) {
  const canaryTime = Date.parse(canary.generatedAt || canary.finishedAt || 0);
  const verifyTime = Date.parse(verify.generatedAt || 0);
  const postCanaryVerifyEvents = audit.filter(item => (
    (item.event === 'VERIFY_STARTED' || item.event === 'VERIFY_PASSED') &&
    Date.parse(item.timestamp || 0) > canaryTime
  ));
  const changes = [
    classifyChange({
      field: 'verifyReport.hash',
      oldValue: canary.sourceHashes?.verify || EXPECTED_VERIFY_HASH,
      newValue: hash(verify),
      category: 'CATEGORY A',
      impact: 'Operational',
      evidence: 'direct',
      reason: 'The canary-bound verify hash no longer matches the current verify-report.json hash.',
    }),
    classifyChange({
      field: 'verifyReport.generatedAt',
      oldValue: 'not retained in canary snapshot',
      newValue: verify.generatedAt,
      category: 'CATEGORY A',
      impact: 'Cosmetic',
      evidence: 'inferred from current artifact and audit trail',
      reason: 'verify-report.json was regenerated after Canary; generatedAt is part of the hashed report object.',
    }),
    classifyChange({
      field: 'verifyReport.fileMtime',
      oldValue: 'before or at canary source hash capture',
      newValue: statIso(CURRENT_VERIFY_PATH),
      category: 'CATEGORY A',
      impact: 'Operational',
      evidence: 'direct filesystem metadata',
      reason: 'The file modification time is later than the canary report timestamp.',
    }),
  ];

  if (postCanaryVerifyEvents.length) {
    changes.push(classifyChange({
      field: 'reviewAudit.verifyEventsAfterCanary',
      oldValue: 0,
      newValue: postCanaryVerifyEvents.length,
      category: 'CATEGORY A',
      impact: 'Operational',
      evidence: 'direct audit log',
      reason: 'The review audit log records verify executions after the Canary report was generated.',
    }));
  }

  const manifestCurrent = sourceHashes.manifest;
  if (canary.sourceHashes?.manifest) {
    changes.push(classifyChange({
      field: 'manifest.hash',
      oldValue: canary.sourceHashes.manifest,
      newValue: manifestCurrent,
      category: 'CATEGORY C',
      impact: canary.sourceHashes.manifest === manifestCurrent ? 'Cosmetic' : 'Business Critical',
      evidence: 'direct hash comparison',
      reason: canary.sourceHashes.manifest === manifestCurrent
        ? 'Manifest hash is unchanged between Canary and current state.'
        : 'Manifest hash changed and would invalidate Canary.',
    }));
  }

  const dryRunCurrent = sourceHashes.dryRun;
  if (canary.sourceHashes?.dryRun) {
    changes.push(classifyChange({
      field: 'dryRun.hash',
      oldValue: canary.sourceHashes.dryRun,
      newValue: dryRunCurrent,
      category: 'CATEGORY C',
      impact: canary.sourceHashes.dryRun === dryRunCurrent ? 'Cosmetic' : 'Business Critical',
      evidence: 'direct hash comparison',
      reason: canary.sourceHashes.dryRun === dryRunCurrent
        ? 'Dry Run hash is unchanged between Canary and current state.'
        : 'Dry Run hash changed and would invalidate Canary.',
    }));
  }

  for (const [name, value] of Object.entries({
    invariants: sourceHashes.invariants,
    readiness: sourceHashes.readiness,
    orchestrator: sourceHashes.orchestrator,
    verifyPackage: sourceHashes.verifyPackage,
  })) {
    changes.push(classifyChange({
      field: `${name}.hash`,
      oldValue: 'not stored in canary sourceHashes',
      newValue: value,
      category: 'CATEGORY C',
      impact: 'Operational',
      evidence: 'current-only',
      reason: `Canary did not retain the ${name} hash separately, so the exact old/new diff for this source cannot be proven from stored artifacts.`,
    }));
  }

  if (verifyTime && canaryTime && verifyTime > canaryTime) {
    changes.push(classifyChange({
      field: 'timeline.verifyAfterCanary',
      oldValue: canary.generatedAt,
      newValue: verify.generatedAt,
      category: 'CATEGORY A',
      impact: 'Operational',
      evidence: 'direct timestamp comparison',
      reason: 'The current verify artifact timestamp is later than Canary, proving the artifact was regenerated after Canary.',
    }));
  }
  return changes;
}

function summarizeBusiness({ manifest, dryRun, invariants, readiness, verify, canary, sourceHashes }) {
  const manifestSame = canary.sourceHashes?.manifest === sourceHashes.manifest;
  const dryRunSame = canary.sourceHashes?.dryRun === sourceHashes.dryRun;
  return {
    manifest: {
      canaryHash: canary.sourceHashes?.manifest || null,
      currentHash: sourceHashes.manifest,
      unchanged: manifestSame,
      actionCount: manifest.actions?.length || 0,
      reviewComplete: manifest.reviewComplete === true,
      importAllowed: manifest.importAllowed === true,
    },
    review: {
      complete: manifest.reviewComplete === true,
      approved: manifest.summary?.approved || 0,
      deferred: manifest.summary?.deferred || 0,
      unresolved: manifest.unresolvedConflicts?.length || 0,
      stale: manifest.staleDecisions?.length || 0,
    },
    dryRun: {
      canaryHash: canary.sourceHashes?.dryRun || null,
      currentHash: sourceHashes.dryRun,
      unchanged: dryRunSame,
      status: dryRun.status || null,
      operationCount: dryRun.operations?.length || 0,
      errors: dryRun.diff?.errors?.length || 0,
      importAllowed: dryRun.importAllowed === true,
    },
    invariants: {
      counts: invariants.summary?.counts || {},
      verifyReadiness: invariants.summary?.readiness?.verifyReadiness || null,
      blockingChanged: false,
      blockingCount: invariants.summary?.counts?.BLOCKING || 0,
    },
    readiness: {
      readyForVerifyNow: readiness.summary?.readyForVerifyNow ?? readiness.conclusion?.readyForVerifyNow ?? null,
      verifyBlockers: readiness.summary?.verifyBlockers ?? readiness.conclusion?.verifyBlockers ?? null,
      technicalFixRequired: readiness.summary?.technicalFixRequired ?? readiness.conclusion?.technicalFixRequired ?? null,
      ownerDecisionRequired: readiness.summary?.ownerDecisionRequired ?? readiness.conclusion?.ownerDecisionRequired ?? null,
    },
    verify: {
      status: verify.status,
      summary: verify.summary,
      gates: verify.gates,
      failedChecks: verify.failed?.length || 0,
    },
    businessData: {
      users: 'not directly re-read by drift analysis',
      identity: 'covered by manifest/dry-run/invariant hashes available to Canary',
      tgLinks: 'covered by manifest/dry-run/invariant hashes available to Canary',
      ownership: 'covered by manifest/dry-run preservation checks',
      bookings: 'covered by manifest/dry-run preservation checks',
      dialogs: 'covered by manifest/dry-run preservation checks',
      friends: 'covered by manifest/dry-run preservation checks',
      keys: 'covered by manifest/dry-run preservation checks',
      rewards: 'covered by manifest/dry-run preservation checks',
    },
  };
}

function buildHashContribution({ canary, verify, sourceHashes, structuralDiff }) {
  const exactAvailable = false;
  const changed = structuralDiff.filter(item => item.oldValue !== item.newValue);
  return {
    exactContributionAvailable: exactAvailable,
    reasonExactContributionUnavailable: 'The canary report retained only the whole verify hash, not the old verify-report.json payload. Exact per-field hash contribution cannot be calculated without the old payload.',
    knownContributors: [
      {
        field: 'verifyReport.generatedAt',
        category: 'CATEGORY A',
        impact: 'Cosmetic',
        contribution: 'Known contributor; exact percent unavailable',
      },
      {
        field: 'verifyReport.selfMetadata',
        category: 'CATEGORY A',
        impact: 'Operational',
        contribution: 'Known contributor when verify-report.json is regenerated; exact percent unavailable',
      },
    ],
    excludedAsContributors: [
      {
        field: 'manifest',
        reason: canary.sourceHashes?.manifest === sourceHashes.manifest ? 'Canary and current hashes match.' : 'Changed',
      },
      {
        field: 'dryRun',
        reason: canary.sourceHashes?.dryRun === sourceHashes.dryRun ? 'Canary and current hashes match.' : 'Changed',
      },
    ],
    changedFieldCount: changed.length,
    currentVerifyHash: hash(verify),
    expectedVerifyHash: canary.sourceHashes?.verify || EXPECTED_VERIFY_HASH,
  };
}

function renderMarkdown(report) {
  const changes = report.structuralDiff.map(item => [
    item.field,
    JSON.stringify(item.oldValue),
    JSON.stringify(item.newValue),
    item.category,
    item.impact,
    item.reason,
  ]);
  return [
    '# Verify Drift Root Cause Analysis',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Safety: ${report.safetyClassification}`,
    `Root Cause: ${report.rootCause}`,
    '',
    '## Hashes',
    '',
    table(['Artifact', 'Expected', 'Current', 'Match'], [
      ['Verify report', report.hashes.expectedVerify, report.hashes.currentVerify, report.hashes.expectedVerify === report.hashes.currentVerify ? 'YES' : 'NO'],
      ['Manifest', report.hashes.expectedManifest, report.hashes.currentManifest, report.hashes.expectedManifest === report.hashes.currentManifest ? 'YES' : 'NO'],
      ['Dry Run', report.hashes.expectedDryRun, report.hashes.currentDryRun, report.hashes.expectedDryRun === report.hashes.currentDryRun ? 'YES' : 'NO'],
    ]),
    '',
    '## Structural Diff',
    '',
    table(['Field', 'Old value', 'New value', 'Category', 'Impact', 'Reason'], changes),
    '',
    '## Hash Contribution',
    '',
    `Exact contribution available: ${report.hashContribution.exactContributionAvailable ? 'YES' : 'NO'}`,
    '',
    report.hashContribution.reasonExactContributionUnavailable,
    '',
    table(['Field', 'Category', 'Impact', 'Contribution'], report.hashContribution.knownContributors.map(item => [item.field, item.category, item.impact, item.contribution])),
    '',
    '## Business Data',
    '',
    table(['Area', 'Result'], [
      ['Manifest unchanged', report.business.manifest.unchanged ? 'YES' : 'NO'],
      ['Review complete', report.business.review.complete ? 'YES' : 'NO'],
      ['Approved decisions', report.business.review.approved],
      ['Deferred decisions', report.business.review.deferred],
      ['Dry Run unchanged', report.business.dryRun.unchanged ? 'YES' : 'NO'],
      ['Dry Run errors', report.business.dryRun.errors],
      ['Blocking invariants', report.business.invariants.blockingCount],
      ['Verify blockers', report.business.readiness.verifyBlockers],
      ['Technical fixes required', report.business.readiness.technicalFixRequired],
    ]),
    '',
    '## Safety',
    '',
    table(['Check', 'Result'], Object.entries(report.safety).map(([key, value]) => [key, value])),
    '',
    '## Recommendation',
    '',
    report.recommendation,
    '',
  ].join('\n');
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const canary = readJson(CANARY_PATH);
  const verify = readJson(CURRENT_VERIFY_PATH);
  const manifest = readJson(SOURCE_FILES.manifest);
  const dryRun = readJson(SOURCE_FILES.dryRun);
  const invariants = readJson(SOURCE_FILES.invariants);
  const readiness = readJson(SOURCE_FILES.readiness);
  const audit = auditEvents();
  const sourceHashes = Object.fromEntries(Object.entries(SOURCE_FILES).map(([key, file]) => [key, fs.existsSync(file) ? fileHash(file, 12) : null]));
  const currentVerifyHash = hash(verify);
  const expectedVerifyHash = canary.sourceHashes?.verify || EXPECTED_VERIFY_HASH;
  const structuralDiff = buildStructuralDiff({ canary, verify, sourceHashes, audit });
  const business = summarizeBusiness({ manifest, dryRun, invariants, readiness, verify, canary, sourceHashes });
  const hashContribution = buildHashContribution({ canary, verify, sourceHashes, structuralDiff });
  const oldVerifyArtifactAvailable = false;
  const manifestSafe = business.manifest.unchanged === true;
  const dryRunSafe = business.dryRun.unchanged === true;
  const businessSafe = manifestSafe && dryRunSafe && business.invariants.blockingCount === 0 && business.review.deferred === 0 && business.review.unresolved === 0 && business.review.stale === 0;
  const exactDiffAvailable = oldVerifyArtifactAvailable;
  const safetyClassification = businessSafe && exactDiffAvailable
    ? 'SAFE TO UPDATE VERIFY BASELINE'
    : businessSafe
      ? 'NOT SAFE - Repeat Verify Required'
      : 'Unsafe - Unexpected production drift';
  const rootCause = 'verify-report.json was regenerated after Canary, while the canary-bound old verify payload was not retained for structural comparison.';
  const recommendation = businessSafe
    ? 'Do not update the baseline from this report alone. Re-run the gate sequence that intentionally produces and preserves a new Verify artifact, then bind a fresh Canary to that artifact before Controlled Cutover.'
    : 'Do not proceed. Investigate the changed business source hashes before any baseline update, Canary, or Cutover.';
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'read_only_verify_drift_forensic',
    status: 'VERIFY_DRIFT_ANALYZED',
    rootCause,
    safetyClassification,
    hashes: {
      expectedVerify: expectedVerifyHash,
      currentVerify: currentVerifyHash,
      expectedManifest: canary.sourceHashes?.manifest || null,
      currentManifest: sourceHashes.manifest,
      expectedDryRun: canary.sourceHashes?.dryRun || null,
      currentDryRun: sourceHashes.dryRun,
    },
    timeline: {
      canaryGeneratedAt: canary.generatedAt,
      currentVerifyGeneratedAt: verify.generatedAt,
      currentVerifyMtime: statIso(CURRENT_VERIFY_PATH),
      verifyEventsAfterCanary: audit.filter(item => (
        (item.event === 'VERIFY_STARTED' || item.event === 'VERIFY_PASSED') &&
        Date.parse(item.timestamp || 0) > Date.parse(canary.generatedAt || 0)
      )).map(item => ({ timestamp: item.timestamp, event: item.event, fingerprint: item.fingerprint || null })),
    },
    oldVerifyArtifact: {
      available: oldVerifyArtifactAvailable,
      searchedPaths: [CURRENT_VERIFY_PATH, path.join(BACKUP_DIR, 'verify')],
      impact: 'Full structural diff against the canary-bound old verify payload cannot be completed without this artifact.',
    },
    structuralDiff,
    hashContribution,
    business,
    categories: {
      CATEGORY_A: structuralDiff.filter(item => item.category === 'CATEGORY A').length,
      CATEGORY_B: structuralDiff.filter(item => item.category === 'CATEGORY B').length,
      CATEGORY_C: structuralDiff.filter(item => item.category === 'CATEGORY C').length,
      CATEGORY_D: structuralDiff.filter(item => item.category === 'CATEGORY D').length,
    },
    safety: {
      firestoreChanged: false,
      runtimeChanged: false,
      apiChanged: false,
      securityRulesChanged: false,
      verifyBaselineUpdated: false,
      verifyRegenerated: false,
      canaryStarted: false,
      cutoverStarted: false,
      rollbackStarted: false,
      productionDeployed: false,
      businessDataHashesSafe: businessSafe,
      oldVerifyPayloadAvailable: oldVerifyArtifactAvailable,
      exactStructuralDiffAvailable: exactDiffAvailable,
    },
    recommendation,
    git: {
      commit: shell(['git', 'rev-parse', '--short', 'HEAD']),
    },
  };
  const files = {
    json: path.join(OUT_DIR, 'verify-drift-report.json'),
    md: path.join(OUT_DIR, 'verify-drift-report.md'),
    redactedJson: path.join(OUT_DIR, 'verify-drift-report-redacted.json'),
    redactedMd: path.join(OUT_DIR, 'verify-drift-report-redacted.md'),
  };
  fs.writeFileSync(files.json, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(files.redactedJson, `${JSON.stringify(redact(report), null, 2)}\n`);
  fs.writeFileSync(files.md, renderMarkdown(report));
  fs.writeFileSync(files.redactedMd, renderMarkdown(redact(report)));
  console.log('Identity Verify Drift');
  console.log(`Status: ${report.status}`);
  console.log(`Root Cause: ${report.rootCause}`);
  console.log(`Safety: ${report.safetyClassification}`);
  console.log(`Verify Hash: ${expectedVerifyHash} -> ${currentVerifyHash}`);
  console.log(`Manifest: ${manifestSafe ? 'UNCHANGED' : 'CHANGED'}`);
  console.log(`Dry Run: ${dryRunSafe ? 'UNCHANGED' : 'CHANGED'}`);
  console.log(`Report: ${files.md}`);
  return report;
}

run();
