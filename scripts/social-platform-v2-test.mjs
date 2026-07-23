import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPeopleRows, buildPeopleSections, buildSocialAnalytics, peopleSuggestionReason, recentPeopleGroups, searchPeopleGroups } from '../src/social/PeopleCore.js';

const actor = { id: 'email:owner@example.com', displayName: 'Mr. TOREDO' };
const now = Date.now();
const users = [
  { id: 'email:tatyana@example.com', displayName: 'Татьяна Гордеева', company: 'АПГ', role: 'Старший администратор', city: 'Зеленоград' },
  { id: 'email:anna@example.com', displayName: 'Анна Белова', company: 'Bell Pub', role: 'Партнёр', city: 'Зеленоград', interests: ['Предприниматель'] },
  { id: 'email:maxim@example.com', displayName: 'Максим Иванов', company: 'Юридический центр', role: 'Юрист', city: 'Москва' },
  { id: 'email:ivan@example.com', displayName: 'Иван Соколов', company: 'Нетворкинг АПГ', role: 'Предприниматель', city: 'Зеленоград' },
];
const requests = [
  { id: 'req-in', connection: true, status: 'pending', direction: 'incoming', senderId: 'email:tatyana@example.com', recipientId: actor.id, sender: users[0], recipient: actor },
  { id: 'req-out', connection: true, status: 'pending', direction: 'outgoing', senderId: actor.id, recipientId: 'email:maxim@example.com', sender: actor, recipient: users[2] },
];
const connections = [
  { id: 'email:anna@example.com', contactUserId: 'email:anna@example.com', status: 'connected', dialogId: 'direct_owner_anna', contact: users[1], shared: { contacts: ['x', 'y', 'z'], events: ['event-a', 'event-b'], partners: ['partner-a'] }, updatedAt: new Date(now - 3600000).toISOString() },
];
const dialogs = [
  { id: 'direct_owner_anna', type: 'direct', participants: [actor, users[1]], messageCount: 7, createdAt: new Date(now - 7200000).toISOString(), firstResponseAt: new Date(now - 5400000).toISOString(), updatedAt: new Date(now - 1800000).toISOString(), context: { title: 'Bell Pub' } },
];

const rows = buildPeopleRows({ users, connections, requests, dialogs, actor });
rows.find(row => row.displayName === 'Иван Соколов').shared = { contacts: ['anna', 'maxim', 'tatyana', 'olga', 'maria'], events: ['networking'], partners: ['bell', 'dom'] };
assert.equal(rows.length, 4, 'unified people rows include search users, friends, requests and dialogs');
assert.equal(rows.find(row => row.displayName === 'Анна Белова')?.relationStatus, 'friend', 'existing friend becomes write-ready');
assert.equal(rows.find(row => row.displayName === 'Анна Белова')?.dialogId, 'direct_owner_anna', 'friend card keeps direct dialog');
assert.equal(rows.find(row => row.displayName === 'Татьяна Гордеева')?.relationStatus, 'incoming', 'incoming request is visible in People');
assert.equal(rows.find(row => row.displayName === 'Максим Иванов')?.relationStatus, 'outgoing', 'outgoing request is preserved');

assert.equal(searchPeopleGroups({ query: 'Татьяна', people: rows })[0].rows[0].displayName, 'Татьяна Гордеева', 'search by first name works');
assert.equal(searchPeopleGroups({ query: 'Bell Pub', people: rows })[0].rows[0].displayName, 'Анна Белова', 'search by company works');
assert.equal(searchPeopleGroups({ query: 'Юрист', people: rows })[0].rows[0].displayName, 'Максим Иванов', 'search by role works');
assert.equal(peopleSuggestionReason(rows.find(row => row.displayName === 'Иван Соколов')), '5 общих друзей', 'suggestions explain why a person is relevant');
assert.equal(recentPeopleGroups(rows, now)[0].label, 'Сегодня', 'recent people are grouped by human date buckets');
assert.equal(buildPeopleSections({ people: rows, pinnedIds: ['email:anna@example.com'] }).favorites[0].displayName, 'Анна Белова', 'pinned people are promoted first');

