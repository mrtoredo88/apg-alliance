import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIMELINE_FILTERS,
  buildProfileTimeline,
  buildProfileHistory,
  buildProfileNowPriority,
  buildProfileSmartSummary,
  filterProfileTimelineItems,
  getProfileFeedTimestamp,
  getProfileTimelineSourceTypes,
  getTimelinePeriodLabel,
  groupProfileTimelineItems,
} from '../src/profileTimeline.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const profile = {
  id: 'partner-1',
  name: 'Coffee House',
  offer: 'Кофе + десерт',
  coverPhoto: 'cover.jpg',
  gallery: ['g1.jpg', 'g2.jpg'],
  videos: [{ title: 'Как мы варим кофе', url: 'https://vk.com/video-1_2', createdAt: '2026-07-13T10:00:00.000Z' }],
  updatedAt: '2026-07-12T10:00:00.000Z',
};

const timeline = buildProfileTimeline({
  profile,
  role: 'partner',
  news: [
    { id: 'n1', partnerId: 'partner-1', title: 'Новое меню', summary: 'Запустили летние напитки '.repeat(18), status: 'published', active: true, publicationType: 'Новость', publishedAt: '2026-07-14T10:00:00.000Z', pinned: true, stats: { comments: 3 } },
    { id: 'n6', partnerId: 'partner-1', title: 'Самая новая publishDate', status: 'published', active: true, publishDate: { seconds: 1784116800, nanoseconds: 0 } },
    { id: 'n4', partnerId: 'partner-1', title: 'Сегодня новое', status: 'published', active: true, publishedAt: '2026-07-15T11:00:00.000Z' },
    { id: 'n5', partnerId: 'partner-1', title: 'Сегодня старое', status: 'published', active: true, publishedAt: '2026-07-15T08:00:00.000Z' },
    { id: 'n2', partnerId: 'partner-1', title: 'Черновик', status: 'draft', active: false, publishedAt: '2026-07-15T10:00:00.000Z' },
    { id: 'n3', partnerId: 'other', title: 'Чужая новость', status: 'published', active: true, publishedAt: '2026-07-15T10:00:00.000Z' },
  ],
  events: [
    { id: 'e1', partnerId: 'partner-1', title: 'Кофейный вечер', status: 'published', active: true, startAt: '2026-07-16T18:00:00.000Z' },
  ],
  reviews: [
    { id: 'r1', userName: 'Анна', text: 'Было вкусно', stars: 5, createdAt: '2026-07-15T09:00:00.000Z' },
  ],
  vkPosts: [
    { id: 'vk1', text: 'Пост из сообщества', date: '2026-07-15T08:00:00.000Z', url: 'https://vk.com/wall-1_1' },
  ],
});

const nowValue = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;
const timelineEvents = [
  { id: 'e1', partnerId: 'partner-1', title: 'Кофейный вечер', status: 'published', active: true, startAt: '2026-07-16T18:00:00.000Z' },
];
const timelineReviews = [
  { id: 'r1', userName: 'Анна', text: 'Было вкусно', stars: 5, createdAt: '2026-07-15T09:00:00.000Z' },
];

const nowPriority = buildProfileNowPriority({
  profile,
  role: 'partner',
  news: [
    { id: 'n1', partnerId: 'partner-1', title: 'Новое меню', publishedAt: '2026-07-14T10:00:00.000Z', status: 'published', active: true },
  ],
  events: timelineEvents,
  reviews: timelineReviews,
  vkPosts: [
    { id: 'vk1', text: 'Новый пост', date: '2026-07-14T12:00:00.000Z' },
  ],
  nowValue: new Date('2026-07-14T20:00:00.000Z').getTime(),
});
assert.ok(nowPriority.length > 0, 'now priority should return at least one item when partner has active content');
assert.ok(nowPriority.every(item => item.value && item.title), 'now priority items should have display text');

const history = buildProfileHistory({
  profile,
  role: 'partner',
  news: [
    { id: 'n1', partnerId: 'partner-1', title: 'Новое меню', publishedAt: '2026-07-14T10:00:00.000Z', status: 'published', active: true },
  ],
  events: timelineEvents,
  reviews: timelineReviews,
  vkPosts: [],
});
assert.ok(Array.isArray(history), 'history must be an array');
assert.ok(history.length > 0, 'history must contain at least one milestone for populated profile');

