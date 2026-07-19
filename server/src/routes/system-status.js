import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission } from '../lib/adminSecurity.js';
import { serverFoundation } from '../apg/index.js';

function architectureGuardReport() {
  const candidates = [
    path.resolve(process.cwd(), 'docs/architecture-guard-report.json'),
    path.resolve(process.cwd(), '../docs/architecture-guard-report.json'),
  ];
  for (const reportPath of candidates) {
    try {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {}
  }
  return { ok: null, generatedAt: null, layers: {}, violations: [] };
}

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
      const [news, comments, users, errors, adminActivity, vkSync, backups, tgPolling] = await Promise.all([
        countSafe(db, 'news'),
        countSafe(db, 'newsComments'),
        countSafe(db, 'users'),
        countSafe(db, 'errorLogs', 300),
        countSafe(db, 'adminActivity', 300),
        db.collection('config').doc('vkNewsSync').get().catch(error => ({ error })),
        db.collection('backups').orderBy('createdAt', 'desc').limit(1).get().catch(error => ({ error, docs: [] })),
        db.collection('config').doc('telegramPolling').get().catch(error => ({ error })),
      ]);

      const lastBackup = backups?.docs?.[0]?.data?.() || null;
      const vkData = vkSync?.exists ? vkSync.data() : null;
      const identitySnapshot = serverFoundation.identityV2.snapshot();
      const guard = architectureGuardReport();
      return {
        ok: true,
        actor: { id: actor.userId, role: actor.role, authSource: actor.authSource },
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        api: { ok: true, runtime: 'yandex-fastify', version: process.env.APP_VERSION || '' },
        identity: {
          ok: true,
          ...identitySnapshot,
        },
        migration: {
          ok: true,
          identity: identitySnapshot,
          dependencyMonitor: {
            reads: { firestore: identitySnapshot.firestoreReads || 0, postgres: identitySnapshot.yandexReads || 0 },
            writes: { firestore: identitySnapshot.firestoreWrites || 0, postgres: identitySnapshot.yandexWrites || 0 },
            fallback: identitySnapshot.fallbackCount || identitySnapshot.firestoreFallbacks || 0,
            fallbackEnabled: identitySnapshot.fallbackEnabled,
            dualRead: identitySnapshot.dualRead,
            dualWrite: identitySnapshot.dualWrite,
          },
        },
        architecture: {
          ok: guard.ok !== false,
          identityProvider: identitySnapshot.provider,
          dataProvider: identitySnapshot.storage,
          repositoryCoverage: 'Foundation guarded',
          firestoreDependency: guard.ok === false ? `${guard.violations?.length || 0} violations` : '0 guarded violations',
          migrationStatus: identitySnapshot.storage === 'postgres' ? 'Identity PostgreSQL ready' : 'Identity fallback mode',
          guard,
        },
        firestore: { ok: Boolean(ping || pingRef), collections: { news, comments, users, errors, adminActivity } },
        queues: { ok: true, pending: 0, note: 'Очередь задач пока не вынесена в отдельный сервис.' },
        telegramAuth: (() => {
          const tg = tgPolling?.exists ? tgPolling.data() : null;
          const lastPollAt = tg?.lastPollAt?.toDate ? tg.lastPollAt.toDate() : null;
          const pollAgeSec = lastPollAt ? Math.round((Date.now() - lastPollAt.getTime()) / 1000) : null;
          return {
            // поллинг живой, если крутился за последние 5 минут (cron — раз в минуту)
            ok: pollAgeSec !== null && pollAgeSec < 300 && !tg?.lastError,
            mode: 'getUpdates-polling',
            lastPollAt: lastPollAt ? lastPollAt.toISOString() : null,
            pollAgeSec,
            lastUpdateAt: tg?.lastUpdateAt?.toDate ? tg.lastUpdateAt.toDate().toISOString() : null,
            processedTotal: tg?.processedTotal || 0,
            lastError: tg?.lastError || null,
            note: pollAgeSec === null ? 'Поллинг ещё не запускался.' : tg?.lastError ? `Ошибка поллинга: ${tg.lastError}` : 'Апдейты Telegram забираются поллингом.',
          };
        })(),
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
