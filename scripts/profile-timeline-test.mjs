import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIMELINE_FILTERS,
  buildLivingProfileTabs,
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
import { getCanonicalNewsId } from '../src/newsUtils.js';

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
    { id: 'n7', partnerId: 'partner-1', title: 'Длинная публикация', summary: 'Подробный текст публикации для проверки раскрытия в профильной ленте. '.repeat(14), status: 'published', active: true, publishedAt: '2026-07-13T10:00:00.000Z' },
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

const livingTabs = buildLivingProfileTabs({
  profile,
  galleryItems: ['g1.jpg', 'g2.jpg', 'cover.jpg'],
  videos: profile.videos,
  reviews: timelineReviews,
  reviewCount: 8,
});
assert.deepEqual(livingTabs.map(item => item.id), ['feed', 'about', 'offer', 'photos', 'video', 'reviews'], 'Living Profile tabs must use one unified order');
assert.deepEqual(livingTabs.map(item => item.label), ['Лента', 'О компании', 'Акции', 'Фото', 'Видео', 'Отзывы'], 'Living Profile tabs must use one shared menu vocabulary');
assert.equal(livingTabs.find(item => item.id === 'offer').count, 1, 'offer tab must show live count when profile has an active offer');
assert.equal(livingTabs.find(item => item.id === 'photos').count, 3, 'photos tab must show live gallery count');
assert.equal(livingTabs.find(item => item.id === 'video').count, 1, 'video tab must show live video count');
assert.equal(livingTabs.find(item => item.id === 'reviews').count, 8, 'reviews tab must prefer live review count');
const emptyLivingTabs = buildLivingProfileTabs({ profile: {}, galleryItems: [], videos: [], reviews: [], reviewCount: 0 });
assert.deepEqual(emptyLivingTabs.map(item => item.count), [undefined, undefined, undefined, undefined, undefined, undefined], 'Living Profile tabs must not display zero counters');

const types = getProfileTimelineSourceTypes(timeline);
for (const type of ['publication', 'event', 'offer', 'video', 'photo', 'review', 'vk']) {
  assert.ok(types.includes(type), `timeline must include ${type}`);
}
assert.equal(timeline.some(item => item.title === 'Черновик'), false, 'draft news must not appear in public timeline');
assert.equal(timeline.some(item => item.title === 'Чужая новость'), false, 'foreign profile news must not appear in timeline');
assert.equal(timeline[0].title, 'Новое меню', 'pinned publication must appear first');
assert.equal(timeline[0].pinned, true, 'timeline item must expose pinned state');

const publicationItems = filterProfileTimelineItems(timeline, 'publication');
assert.equal(publicationItems.length, 5, 'publication filter must keep only news entries');
assert.equal(publicationItems[1].title, 'Самая новая publishDate', 'publishDate Timestamp publication must stay above older publication');
assert.equal(publicationItems[1].feedTimestamp, 1784116800000, 'timeline item must expose normalized feedTimestamp');
assert.equal(publicationItems[2].title, 'Сегодня новое', 'newer unpinned publication must stay above older publication');
assert.equal(publicationItems[3].title, 'Сегодня старое', 'older unpinned publication must stay below newer publication');
assert.equal(publicationItems[4].title, 'Длинная публикация', 'longer older publication must stay below newer publication');
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