const summary = buildProfileSmartSummary({
  news: [
    { id: 'n1', partnerId: 'partner-1', publishedAt: new Date(nowValue - 2 * oneDayMs).toISOString(), status: 'published', active: true },
    { id: 'n2', partnerId: 'partner-1', publishedAt: new Date(nowValue - 40 * oneDayMs).toISOString(), status: 'published', active: true },
  ],
  events: [
    { id: 'e1', partnerId: 'partner-1', title: 'Кофейный вечер', status: 'published', active: true, publishedAt: new Date(nowValue - 5 * oneDayMs).toISOString() },
  ],
  reviews: [
    { id: 'r1', userName: 'Анна', createdAt: new Date(nowValue - 10 * oneDayMs).toISOString() },
  ],
  nowValue,
});
assert.equal(summary.publications, 1, 'smart summary must count publications inside 30 days');
assert.equal(summary.events, 1, 'smart summary must count events inside 30 days');
assert.equal(summary.reviews, 1, 'smart summary must count reviews inside 30 days');

const summaryOld = buildProfileSmartSummary({
  news: [
    { id: 'n3', partnerId: 'partner-1', publishedAt: new Date(nowValue - 40 * oneDayMs).toISOString(), status: 'published', active: true },
  ],
  events: [
    { id: 'e2', partnerId: 'partner-1', title: 'Мастер-класс', status: 'published', active: true, publishedAt: new Date(nowValue - 90 * oneDayMs).toISOString() },
  ],
  reviews: [
    { id: 'r2', userName: 'Оля', createdAt: new Date(nowValue - 50 * oneDayMs).toISOString() },
  ],
  nowValue,
});
assert.equal(summaryOld.publications, 0, 'smart summary must ignore items older than 30 days');
assert.equal(summaryOld.events, 0, 'smart summary must ignore old events');
assert.equal(summaryOld.reviews, 0, 'smart summary must ignore old reviews');

const emptySmart = buildProfileSmartSummary({
  news: [],
  events: [],
  reviews: [],
});
assert.equal(emptySmart.publications + emptySmart.events + emptySmart.reviews, 0, 'summary should be zero for empty input');
const emptyPriority = buildProfileNowPriority({ profile: {}, role: 'partner', news: [], events: [], reviews: [], vkPosts: [], nowValue: new Date('2026-07-15T12:00:00.000Z').getTime() });
assert.equal(Array.isArray(emptyPriority), true, 'now priority should work for empty profile');
assert.equal(emptyPriority.length, 0, 'now priority should be empty if no trigger content');
const emptyTimeline = buildProfileTimeline({ profile: {}, news: [], events: [], reviews: [], vkPosts: [] });
assert.equal(emptyTimeline.length, 0, 'timeline should be empty for empty profile data');
const historyEmpty = buildProfileHistory({ profile: {}, news: [], events: [], reviews: [] });
assert.equal(historyEmpty.length, 0, 'history should be empty for empty profile');

const types = getProfileTimelineSourceTypes(timeline);
for (const type of ['publication', 'event', 'offer', 'video', 'photo', 'review', 'vk']) {
  assert.ok(types.includes(type), `timeline must include ${type}`);
}
assert.equal(timeline.some(item => item.title === 'Черновик'), false, 'draft news must not appear in public timeline');
assert.equal(timeline.some(item => item.title === 'Чужая новость'), false, 'foreign profile news must not appear in timeline');
assert.equal(timeline[0].title, 'Новое меню', 'pinned publication must appear first');
assert.equal(timeline[0].pinned, true, 'timeline item must expose pinned state');

const publicationItems = filterProfileTimelineItems(timeline, 'publication');
assert.equal(publicationItems.length, 4, 'publication filter must keep only news entries');
assert.equal(publicationItems[1].title, 'Самая новая publishDate', 'publishDate Timestamp publication must stay above older publication');
assert.equal(publicationItems[1].feedTimestamp, 1784116800000, 'timeline item must expose normalized feedTimestamp');
assert.equal(publicationItems[2].title, 'Сегодня новое', 'newer unpinned publication must stay above older publication');
assert.equal(publicationItems[3].title, 'Сегодня старое', 'older unpinned publication must stay below newer publication');
assert.deepEqual(TIMELINE_FILTERS, [{ id: 'feed', label: 'Лента' }], 'timeline must expose one unified Feed tab instead of old source tabs');
assert.equal(filterProfileTimelineItems(timeline, 'feed').length, timeline.length, 'Feed filter must keep all source types in one list');
assert.equal(getProfileFeedTimestamp({ seconds: 1784116800, nanoseconds: 0 }), 1784116800000, 'feed timestamp helper must support Firestore Timestamp-like objects');
assert.equal(getProfileFeedTimestamp(new Date('2026-07-15T10:00:00.000Z')), new Date('2026-07-15T10:00:00.000Z').getTime(), 'feed timestamp helper must support Date objects');
assert.equal(getProfileFeedTimestamp('2026-07-15T10:00:00.000Z'), new Date('2026-07-15T10:00:00.000Z').getTime(), 'feed timestamp helper must support date strings');
const mixedDateTimeline = buildProfileTimeline({
  profile,
  role: 'partner',
  news: [
    { id: 'm1', partnerId: 'partner-1', title: 'created older', status: 'published', active: true, created: '2026-07-12T10:00:00.000Z' },
    { id: 'm2', partnerId: 'partner-1', title: 'date middle', status: 'published', active: true, date: '2026-07-13T10:00:00.000Z' },
    { id: 'm3', partnerId: 'partner-1', title: 'publishDate newest', status: 'published', active: true, publishDate: '2026-07-16T10:00:00.000Z' },
    { id: 'm4', partnerId: 'partner-1', title: 'publishedAt second', status: 'published', active: true, publishedAt: '2026-07-15T10:00:00.000Z' },
  ],
  events: [],
  reviews: [],
  vkPosts: [],
}).filter(item => item.type === 'publication');
assert.deepEqual(mixedDateTimeline.map(item => item.title), ['publishDate newest', 'publishedAt second', 'date middle', 'created older'], 'mixed date fields must be normalized before DESC feed sorting');

