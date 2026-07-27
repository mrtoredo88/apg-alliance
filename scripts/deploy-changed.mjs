import { spawnSync } from 'node:child_process';
import { createReleasePlan } from './release-change-plan.mjs';
import { createAnalysis, formatAnalysis, STATUS } from './release-report.mjs';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const explain = args.has('--explain') || args.has('--why');
const deployMigrationOperator = args.has('--deploy-migration-operator');
const startedAt = Date.now();

function valueAfter(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function output(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

const head = valueAfter('--head', 'HEAD');
const base = valueAfter('--base', process.env.APG_RELEASE_BASE || `${head}^`);
const changed = output('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`])
  .split('\n')
  .filter(Boolean);
const plan = createReleasePlan(changed);
const analysis = createAnalysis(plan, { deployMigrationOperator });

console.log(formatAnalysis({ base, head, plan, analysis, durationMs: Date.now() - startedAt }));

if (!plan.frontend && !plan.backend && !plan.migrationOperator) {
  console.log('No deployable changes found.');
  process.exit(0);
}

if (dryRun || explain) process.exit(0);

if (plan.frontend) {
  run('bash', ['./deploy-frontend.sh']);
  analysis.frontend = STATUS.deployed;
}
if (plan.backend) {
  const backend = spawnSync('bash', ['./server/deploy.sh'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (backend.status === 42) {
    analysis.backend = STATUS.identical;
    analysis.dockerBuild = STATUS.deployed;
    analysis.dockerPush = STATUS.identical;
    analysis.serverlessRevision = STATUS.identical;
    analysis.avoided.registryPushes = 1;
    analysis.avoided.serverlessRevisions = 1;
  } else if (backend.status !== 0) {
    process.exit(backend.status || 1);
  } else {
    analysis.backend = STATUS.deployed;
    analysis.dockerBuild = STATUS.deployed;
    analysis.dockerPush = STATUS.deployed;
    analysis.serverlessRevision = STATUS.deployed;
  }
}

if (plan.migrationOperator) {
  if (deployMigrationOperator) {
    run('node', ['./scripts/account-operator-deploy.mjs']);
    analysis.migration = STATUS.deployed;
  } else {
    console.log('Migration operator inputs changed; deployment skipped unless --deploy-migration-operator is supplied.');
  }
}

console.log(formatAnalysis({ base, head, plan, analysis, durationMs: Date.now() - startedAt }));
