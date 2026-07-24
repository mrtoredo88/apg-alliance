import { randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.argv[2] || 'server/.env');
const keys = [
  'APG_SESSION_SECRET',
  'PUSH_SECRET',
  'CRON_SECRET',
  'RAFFLE_SECRET',
  'ACTIVITY_SECRET',
];

const original = readFileSync(envPath, 'utf8');
let next = original;

for (const key of keys) {
  const value = randomBytes(48).toString('base64url');
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  next = pattern.test(next)
    ? next.replace(pattern, line)
    : `${next.replace(/\s*$/, '\n')}${line}\n`;
}

const temporaryPath = `${envPath}.rotate-${process.pid}`;
writeFileSync(temporaryPath, next, { mode: 0o600 });
chmodSync(temporaryPath, 0o600);
renameSync(temporaryPath, envPath);

const mode = statSync(envPath).mode & 0o777;
if (mode !== 0o600) throw new Error(`Unexpected env mode: ${mode.toString(8)}`);

console.log(JSON.stringify({ ok: true, rotated: keys }));
