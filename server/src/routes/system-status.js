import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission } from '../lib/adminSecurity.js';

async function countSafe(db, collectionName, limit = 1000) {
  try {
    const snap = await db.collection(collectionName).limit(limit).get();
    return { ok: true, count: snap.size, capped: snap.size >= limit };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}

export default async function systemStatusRoutes(fastify) {
  fastify.get('/api/system-status', async (request, reply) => {
    const db = getDb();
    try {
      const actor = await requireAdminPermission(request, 'system:read');
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
      return {
        ok: true,
        actor: { id: actor.userId, role: actor.role, authSource: actor.authSource },
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        api: { ok: true, runtime: 'yandex-fastify', version: process.env.APP_VERSION || '' },
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
      };
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