const openableNewsTimeline = buildProfileTimeline({
  profile,
  role: 'partner',
  news: [
    { newsId: 'first-news-id', partnerId: 'partner-1', title: 'Первая публикация', status: 'published', active: true, publishedAt: '2026-07-12T10:00:00.000Z' },
    { documentId: 'middle-doc-id', partnerId: 'partner-1', title: 'Средняя публикация', status: 'published', active: true, publishedAt: '2026-07-13T10:00:00.000Z' },
    { articleId: 'latest-article-id', partnerId: 'partner-1', title: 'Последняя публикация', status: 'published', active: true, publishedAt: '2026-07-16T10:00:00.000Z' },
  ],
  events: [],
  reviews: [],
  vkPosts: [],
}).filter(item => item.type === 'publication');
assert.deepEqual(openableNewsTimeline.map(item => item.title), ['Последняя публикация', 'Средняя публикация', 'Первая публикация'], 'profile feed must keep newest publication first before opening');
for (const item of openableNewsTimeline) {
  assert.equal(item.action, 'openNews', 'profile publication must keep contextual open action');
  assert.ok(item.entity, 'profile publication must carry full source news entity');
  assert.ok(getCanonicalNewsId(item.entity), 'profile publication entity must expose a canonical id for ArticleView');
  assert.ok(item.entity.id, 'profile publication entity must be normalized with id');
  assert.ok(item.id.includes(getCanonicalNewsId(item.entity)), 'feed item id must be based on the same canonical news id');
}
const onlyPublicationTimeline = buildProfileTimeline({
  profile,
  role: 'partner',
  news: [
    { slug: 'only-slug-publication', partnerId: 'partner-1', title: 'Единственная публикация', status: 'published', active: true, date: '2026-07-17T10:00:00.000Z' },
  ],
  events: [],
  reviews: [],
  vkPosts: [],
}).filter(item => item.type === 'publication');
assert.equal(onlyPublicationTimeline.length, 1, 'single profile publication must remain openable');
assert.equal(getCanonicalNewsId(onlyPublicationTimeline[0].entity), 'only-slug-publication', 'single profile publication must preserve slug as canonical id');

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
const timelinePublications = timeline.filter(item => item.action === 'openNews');
assert.ok(timelinePublications.length >= 3, 'timeline fixture must cover first, middle and last publication opening');
for (const item of timelinePublications) {
  assert.ok(item.entity, `feed item ${item.title} must keep the original news entity`);
  assert.ok(getCanonicalNewsId(item.entity), `feed item ${item.title} must keep a canonical news id for ArticleView`);
}
assert.ok(timelinePublications.some(item => String(item.text || '').length > 520), 'timeline fixture must cover long publication inline reading');
assert.ok(timelinePublications.some(item => String(item.text || '').length <= 320), 'timeline fixture must cover short publication direct ArticleView opening');

