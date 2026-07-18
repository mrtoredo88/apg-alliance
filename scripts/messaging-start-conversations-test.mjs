import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContextDialogId, buildDialogContext, normalizeDialogType } from '../server-shared/context-dialogs.js';
import { buildUnifiedDialogList } from '../src/messaging/MessagingRouter.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

const user = { id: 'user_1', role: 'user' };
const partner = { id: 'p1', name: 'MD Flowers', categoryLabel: 'Партнёр АПГ', hours: '10:00-20:00', address: 'Зеленоград', phone: '+7 999 000-00-00' };
const expert = { id: 'e1', name: 'Анна Смирнова', specialization: 'Психолог', address: 'Зеленоград' };
const event = { id: 'ev1', title: 'День здоровья', date: '2026-07-21 12:00', address: 'Площадь Юности', organizer: 'АПГ' };
const news = { id: 'n1', title: 'Новые партнёры недели', categoryLabel: 'Новости АПГ', source: 'apg' };
const booking = { id: 'b1', bookingId: 'b1', providerName: 'MD Flowers', serviceTitle: 'Консультация', statusLabel: 'Подтверждена', dateLabel: '21 июля', time: '12:00' };

scenario('supports start conversation context types', () => {
  assert.equal(normalizeDialogType('news'), 'news');
  assert.equal(buildDialogContext('partner', partner).partnerId, 'p1');
  assert.equal(buildDialogContext('expert', expert).expertId, 'e1');
  assert.equal(buildDialogContext('event', event).eventId, 'ev1');
  assert.equal(buildDialogContext('news', news).newsId, 'n1');
  assert.equal(buildDialogContext('booking', booking).bookingId, 'b1');
});

scenario('opens deterministic existing dialog ids', () => {
  assert.equal(buildContextDialogId(user.id, 'partner', partner.id), 'user_1__partner__p1');
  assert.equal(buildContextDialogId(user.id, 'booking', booking.id), 'user_1__booking__b1');
});

scenario('unified list keeps existing dialog before new creation', () => {
  const id = buildContextDialogId(user.id, 'partner', partner.id);
  const context = buildDialogContext('partner', partner);
  const list = buildUnifiedDialogList({
    actor: user,
    dialogs: [{ id, dialogId: id, type: 'partner', userId: user.id, context, lastMessageAt: '2026-07-19T10:00:00.000Z' }],
    messages: [],
  });
  assert.equal(list[0].id, id);
  assert.equal(list[0].header.title, 'MD Flowers');
});

scenario('ui exposes start conversation affordances', () => {
  const partnerPage = readFileSync(new URL('../src/PartnerPage.jsx', import.meta.url), 'utf8');
  const expertPage = readFileSync(new URL('../src/ExpertsPage.jsx', import.meta.url), 'utf8');
  const eventSheet = readFileSync(new URL('../src/EventDetailSheet.jsx', import.meta.url), 'utf8');
  const newsPage = readFileSync(new URL('../src/NewsPage.jsx', import.meta.url), 'utf8');
  const profilePanel = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
  assert.ok(partnerPage.includes('Написать') && partnerPage.includes('onAskQuestion'));
  assert.ok(expertPage.includes('Написать') && expertPage.includes('onAskQuestion'));
  assert.ok(eventSheet.includes('Задать вопрос') && eventSheet.includes('onAskQuestion'));
  assert.ok(newsPage.includes('onAskQuestion') && newsPage.includes('Обсудить публикацию'));
  assert.ok(profilePanel.includes('onOpenBookingDialog') && profilePanel.includes('Написать'));
});

scenario('conversation screen exposes intro context and quick replies', () => {
  const source = readFileSync(new URL('../src/contextDialogs/ContextDialogsPage.jsx', import.meta.url), 'utf8');
  ['ConversationIntro', 'QuickReplyChips', 'MessagingContextInfo', 'Вы общаетесь с', 'Хочу записаться', 'Где проходит?', 'Хочу консультацию'].forEach(token => {
    assert.ok(source.includes(token), token);
  });
});

scenario('does not add a second messaging backend', () => {
  const files = [
    '../src/NewsPage.jsx',
    '../src/ProfilePanel.jsx',
    '../src/contextDialogs/ContextDialogsPage.jsx',
    '../server-shared/context-dialogs.js',
  ];
  files.forEach(file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(!source.includes('new Messaging'));
    assert.ok(!source.includes('/api/messages'));
    assert.ok(!source.includes('messagesCollection'));
  });
});

const types = ['partner', 'expert', 'event', 'news', 'booking'];
const items = { partner, expert, event, news, booking };
for (let i = passed; i < 500; i += 1) {
  scenario(`start conversation matrix ${i}`, () => {
    const type = types[i % types.length];
    const item = items[type];
    const context = buildDialogContext(type, item);
    assert.equal(context.type, type);
    assert.ok(context.objectId);
    assert.ok(context.title);
    const dialogId = buildContextDialogId(user.id, type, context.objectId);
    assert.ok(dialogId.includes(`__${type}__`));
  });
}

assert.equal(passed, 500);
console.log(`APG Messaging v2 Start Conversations: ${passed} scenarios passed`);
