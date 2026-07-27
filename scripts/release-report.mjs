export const STATUS = {
  deployed: 'DEPLOYED',
  required: 'REQUIRED',
  digestCheck: 'PENDING_DIGEST_CHECK',
  skipped: 'SKIPPED',
  identical: 'SKIPPED_IDENTICAL_IMAGE',
};

export function createAnalysis(plan, options = {}) {
  const deployMigrationOperator = Boolean(options.deployMigrationOperator);
  return {
    frontend: plan.frontend ? STATUS.required : STATUS.skipped,
    backend: plan.backend ? STATUS.required : STATUS.skipped,
    migration: plan.migrationOperator
      ? (deployMigrationOperator ? STATUS.required : STATUS.skipped)
      : STATUS.skipped,
    dockerBuild: plan.backend ? STATUS.required : STATUS.skipped,
    dockerPush: plan.backend ? STATUS.digestCheck : STATUS.skipped,
    serverlessRevision: plan.backend ? STATUS.digestCheck : STATUS.skipped,
    reasons: {
      frontend: plan.frontend
        ? `matched: ${plan.frontendFiles.join(', ')}`
        : 'no frontend inputs changed',
      backend: plan.backend
        ? `matched: ${plan.backendFiles.join(', ')}; push and revision depend on the OCI digest comparison`
        : 'no backend inputs changed',
      migration: plan.migrationOperator
        ? (deployMigrationOperator
          ? `matched and explicitly enabled: ${plan.migrationFiles.join(', ')}`
          : `matched but requires --deploy-migration-operator: ${plan.migrationFiles.join(', ')}`)
        : 'no migration operator inputs changed',
    },
    avoided: {
      dockerBuilds: plan.backend ? 0 : 1,
      registryPushes: plan.backend ? 0 : 1,
      serverlessRevisions: plan.backend ? 0 : 1,
      migrationBuilds: plan.migrationOperator && deployMigrationOperator ? 0 : 1,
    },
  };
}

export function formatAnalysis({ base, head, plan, analysis, durationMs = 0 }) {
  const changedFiles = plan.files.length
    ? plan.files.map(file => `  - ${file}`).join('\n')
    : '  (none)';
  return [
    'Deployment analysis',
    `Range: ${base}...${head}`,
    '',
    'Changed files',
    changedFiles,
    '',
    `Frontend: ${analysis.frontend}`,
    `  Reason: ${analysis.reasons.frontend}`,
    `Backend: ${analysis.backend}`,
    `  Reason: ${analysis.reasons.backend}`,
    `Migration: ${analysis.migration}`,
    `  Reason: ${analysis.reasons.migration}`,
    `Docker Build: ${analysis.dockerBuild}`,
    `Docker Push: ${analysis.dockerPush}`,
    `Serverless Revision: ${analysis.serverlessRevision}`,
    '',
    'Release Summary',
    `Frontend: ${analysis.frontend}`,
    `Backend: ${analysis.backend}`,
    `Migration: ${analysis.migration}`,
    `Docker Build: ${analysis.dockerBuild}`,
    `Docker Push: ${analysis.dockerPush}`,
    `Serverless Revision: ${analysis.serverlessRevision}`,
    `Duration: ${(durationMs / 1000).toFixed(1)}s`,
    '',
    'Prevented actions (this run)',
    `Docker builds avoided: ${analysis.avoided.dockerBuilds}`,
    `Registry pushes avoided: ${analysis.avoided.registryPushes}`,
    `Serverless revisions avoided: ${analysis.avoided.serverlessRevisions}`,
    `Migration builds avoided: ${analysis.avoided.migrationBuilds}`,
  ].join('\n');
}
