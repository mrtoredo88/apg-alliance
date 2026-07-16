import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeVkCommunityUrl, getVkCommunityScreenName } from '../server-shared/vk-community.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const cases = [
  ['https://vk.com/apgzelenograd?from=feed#wall', 'https://vk.com/apgzelenograd', 'apgzelenograd'],
  ['http://vk.com/club12345', 'https://vk.com/club12345', 'club12345'],
  ['vk.com/public12345', 'https://vk.com/public12345', 'public12345'],
  ['www.vk.com/test_group', 'https://vk.com/test_group', 'test_group'],
  ['@apg_test', 'https://vk.com/apg_test', 'apg_test'],
  ['apg.test', 'https://vk.com/apg.test', 'apg.test'],
  ['javascript:alert(1)', '', ''],
  ['https://example.com/apg', '', ''],
  ['https://vk.com/a/b', '', ''],
];

for (const [input, url, screenName] of cases) {
  assert.equal(normalizeVkCommunityUrl(input), url, `normalize ${input}`);
  assert.equal(getVkCommunityScreenName(input), screenName, `screen ${input}`);
}

const serverRoute = read('server/src/routes/vk-news.js');
assert.match(serverRoute, /fastify\.get\('\/api\/community-feed'/, 'community feed endpoint must exist');
assert.match(serverRoute, /communityFeedCache/, 'community feed must use server cache');
assert.match(serverRoute, /utils\.resolveScreenName/, 'community feed must resolve VK screen names on backend');
assert.match(serverRoute, /mapCommunityPost/, 'community feed must not reuse news collection writes for external posts');
assert.doesNotMatch(serverRoute.slice(serverRoute.indexOf("fastify.get('/api/community-feed'"), serverRoute.indexOf("fastify.get('/api/vk-news'")), /collection\('news'\)|cachePosts\(/, 'community feed must not write external posts into APG news');

const partnerPage = read('src/PartnerPage.jsx');
const expertsPage = read('src/ExpertsPage.jsx');
const profileTimeline = read('src/profileTimeline.js');
assert.match(profileTimeline, /buildLivingProfileTabs/, 'profile timeline must expose shared Living Profile tabs');
assert.match(profileTimeline, /id: 'feed', label: 'Лента'/, 'shared Living Profile tabs must start with feed');
assert.match(profileTimeline, /id: 'about', label: 'О компании'/, 'shared Living Profile tabs must include about');
assert.match(profileTimeline, /id: 'offer', label: 'Акции'/, 'shared Living Profile tabs must include offers');
assert.match(profileTimeline, /id: 'photos', label: 'Фото'/, 'shared Living Profile tabs must include photos');
assert.match(profileTimeline, /id: 'video', label: 'Видео'/, 'shared Living Profile tabs must include video');
assert.match(profileTimeline, /id: 'reviews', label: 'Отзывы'/, 'shared Living Profile tabs must include reviews');
for (const [name, source] of [['PartnerPage', partnerPage], ['ExpertsPage', expertsPage]]) {
  assert.match(source, /ProfileTimelineSection/, `${name} must render unified profile timeline`);
  assert.match(source, /buildLivingProfileTabs/, `${name} must use shared Living Profile tabs`);
  assert.match(source, /setDesktopTab\('feed'\)/, `${name} must open unified timeline by default`);
  assert.match(source, /Хронология публичной активности/, `${name} must describe feed as profile activity timeline`);
  assert.doesNotMatch(source, /Последние публикации сообщества/, `${name} must not expose VK as a separate feed`);
}

const frontendSources = [
  read('src/PartnerPage.jsx'),
  read('src/ExpertsPage.jsx'),
  read('src/components/CommunityFeedSection.jsx'),
  read('src/components/ProfileTimelineSection.jsx'),
  read('src/utils/externalUrls.js'),
].join('\n');
assert.doesNotMatch(frontendSources, /VK_(SERVICE|USER|GROUP)_TOKEN|access_token/i, 'VK tokens must not appear in frontend feed code');

const adminPanel = read('src/AdminPanel.jsx');
const partnerCabinet = read('src/PartnerCabinetPage.jsx');
const expertCabinet = read('src/ExpertCabinetPage.jsx');
const questionnaire = read('src/components/PartnerQuestionnaire.jsx');
const showcase = read('src/cabinet/DigitalShowcaseBuilder.jsx');
for (const [name, source] of [['AdminPanel', adminPanel], ['PartnerCabinetPage', partnerCabinet], ['ExpertCabinetPage', expertCabinet], ['PartnerQuestionnaire', questionnaire], ['DigitalShowcaseBuilder', showcase]]) {
  assert.match(source, /Сообщество для ленты VK/, `${name} must expose community feed field copy`);
}

console.log('community-feed-test: ok');
