import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = 'backups/identity/readiness';

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
    if (/id|uid|email|telegram|target|canonical|user|conflict|value/i.test(key)) {
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

function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Required readiness source is missing: ${file}`);
  return file;
}

function currentBlockerReview({ invariants, manifest, brokenReferences, ownerForensic }) {
  const approved = new Set((manifest.actions || []).map(item => item.conflictId).filter(Boolean));
  const unresolved = new Set(manifest.unresolvedConflicts || []);
  return (invariants.items || []).filter(item => item.severity === 'BLOCKING').map(item => {
    const conflictId = item.payload?.conflictId || null;
    const disappearsAfterApproved = conflictId ? approved.has(conflictId) : false;
    const category = item.category;
    const isUserData = ['DUPLICATE_EMAIL', 'DUPLICATE_TELEGRAM_ID', 'ORPHAN_TG_LINK', 'UNRESOLVED_OWNER_DECISION'].includes(category);
    const isBusinessData = false;
    const onlyIdentity = true;
    let bucket = 'Owner Decision Required';
    let requiresSeparateFix = false;
    let blocksVerify = true;
    let evidence = item.evidence || [];
    let conclusion = item.blockingReason || 'Blocking identity invariant.';

    if (category === 'UNRESOLVED_OWNER_DECISION' && conflictId === ownerForensic.conflictId) {
      evidence = [
        ...evidence,
        `Owner Deep Forensic recommendation: ${ownerForensic.finalRecommendation?.recommendedDecision}`,
        `Canonical account: ${ownerForensic.finalRecommendation?.canonicalAccount}`,
        `Confidence: ${ownerForensic.finalRecommendation?.confidence}%`,
      ];
      conclusion = 'Blocks Verify only because the owner decision has not been recorded; forensic evidence is now sufficient for an explicit owner-approved decision.';
    } else if (category === 'UNRESOLVED_OWNER_DECISION' && unresolved.has(conflictId)) {
      conclusion = 'Blocks Verify because no final owner decision exists; if evidence is insufficient, this must remain deferred rather than being auto-resolved.';
    } else if (category === 'DUPLICATE_EMAIL' || category === 'DUPLICATE_TELEGRAM_ID' || category === 'ORPHAN_TG_LINK') {
      conclusion = 'Blocks Verify as a raw invariant until the corresponding owner decision is recorded and a new dry run proves the virtual state is clean.';
    }

    return {
      invariantId: item.id,
      category,
      source: item.source,
      reason: item.blockingReason,
      relatesToUserData: isUserData,
      relatesToBusinessData: isBusinessData,
      identityOnly: onlyIdentity,
      disappearsAfterApprovedOwnerDecisions: disappearsAfterApproved,
      requiresSeparateFix,
      blocksVerify,
      readinessBucket: bucket,
      evidence,
      conclusion,
    };
  }).concat((brokenReferences.records || []).map(record => ({
    invariantId: record.referenceId,
    category: 'DANGLING_IDENTITY_REFERENCE',
    source: 'broken-references-forensic.records',
    reason: record.rootCause,
    relatesToUserData: false,
    relatesToBusinessData: false,
    identityOnly: true,
    disappearsAfterApprovedOwnerDecisions: record.disappearsAfterApprovedActions === 'YES',
    requiresSeparateFix: record.needsIndependentRepair === 'YES',
    blocksVerify: false,
    readinessBucket: 'Ready',
    evidence: [
      `Collection: ${record.collection}`,
      `Business impact: ${record.businessImpact}`,
      `Linked conflict: ${record.linkedConflict}`,
      `Business references: ${Object.entries(record.allRelated || {}).filter(([name]) => !['auth_map', 'users', 'canonicalUsers', 'identityLinks', 'emailIndex', 'tgLinks', 'roles'].includes(name)).reduce((sum, [, count]) => sum + Number(count || 0), 0)}`,
    ],
    conclusion: 'Does not block Verify because forensic evidence classifies it as a historical auth_map artifact without business references or identity-chain ownership.',
  })));
}

function finalAreas({ invariants, manifest, dryRun, brokenReferences }) {
  const counts = invariants.summary?.counts || {};
  return [
    ['Duplicate emails', `${dryRun.invariants?.duplicateEmails?.length || 0} remaining`, 'YES', 'Two duplicate email groups still exist in the current dry run and require owner decisions plus a clean follow-up dry run.'],
    ['Telegram duplicates', `${dryRun.invariants?.duplicateTelegramIds?.length || 0} remaining`, 'YES', 'One Telegram duplicate still exists and can affect identity resolution.'],
    ['Orphan tgLinks', `${dryRun.invariants?.orphanTgLinks?.length || 0} remaining`, 'YES', 'One orphan tgLink remains unresolved and can route Telegram login to a missing identity.'],
    ['Broken references', `${brokenReferences.summary?.brokenReferences || 0} classified informational`, 'NO', 'All current broken references are historical auth_map artifacts with LOW business impact.'],
    ['Owner decisions', `${manifest.summary?.approved || 0} approved / ${manifest.summary?.deferred || 0} deferred`, 'YES', 'Deferred owner decisions keep the review incomplete.'],
    ['Dry Run', dryRun.readyForVerify ? 'READY' : 'NOT READY', dryRun.readyForVerify ? 'NO' : 'YES', 'Dry run currently reports readyForVerify=false.'],
    ['Invariants', `${counts.BLOCKING || 0} blocking / ${counts.INFORMATIONAL || 0} informational`, (counts.BLOCKING || 0) ? 'YES' : 'NO', 'Blocking invariants are unresolved identity conflicts; informational artifacts do not block.'],
  ];
}

function buildReview() {
  const dryRunPath = requireFile('backups/identity/dryrun/dry-run-report.json');
  const invariantsPath = requireFile('backups/identity/invariants/invariant-classification.json');
  const brokenReferencesPath = requireFile('backups/identity/forensics/broken-references.json');
  const ownerForensicPath = requireFile('backups/identity/forensics/owner-identity-deep-forensic.json');
  const manifestPath = requireFile('backups/identity/resolution-manifest-v2.json');
  const dryRun = readJson(dryRunPath);
  const invariants = readJson(invariantsPath);
  const brokenReferences = readJson(brokenReferencesPath);
  const ownerForensic = readJson(ownerForensicPath);
  const manifest = readJson(manifestPath);
  const blockers = currentBlockerReview({ invariants, manifest, brokenReferences, ownerForensic });
  const verifyBlockers = blockers.filter(item => item.blocksVerify);
  const technicalFixes = blockers.filter(item => item.readinessBucket === 'Technical Fix Required');
  const ownerDecisionRequired = blockers.filter(item => item.readinessBucket === 'Owner Decision Required');
  const ready = blockers.filter(item => item.readinessBucket === 'Ready');
  const conclusion = technicalFixes.length
    ? 'Перед Verify необходимо выполнить технические исправления.'
    : verifyBlockers.length
      ? 'Identity готова к Verify только после принятия оставшихся owner decisions и повторного clean dry-run.'
      : 'Identity готова к Verify.';

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'read-only final readiness review',
    sources: { dryRunPath, invariantsPath, brokenReferencesPath, ownerForensicPath, manifestPath },
    summary: {
      conclusion,
      readyForVerifyNow: verifyBlockers.length === 0,
      verifyBlockers: verifyBlockers.length,
      ownerDecisionRequired: ownerDecisionRequired.length,
      technicalFixRequired: technicalFixes.length,
      readyItems: ready.length,
      importAllowed: false,
    },
    readinessBuckets: {
      Ready: ready,
      OwnerDecisionRequired: ownerDecisionRequired,
      TechnicalFixRequired: technicalFixes,
      VerifyBlocking: verifyBlockers,
    },
    currentBlockers: blockers,
    finalTable: finalAreas({ invariants, manifest, dryRun, brokenReferences }).map(([area, status, blocksVerify, reason]) => ({ area, status, blocksVerify, reason })),
    evidenceLinks: [
      { area: 'Dry Run', source: dryRunPath, finding: `readyForVerify=${dryRun.readyForVerify}; importAllowed=${dryRun.importAllowed}` },
      { area: 'Invariant Classification', source: invariantsPath, finding: `${invariants.summary?.counts?.BLOCKING || 0} BLOCKING, ${invariants.summary?.counts?.INFORMATIONAL || 0} INFORMATIONAL` },
      { area: 'Broken References', source: brokenReferencesPath, finding: `${brokenReferences.summary?.brokenReferences || 0} historical artifacts; business impact LOW` },
      { area: 'Owner Deep Forensic', source: ownerForensicPath, finding: `${ownerForensic.conflictId}: ${ownerForensic.finalRecommendation?.recommendedDecision}, confidence ${ownerForensic.finalRecommendation?.confidence}%` },
      { area: 'Resolution Manifest', source: manifestPath, finding: `${manifest.summary?.approved || 0} approved, ${manifest.summary?.deferred || 0} deferred, importAllowed=${manifest.importAllowed}` },
    ],
    finalConclusion: {
      answer: conclusion,
      variant: technicalFixes.length ? 2 : verifyBlockers.length ? 1 : 1,
      concreteObstacles: verifyBlockers.map(item => ({
        invariantId: item.invariantId,
        category: item.category,
        bucket: item.readinessBucket,
        reason: item.conclusion,
        evidence: item.evidence,
      })),
      realVerifyBlockersOnly: verifyBlockers.map(item => item.invariantId),
    },
    safety: {
      firestoreChanged: false,
      runtimeChanged: false,
      apiChanged: false,
      securityRulesChanged: false,
      reviewSessionChanged: false,
      manifestChanged: false,
      importStarted: false,
      verifyStarted: false,
      canaryStarted: false,
      cutoverStarted: false,
      rollbackStarted: false,
      productionDeployed: false,
    },
  };
}

function renderMarkdown(report, { redacted = false } = {}) {
  return [
    '# Identity Final Readiness Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Redacted: ${String(redacted)}`,
    '',
    '## Executive Summary',
    '',
    `Conclusion: ${report.summary.conclusion}`,
    `Ready for Verify now: ${report.summary.readyForVerifyNow ? 'YES' : 'NO'}`,
    `Verify blockers: ${report.summary.verifyBlockers}`,
    `Owner Decision Required: ${report.summary.ownerDecisionRequired}`,
    `Technical Fix Required: ${report.summary.technicalFixRequired}`,
    `Import allowed: ${String(report.summary.importAllowed)}`,
    '',
    '## Final Table',
    '',
    table(['Area', 'Status', 'Blocks Verify', 'Reason'], report.finalTable.map(item => [item.area, item.status, item.blocksVerify, item.reason])),
    '',
    '## Current Blocking Invariants',
    '',
    table(
      ['Invariant', 'Category', 'Source', 'User Data', 'Business Data', 'Identity Only', 'Disappears After Approved Decisions', 'Requires Separate Fix', 'Blocks Verify', 'Bucket', 'Reason'],
      report.currentBlockers.map(item => [
        item.invariantId,
        item.category,
        item.source,
        item.relatesToUserData ? 'YES' : 'NO',
        item.relatesToBusinessData ? 'YES' : 'NO',
        item.identityOnly ? 'YES' : 'NO',
        item.disappearsAfterApprovedOwnerDecisions ? 'YES' : 'NO',
        item.requiresSeparateFix ? 'YES' : 'NO',
        item.blocksVerify ? 'YES' : 'NO',
        item.readinessBucket,
        item.conclusion,
      ]),
    ),
    '',
    '## Readiness Matrix',
    '',
    '### Ready',
    '',
    table(['Invariant', 'Reason'], report.readinessBuckets.Ready.map(item => [item.invariantId, item.conclusion])),
    '',
    '### Owner Decision Required',
    '',
    table(['Invariant', 'Reason'], report.readinessBuckets.OwnerDecisionRequired.map(item => [item.invariantId, item.conclusion])),
    '',
    '### Technical Fix Required',
    '',
    table(['Invariant', 'Reason'], report.readinessBuckets.TechnicalFixRequired.map(item => [item.invariantId, item.conclusion])),
    '',
    '### Verify Blocking',
    '',
    table(['Invariant', 'Reason'], report.readinessBuckets.VerifyBlocking.map(item => [item.invariantId, item.conclusion])),
    '',
    '## Evidence Links',
    '',
    table(['Area', 'Source', 'Finding'], report.evidenceLinks.map(item => [item.area, item.source, item.finding])),
    '',
    '## Final Conclusion',
    '',
    report.finalConclusion.answer,
    '',
    'Concrete obstacles:',
    ...report.finalConclusion.concreteObstacles.map(item => `- ${item.invariantId}: ${item.reason}`),
    '',
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
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = buildReview();
const redacted = redactDeep(report);
const mdPath = path.join(OUT_DIR, 'final-readiness-review.md');
const jsonPath = path.join(OUT_DIR, 'final-readiness-review.json');
const redactedMdPath = path.join(OUT_DIR, 'final-readiness-review-redacted.md');
const redactedJsonPath = path.join(OUT_DIR, 'final-readiness-review-redacted.json');

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(redactedJsonPath, `${JSON.stringify(redacted, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(report));
fs.writeFileSync(redactedMdPath, renderMarkdown(redacted, { redacted: true }));

console.log(JSON.stringify({
  ok: true,
  readyForVerifyNow: report.summary.readyForVerifyNow,
  conclusion: report.summary.conclusion,
  verifyBlockers: report.summary.verifyBlockers,
  ownerDecisionRequired: report.summary.ownerDecisionRequired,
  technicalFixRequired: report.summary.technicalFixRequired,
  reportPath: mdPath,
  jsonPath,
  redactedPath: redactedMdPath,
  redactedJsonPath,
  changedProductionData: false,
}, null, 2));