const analytics = buildSocialAnalytics({
  users,
  connections,
  requests: [...requests, { id: 'req-ok', status: 'accepted', connection: true }, { id: 'req-no', status: 'declined', connection: true }],
  dialogs,
  analyticsRows: [{ action: 'connections:request' }],
});
assert.equal(analytics.users, 4, 'social analytics counts users');
assert.equal(analytics.friends, 1, 'social analytics counts confirmed friends');
assert.equal(analytics.requests, 4, 'social analytics counts requests');
assert.equal(analytics.messages, 7, 'social analytics counts dialog messages');
assert.equal(analytics.averageMessages, 7, 'social analytics counts average messages');
assert.equal(analytics.acceptedRequests, 1, 'social analytics counts accepted requests');
assert.equal(analytics.declinedRequests, 1, 'social analytics counts declined requests');
assert.equal(analytics.requestAcceptanceRate, 25, 'social analytics acceptance rate is rounded');

const [profile, peopleCore, userActions, actionRouter, capabilityRegistry, executionRegistry, adminPanel] = await Promise.all([
  readFile(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/social/PeopleCore.js', import.meta.url), 'utf8'),
  readFile(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/loki/core/modules/ActionRouter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/loki/core/capabilities/CapabilityRegistry.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/loki/core/execution/ExecutionRegistry.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8'),
]);

assert.match(profile, /data-people-panel/, 'profile has unified People panel');
assert.match(profile, /data-people-bottom-sheet/, 'profile opens compact people bottom sheet');
assert.match(profile, /data-people-compact-card[\s\S]*Люди рядом[\s\S]*Друзья, заявки и диалоги/, 'Profile has a compact professional People summary');
assert.match(profile, /data-people-compact-summary[\s\S]*data-people-compact-recent/, 'Compact People summary keeps metrics and important contacts');
assert.match(profile, /Карточка участника[\s\S]*peopleStatusChipStyle\(peopleSheet\.relationStatus\)[\s\S]*peopleSharedSummary\(peopleSheet\)/, 'People bottom sheet shows participant card status and shared context');
assert.match(profile, /Избранные[\s\S]*Недавние[\s\S]*Возможно, вы знакомы[\s\S]*Все пользователи/, 'People first screen has final social UX sections');
assert.match(peopleCore, /Все[\s\S]*Друзья[\s\S]*Заявки[\s\S]*Диалоги[\s\S]*Недавно[\s\S]*Онлайн[\s\S]*Партнёры[\s\S]*Эксперты/, 'profile exposes smart People tabs');
assert.match(profile, /peopleEmptyTitle[\s\S]*peopleEmptyText[\s\S]*data-people-empty-state/, 'People has action-oriented empty states');
assert.match(peopleCore, /peopleKind[\s\S]*Эксперт может быть полезен[\s\S]*Партнёр АПГ рядом/, 'People explains partner/expert recommendations');
assert.match(profile, /Кто может писать и отправлять заявки/, 'privacy settings are present in People');
assert.doesNotMatch(profile, /Dev Panel · Connections/, 'People panel does not expose connection dev fields');
assert.match(userActions, /connections:search/, 'backend exposes People search over users');
assert.match(actionRouter, /peoplePayload[\s\S]*peopleQuery/, 'Loki routes social requests to People with search payload');
assert.match(capabilityRegistry, /SEARCH_PEOPLE[\s\S]*ADD_FRIEND/, 'Capability Registry includes people search and add friend');
assert.match(executionRegistry, /profile#people/, 'Execution Registry resolves social actions to unified People');
assert.match(adminPanel, /Social Analytics/, 'admin has Social Analytics tab');
assert.match(adminPanel, /Среднее сообщений[\s\S]*Первый ответ, мин[\s\S]*Самые активные сообщества/, 'admin has v2.1 social analytics metrics');

console.log('social-platform-v2.1 regression PASS');
