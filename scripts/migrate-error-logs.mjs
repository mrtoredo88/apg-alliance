import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildErrorFingerprint } from '../server-shared/error-log.js';

const apply = process.argv.includes('--apply');
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snapshot = await db.collection('errorLogs').get();
const groups = new Map();

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  const result = new Date(value || 0).getTime();
  return Number.isFinite(result) ? result : 0;
}

for (const document of snapshot.docs) {
  const row = document.data() || {};
  const { fingerprint, stackHash } = buildErrorFingerprint(row);
  const current = groups.get(fingerprint) || { rows: [], occurrences: 0, firstSeen: null, lastSeen: null, stackHash };
  const firstSeen = row.firstSeen || row.createdAt || row.timestamp || null;
  const lastSeen = row.lastSeen || row.timestamp || row.updatedAt || firstSeen;
  current.rows.push({ id: document.id, ...row });
  current.occurrences += Math.max(1, Number(row.occurrences || 1));
  if (!current.firstSeen || millis(firstSeen) < millis(current.firstSeen)) current.firstSeen = firstSeen;
  if (!current.lastSeen || millis(lastSeen) > millis(current.lastSeen)) current.lastSeen = lastSeen;
  groups.set(fingerprint, current);
}

const summary = {
  documents: snapshot.size,
  unique: groups.size,
  duplicates: snapshot.size - groups.size,
  apply,
};
console.log(JSON.stringify(summary));
if (!apply) process.exit(0);

let batch = db.batch();
let operations = 0;
async function commitIfNeeded(force = false) {
  if (!operations || (!force && operations < 400)) return;
  await batch.commit();
  batch = db.batch();
  operations = 0;
}

for (const [fingerprint, group] of groups) {
  const latest = group.rows.slice().sort((a, b) => millis(b.lastSeen || b.timestamp) - millis(a.lastSeen || a.timestamp))[0];
  const histories = group.rows.flatMap(row => Array.isArray(row.occurrenceHistory) ? row.occurrenceHistory : [{
    at: (row.timestamp?.toDate ? row.timestamp.toDate() : new Date(row.timestamp || row.createdAt || Date.now())).toISOString(),
    userId: row.userId || null,
    version: row.version || row.build || null,
    route: row.route || row.page || row.url || null,
    component: row.component || row.source || null,
    device: row.device || null,
    browser: row.browser || null,
    os: row.os || null,
  }]).slice(-50);
  const target = db.collection('errorLogs').doc(`err_${fingerprint}`);
  batch.set(target, {
    ...latest,
    fingerprint,
    stackHash: group.stackHash,
    occurrences: group.occurrences,
    occurrenceHistory: histories,
    firstSeen: group.firstSeen instanceof Timestamp ? group.firstSeen : group.firstSeen || FieldValue.serverTimestamp(),
    lastSeen: group.lastSeen instanceof Timestamp ? group.lastSeen : group.lastSeen || FieldValue.serverTimestamp(),
    timestamp: group.lastSeen instanceof Timestamp ? group.lastSeen : group.lastSeen || FieldValue.serverTimestamp(),
    migratedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  operations += 1;
  for (const row of group.rows) {
    if (row.id === target.id) continue;
    batch.delete(db.collection('errorLogs').doc(row.id));
    operations += 1;
    await commitIfNeeded();
  }
  await commitIfNeeded();
}
await commitIfNeeded(true);
console.log(JSON.stringify({ ok: true, ...summary }));
