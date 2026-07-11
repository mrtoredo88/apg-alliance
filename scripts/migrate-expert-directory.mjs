import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { normalizeExpertRecord } from '../server-shared/expert-directory.js';

const apply = process.argv.includes('--apply');
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snapshot = await db.collection('experts').get();
const changes = [];

for (const document of snapshot.docs) {
  const source = document.data() || {};
  const normalized = normalizeExpertRecord(source);
  const patch = {};
  if (normalized.phone && normalized.phone !== source.phone) patch.phone = normalized.phone;
  if (normalized.category !== source.category) patch.category = normalized.category;
  if (JSON.stringify(normalized.categories) !== JSON.stringify(source.categories || [])) patch.categories = normalized.categories;
  if (JSON.stringify(normalized.secondaryCategories) !== JSON.stringify(source.secondaryCategories || [])) patch.secondaryCategories = normalized.secondaryCategories;
  if (normalized.offer && normalized.offer !== source.offer) patch.offer = normalized.offer;
  if (Object.keys(patch).length) changes.push({ id: document.id, name: source.name || '', patch });
}

console.log(JSON.stringify({ documents: snapshot.size, changes: changes.length, apply, rows: changes }, null, 2));
if (apply && changes.length) {
  const batch = db.batch();
  changes.forEach(change => batch.set(db.collection('experts').doc(change.id), { ...change.patch, directoryNormalizedAt: FieldValue.serverTimestamp() }, { merge: true }));
  await batch.commit();
  console.log(JSON.stringify({ ok: true, updated: changes.length }));
}
