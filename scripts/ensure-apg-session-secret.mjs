import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

const envPath = process.argv[2] || 'server/.env';
const source = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const current = source.split(/\r?\n/).find(line => line.startsWith('APG_SESSION_SECRET='))?.slice('APG_SESSION_SECRET='.length) || '';
if (current.length >= 32) {
  console.log(JSON.stringify({ ok: true, created: false, envPath, length: current.length }));
  process.exit(0);
}
const secret = randomBytes(48).toString('base64url');
const filtered = source.split(/\r?\n/).filter(line => !line.startsWith('APG_SESSION_SECRET=')).join('\n').replace(/\n*$/, '\n');
fs.writeFileSync(envPath, `${filtered}APG_SESSION_SECRET=${secret}\n`, { mode: 0o600 });
fs.chmodSync(envPath, 0o600);
console.log(JSON.stringify({ ok: true, created: true, envPath, length: secret.length }));
