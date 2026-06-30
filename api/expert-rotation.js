// POST /api/expert-rotation
// Vercel cron: every Monday at 00:00 UTC
// Rotates "В топе" ambassador expert per category
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

function getISOWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const db = getFirestore(getAdminApp());
  const weekKey = getISOWeekKey();

  // All active ambassadors
  const snap = await db.collection('experts')
    .where('tier', '==', 'ambassador')
    .where('active', '==', true)
    .get();

  // Group by category, sorted by ambassadorSince (oldest first = stable order)
  const byCategory = {};
  for (const d of snap.docs) {
    const e = { id: d.id, ...d.data() };
    const cat = e.category ?? 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => {
      const ta = a.ambassadorSince?.toDate?.()?.getTime() ?? (a.createdAt?.toDate?.()?.getTime() ?? 0);
      const tb = b.ambassadorSince?.toDate?.()?.getTime() ?? (b.createdAt?.toDate?.()?.getTime() ?? 0);
      return ta - tb;
    });
  }

  const results = [];
  const batch = db.batch();

  for (const [cat, ambassadors] of Object.entries(byCategory)) {
    if (!ambassadors.length) continue;

    const rotRef = db.collection('expertRotation').doc(cat);
    const rotSnap = await rotRef.get();
    const current = rotSnap.exists ? rotSnap.data() : null;

    if (current?.weekKey === weekKey) {
      results.push({ category: cat, skipped: true, expertId: current.expertId });
      continue;
    }

    let nextIndex = 0;
    if (current?.expertId) {
      const prevIdx = ambassadors.findIndex(e => e.id === current.expertId);
      nextIndex = (prevIdx + 1) % ambassadors.length;
    }

    const next = ambassadors[nextIndex];
    batch.set(rotRef, {
      category: cat,
      expertId: next.id,
      expertIndex: nextIndex,
      weekKey,
      updatedAt: FieldValue.serverTimestamp(),
    });

    results.push({ category: cat, expertId: next.id, index: nextIndex, weekKey });
  }

  await batch.commit();
  res.json({ ok: true, weekKey, results });
}
