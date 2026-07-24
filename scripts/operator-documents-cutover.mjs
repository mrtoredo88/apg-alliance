import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const snapshotPath = process.argv[2];
const invokeEnvPath = 'backups/account-core/remote-preflight/operator-invoke.env';
if (!snapshotPath || !fs.existsSync(snapshotPath)) throw new Error('Snapshot file is required.');
if (!fs.existsSync(invokeEnvPath)) throw new Error('Migration operator credentials are missing.');

function parseEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function command(name, args) {
  const result = spawnSync(name, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${name} failed.`);
  return result.stdout.trim();
}

const env = parseEnv(invokeEnvPath);
if (!env.OPERATOR_URL || !env.APG_OPERATOR_TOKEN) throw new Error('Migration operator credentials are incomplete.');
const iamToken = command('yc', ['iam', 'create-token']);
const encodedSnapshot = gzipSync(fs.readFileSync(snapshotPath), { level: 9 }).toString('base64');

async function invoke(path, payload) {
  const response = await fetch(new URL(path, env.OPERATOR_URL), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${iamToken}`,
      'content-type': 'application/json',
      'x-operator-token': env.APG_OPERATOR_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    throw Object.assign(new Error(`${path} failed: ${body.status || response.status}`), { result: body });
  }
  return {
    ok: body.ok,
    exitCode: body.exitCode,
    status: body.status,
    productionChanged: body.productionChanged,
    stdoutTail: body.stdoutTail,
    stderrTail: body.stderrTail,
  };
}

const payload = { documentSnapshotGzipBase64: encodedSnapshot };
const imported = await invoke('/documents/import', payload);
console.log(JSON.stringify({ phase: 'import', ...imported }, null, 2));
const verified = await invoke('/documents/verify', payload);
console.log(JSON.stringify({ phase: 'verify', ...verified }, null, 2));
