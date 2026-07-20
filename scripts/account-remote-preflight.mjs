import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';

const REPORT_PATH = 'backups/account-core/preflight/remote-preflight-redacted.json';
const PRODUCTION_CONTAINER = 'apg-api';
const PRODUCTION_CONTAINER_ID = 'bbangqkf2d4pa9855lu0';
const PRODUCTION_NETWORK_ID = 'enpa19j9jpki1f67p6kq';
const PRODUCTION_IMAGE = 'cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest';
const EXECUTE = process.argv.includes('--execute') || process.env.APG_REMOTE_PREFLIGHT_EXECUTION === '1';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function now() {
  return new Date().toISOString();
}

function runScript(script) {
  const result = spawnSync('npm', ['run', script], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    env: { ...process.env, APG_REMOTE_PREFLIGHT_EXECUTION: '1' },
  });
  return {
    script,
    ok: result.status === 0,
    status: result.status,
    stdoutTail: String(result.stdout || '')
      .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
      .replace(/getaddrinfo ENOTFOUND [^\s]+/gi, 'getaddrinfo ENOTFOUND REDACTED_HOST')
      .slice(-3000),
    stderrTail: String(result.stderr || '')
      .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
      .replace(/getaddrinfo ENOTFOUND [^\s]+/gi, 'getaddrinfo ENOTFOUND REDACTED_HOST')
      .slice(-1200),
  };
}

function buildReport({ executed, envLoad, diagnostics = null, preflight = null }) {
  const ready = !executed || (diagnostics?.ok && preflight?.ok);
  return {
    version: 1,
    generatedAt: now(),
    mode: executed ? 'remote_execution' : 'preparation',
    status: ready ? 'REMOTE_PREFLIGHT_READY' : 'REMOTE_PREFLIGHT_BLOCKED',
    productionChanged: false,
    deployStarted: false,
    snapshotStarted: false,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
    rollbackStarted: false,
    postgresWrites: 0,
    secretsPrinted: false,
    dsnPrinted: false,
    productionNetwork: {
      backendRuntime: 'Yandex Serverless Container',
      containerName: PRODUCTION_CONTAINER,
      containerId: PRODUCTION_CONTAINER_ID,
      image: PRODUCTION_IMAGE,
      networkId: PRODUCTION_NETWORK_ID,
      serviceAccount: 'configured in server/deploy.sh',
    },
    localBlocker: 'Local operator DNS cannot resolve the private PostgreSQL hostname.',
    recommendedRuntime: 'Run the migration operator in a one-off container/job attached to the same Yandex VPC network as apg-api.',
    env: {
      loadedKeys: envLoad.loaded.map(item => item.key).sort(),
      sourceCount: Object.keys(envLoad.sources).length,
      redacted: true,
    },
    execution: {
      executed,
      diagnostics,
      preflight,
    },
    nextSafeStep: ready
      ? 'After explicit owner approval, run the same command from the production network and require PASS before account:snapshot.'
      : 'Fix the reported remote blocker, then rerun remote preflight. Do not snapshot/import/verify/canary/cutover.',
  };
}

async function main() {
  const envLoad = loadMigrationEnv();
  let diagnostics = null;
  let preflight = null;

  if (EXECUTE) {
    diagnostics = runScript('postgres:diagnostics');
    if (diagnostics.ok) {
      preflight = runScript('account:preflight');
    } else {
      preflight = { script: 'account:preflight', ok: false, status: null, skipped: true, reason: 'POSTGRES_DIAGNOSTICS_FAILED' };
    }
  }

  const report = buildReport({ executed: EXECUTE, envLoad, diagnostics, preflight });
  ensureDir(REPORT_PATH);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    mode: report.mode,
    report: REPORT_PATH,
    productionNetwork: {
      backendRuntime: report.productionNetwork.backendRuntime,
      containerName: report.productionNetwork.containerName,
      containerId: report.productionNetwork.containerId,
      networkId: report.productionNetwork.networkId,
    },
    command: 'APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute',
    productionChanged: false,
    deployStarted: false,
    postgresWrites: 0,
    secretsPrinted: false,
  }, null, 2));
  if (EXECUTE && report.status !== 'REMOTE_PREFLIGHT_READY') process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'REMOTE_PREFLIGHT_BLOCKED',
    error: String(error?.message || error).slice(0, 500),
    productionChanged: false,
    postgresWrites: 0,
    secretsPrinted: false,
  }, null, 2));
  process.exit(1);
});
