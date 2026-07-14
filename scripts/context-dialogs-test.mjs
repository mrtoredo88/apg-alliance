import assert from 'node:assert/strict';
import {
  CONTEXT_DIALOG_TYPES,
  buildContextDialogId,
  buildDialogAutoAnswer,
  buildDialogContext,
  buildDialogDeepLink,
  buildDialogNotificationBody,
  buildDialogNotificationTitle,
  normalizeDialogType,
} from '../server-shared/context-dialogs.js';
import {
  buildDialogWorkspaceHistory,
  buildWorkspaceDialogKpis,
  enrichWorkspaceDialogs,
  filterWorkspaceDialogs,
  sanitizeDialogWorkspaceNotes,
} from '../server-shared/workspace-dialogs.js';

assert.ok(CONTEXT_DIALOG_TYPES.partner);
assert.ok(CONTEXT_DIALOG_TYPES.expert);
assert.ok(CONTEXT_DIALOG_TYPES.event);
assert.ok(CONTEXT_DIALOG_TYPES.promotion);

assert.equal(normalizeDialogType('PARTNER'), 'partner');
assert.equal(normalizeDialogType('unknown'), '');

const id = buildContextDialogId('user/1', 'partner', 'coffee house');
assert.equal(id, 'user_1__partner__coffee_house');
assert.equal(buildContextDialogId('user/1', 'bad', 'x'), '');

const partnerContext = buildDialogContext('partner', {
  id: 'p1',
  name: 'Coffee Time',
  categoryLabel: 'Кофейня',
  hours: '09:00-22:00',
  address: 'Зеленоград',
  ownerUserIds: ['owner1', 'owner1'],
});
assert.equal(partnerContext.type, 'partner');
assert.equal(partnerContext.objectId, 'p1');
assert.equal(partnerContext.partnerId, 'p1');
assert.deepEqual(partnerContext.ownerUserIds, ['owner1']);
assert.equal(buildDialogDeepLink('user_1__partner__p1'), '/dialogs?dialogId=user_1__partner__p1');
assert.equal(buildDialogNotificationTitle(partnerContext), '💬 Coffee Time');
assert.equal(buildDialogNotificationBody(partnerContext, { senderRole: 'owner' }), 'Ответил на ваше сообщение.');
assert.equal(buildDialogNotificationBody(partnerContext, { messageCount: 4 }), 'У вас 4 новых сообщения');

const promoContext = buildDialogContext('promotion', {
  id: 'p1',
  name: 'Coffee Time',
  offer: 'Кофе + десерт',
});
assert.equal(promoContext.type, 'promotion');
assert.equal(promoContext.title, 'Кофе + десерт');
assert.equal(promoContext.partnerId, 'p1');
assert.equal(promoContext.promotionId, 'p1');

assert.equal(buildDialogAutoAnswer(partnerContext, 'До скольки работаете?'), 'По данным карточки: 09:00-22:00.');
assert.equal(buildDialogAutoAnswer(partnerContext, 'Как добраться?'), 'Адрес из карточки: Зеленоград.');
assert.equal(buildDialogAutoAnswer(partnerContext, 'Можно с ребенком?'), null);

assert.equal(sanitizeDialogWorkspaceNotes(`  ${'a'.repeat(4010)}  `).length, 4000);

