import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMessagingSnapshot } from '../src/messaging/MessagingSnapshot.js';
import { buildNotificationCenter, notificationActionLabel, notificationPriority } from '../src/notifications/NotificationCenter.js';
import { PEOPLE_RELATION_STATUS, buildPeoplePulse } from '../src/social/PeopleCore.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const people = [
  { id: 'incoming', displayName: 'Анна', relationStatus: PEOPLE_RELATION_STATUS.INCOMING },
  { id: 'friend', displayName: 'Максим', relationStatus: PEOPLE_RELATION_STATUS.FRIEND, dialogId: 'direct_friend' },
  { id: 'online', displayName: 'Ольга', onlineStatus: 'online', relationStatus: PEOPLE_RELATION_STATUS.STRANGER },
  { id: 'expert', displayName: 'Ирина', role: 'Эксперт', relationStatus: PEOPLE_RELATION_STATUS.STRANGER },
];
const pulse = buildPeoplePulse({ people, pinnedIds: ['friend'] });
assert.equal(pulse.incomingCount, 1, 'People pulse counts incoming requests');
assert.equal(pulse.priority[0].pulseAction, 'accept', 'People pulse promotes incoming request first');
assert.match(pulse.healthLabel, /друз/, 'People pulse explains network health');

const dialogs = [
  { id: 'd1', type: 'direct', participantIds: ['owner', 'anna'], unreadCount: 2, context: { type: 'direct', title: 'Анна' }, updatedAt: new Date().toISOString() },
  { id: 'd2', type: 'booking', participantIds: ['owner', 'partner'], context: { type: 'booking', title: 'Запись' }, workspaceState: { pinned: true }, updatedAt: new Date(Date.now() - 1000).toISOString() },
  { id: 'd3', type: 'event', participantIds: ['owner', 'event'], workspaceState: { archived: true }, context: { type: 'event', title: 'Встреча' }, updatedAt: new Date(Date.now() - 2000).toISOString() },
];
const snapshot = buildMessagingSnapshot({ dialogs, actor: { id: 'owner' } });
assert.equal(snapshot.unread, 2, 'Messaging snapshot keeps unread count');
assert.equal(snapshot.pinned, 1, 'Messaging snapshot counts pinned dialogs');
assert.equal(snapshot.archive, 1, 'Messaging snapshot counts archived dialogs separately');
assert.equal(snapshot.priority[0].reason, 'Есть непрочитанные', 'Messaging priority promotes unread dialogs');
assert.equal(snapshot.nextBestAction, 'Ответить на новые сообщения', 'Messaging snapshot gives next best action');

const notifications = [
  { id: 'n1', type: 'contextDialogMessage', title: 'Новое сообщение', dialogId: 'd1', createdAt: new Date().toISOString() },
  { id: 'n2', category: 'offers', title: 'Акция', deepLink: '#offers', createdAt: new Date(Date.now() - 1000).toISOString() },
  { id: 'n3', category: 'news', title: 'Новость', createdAt: new Date(Date.now() - 2000).toISOString() },
];
const center = buildNotificationCenter({ notifications, isUnread: item => item.id === 'n1' });
assert.equal(notificationPriority(notifications[0]), 'high', 'message notifications are high priority');
assert.equal(notificationActionLabel(notifications[0]), 'Открыть чат', 'message notifications open chat');
assert.equal(center.unread, 1, 'Notification center counts unread items');
assert.equal(center.urgent[0].id, 'n1', 'Notification center promotes urgent notifications');
assert.equal(center.actionable[0].id, 'n2', 'Notification center separates actionable updates');

const profile = read('src/ProfilePanel.jsx');
const messaging = read('src/contextDialogs/ContextDialogsPage.jsx');
const notificationsPage = read('src/NotificationsPage.jsx');
const notificationCore = read('src/notifications/NotificationCenter.js');
const pkg = JSON.parse(read('package.json'));

assert.match(profile, /data-people-pulse[\s\S]*Пульс сети[\s\S]*data-people-priority-strip/, 'Profile People panel has social pulse');
const peoplePulseBlock = profile.match(/<div data-people-pulse[\s\S]*?\{connectionLoading &&/)?.[0] || '';
assert.doesNotMatch(peoplePulseBlock, /<GlassButton[\s\S]*?(Написать|Открыть|Принять)/, 'People pulse cards do not duplicate action buttons');
const peopleCardSource = profile.match(/data-people-card style[\s\S]*?person\.phone &&/)?.[0] || '';
assert.doesNotMatch(peopleCardSource, />Профиль</, 'compact People cards use card click instead of duplicate Profile button');
assert.match(profile, /visiblePeopleRows\.length > 0 && \([\s\S]*data-my-contacts-button/, 'People footer actions are hidden when empty state already shows the same buttons');
assert.match(messaging, /data-messaging-priority-inbox[\s\S]*Важное сейчас[\s\S]*messagingSnapshot\.nextBestAction/, 'Messaging has priority inbox');
assert.match(notificationsPage, /data-notification-priority-inbox[\s\S]*Priority Inbox/, 'Notifications page has priority inbox');
assert.match(notificationsPage, /'urgent', 'Важное'[\s\S]*'actionable', 'Действия'/, 'Notifications page has priority filters');
assert.match(notificationCore, /buildNotificationCenter[\s\S]*nextBestAction/, 'Notification core exposes smart notification center');
assert.equal(pkg.scripts['test:people-messaging-notifications'], 'node scripts/people-messaging-notifications-test.mjs');

console.log('people + messaging + notifications smart layer PASS');
