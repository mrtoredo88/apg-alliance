const normalize = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');

const matchesAny = (file, patterns) => patterns.some(pattern => (
  pattern.endsWith('/**')
    ? file.startsWith(pattern.slice(0, -3))
    : file === pattern
));

export const BACKEND_INPUTS = [
  'server/**',
  'server-shared/**',
  'docs/architecture-guard-report.json',
];

export const FRONTEND_INPUTS = [
  'src/**',
  'public/**',
  'index.html',
  'vite.config.js',
  'package.json',
  'package-lock.json',
  'deploy-frontend.sh',
];

export const MIGRATION_OPERATOR_INPUTS = [
  'ops/migration-operator/**',
  'scripts/account-remote-preflight.mjs',
  'scripts/account-snapshot.mjs',
  'scripts/account-core-import.mjs',
  'scripts/account-dry-run.mjs',
  'scripts/account-verify.mjs',
  'scripts/account-rollback.mjs',
  'scripts/account-observe.mjs',
  'scripts/identity-merge-execute.mjs',
  'scripts/admin-pg-password-repair.mjs',
  'scripts/tatyana-pg-account-repair.mjs',
  'scripts/owner-pg-account-audit.mjs',
  'scripts/owner-pg-account-repair.mjs',
  'scripts/pg-profile-integrity-audit.mjs',
  'scripts/pg-partner-catalog-import.mjs',
  'scripts/lib/**',
  'server-shared/admin-password.js',
  'server/src/apg/identity/schema/identity-v2.sql',
  'server/src/apg/account/schema/account-core.sql',
  'server/src/lib/documentStore.js',
  'server/firebase-service-account.json',
  'server/src/routes/system-status.js',
  'backups/audits/merge-tatyana/merge-plan.json',
  'docs/migration/rollback-readiness.md',
  'docs/migration/monitoring-readiness.md',
  'package.json',
  'package-lock.json',
];

export const RELEASE_INFRA_INPUTS = [
  'scripts/deploy-changed.mjs',
  'scripts/release-change-plan.mjs',
  'scripts/configure-registry-lifecycle.sh',
  'ops/registry-lifecycle/**',
];

export function createReleasePlan(inputFiles) {
  const files = [...new Set(inputFiles.map(normalize).filter(Boolean))].sort();
  const frontendFiles = files.filter(file => matchesAny(file, FRONTEND_INPUTS));
  const backendFiles = files.filter(file => matchesAny(file, BACKEND_INPUTS));
  const migrationFiles = files.filter(file => matchesAny(file, MIGRATION_OPERATOR_INPUTS));
  const infraFiles = files.filter(file => matchesAny(file, RELEASE_INFRA_INPUTS));

  return {
    files,
    frontend: frontendFiles.length > 0,
    backend: backendFiles.length > 0,
    migrationOperator: migrationFiles.length > 0,
    frontendFiles,
    backendFiles,
    migrationFiles,
    infraFiles,
  };
}
