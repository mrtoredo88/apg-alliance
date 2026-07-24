import { chmodSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = realpathSync(resolve(process.argv[2] || 'server/.env'));
const original = readFileSync(envPath, 'utf8');
const next = original
  .split(/\r?\n/)
  .filter(line => !line.startsWith('FIREBASE_SERVICE_ACCOUNT=') && !line.startsWith('GOOGLE_APPLICATION_CREDENTIALS='))
  .join('\n')
  .replace(/\n*$/, '\n');

if (next === original) {
  console.log(JSON.stringify({ ok: true, removed: false }));
  process.exit(0);
}

const temporaryPath = `${envPath}.firebase-cleanup-${process.pid}`;
writeFileSync(temporaryPath, next, { mode: 0o600 });
chmodSync(temporaryPath, 0o600);
renameSync(temporaryPath, envPath);
console.log(JSON.stringify({
  ok: true,
  removed: true,
  keys: ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS'],
}));
