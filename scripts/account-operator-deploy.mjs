import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CONTAINER_NAME = 'apg-migration-operator';
const SOURCE_CONTAINER_NAME = 'apg-api';
const REGISTRY_ID = 'crpvv13u8vr3qjftdvvg';
const IMAGE = `cr.yandex/${REGISTRY_ID}/${CONTAINER_NAME}:${process.env.SOURCE_COMMIT || 'local'}`;
const NETWORK_ID = 'enpa19j9jpki1f67p6kq';
const SERVICE_ACCOUNT_ID = 'ajegfv96md2tqri8gjdp';
const INVOKE_ENV_PATH = 'backups/account-core/remote-preflight/operator-invoke.env';
const REQUIRED_PLATFORM = { os: 'linux', architecture: 'amd64' };
const REQUIRED_ENV = [
  'APG_IDENTITY_DATABASE_URL',
];

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${String(result.stderr || result.stdout).slice(0, 800)}`);
  }
  return result.stdout;
}

function runQuiet(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${redact(String(result.stderr || result.stdout).slice(0, 1200))}`);
  }
  return result.stdout;
}

function ycJson(args) {
  return JSON.parse(run('yc', [...args, '--format', 'json']));
}

function redact(value) {
  return String(value || '')
    .replace(/postgres:\/\/[^@\s]+@[^\s]+/gi, 'postgres://REDACTED')
    .replace(/(APG_OPERATOR_TOKEN=)[^\s"]+/g, '$1REDACTED')
    .replace(/("[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASS|DATABASE_URL)"\s*:\s*")[^"]*(")/g, '$1REDACTED$2');
}

function containerExists(name) {
  const containers = ycJson(['serverless', 'container', 'list']);
  return containers.some(container => container.name === name);
}

function latestRevisionEnv() {
  const revisions = ycJson(['serverless', 'container', 'revision', 'list', '--container-name', SOURCE_CONTAINER_NAME]);
  const latest = revisions[0];
  if (!latest) throw new Error('SOURCE_REVISION_NOT_FOUND');
  const env = latest.image?.environment || {};
  const selected = {};
  for (const key of REQUIRED_ENV) {
    if (env[key]) selected[key] = env[key];
  }
  return { latest, selected };
}

function printRedacted(label, value) {
  console.log(JSON.stringify({ [label]: value }, null, 2));
}

function writeInvokeEnv({ url, token }) {
  fs.mkdirSync('backups/account-core/remote-preflight', { recursive: true });
  fs.writeFileSync(INVOKE_ENV_PATH, [
    `OPERATOR_URL=${url}`,
    `APG_OPERATOR_TOKEN=${token}`,
    '',
  ].join('\n'), { mode: 0o600 });
}

function imageManifest(image) {
  return JSON.parse(run('docker', ['manifest', 'inspect', image]));
}

function assertAmd64Image(image) {
  const manifest = imageManifest(image);
  const platforms = (manifest.manifests || []).map(item => item.platform || {});
  const ok = platforms.some(platform => platform.os === REQUIRED_PLATFORM.os && platform.architecture === REQUIRED_PLATFORM.architecture);
  if (!ok) {
    printRedacted('operatorImage', {
      ok: false,
      image,
      required: REQUIRED_PLATFORM,
      platforms,
      valuesPrinted: false,
    });
    throw new Error('OPERATOR_IMAGE_NOT_LINUX_AMD64');
  }
  printRedacted('operatorImage', {
    ok: true,
    image,
    required: REQUIRED_PLATFORM,
    platforms,
    valuesPrinted: false,
  });
  return manifest;
}

function main() {
  const sourceCommit = run('git', ['rev-parse', '--short', 'HEAD']).trim();
  const image = IMAGE.replace(':local', `:${sourceCommit}`);
  const token = crypto.randomBytes(32).toString('hex');
  const { latest, selected } = latestRevisionEnv();
  const missing = REQUIRED_ENV.filter(key => !selected[key]);
  if (missing.length) {
    printRedacted('operatorDeploy', { ok: false, error: 'MISSING_REQUIRED_ENV', missing });
    process.exit(1);
  }

  printRedacted('operatorDeploy', {
    ok: true,
    sourceContainer: SOURCE_CONTAINER_NAME,
    sourceRevision: latest.id,
    sourceCommit,
    targetContainer: CONTAINER_NAME,
    image,
    networkId: NETWORK_ID,
    serviceAccountId: SERVICE_ACCOUNT_ID,
    envNames: [...REQUIRED_ENV, 'APG_REMOTE_OPERATOR_RUNTIME', 'APG_REMOTE_PREFLIGHT_EXECUTION', 'APG_OPERATOR_TOKEN'].sort(),
    valuesPrinted: false,
  });

  run('docker', [
    'buildx',
    'build',
    '--platform',
    'linux/amd64',
    '-f',
    'ops/migration-operator/Dockerfile',
    '-t',
    image,
    '--push',
    '.',
  ], { stdio: 'inherit' });
  assertAmd64Image(image);

  if (!containerExists(CONTAINER_NAME)) {
    runQuiet('yc', ['serverless', 'container', 'create', '--name', CONTAINER_NAME]);
  }

  const envArgs = [
    ...Object.entries(selected).flatMap(([key, value]) => ['--environment', `${key}=${value}`]),
    '--environment', 'APG_REMOTE_OPERATOR_RUNTIME=production-vpc',
    '--environment', 'APG_REMOTE_PREFLIGHT_EXECUTION=1',
    '--environment', `APG_OPERATOR_TOKEN=${token}`,
  ];

  runQuiet('yc', [
    'serverless', 'container', 'revision', 'deploy',
    '--container-name', CONTAINER_NAME,
    '--image', image,
    '--cores', '1',
    '--memory', '512MB',
    '--execution-timeout', '600s',
    '--concurrency', '1',
    '--min-instances', '0',
    '--network-id', NETWORK_ID,
    '--service-account-id', SERVICE_ACCOUNT_ID,
    ...envArgs,
  ]);

  const target = ycJson(['serverless', 'container', 'get', CONTAINER_NAME]);
  const revisions = ycJson(['serverless', 'container', 'revision', 'list', '--container-name', CONTAINER_NAME]);
  writeInvokeEnv({ url: target.url, token });
  printRedacted('operatorReady', {
    containerId: target.id,
    containerName: target.name,
    url: target.url,
    revisionId: revisions[0]?.id || '',
    image,
    invokeEnvPath: INVOKE_ENV_PATH,
    valuesPrinted: false,
  });
}

main();
