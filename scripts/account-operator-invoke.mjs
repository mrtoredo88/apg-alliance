import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CONTAINER_NAME = 'apg-migration-operator';
const INVOKE_ENV_PATH = 'backups/account-core/remote-preflight/operator-invoke.env';
const REPORT_PATH = 'backups/account-core/remote-preflight/remote-preflight-report-redacted.json';
const SUMMARY_PATH = 'backups/account-core/remote-preflight/remote-preflight-summary.md';

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${String(result.stderr || result.stdout).slice(0, 1000)}`);
  }
  return result.stdout.trim();
}

function ycJson(args) {
  return JSON.parse(run('yc', [...args, '--format', 'json']));
}

function parseEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function ensureDir(filePath) {
  fs.mkdirSync(filePath.split('/').slice(0, -1).join('/'), { recursive: true });
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

function redactedRuntime() {
  const container = ycJson(['serverless', 'container', 'get', CONTAINER_NAME]);
  const revisions = ycJson(['serverless', 'container', 'revision', 'list', '--container-name', CONTAINER_NAME]);
  const latest = revisions[0] || {};
  return {
    containerId: container.id,
    containerName: container.name,
    revisionId: latest.id || '',
    imageDigest: latest.image?.image_digest || '',
    imageUrl: latest.image?.image_url || '',
    vpc: latest.connectivity?.network_id || '',
    serviceAccount: latest.service_account_id || '',
    executionTimestamp: new Date().toISOString(),
    sourceCommit: run('git', ['rev-parse', '--short', 'HEAD']),
  };
}

function summaryMarkdown({ runtime, response }) {
  const report = response.report || {};
  const validation = report.validation || {};
  const checks = validation.checks || [];
  const statusFor = name => checks.find(check => check.name === name)?.status || 'UNKNOWN';
  return [
    '# Account Core Remote Preflight',
    '',
    `Generated: ${runtime.executionTimestamp}`,
    `Status: ${response.status || report.status || 'REMOTE_PREFLIGHT_BLOCKED'}`,
    '',
    '## Runtime',
    '',
    `- Operator container: ${runtime.containerName}`,
    `- Operator container ID: ${runtime.containerId}`,
    `- Operator revision ID: ${runtime.revisionId}`,
    `- Image digest: ${runtime.imageDigest}`,
    `- VPC: ${runtime.vpc}`,
    `- Service account: ${runtime.serviceAccount}`,
    `- Source commit: ${runtime.sourceCommit}`,
    '',
    '## Checks',
    '',
    `- DNS: ${statusFor('dns')}`,
    `- TCP: ${statusFor('tcp')}`,
    `- Yandex CA: ${statusFor('yandex_ca_certificate')}`,
    `- Verified TLS: ${statusFor('postgres_auth')}`,
    `- PostgreSQL auth: ${statusFor('postgres_auth')}`,
    `- PostgreSQL SELECT 1: ${statusFor('postgres_auth')}`,
    `- Firebase Admin init: ${statusFor('firebase_admin_initialization')}`,
    '',
    '## Counters',
    '',
    `- Production data reads: ${validation.productionDataReads ?? report.productionDataReads ?? 0}`,
    `- Firestore reads: ${validation.firestoreReads ?? report.firestoreReads ?? 0}`,
    `- PostgreSQL business-table reads: ${validation.postgresBusinessTableReads ?? report.postgresBusinessTableReads ?? 0}`,
    `- PostgreSQL writes: ${validation.postgresWrites ?? report.postgresWrites ?? 0}`,
    `- Firestore writes: ${validation.firestoreWrites ?? report.firestoreWrites ?? 0}`,
    '',
    '## Guardrails',
    '',
    `- Snapshot started: ${Boolean(report.snapshotStarted || response.snapshotStarted)}`,
    `- Import started: ${Boolean(report.importStarted || response.importStarted)}`,
    `- Verify started: ${Boolean(report.verifyStarted || response.verifyStarted)}`,
    `- Canary started: ${Boolean(report.canaryStarted || response.canaryStarted)}`,
    `- Cutover started: ${Boolean(report.cutoverStarted || response.cutoverStarted)}`,
    `- Rollback started: ${Boolean(report.rollbackStarted || response.rollbackStarted)}`,
    '',
  ].join('\n');
}

async function main() {
  if (!fs.existsSync(INVOKE_ENV_PATH)) {
    throw new Error(`Missing ${INVOKE_ENV_PATH}. Run npm run account:operator:deploy first.`);
  }
  const env = parseEnvFile(INVOKE_ENV_PATH);
  if (!env.OPERATOR_URL || !env.APG_OPERATOR_TOKEN) {
    throw new Error('OPERATOR_INVOKE_ENV_INCOMPLETE');
  }
  const iamToken = run('yc', ['iam', 'create-token']);
  const response = await fetch(joinUrl(env.OPERATOR_URL, '/run'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${iamToken}`,
      'x-operator-token': env.APG_OPERATOR_TOKEN,
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { ok: false, status: 'REMOTE_PREFLIGHT_BLOCKED', error: 'INVALID_JSON_RESPONSE' };
  }
  const runtime = redactedRuntime();
  const output = {
    version: 1,
    runtime,
    httpStatus: response.status,
    ok: response.ok && payload.ok === true,
    status: payload.status || payload.report?.status || 'REMOTE_PREFLIGHT_BLOCKED',
    response: payload,
    productionChanged: false,
  };
  ensureDir(REPORT_PATH);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(SUMMARY_PATH, summaryMarkdown({ runtime, response: payload }));
  console.log(JSON.stringify({
    status: output.status,
    ok: output.ok,
    report: REPORT_PATH,
    summary: SUMMARY_PATH,
    operatorContainerId: runtime.containerId,
    operatorRevisionId: runtime.revisionId,
    vpc: runtime.vpc,
    serviceAccount: runtime.serviceAccount,
    productionChanged: false,
    valuesPrinted: false,
  }, null, 2));
  if (!output.ok) process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'REMOTE_PREFLIGHT_BLOCKED',
    error: String(error?.message || error).slice(0, 1000),
    productionChanged: false,
    valuesPrinted: false,
  }, null, 2));
  process.exit(1);
});
