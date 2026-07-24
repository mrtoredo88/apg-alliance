import { chmodSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const keyFile = resolve(process.argv[2] || '');
const envPath = realpathSync(resolve(process.argv[3] || 'server/.env'));
const target = process.argv[4] || 'storage';
const response = JSON.parse(readFileSync(keyFile, 'utf8'));
const key = response.access_key || response;
const secret = response.secret || key.secret;
if (!key.id || !key.key_id || !secret) throw new Error('Invalid Yandex access-key response.');

let env = readFileSync(envPath, 'utf8');
const names = target === 'postbox'
  ? ['POSTBOX_KEY_ID', 'POSTBOX_SECRET']
  : ['YC_ACCESS_KEY', 'YC_SECRET_KEY'];
for (const [name, value] of [[names[0], key.key_id], [names[1], secret]]) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (!pattern.test(env)) throw new Error(`${name} is missing from env.`);
  env = env.replace(pattern, line);
}

const temporaryPath = `${envPath}.yc-key-${process.pid}`;
writeFileSync(temporaryPath, env, { mode: 0o600 });
chmodSync(temporaryPath, 0o600);
renameSync(temporaryPath, envPath);
console.log(JSON.stringify({ ok: true, resourceId: key.id, target, applied: true }));
