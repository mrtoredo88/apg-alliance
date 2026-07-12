// Regression-аудит и восстановление публичности после внедрения Content Lifecycle.
// Карточки, видимые по старым правилам (active !== false), но скрытые новым
// lifecycle-фильтром, возвращаются в published (события в прошлом — в completed).
// Запуск: node scripts/content-lifecycle-repair.mjs [--dry-run]
import { readFileSync } from 'node:fs';
import { getDb } from '../server/src/lib/firebase.js';
import { buildLifecyclePatch, isEventPast, isLifecyclePublic, normalizeContentStatus } from '../server-shared/content-lifecycle.js';

const dryRun = process.argv.includes('--dry-run');
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  const env = readFileSync(new URL('../server/.env', import.meta.url), 'utf8');
  process.env.FIREBASE_SERVICE_ACCOUNT = env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m)?.[1]?.trim() || '';
}
const db = getDb();

const COLLECTIONS = {
  partners: item => item.active !== false && item.archived !== true && item.deleted !== true && item.catalogPublished !== false,
  experts: item => item.active !== false && item.archived !== true && item.deleted !== true,
  events: item => item.active !== false && item.archived !== true && item.deleted !== true,
  news: item => item.active !== false && item.archived !== true && item.deleted !== true,
  customTasks: item => item.active !== false && item.archived !== true && item.deleted !== true,
  prizes: item => item.active !== false && item.archived !== true && item.deleted !== true,
};

const summary = [];
for (const [name, wasPublicLegacy] of Object.entries(COLLECTIONS)) {
  const snap = await db.collection(name).get();
  const rows = snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  const legacyPublic = rows.filter(wasPublicLegacy);
  const nowPublic = rows.filter(item => name === 'events'
    ? ['published', 'completed'].includes(normalizeContentStatus(item)) && item.archived !== true && item.deleted !== true
    : isLifecyclePublic(item));
  const lost = legacyPublic.filter(item => !nowPublic.some(row => row.id === item.id));
  summary.push({ name, total: rows.length, legacyPublic: legacyPublic.length, nowPublic: nowPublic.length, lost: lost.length });
  console.log(`=== ${name}: всего ${rows.length}, публично по старым правилам ${legacyPublic.length}, по lifecycle ${nowPublic.length}, потеряно ${lost.length}`);
  for (const item of lost) {
    const currentStatus = normalizeContentStatus(item);
    const targetStatus = name === 'events' && isEventPast(item) ? 'completed' : 'published';
    console.log(`  → ${item.id} | ${item.name || item.title || 'без названия'} | status: ${item.status ?? '—'} → ${targetStatus} (normalized: ${currentStatus}), active: ${item.active ?? '—'}`);
    if (dryRun) continue;
    const patch = buildLifecyclePatch({
      item,
      resource: name === 'customTasks' ? 'tasks' : name,
      nextStatus: targetStatus,
      actorId: 'content-lifecycle-repair',
      reason: 'Карточка была публичной до внедрения Content Lifecycle (active=true); статус восстановлен миграцией.',
    });
    await item.ref.set({ ...patch, updatedAt: new Date() }, { merge: true });
    console.log(`    восстановлено: ${targetStatus}`);
  }
}
console.log('\nИтог:', JSON.stringify(summary));
process.exit(0);