const periodLabel = getTimelinePeriodLabel('2026-07-15T09:00:00.000Z', new Date('2026-07-15T12:00:00.000Z').getTime());
assert.equal(periodLabel, 'Сегодня', 'timeline period helper must group today entries');
const groups = groupProfileTimelineItems(timeline, new Date('2026-07-15T12:00:00.000Z').getTime());
assert.equal(groups[0].label, 'Закреплено', 'timeline must expose pinned group before chronology');
assert.ok(groups.some(group => group.label === 'Сегодня'), 'timeline must group regular items by human period labels');
const todayGroup = groups.find(group => group.label === 'Сегодня');
const todayPublications = todayGroup.items.filter(item => item.type === 'publication');
assert.equal(todayPublications[0].title, 'Самая новая publishDate', 'timeline groups must sort newest publication first');
assert.equal(todayPublications[1].title, 'Сегодня новое', 'timeline groups must keep second newest publication after newest publication');
assert.equal(todayPublications[2].title, 'Сегодня старое', 'timeline groups must keep older publication after newer publication');

const timelineComponent = read('src/components/ProfileTimelineSection.jsx');
const feedFramework = read('src/components/FeedFramework.jsx');
assert.match(timelineComponent, /api\/community-feed/, 'VK must remain one timeline source through existing backend endpoint');
assert.match(timelineComponent, /buildProfileTimeline/, 'timeline UI must use shared timeline builder');
assert.match(timelineComponent, /UniversalFeed/, 'timeline UI must render the shared universal Feed Framework');
assert.doesNotMatch(timelineComponent, /TIMELINE_FILTERS/, 'timeline UI must not render old source filter tabs');
assert.doesNotMatch(timelineComponent, /filter\.label/, 'timeline UI must not render the old All/News source pills');
assert.match(timelineComponent, /groupProfileTimelineItems/, 'timeline UI must group items by period');
assert.match(feedFramework, /Показать полностью/, 'long feed entries must be expandable');
assert.match(timelineComponent, /Показать ещё/, 'timeline must use progressive pagination');
assert.match(timelineComponent, /Закреплено/, 'pinned timeline item must be visible in UI');
assert.match(timelineComponent, /VK-источник временно недоступен, остальные события ленты показаны/, 'VK failure must not break the full timeline');
assert.match(feedFramework, /export function UniversalFeedCard/, 'Feed Framework must expose one reusable feed card');
assert.match(feedFramework, /export function UniversalFeed/, 'Feed Framework must expose the reusable feed list');
assert.match(feedFramework, /MediaPreview/, 'Feed Framework must use Smart Media Framework for images, galleries and video');
assert.match(feedFramework, /item\.feedTimestamp \|\| item\.publishDate \|\| item\.publishedAt \|\| item\.createdAt \|\| item\.created/, 'Feed Framework must sort by normalized feedTimestamp before existing publication date fields');
assert.match(feedFramework, /likesCount|commentCount|commentsCount/, 'Feed card must preserve social counters when existing data provides them');

const workspaceNews = read('src/workspace/WorkspaceNewsCenter.jsx');
assert.match(workspaceNews, /Создать публикацию/, 'Workspace must expose create publication action');
assert.match(workspaceNews, /PUBLICATION_TYPES/, 'Workspace editor must expose publication types');
assert.match(workspaceNews, /publicationType/, 'Workspace editor must save publication type in existing news model');

const sharedNews = read('server-shared/workspace-news.js');
const adminActions = read('server/src/routes/admin-actions.js');
assert.match(sharedNews, /publicationType/, 'workspace sanitizer must allow publication type');
assert.match(adminActions, /publicationType/, 'admin news allowlist must keep publication type');

console.log('profile-timeline-test: ok');
