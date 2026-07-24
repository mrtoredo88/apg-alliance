import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const SOURCE_CONTAINER = 'apg-api';
const TARGET_CONTAINER = 'apg-api-candidate';
const REGISTRY = 'cr.yandex/crpvv13u8vr3qjftdvvg';
const NETWORK_ID = 'enpa19j9jpki1f67p6kq';
const SERVICE_ACCOUNT_ID = 'ajegfv96md2tqri8gjdp';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${String(result.stderr || result.stdout).slice(0, 1000)}`);
  return result.stdout || '';
}
const ycJson = args => JSON.parse(run('yc', [...args, '--format', 'json']));
function envFile(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

const commit = run('git', ['rev-parse', '--short=8', 'HEAD']).trim();
const fullCommit = run('git', ['rev-parse', 'HEAD']).trim();
const image = `${REGISTRY}/apg-api-candidate:${commit}`;
const localEnv = envFile('server/.env');
if (String(localEnv.APG_SESSION_SECRET || '').length < 32) throw new Error('APG_SESSION_SECRET is missing.');

const revisions = ycJson(['serverless', 'container', 'revision', 'list', '--container-name', SOURCE_CONTAINER]);
const source = revisions[0];
if (!source) throw new Error('Active APG API revision not found.');
const environment = { ...(source.image?.environment || {}) };
delete environment.GOOGLE_APPLICATION_CREDENTIALS;
delete environment.FIREBASE_SERVICE_ACCOUNT;
environment.APG_SESSION_SECRET = localEnv.APG_SESSION_SECRET;
environment.APG_DATA_DATABASE_URL = environment.APG_DATA_DATABASE_URL || environment.APG_IDENTITY_DATABASE_URL;
environment.IDENTITY_PROVIDER = 'native-apg';
environment.IDENTITY_STORAGE = 'postgres';
environment.APP_VERSION = commit;
environment.GIT_SHA = fullCommit;
environment.BUILD_TIME = new Date().toISOString();

console.log(JSON.stringify({
  phase: 'candidate-build',
  sourceRevision: source.id,
  targetContainer: TARGET_CONTAINER,
  image,
  firebaseCredentialsIncluded: false,
  environmentNames: Object.keys(environment).sort(),
  valuesPrinted: false,
}, null, 2));

run('docker', [
  'buildx', 'build', '--platform', 'linux/amd64',
  '-f', 'server/Dockerfile',
  '-t', image,
  '--build-arg', `APP_VERSION=${commit}`,
  '--build-arg', `GIT_SHA=${fullCommit}`,
  '--build-arg', `BUILD_TIME=${environment.BUILD_TIME}`,
  '--push', '.',
], { stdio: 'inherit' });

const containers = ycJson(['serverless', 'container', 'list']);
if (!containers.some(item => item.name === TARGET_CONTAINER)) {
  run('yc', ['serverless', 'container', 'create', '--name', TARGET_CONTAINER]);
}
const envArgs = Object.entries(environment).flatMap(([key, value]) => ['--environment', `${key}=${value}`]);
run('yc', [
  'serverless', 'container', 'revision', 'deploy',
  '--container-name', TARGET_CONTAINER,
  '--image', image,
  '--cores', '1', '--memory', '512MB', '--execution-timeout', '30s',
  '--concurrency', '8', '--min-instances', '0',
  '--network-id', NETWORK_ID,
  '--service-account-id', SERVICE_ACCOUNT_ID,
  ...envArgs,
]);
const target = ycJson(['serverless', 'container', 'get', TARGET_CONTAINER]);
const targetRevisions = ycJson(['serverless', 'container', 'revision', 'list', '--container-name', TARGET_CONTAINER]);
console.log(JSON.stringify({
  phase: 'candidate-ready',
  containerId: target.id,
  url: target.url,
  revisionId: targetRevisions[0]?.id || '',
  image,
  valuesPrinted: false,
}, null, 2));
