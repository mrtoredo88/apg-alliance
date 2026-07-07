import { getAdminDb } from './_firebase-admin.js';
import { adminError, requireAdminPermission } from './_admin-security.js';

async function countSafe(db, collectionName, limit = 1000) {
  try {
    const snap = await db.collection(collectionName).limit(limit).get();
    return { ok: true, count: snap.size, capped: snap.size >= limit };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,X-Firebase-Auth,X-APG-Auth,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const db = getAdminDb();
  try {
    const actor = await requireAdminPermission(req, 'system:read');
    const startedAt = Date.now();
    const pingRef = db.collection('config').doc('systemStatus');
    const ping = await pingRef.get();
    const [news, comments, users, errors, adminActivity, vkSync, backups] = await Promise.all([
      countSafe(db, 'news'),
      countSafe(db, 'newsComments'),
      countSafe(db, 'users'),
      countSafe(db, 'errorLogs', 300),
      countSafe(db, 'adminActivity', 300),
      db.collection('config').doc('vkNewsSync').get().catch(error => ({ error })),
      db.collection('backups').orderBy('createdAt', 'desc').limit(1).get().catch(error => ({ error, docs: [] })),
    ]);

    const lastBackup = backups?.docs?.[0]?.data?.() || null;
    const vkData = vkSync?.exists ? vkSync.data() : null;
    return res.status(200).json({
      ok: true,
      actor: { id: actor.userId, role: actor.role, authSource: actor.authSource },
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      api: { ok: true, runtime: 'vercel', version: process.env.VERCEL_GIT_COMMIT_SHA || '' },
      firestore: { ok: Boolean(ping || pingRef), collections: { news, comments, users, errors, adminActivity } },
      queues: { ok: true, pending: 0, note: 'Очередь задач пока не вынесена в отдельный сервис.' },
      vkNews: {
        ok: Boolean(vkData),
        lastSyncAt: vkData?.updatedAt?.toDate ? vkData.updatedAt.toDate().toISOString() : vkData?.updatedAt || null,
        source: vkData?.source || 'unknown',
        count: vkData?.count || 0,
      },
      backups: {
        configured: Boolean(lastBackup),
        lastBackupAt: lastBackup?.createdAt?.toDate ? lastBackup.createdAt.toDate().toISOString() : null,
        scope: lastBackup?.scope || null,
        note: lastBackup ? 'Найден последний backup marker.' : 'Backup marker пока не найден; механизм восстановления подготовлен архитектурно.',
      },
    });
  } catch (error) {
    return adminError(res, error);
  }
}
