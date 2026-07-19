import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IDENTITY_DIR = path.join(ROOT, 'server/src/apg/identity');
const FORBIDDEN = [
  'firebase-admin/firestore',
  "collection(",
  ".collection(",
  "doc(",
  "getDoc(",
  "getDocs(",
  "setDoc(",
  "updateDoc(",
];
const ALLOWED = new Set([
  path.join(IDENTITY_DIR, 'providers/FirebaseAdminIdentityProvider.js'),
  path.join(IDENTITY_DIR, 'schema/identity-v2.sql'),
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith('.js') || full.endsWith('.sql') ? [full] : [];
  });
}

const violations = [];
for (const file of walk(IDENTITY_DIR)) {
  if (ALLOWED.has(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  FORBIDDEN.forEach(token => {
    if (source.includes(token)) violations.push({ file: path.relative(ROOT, file), token });
  });
}

if (violations.length) {
  console.error(JSON.stringify({ ok: false, violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: walk(IDENTITY_DIR).length, rule: 'identity_uses_repositories_not_firestore' }, null, 2));
