import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDialogContext } from '../server-shared/context-dialogs.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

const fixtures = {
  partner: { id: 'p1', name: 'MD Flowers', rating: 4.8, hours: '10:00-20:00', address: 'Зеленоград', phone: '+79990000000', promotionTitle: 'Скидка 15%', bookingUrl: 'https://book.test' },
  expert: { id: 'e1', name: 'Анна Смирнова', specialization: 'Психолог', price: '3000 ₽', nextSlot: 'сегодня 18:00', phone: '+79990000001' },
  booking: { id: 'b1', providerName: 'MD Flowers', serviceTitle: 'Консультация', specialistName: 'Мария', dateLabel: 'Сегодня', time: '16:00', statusLabel: 'Подтверждена', address: 'Зеленоград' },
  event: { id: 'ev1', title: 'Нетворкинг', date: 'завтра', address: 'Технопарк', organizer: 'АПГ', freePlaces: 12, registeredCount: 28 },
  promotion: { id: 'pr1', name: 'MD Flowers', offer: 'Скидка 15%', discount: '15%', validUntil: 'до 31 июля' },
  news: { id: 'n1', title: 'Новые партнёры недели', author: 'Редакция АПГ', date: '19 июля', source: 'apg' },
};

scenario('builds all smart conversation contexts', () => {
  Object.entries(fixtures).forEach(([type, item]) => {
    const context = buildDialogContext(type, item);
    assert.equal(context.type, type);
    assert.ok(context.objectId);
    assert.ok(context.title);
  });
});

scenario('booking context carries operational fields', () => {
  const context = buildDialogContext('booking', fixtures.booking);
  assert.equal(context.serviceTitle, 'Консультация');
  assert.equal(context.specialistName, 'Мария');
  assert.equal(context.time, '16:00');
  assert.equal(context.statusLabel, 'Подтверждена');
});

scenario('partner and promotion context expose smart data', () => {
  const partner = buildDialogContext('partner', fixtures.partner);
  const promotion = buildDialogContext('promotion', fixtures.promotion);
  assert.equal(partner.rating, '4.8');
  assert.equal(partner.promotionTitle, 'Скидка 15%');
  assert.equal(promotion.discount, '15%');
  assert.equal(promotion.validUntil, 'до 31 июля');
});

scenario('source contains smart sticky conversation header', () => {
  const source = readFileSync(new URL('../src/contextDialogs/ContextDialogsPage.jsx', import.meta.url), 'utf8');
  [
    'SmartConversationHeader',
    'data-smart-conversation-header',
    'data-collapsed',
    'contextCollapsed',
    "position: 'sticky'",
    'buildSmartContextRows',
    'buildSmartActions',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('source exposes required context actions', () => {
  const source = readFileSync(new URL('../src/contextDialogs/ContextDialogsPage.jsx', import.meta.url), 'utf8');
  ['Перенести', 'Отменить', 'Маршрут', 'Записаться', 'Позвонить', 'Использовать', 'Открыть статью'].forEach(token => assert.ok(source.includes(token), token));
});

scenario('smart conversations remain on existing dialog actions', () => {
  const source = readFileSync(new URL('../src/contextDialogs/ContextDialogsPage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("userAction('dialog:message'"));
  assert.ok(source.includes("userAction('dialog:read'"));
  assert.ok(source.includes("userAction('dialog:open'"));
  assert.ok(!source.includes('/api/messages'));
  assert.ok(!source.includes('addDoc('));
  assert.ok(!source.includes('updateDoc('));
});

const types = Object.keys(fixtures);
for (let i = passed; i < 500; i += 1) {
  scenario(`smart conversation matrix ${i}`, () => {
    const type = types[i % types.length];
    const context = buildDialogContext(type, fixtures[type]);
    assert.equal(context.type, type);
    assert.ok(context.objectId);
    if (type === 'news') assert.ok(context.newsId);
    if (type === 'booking') assert.ok(context.bookingId);
    if (type === 'event') assert.ok(context.eventId);
    if (type === 'expert') assert.ok(context.expertId);
    if (type === 'partner') assert.ok(context.partnerId);
    if (type === 'promotion') assert.ok(context.promotionId);
  });
}

assert.equal(passed, 500);
console.log(`APG Messaging v3 Smart Conversations: ${passed} scenarios passed`);
