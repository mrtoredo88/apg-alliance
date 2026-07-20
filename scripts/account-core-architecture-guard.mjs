import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ACCOUNT_DIR = path.join(ROOT, 'server/src/apg/account');
const ALLOWED = [
  '/server/src/apg/account/adapters/',
  '/server/src/apg/account/schema/',
];
const FORBIDDEN = [
  'firebase-admin/firestore',
  'firebase-admin/auth',
  "from 'firebase/",
  'from "firebase/',
  "from 'firebase-admin",
  'from "firebase-admin',
  'collection(',
  '.collection(',
  'doc(',
  'getDoc(',
  'getDocs(',
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|sql)$/.test(entry.name) ? [full] : [];
  });
}

function allowed(file) {
  const normalized = `/${path.relative(ROOT, file).split(path.sep).join('/')}`;
  return ALLOWED.some(segment => normalized.includes(segment));
}

const violations = [];
for (const file of walk(ACCOUNT_DIR)) {
  if (allowed(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  FORBIDDEN.forEach(token => {
    if (source.includes(token)) violations.push({ file: path.relative(ROOT, file), token });
  });
}

if (violations.length) {
  console.error(JSON.stringify({ ok: false, rule: 'account_core_uses_repositories_not_firestore', violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  rule: 'account_core_uses_repositories_not_firestore',
  checked: walk(ACCOUNT_DIR).length,
}, null, 2));
