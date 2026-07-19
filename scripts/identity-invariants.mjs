import fs from 'node:fs';
import path from 'node:path';
import { classifyIdentityInvariants, writeInvariantReports } from '../src/admin/identity/invariants/index.js';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const dryRunPath = process.env.IDENTITY_DRY_RUN_REPORT || 'backups/identity/dryrun/dry-run-report.json';
const brokenReferencesPath = process.env.IDENTITY_BROKEN_REFERENCES_REPORT || 'backups/identity/forensics/broken-references.json';
const manifestPath = process.env.IDENTITY_RESOLUTION_MANIFEST || 'backups/identity/resolution-manifest-v2.json';

if (!fs.existsSync(dryRunPath)) {
  console.error(`Identity Invariants: dry run report not found: ${dryRunPath}`);
  process.exit(1);
}

if (!fs.existsSync(brokenReferencesPath)) {
  console.error(`Identity Invariants: broken references forensic report not found: ${brokenReferencesPath}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Identity Invariants: resolution manifest not found: ${manifestPath}`);
  process.exit(1);
}

const report = classifyIdentityInvariants({
  dryRunReport: readJson(dryRunPath),
  brokenReferencesReport: readJson(brokenReferencesPath),
  manifest: readJson(manifestPath),
});

const files = writeInvariantReports(report);
const counts = report.summary.counts;

console.log('Identity Invariants');
console.log(`BLOCKING: ${counts.BLOCKING}`);
console.log(`WARNING: ${counts.WARNING}`);
console.log(`INFORMATIONAL: ${counts.INFORMATIONAL}`);
console.log(`Migration readiness: ${report.summary.readiness.migrationReadiness}`);
console.log(`Verify readiness: ${report.summary.readiness.verifyReadiness}`);
console.log(`Import allowed: ${String(report.summary.readiness.importAllowed)}`);
console.log(`Report: ${path.resolve(files.mdPath)}`);
console.log(`JSON: ${path.resolve(files.jsonPath)}`);
console.log(`Redacted report: ${path.resolve(files.redactedMdPath)}`);
console.log(`Redacted JSON: ${path.resolve(files.redactedJsonPath)}`);
