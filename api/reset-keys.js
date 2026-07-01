// Временный endpoint — удалить после использования
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-secret'] !== process.env.RAFFLE_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const db = getFirestore(getAdminApp());
  const snap = await db.collection('users').get();

  const BATCH_SIZE = 500;
  let count = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.update(d.ref, { keys: 0 }));
    await batch.commit();
    count += snap.docs.slice(i, i + BATCH_SIZE).length;
  }

  res.json({ ok: true, updated: count });
}