const timelineComponent = read('src/components/ProfileTimelineSection.jsx');
const feedFramework = read('src/components/FeedFramework.jsx');
const profileMediaViewer = read('src/components/ProfileMediaViewer.jsx');
const partnerPage = read('src/PartnerPage.jsx');
const expertsPage = read('src/ExpertsPage.jsx');
const newsPage = read('src/NewsPage.jsx');
assert.match(timelineComponent, /api\/community-feed/, 'VK must remain one timeline source through existing backend endpoint');
assert.match(timelineComponent, /buildProfileTimeline/, 'timeline UI must use shared timeline builder');
assert.match(timelineComponent, /UniversalFeed/, 'timeline UI must render the shared universal Feed Framework');
assert.match(timelineComponent, /onOpen=\{item => openTimelineItem\(item/, 'profile feed must delegate item opening through a container callback');
assert.match(timelineComponent, /profileReading/, 'profile feed must read regular publications inline without leaving the profile');
assert.doesNotMatch(feedFramework, /navigate\(/, 'Feed Framework must not hard-code router navigation');
assert.doesNotMatch(feedFramework, /openNews\(/, 'Feed Framework must not call global news opening directly');
assert.match(newsPage, /export function ArticleView/, 'ArticleView must be reusable by contextual profile feeds');
assert.match(partnerPage, /selectedProfileNews/, 'Partner profile must keep selected feed publication in local state');
assert.match(partnerPage, /onOpenNews=\{handleOpenProfileNews\}/, 'Partner profile feed must open publications locally instead of global news');
assert.match(partnerPage, /<ArticleView[\s\S]*item=\{selectedProfileNews\}/, 'Partner profile must render contextual ArticleView inside the profile flow');
assert.match(partnerPage, /if \(desktopMode\)[\s\S]*<ProfileVideoViewer videos=\{partner\.videos\}[\s\S]*\{selectedProfileArticle\}[\s\S]*return \(/, 'Partner desktop profile must mount selected ArticleView after a feed click');
assert.match(partnerPage, /getCanonicalNewsId/, 'Partner profile must keep contextual ArticleView open for news entities without plain id');
assert.match(partnerPage, /ProfilePhotoGrid/, 'Partner profile must use the shared Living Profile photo grid');
assert.match(partnerPage, /ProfileVideoGrid/, 'Partner profile must use the shared Living Profile video grid');
assert.match(partnerPage, /ProfilePhotoViewer/, 'Partner profile must open photos over the current profile');
assert.match(partnerPage, /ProfileVideoViewer/, 'Partner profile must open videos over the current profile');
assert.match(expertsPage, /selectedProfileNews/, 'Expert profile must keep selected feed publication in local state');
assert.match(expertsPage, /onOpenNews=\{handleOpenProfileNews\}/, 'Expert profile feed must open publications locally instead of global news');
assert.match(expertsPage, /<ArticleView[\s\S]*item=\{selectedProfileNews\}/, 'Expert profile must render contextual ArticleView inside the profile flow');
assert.match(expertsPage, /getCanonicalNewsId/, 'Expert profile must keep contextual ArticleView open for news entities without plain id');
assert.match(expertsPage, /ProfilePhotoGrid/, 'Expert profile must use the shared Living Profile photo grid');
assert.match(expertsPage, /ProfileVideoGrid/, 'Expert profile must use the shared Living Profile video grid');
assert.match(expertsPage, /ProfilePhotoViewer/, 'Expert profile must open photos over the current profile');
assert.match(expertsPage, /ProfileVideoViewer/, 'Expert profile must open videos over the current profile');
assert.match(profileMediaViewer, /MediaPreview/, 'Living Profile gallery must use Smart Media Framework previews');
assert.match(profileMediaViewer, /createPortal/, 'Living Profile media viewer must open above the profile without unmounting it');
assert.match(profileMediaViewer, /Escape/, 'Living Profile media viewer must support ESC close');
assert.match(profileMediaViewer, /ArrowLeft/, 'Living Profile media viewer must support previous keyboard navigation');
assert.match(profileMediaViewer, /ArrowRight/, 'Living Profile media viewer must support next keyboard navigation');
assert.match(profileMediaViewer, /onTouchStart/, 'Living Profile media viewer must support swipe gestures');
assert.doesNotMatch(profileMediaViewer, /autoPlay/, 'Living Profile video viewer must not autoplay videos');
assert.doesNotMatch(timelineComponent, /buildProfileHistory/, 'profile feed UI must not render the old History block');
assert.doesNotMatch(timelineComponent, /buildProfileNowPriority/, 'profile feed UI must not render the old What matters now block');
assert.doesNotMatch(timelineComponent, /Smart Summary/, 'profile feed UI must not render summary cards before the feed');
assert.doesNotMatch(timelineComponent, />История</, 'profile feed UI must not render the History section');
assert.doesNotMatch(timelineComponent, /Что сейчас важно/, 'profile feed UI must not render the removed What matters now section');
assert.doesNotMatch(timelineComponent, /TIMELINE_FILTERS/, 'timeline UI must not render old source filter tabs');
assert.doesNotMatch(timelineComponent, /filter\.label/, 'timeline UI must not render the old All/News source pills');
assert.match(timelineComponent, /groupProfileTimelineItems/, 'timeline UI must group items by period');
assert.match(feedFramework, /FEED_TEXT_LIMIT/, 'Feed Framework must use explicit reading limits');
assert.match(feedFramework, /Прочитать полностью/, 'long profile feed entries must expand inline');
assert.match(feedFramework, /Скрыть/, 'expanded profile feed entries must collapse inline');
assert.match(feedFramework, /Открыть статью/, 'very long profile feed entries must keep an explicit ArticleView action');
assert.match(feedFramework, /profileReading && item\.action === 'openNews'/, 'inline reading must be limited to profile news publications');
assert.match(feedFramework, /max-height 260ms ease/, 'inline feed expansion must animate smoothly');
assert.doesNotMatch(feedFramework, /if \(inlineRead\) return undefined/, 'profile reading must not block ArticleView opening from title/media/meta');
assert.doesNotMatch(feedFramework, /disabled=\{inlineRead\}/, 'profile reading must not disable title or media ArticleView actions');
assert.match(feedFramework, /const inlineMetaButton/, 'feed meta and date controls must remain clickable');
assert.match(timelineComponent, /Показать ещё/, 'timeline must use progressive pagination');
assert.match(feedFramework, /Закреплено/, 'pinned timeline item must be visible in the shared Feed Framework UI');
assert.match(timelineComponent, /VK-источник временно недоступен, остальные события ленты показаны/, 'VK failure must not break the full timeline');
assert.match(feedFramework, /export function UniversalFeedCard/, 'Feed Framework must expose one reusable feed card');
assert.match(feedFramework, /export function UniversalFeed/, 'Feed Framework must expose the reusable feed list');
assert.match(feedFramework, /FEED_ACTIVITY_TYPES/, 'Feed Framework must expose the universal activity type model');
for (const type of ['NEWS', 'EVENT', 'PROMOTION', 'PHOTO', 'VIDEO', 'REVIEW', 'ACHIEVEMENT', 'ANNOUNCEMENT']) {
  assert.match(feedFramework, new RegExp(type), `Feed Framework must support ${type} activity type`);
}
assert.match(feedFramework, /getFeedTypeMeta/, 'Feed Framework must normalize current source aliases to activity badges');
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
