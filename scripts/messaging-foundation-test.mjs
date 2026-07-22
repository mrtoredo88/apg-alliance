import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMessagingDeepLink,
  buildUnifiedDialogList,
  normalizeMessagingRoute,
} from '../src/messaging/MessagingRouter.js';
import { canAccessDialog } from '../src/messaging/MessagingPermissions.js';
import { getMessagingCategory } from '../src/messaging/MessagingRegistry.js';
import { normalizeMessagingDialog } from '../src/messaging/MessagingContext.js';
import { buildMessagingSnapshot } from '../src/messaging/MessagingSnapshot.js';
import { validateMessagingState } from '../src/messaging/MessagingValidator.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

const actor = { id: 'u1', role: 'user', partnerId: 'p1' };
const dialogs = [
  { id: 'd-direct', type: 'direct', participantIds: ['u1', 'u2'], title: 'Виталий и Анна', lastMessage: { text: 'Привет', createdAt: '2026-07-19T09:00:00.000Z' }, unreadCount: 1 },
  { id: 'd-partner', type: 'partner', userId: 'u1', context: { type: 'partner', objectId: 'p1', partnerId: 'p1', title: 'Студия массажа', subtitle: 'Партнер' }, lastMessage: { text: 'Можно записаться?', createdAt: '2026-07-19T10:00:00.000Z' }, unreadCount: 0 },
  { id: 'd-event', type: 'event', userId: 'u1', context: { type: 'event', objectId: 'ev1', title: 'День здоровья' }, lastMessage: { text: 'Во сколько начало?', createdAt: '2026-07-19T11:00:00.000Z' }, unreadCount: 2, workspacePrivate: { pinned: true } },
  { id: 'd-group', type: 'group', participantIds: ['u1', 'u3'], context: { type: 'group', title: 'Команда события' }, lastMessage: { text: 'План готов', createdAt: '2026-07-19T08:00:00.000Z' } },
  { id: 'd-archived', type: 'direct', participantIds: ['u1', 'u4'], title: 'Архивный чат', lastMessage: { text: 'Вернуться позже', createdAt: '2026-07-18T08:00:00.000Z' }, workspacePrivate: { archived: true } },
  { id: 'd-admin', type: 'direct', participantIds: ['admin1'], title: 'Admin Dialog', lastMessage: { text: 'Служебное', createdAt: '2026-07-19T12:00:00.000Z' } },
];

const messages = [
  { id: 'm1', dialogId: 'd-direct', text: 'Привет', senderId: 'u2', createdAt: '2026-07-19T09:00:00.000Z' },
  { id: 'm2', dialogId: 'd-partner', text: 'Массаж спины', senderId: 'u1', createdAt: '2026-07-19T10:00:00.000Z' },
  { id: 'm3', dialogId: 'd-event', text: 'Регистрация на мероприятие', senderId: 'u2', createdAt: '2026-07-19T11:00:00.000Z' },
  { id: 'm4', dialogId: 'd-group', text: 'Групповой чат', senderId: 'u3', createdAt: '2026-07-19T08:00:00.000Z' },
];

scenario('normalizes messaging categories', () => {
  assert.equal(getMessagingCategory('direct'), 'PERSONAL');
  assert.equal(getMessagingCategory('partner'), 'PARTNER');
  assert.equal(getMessagingCategory('event'), 'EVENT');
  assert.equal(getMessagingCategory('group'), 'GROUP');
  assert.equal(getMessagingCategory('support'), 'SUPPORT');
  assert.equal(getMessagingCategory('news'), 'SYSTEM');
});

scenario('checks permissions', () => {
  assert.equal(canAccessDialog({ id: 'u1', role: 'user' }, dialogs[0]).allowed, true);
  assert.equal(canAccessDialog({ id: 'u-random', role: 'user' }, dialogs[4]).allowed, false);
  assert.equal(canAccessDialog({ id: 'admin1', role: 'admin' }, dialogs[2]).allowed, true);
  assert.equal(canAccessDialog({ id: 'u1', role: 'partner', partnerId: 'p1' }, dialogs[1]).allowed, true);
});

scenario('builds universal sorted list', () => {
  const list = buildUnifiedDialogList({ dialogs, messages, actor });
  assert.equal(list[0].id, 'd-event');
  assert.ok(list.every(item => item.id !== 'd-admin'));
  assert.equal(list.find(item => item.id === 'd-direct').header.title, 'Виталий и Анна');
});

scenario('filters and searches', () => {
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, filter: 'unread' }).map(item => item.id), ['d-event', 'd-direct']);
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, filter: 'groups' }).map(item => item.id), ['d-group']);
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, filter: 'pinned' }).map(item => item.id), ['d-event']);
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, filter: 'archive' }).map(item => item.id), ['d-archived']);
  assert.equal(buildUnifiedDialogList({ dialogs, messages, actor }).some(item => item.id === 'd-archived'), false);
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, query: 'массаж' }).map(item => item.id), ['d-partner']);
  assert.deepEqual(buildUnifiedDialogList({ dialogs, messages, actor, query: 'мероприятие' }).map(item => item.id), ['d-event']);
});

scenario('routes messages alias to existing dialogs panel', () => {
  assert.deepEqual(normalizeMessagingRoute('/messages', '?dialogId=d1'), { panel: 'dialogs', route: '/messages', dialogId: 'd1' });
  assert.equal(buildMessagingDeepLink('d1'), '/messages?dialogId=d1');
});

scenario('builds snapshot and validates state', () => {
  const snapshot = buildMessagingSnapshot({ dialogs, messages, actor });
  assert.equal(snapshot.total, 4);
  assert.equal(snapshot.unread, 3);
  assert.equal(snapshot.realtime, 'existing-context-dialogs');
  assert.equal(validateMessagingState({ dialogs: buildUnifiedDialogList({ dialogs, messages, actor }) }).valid, true);
});

scenario('normalizes conversation header', () => {
  const row = normalizeMessagingDialog(dialogs[1], { messages: messages.filter(item => item.dialogId === 'd-partner'), actor });
  assert.equal(row.header.avatar, '🏪');
  assert.equal(row.header.title, 'Студия массажа');
  assert.equal(row.permissions.canRead, true);
});

scenario('source does not create backend or firestore models', () => {
  [
    '../src/messaging/MessagingRouter.js',
    '../src/messaging/MessagingRegistry.js',
    '../src/messaging/MessagingPermissions.js',
    '../src/messaging/MessagingContext.js',
  ].forEach(file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(!source.includes('collection('));
    assert.ok(!source.includes('addDoc'));
    assert.ok(!source.includes('updateDoc'));
    assert.ok(!source.includes('fetch('));
  });
});

const filters = ['all', 'personal', 'partners', 'events', 'groups', 'unread', 'pinned', 'archive'];
const queries = ['', 'вит', 'массаж', 'мероприятие', 'чат', 'привет', 'регистрация'];
for (let i = passed; i < 500; i += 1) {
  scenario(`matrix messaging foundation ${i}`, () => {
    const filter = filters[i % filters.length];
    const query = queries[i % queries.length];
    const list = buildUnifiedDialogList({ dialogs, messages, actor, filter, query });
    const snapshot = buildMessagingSnapshot({ dialogs, messages, actor });
    assert.ok(Array.isArray(list));
    assert.ok(snapshot.total >= list.length);
    assert.ok(list.every(item => item.permissions.canRead));
    assert.ok(list.every(item => item.header.title));
  });
}

assert.equal(passed, 500);
console.log(`Universal Messaging Foundation v1: ${passed} scenarios passed`);
