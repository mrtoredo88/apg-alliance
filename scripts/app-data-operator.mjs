import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const execute = process.argv.includes('--execute');
const ENV_PATH = 'backups/account-core/remote-preflight/operator-invoke.env';

function parseEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    return match ? [match[1], match[2]] : null;
  }).filter(Boolean));
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout).slice(0, 1200));
  return result.stdout.trim();
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) throw new Error('OPERATOR_ENV_NOT_FOUND');
  const env = parseEnv(ENV_PATH);
  if (!env.OPERATOR_URL || !env.APG_OPERATOR_TOKEN) throw new Error('OPERATOR_ENV_INCOMPLETE');
  const iamToken = run('yc', ['iam', 'create-token']);
  const path = execute ? '/app-data-migrate' : '/app-data-inventory';
  const response = await fetch(`${env.OPERATOR_URL.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${iamToken}`,
      'content-type': 'application/json',
      'x-operator-token': env.APG_OPERATOR_TOKEN,
    },
    body: JSON.stringify(execute ? { confirm: 'MIGRATE_APP_DATA_TO_POSTGRES' } : {}),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: 'INVALID_OPERATOR_RESPONSE' }));
  console.log(JSON.stringify({
    ok: response.ok && payload.ok,
    mode: execute ? 'execute-and-verify' : 'read-only-inventory',
    status: payload.status || '',
    productionChanged: Boolean(payload.productionChanged),
    stdoutTail: payload.stdoutTail || '',
    stderrTail: payload.stderrTail || '',
  }, null, 2));
  if (!response.ok || !payload.ok) process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error).slice(0, 1200) }, null, 2));
  process.exit(1);
});