const now = new Date('2026-07-14T10:00:00.000Z');
const workspaceDialogs = enrichWorkspaceDialogs({
  now,
  dialogs: [
    {
      id: 'user_1__partner__p1',
      dialogId: 'user_1__partner__p1',
      type: 'partner',
      objectId: 'p1',
      userId: 'user_1',
      context: partnerContext,
      lastMessage: { text: 'Нужно уточнить бронь', senderRole: 'user' },
      lastMessageAt: '2026-07-14T09:00:00.000Z',
      unreadCount: 2,
      workspacePrivate: { pinned: true, notes: 'VIP клиент' },
    },
    {
      id: 'user_2__event__e1',
      dialogId: 'user_2__event__e1',
      type: 'event',
      objectId: 'e1',
      userId: 'user_2',
      context: { type: 'event', objectId: 'e1', title: 'Нетворкинг', eventId: 'e1' },
      lastMessage: { text: 'Спасибо', senderRole: 'owner' },
      lastMessageAt: '2026-07-10T09:00:00.000Z',
      workspacePrivate: { archived: true },
    },
  ],
  messages: [
    { id: 'm1', dialogId: 'user_1__partner__p1', text: 'телефон +7999', createdAt: '2026-07-14T09:01:00.000Z' },
    { id: 'm2', dialogId: 'user_1__partner__p1', text: 'Создана встреча', senderRole: 'system', isSystem: true, createdAt: '2026-07-14T09:02:00.000Z' },
  ],
  bookings: [
    { id: 'b1', dialogId: 'user_1__partner__p1', userId: 'user_1', startAt: '2026-07-15T12:00:00.000Z', serviceTitle: 'Консультация', statusHistory: [{ text: 'Встреча подтверждена', at: '2026-07-14T09:03:00.000Z' }] },
  ],
  events: [{ id: 'e1', title: 'Нетворкинг' }],
});
assert.equal(workspaceDialogs[0].id, 'user_1__partner__p1');
assert.equal(workspaceDialogs[0].messageCount, 2);
assert.equal(workspaceDialogs[0].upcomingBooking.id, 'b1');
assert.equal(workspaceDialogs[0].awaitingReply, true);
assert.equal(workspaceDialogs[0].hasNotes, true);
assert.equal(buildWorkspaceDialogKpis(workspaceDialogs).unread, 1);
assert.equal(buildWorkspaceDialogKpis(workspaceDialogs).archived, 1);
assert.equal(filterWorkspaceDialogs(workspaceDialogs, { filter: 'unread' }).length, 1);
assert.equal(filterWorkspaceDialogs(workspaceDialogs, { filter: 'archive' }).length, 1);
assert.equal(filterWorkspaceDialogs(workspaceDialogs, { filter: 'notes', query: 'vip' }).length, 1);
assert.equal(filterWorkspaceDialogs(workspaceDialogs, { filter: 'has-bookings' }).map(item => item.id).join(','), 'user_1__partner__p1');
assert.equal(buildDialogWorkspaceHistory(workspaceDialogs[0])[0].text, 'Встреча подтверждена');
assert.deepEqual(buildDialogWorkspaceHistory(null), []);
assert.deepEqual(buildDialogWorkspaceHistory({ id: 'empty', messages: null, relatedBookings: null }), [{ id: 'empty:created', type: 'dialog_created', text: 'Создан диалог', at: undefined }]);

const damagedWorkspaceDialogs = enrichWorkspaceDialogs({
  now,
  dialogs: [
    null,
    { id: '', context: null },
    { id: 'broken-dialog', dialogId: 'broken-dialog', userId: 'user_3', context: null, workspacePrivate: null },
  ],
  messages: [
    null,
    { id: 'm3', dialogId: 'broken-dialog', text: 'Сообщение ещё грузится', createdAt: '2026-07-14T09:04:00.000Z' },
  ],
  bookings: [null],
  events: [null],
});
assert.equal(damagedWorkspaceDialogs.length, 1);
assert.equal(damagedWorkspaceDialogs[0].id, 'broken-dialog');
assert.equal(damagedWorkspaceDialogs[0].messageCount, 1);
assert.equal(filterWorkspaceDialogs([null, ...damagedWorkspaceDialogs], { filter: 'active' }).length, 1);
assert.equal(buildWorkspaceDialogKpis([null, ...damagedWorkspaceDialogs]).all, 1);
assert.deepEqual(enrichWorkspaceDialogs({ dialogs: null, messages: null, bookings: null, events: null }), []);

console.log('context-dialogs-test passed');
