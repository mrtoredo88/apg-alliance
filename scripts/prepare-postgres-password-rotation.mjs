import { randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = realpathSync(resolve(process.argv[2] || 'server/.env'));
const secretPath = resolve(process.argv[3] || '');
if (!secretPath) throw new Error('Protected temporary secret path is required.');

const password = randomBytes(36).toString('base64url');
let env = readFileSync(envPath, 'utf8');
let updated = 0;
for (const key of ['APG_IDENTITY_DATABASE_URL', 'APG_DATA_DATABASE_URL']) {
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = env.match(pattern);
  if (!match?.[1]) continue;
  const url = new URL(match[1]);
  url.password = password;
  env = env.replace(pattern, `${key}=${url.toString()}`);
  updated += 1;
}
if (!updated) throw new Error('No PostgreSQL URLs were updated.');

const envTemporaryPath = `${envPath}.postgres-password-${process.pid}`;
writeFileSync(envTemporaryPath, env, { mode: 0o600 });
chmodSync(envTemporaryPath, 0o600);
renameSync(envTemporaryPath, envPath);
writeFileSync(secretPath, `${password}\n`, { mode: 0o600 });
chmodSync(secretPath, 0o600);

console.log(JSON.stringify({ ok: true, urlsUpdated: updated, passwordPrinted: false }));
