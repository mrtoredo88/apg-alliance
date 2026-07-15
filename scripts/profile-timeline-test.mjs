import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProfileTimeline, getProfileTimelineSourceTypes } from '../src/profileTimeline.js';

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
    { id: 'n1', partnerId: 'partner-1', title: 'Новое меню', summary: 'Запустили летние напитки', status: 'published', active: true, publicationType: 'Новость', publishedAt: '2026-07-14T10:00:00.000Z' },
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

const types = getProfileTimelineSourceTypes(timeline);
for (const type of ['publication', 'event', 'offer', 'video', 'photo', 'review', 'vk']) {
  assert.ok(types.includes(type), `timeline must include ${type}`);
}
assert.equal(timeline.some(item => item.title === 'Черновик'), false, 'draft news must not appear in public timeline');
assert.equal(timeline.some(item => item.title === 'Чужая новость'), false, 'foreign profile news must not appear in timeline');
assert.deepEqual([...timeline].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(item => item.id), timeline.map(item => item.id), 'timeline must be sorted by time desc');

const timelineComponent = read('src/components/ProfileTimelineSection.jsx');
assert.match(timelineComponent, /api\/community-feed/, 'VK must remain one timeline source through existing backend endpoint');
assert.match(timelineComponent, /buildProfileTimeline/, 'timeline UI must use shared timeline builder');
assert.match(timelineComponent, /VK-источник временно недоступен, остальные события ленты показаны/, 'VK failure must not break the full timeline');

const workspaceNews = read('src/workspace/WorkspaceNewsCenter.jsx');
assert.match(workspaceNews, /Создать публикацию/, 'Workspace must expose create publication action');
assert.match(workspaceNews, /PUBLICATION_TYPES/, 'Workspace editor must expose publication types');
assert.match(workspaceNews, /publicationType/, 'Workspace editor must save publication type in existing news model');

const sharedNews = read('server-shared/workspace-news.js');
const adminActions = read('server/src/routes/admin-actions.js');
assert.match(sharedNews, /publicationType/, 'workspace sanitizer must allow publication type');
assert.match(adminActions, /publicationType/, 'admin news allowlist must keep publication type');

console.log('profile-timeline-test: ok');
