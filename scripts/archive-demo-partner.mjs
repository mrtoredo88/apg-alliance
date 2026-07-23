import { readFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const partnerRef = db.collection('partners').doc('demo-partner-apg');
const partnerSnap = await partnerRef.get();
if (!partnerSnap.exists) throw new Error('Демо-партнёр АПГ не найден');

const partner = partnerSnap.data() || {};
const ownerUserIds = Array.isArray(partner.ownerUserIds) ? partner.ownerUserIds.filter(Boolean) : [];
if (!ownerUserIds.length) throw new Error('У демо-партнёра нет владельцев — архивация остановлена');

const batch = db.batch();
batch.set(partnerRef, {
  active: false,
  featured: false,
  catalogPublished: false,
  status: 'archived',
  lifecycleStatus: 'archived',
  contentStatus: 'archived',
  lifecycleStatusLabel: 'Архив',
  connectionStatus: 'archived',
  connectionStatusLabel: 'Доступен владельцам',
  archived: true,
  privateDemoAccess: true,
  demoVisibility: 'owners',
  archivedAt: FieldValue.serverTimestamp(),
  archivedBy: 'system:demo-archive',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

for (const [collectionName, documentId] of [
  ['news', 'demo-partner-apg-news'],
  ['events', 'demo-partner-apg-event'],
]) {
  batch.set(db.collection(collectionName).doc(documentId), {
    active: false,
    status: 'archived',
    lifecycleStatus: 'archived',
    contentStatus: 'archived',
    archived: true,
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: 'system:demo-archive',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

await batch.commit();
console.log(JSON.stringify({
  ok: true,
  partnerId: partnerRef.id,
  ownerAccessPreserved: true,
  ownerUserIds,
  publicContentArchived: ['partner', 'news', 'event'],
}, null, 2));
