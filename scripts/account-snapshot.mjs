import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';
import { getDb } from '../server/src/lib/firebase.js';

loadMigrationEnv();

const REMOTE_PREFLIGHT_REPORT = 'backups/account-core/remote-preflight/remote-preflight-report-redacted.json';
const OUT_DIR = 'backups/account-core/snapshot';
const RAW_DIR = path.join(OUT_DIR, 'raw');

const COLLECTIONS = [
  'users',
  'tgLinks',
  'telegramAuthSessions',
  'partners',
  'experts',
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function serialize(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function readCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: serialize(doc.data() || {}) }));
}

async function readCollectionGroup(db, name) {
  const snap = await db.collectionGroup(name).get();
  return snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: serialize(doc.data() || {}) }));
}

function redactedCollectionSummary(snapshot) {
  return Object.fromEntries(Object.entries(snapshot.collections).map(([name, docs]) => [name, docs.length]));
}

function writeRedactedReports({ snapshot, rawPath, hash }) {
  const summary = {
    status: 'SNAPSHOT_CREATED',
    immutable: true,
    generatedAt: snapshot.generatedAt,
    source: 'production-firestore-read-only',
    scope: 'account-core',
    rawSnapshotPath: rawPath,
    sha256: hash,
    accountCount: snapshot.collections.users.length,
    collectionCounts: redactedCollectionSummary(snapshot),
    collectionGroupCounts: Object.fromEntries(Object.entries(snapshot.collectionGroups).map(([name, docs]) => [name, docs.length])),
    productionChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
  };
  const manifestPath = path.join(OUT_DIR, `account-core-snapshot-${snapshot.id}-manifest-redacted.json`);
  const summaryPath = path.join(OUT_DIR, `account-core-snapshot-${snapshot.id}-summary.md`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(summaryPath, [
    '# Account Core Snapshot',
    '',
    `Status: ${summary.status}`,
    `Generated: ${summary.generatedAt}`,
    `SHA256: ${summary.sha256}`,
    `Account count: ${summary.accountCount}`,
    '',
    '## Counts',
    '',
    ...Object.entries(summary.collectionCounts).map(([name, count]) => `- ${name}: ${count}`),
    ...Object.entries(summary.collectionGroupCounts).map(([name, count]) => `- collectionGroup:${name}: ${count}`),
    '',
    '## Guardrails',
    '',
    '- Firestore writes: 0',
    '- PostgreSQL writes: 0',
    '- Import: NOT RUN',
    '- Verify: NOT RUN',
    '- Canary: NOT RUN',
    '- Cutover: NOT RUN',
    '',
  ].join('\n'));
  return { summary, manifestPath, summaryPath };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const preflight = readJson(REMOTE_PREFLIGHT_REPORT);
  if (preflight?.status !== 'REMOTE_PREFLIGHT_PASSED') {
    const report = {
      status: 'SNAPSHOT_BLOCKED',
      reason: 'REMOTE_PREFLIGHT_NOT_PASSED',
      remotePreflightStatus: preflight?.status || 'MISSING',
      productionChanged: false,
      firestoreChanged: false,
      importStarted: false,
      verifyStarted: false,
      canaryStarted: false,
      cutoverStarted: false,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'snapshot-blocked-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const db = getDb();
  const id = safeTimestamp();
  const collections = {};
  for (const name of COLLECTIONS) collections[name] = await readCollection(db, name);
  const collectionGroups = {
    bookings: await readCollectionGroup(db, 'bookings'),
  };
  const snapshot = {
    version: 1,
    id,
    generatedAt: new Date().toISOString(),
    scope: 'account-core',
    collections,
    collectionGroups,
    productionChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
  };
  const raw = `${JSON.stringify(snapshot, null, 2)}\n`;
  const hash = sha256(raw);
  const rawPath = path.join(RAW_DIR, `account-core-snapshot-${id}.json`);
  fs.writeFileSync(rawPath, raw, { mode: 0o600 });
  fs.writeFileSync(path.join(OUT_DIR, `account-core-snapshot-${id}.sha256`), `${hash}  ${rawPath}\n`);
  const { summary, manifestPath, summaryPath } = writeRedactedReports({ snapshot, rawPath, hash });
  fs.writeFileSync(path.join(OUT_DIR, 'latest-snapshot-redacted.json'), `${JSON.stringify({ ...summary, manifestPath, summaryPath }, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, manifestPath, summaryPath }, null, 2));
}

main().catch(error => {
  const report = {
    status: 'SNAPSHOT_FAILED',
    error: String(error?.message || error).slice(0, 500),
    productionChanged: false,
    firestoreWrites: 0,
    postgresWrites: 0,
    importStarted: false,
    verifyStarted: false,
    canaryStarted: false,
    cutoverStarted: false,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'snapshot-failed-redacted.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
});
