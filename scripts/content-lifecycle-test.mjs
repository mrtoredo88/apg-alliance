import assert from 'node:assert/strict';
import {
  buildLifecyclePatch,
  filterByLifecycleView,
  getLifecycleAutoRecommendation,
  isLifecycleArchived,
  isLifecycleDeleted,
  isLifecyclePublic,
  normalizeContentStatus,
  summarizeLifecycle,
} from '../server-shared/content-lifecycle.js';

const news = { id: 'n1', title: 'Новость', active: true, status: 'published', publishedAt: new Date(Date.now() - 220 * 86400000).toISOString(), views: 15 };
assert.equal(normalizeContentStatus(news), 'published');
assert.equal(isLifecyclePublic(news), true);
assert.equal(getLifecycleAutoRecommendation('news', news)?.targetStatus, 'archived');

const archivedPatch = buildLifecyclePatch({ item: news, resource: 'news', nextStatus: 'archived', actorId: 'admin', reason: 'old' });
assert.equal(archivedPatch.archived, true);
assert.equal(archivedPatch.deleted, false);
assert.equal(archivedPatch.lifecycleStatus, 'archived');
assert.equal(archivedPatch.lifecycleHistory.length, 1);
assert.equal(isLifecycleArchived({ ...news, ...archivedPatch }), true);
assert.equal(isLifecycleDeleted({ ...news, ...archivedPatch }), false);
assert.equal(isLifecyclePublic({ ...news, ...archivedPatch }), false);

const restoredPatch = buildLifecyclePatch({ item: { ...news, ...archivedPatch }, resource: 'news', nextStatus: 'published', actorId: 'admin', reason: 'restore' });
assert.equal(restoredPatch.archived, false);
assert.equal(restoredPatch.deleted, false);
assert.equal(restoredPatch.lifecycleStatus, 'published');
assert.equal(restoredPatch.lifecycleHistory.length, 2);

const deletedPatch = buildLifecyclePatch({ item: news, resource: 'news', nextStatus: 'deleted', actorId: 'admin' });
assert.equal(deletedPatch.archived, true);
assert.equal(deletedPatch.deleted, true);
assert.equal(normalizeContentStatus({ ...news, ...deletedPatch }), 'deleted');

const pastEvent = { id: 'e1', title: 'Встреча', status: 'published', date: new Date(Date.now() - 2 * 86400000).toISOString() };
assert.equal(getLifecycleAutoRecommendation('events', pastEvent)?.targetStatus, 'completed');
const completedEvent = { ...pastEvent, status: 'completed', completedAt: new Date(Date.now() - 90 * 86400000).toISOString() };
assert.equal(getLifecycleAutoRecommendation('events', completedEvent)?.targetStatus, 'archived');

const rows = [news, { ...news, id: 'n2', status: 'draft', active: false }, { ...news, id: 'n3', ...archivedPatch }];
assert.equal(filterByLifecycleView(rows, 'active', 'news').length, 2);
assert.equal(filterByLifecycleView(rows, 'archive', 'news').length, 1);
assert.equal(summarizeLifecycle(rows, 'news').archived, 1);

// ════════════════════════════════════════════════════════════════════
// ПОСТОЯННЫЙ REGRESSION: карточка эксперта Ольги Крутиковой (2026-07-12).
// Карточка была публичной по старым правилам (active: true при status: draft
// из ИИ-импорта) и исчезла из каталога после внедрения Content Lifecycle.
// Инвариант: миграция/изменение движка не имеет права молча скрывать
// опубликованные (де-факто публичные) карточки без явного правила.
// Запускается при каждом изменении Identity Core / Content Lifecycle /
// Pipeline / Business Hub (npm run test:core).
// ════════════════════════════════════════════════════════════════════

const olgaCase = { id: 'GmocLuICfZAEwyKE14xR', name: 'Крутикова Ольга', status: 'draft', active: true, phone: '+79851606801', gallery: ['1', '2', '3', '4'] };

// 1. Кейс воспроизводится: де-факто публичная карточка классифицируется как draft
assert.equal(isLifecyclePublic(olgaCase), false, 'воспроизведение регрессии: active:true + status:draft скрыто');

// 2. Правило миграции (scripts/content-lifecycle-repair.mjs) обязано находить такие карточки
const legacyPublic = item => item.active !== false && item.archived !== true && item.deleted !== true;
assert.equal(legacyPublic(olgaCase) && !isLifecyclePublic(olgaCase), true, 'repair-скрипт должен видеть карточку как потерянную');

// 3. После восстановления карточка публична, данные не тронуты
const repairPatch = buildLifecyclePatch({ item: olgaCase, resource: 'experts', nextStatus: 'published', actorId: 'content-lifecycle-repair', reason: 'restore' });
const restored = { ...olgaCase, ...repairPatch };
assert.equal(isLifecyclePublic(restored), true, 'после миграции карточка публична');
assert.equal(restored.phone, olgaCase.phone, 'телефон не тронут');
assert.deepEqual(restored.gallery, olgaCase.gallery, 'галерея не тронута');
assert.equal(restored.lifecycleHistory.at(-1).from, 'draft', 'история фиксирует прежний статус');

// 4. Опубликованная карточка не может быть молча понижена: только явный nextStatus
['draft', 'archived', 'deleted', 'completed'].forEach(status => {
  const published = { id: 'x', status: 'published', active: true };
  assert.equal(normalizeContentStatus(published), 'published');
  const demoted = buildLifecyclePatch({ item: published, resource: 'experts', nextStatus: status, actorId: 'admin', reason: 'explicit' });
  assert.equal(demoted.lifecycleHistory.at(-1).from, 'published', `понижение до ${status} всегда фиксируется в истории с from=published`);
  assert.equal(demoted.lifecycleHistory.at(-1).reason, 'explicit', 'понижение требует явной причины');
});

// 5. Некорректный nextStatus не понижает опубликованную карточку
const fallbackPatch = buildLifecyclePatch({ item: { status: 'published' }, resource: 'experts', nextStatus: 'nonsense' });
assert.equal(fallbackPatch.lifecycleStatus, 'published', 'неизвестный статус не превращается в draft');

// 6. normalizeContentStatus не понижает published ни при каких дополнительных флагах видимости
assert.equal(normalizeContentStatus({ status: 'published', active: true }), 'published');
assert.equal(normalizeContentStatus({ lifecycleStatus: 'published' }), 'published');
assert.equal(normalizeContentStatus({ lifecycle: { status: 'published' }, status: 'draft' }), 'published', 'lifecycle.status — источник истины после миграции');

console.log('Content Lifecycle regression tests passed (включая постоянный кейс карточки Ольги)');
