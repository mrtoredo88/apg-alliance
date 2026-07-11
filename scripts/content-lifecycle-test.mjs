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

console.log('Content Lifecycle Engine V1 tests passed');
