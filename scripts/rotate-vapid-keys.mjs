import { chmodSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import webpush from '../server/node_modules/web-push/src/index.js';

const envPath = realpathSync(resolve(process.argv[2] || 'server/.env'));
const constantsPath = resolve(process.argv[3] || 'src/constants.js');
const keys = webpush.generateVAPIDKeys();

let env = readFileSync(envPath, 'utf8');
for (const [name, value] of [
  ['WEB_PUSH_VAPID_PUBLIC_KEY', keys.publicKey],
  ['WEB_PUSH_VAPID_PRIVATE_KEY', keys.privateKey],
]) {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (!pattern.test(env)) throw new Error(`${name} is missing from env.`);
  env = env.replace(pattern, `${name}=${value}`);
}
const envTemporaryPath = `${envPath}.vapid-${process.pid}`;
writeFileSync(envTemporaryPath, env, { mode: 0o600 });
chmodSync(envTemporaryPath, 0o600);
renameSync(envTemporaryPath, envPath);

const constants = readFileSync(constantsPath, 'utf8');
const publicKeyPattern = /export const WEB_PUSH_VAPID_PUBLIC_KEY = '[^']+';/;
if (!publicKeyPattern.test(constants)) throw new Error('WEB_PUSH_VAPID_PUBLIC_KEY constant is missing.');
writeFileSync(
  constantsPath,
  constants.replace(publicKeyPattern, `export const WEB_PUSH_VAPID_PUBLIC_KEY = '${keys.publicKey}';`),
);

console.log(JSON.stringify({ ok: true, rotated: true, publicKeyUpdated: true, privateKeyPrinted: false }));
