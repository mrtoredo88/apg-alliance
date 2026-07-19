import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'docs/architecture-guard-report.json');
const SCAN_ROOTS = ['src/apg', 'server/src/apg'];
const ALLOWED_SEGMENTS = [
  '/infrastructure/adapters/',
  '/identity/providers/',
  '/data/FirestoreAdminAdapter.js',
  '/schema/identity-v2.sql',
];
const FORBIDDEN = [
  'import { db',
  'import { auth',
  'from "./firebase"',
  "from './firebase'",
  'from "firebase/',
  "from 'firebase/",
  'from "firebase-admin',
  "from 'firebase-admin",
  'auth.currentUser',
  'signInWithCustomToken',
  'verifyIdToken',
  'createCustomToken',
  'collection(',
  '.collection(',
  'doc(',
  'query(',
  'getDoc(',
  'getDocs(',
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
];

function tokenAllowedInLine(token, line) {
  const trimmed = line.trim();
  if (token === 'query(' && (trimmed.startsWith('query(spec)') || line.includes('.query('))) return true;
  if (token === 'collection(' && trimmed.startsWith('collection()')) return true;
  if (token === 'runTransaction(' && trimmed.startsWith('async runTransaction()')) return true;
  if (token === 'createCustomToken' && (trimmed.startsWith('async createCustomToken(') || line.includes('this.tokenProvider.authenticate'))) return true;
  return false;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|jsx|sql)$/.test(entry.name) ? [full] : [];
  });
}

function isAllowed(file) {
  const normalized = file.split(path.sep).join('/');
  return ALLOWED_SEGMENTS.some(segment => normalized.includes(segment));
}

function layerOf(file) {
  const normalized = path.relative(ROOT, file).split(path.sep).join('/');
  if (normalized.includes('/identity/')) return 'Identity Layer';
  if (normalized.includes('/data/')) return 'Repository Layer';
  if (normalized.includes('/domain/')) return 'Domain Layer';
  if (normalized.includes('/infrastructure/')) return 'Infrastructure';
  return normalized.startsWith('server/') ? 'Server Foundation' : 'Client Foundation';
}

const files = SCAN_ROOTS.flatMap(root => walk(path.join(ROOT, root)));
const violations = [];
const layers = {};

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const layer = layerOf(file);
  layers[layer] = layers[layer] || { checked: 0, violations: 0, allowedInfrastructure: 0 };
  layers[layer].checked += 1;
  if (isAllowed(file)) {
    layers[layer].allowedInfrastructure += 1;
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  for (const token of FORBIDDEN) {
    lines.forEach((line, index) => {
      if (line.includes(token) && !tokenAllowedInLine(token, line)) {
        violations.push({ file: relative, layer, token, line: index + 1 });
        layers[layer].violations += 1;
      }
    });
  }
}

const nextReport = {
  ok: violations.length === 0,
  rule: 'foundation_layers_use_identity_repository_and_infrastructure_adapters',
  checkedFiles: files.length,
  layers,
  violations,
  allowed: ALLOWED_SEGMENTS,
};

let previousReport = null;
try {
  previousReport = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
} catch {}

const previousComparable = previousReport ? { ...previousReport, generatedAt: undefined } : null;
const nextComparable = { ...nextReport, generatedAt: undefined };
const report = {
  ...nextReport,
  generatedAt: previousComparable && JSON.stringify(previousComparable) === JSON.stringify(nextComparable)
    ? previousReport.generatedAt
    : new Date().toISOString(),
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
