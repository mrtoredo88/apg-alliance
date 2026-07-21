import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPeopleRows, buildSocialAnalytics, searchPeopleGroups } from '../src/social/PeopleCore.js';

const actor = { id: 'email:owner@example.com', displayName: 'Mr. TOREDO' };
const users = [
  { id: 'email:tatyana@example.com', displayName: 'Татьяна Гордеева', company: 'АПГ', role: 'Старший администратор', city: 'Зеленоград' },
  { id: 'email:anna@example.com', displayName: 'Анна Белова', company: 'Bell Pub', role: 'Партнёр', city: 'Зеленоград' },
  { id: 'email:maxim@example.com', displayName: 'Максим Иванов', company: 'Юридический центр', role: 'Юрист', city: 'Москва' },
];
const requests = [
  { id: 'req-in', connection: true, status: 'pending', direction: 'incoming', senderId: 'email:tatyana@example.com', recipientId: actor.id, sender: users[0], recipient: actor },
  { id: 'req-out', connection: true, status: 'pending', direction: 'outgoing', senderId: actor.id, recipientId: 'email:maxim@example.com', sender: actor, recipient: users[2] },
];
const connections = [
  { id: 'email:anna@example.com', contactUserId: 'email:anna@example.com', status: 'connected', dialogId: 'direct_owner_anna', contact: users[1], shared: { contacts: ['x', 'y', 'z'], events: ['event-a', 'event-b'], partners: ['partner-a'] } },
];
const dialogs = [
  { id: 'direct_owner_anna', type: 'direct', participants: [actor, users[1]], messageCount: 7 },
];

const rows = buildPeopleRows({ users, connections, requests, dialogs, actor });
assert.equal(rows.length, 3, 'unified people rows include search users, friends, requests and dialogs');
assert.equal(rows.find(row => row.displayName === 'Анна Белова')?.relationStatus, 'friend', 'existing friend becomes write-ready');
assert.equal(rows.find(row => row.displayName === 'Анна Белова')?.dialogId, 'direct_owner_anna', 'friend card keeps direct dialog');
assert.equal(rows.find(row => row.displayName === 'Татьяна Гордеева')?.relationStatus, 'incoming', 'incoming request is visible in People');
assert.equal(rows.find(row => row.displayName === 'Максим Иванов')?.relationStatus, 'outgoing', 'outgoing request is preserved');

assert.equal(searchPeopleGroups({ query: 'Татьяна', people: rows })[0].rows[0].displayName, 'Татьяна Гордеева', 'search by first name works');
assert.equal(searchPeopleGroups({ query: 'Bell Pub', people: rows })[0].rows[0].displayName, 'Анна Белова', 'search by company works');
assert.equal(searchPeopleGroups({ query: 'Юрист', people: rows })[0].rows[0].displayName, 'Максим Иванов', 'search by role works');

const analytics = buildSocialAnalytics({
  users,
  connections,
  requests: [...requests, { id: 'req-ok', status: 'accepted', connection: true }],
  dialogs,
  analyticsRows: [{ action: 'connections:request' }],
});
assert.equal(analytics.users, 3, 'social analytics counts users');
assert.equal(analytics.friends, 1, 'social analytics counts confirmed friends');
assert.equal(analytics.requests, 3, 'social analytics counts requests');
assert.equal(analytics.messages, 7, 'social analytics counts dialog messages');
assert.equal(analytics.requestAcceptanceRate, 33, 'social analytics acceptance rate is rounded');

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
assert.match(peopleCore, /Все[\s\S]*Друзья[\s\S]*Заявки[\s\S]*Диалоги/, 'profile exposes required People tabs');
assert.match(profile, /Кто может писать и отправлять заявки/, 'privacy settings are present in People');
assert.doesNotMatch(profile, /Dev Panel · Connections/, 'People panel does not expose connection dev fields');
assert.match(userActions, /connections:search/, 'backend exposes People search over users');
assert.match(actionRouter, /OPEN_PEOPLE/, 'Loki routes social requests to People');
assert.match(capabilityRegistry, /SEARCH_PEOPLE[\s\S]*ADD_FRIEND/, 'Capability Registry includes people search and add friend');
assert.match(executionRegistry, /profile#people/, 'Execution Registry resolves social actions to unified People');
assert.match(adminPanel, /Social Analytics/, 'admin has Social Analytics tab');

console.log('social-platform-v2 regression PASS');
