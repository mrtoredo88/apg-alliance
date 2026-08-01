import assert from 'node:assert/strict';
import { applyLokiResponsePolicy } from '../src/loki/core/response/ResponsePolicy.js';

const card = (id, type, title, text, actions = []) => ({ id, type, title, text, action: { type: `open:${id}` }, actions });
const coffee = card('coffee', 'partner', 'Кофейня 22', 'Кофе, завтраки и выпечка', [
  { label: 'Позвонить', href: 'tel:+70000000000' },
  { label: 'Открыть раздел', action: { type: 'open:coffee' } },
  { label: 'Показать маршрут', action: { type: 'map' } },
]);
const flowers = card('flowers', 'partner', 'MD flowers', 'Цветочная студия и букеты');
const news = card('news', 'news', 'Новости города', 'Главное сегодня');
const event = card('event', 'event', 'Встреча АПГ', 'Сегодня вечером');

const coffeeResult = applyLokiResponsePolicy({
  question: 'Хочу вкусный кофе',
  result: { text: 'Нашёл 4 варианта. Готово. полезных поводов стало больше.', card: coffee, cards: [coffee, flowers, news] },
});
assert.deepEqual(coffeeResult.cards.map(item => item.id), ['coffee']);
assert.equal(coffeeResult.responsePolicy.rejected, 2);
assert.match(coffeeResult.text, /один подходящий вариант/);
assert.deepEqual(coffeeResult.cards[0].actions.map(item => item.label), ['Открыть', 'Маршрут', 'Позвонить']);

const eventResult = applyLokiResponsePolicy({
  question: 'Какие мероприятия сегодня?',
  result: { text: 'Есть несколько вариантов.', cards: [event, news, flowers] },
});
assert.deepEqual(eventResult.cards.map(item => item.id), ['event']);

const newsResult = applyLokiResponsePolicy({
  question: 'Что нового?',
  result: { text: 'Свежие материалы.', cards: [news, event] },
});
assert.deepEqual(newsResult.cards.map(item => item.id), ['news']);

const emptyCoffee = applyLokiResponsePolicy({
  question: 'Где выпить кофе?',
  result: { text: 'Есть варианты.', cards: [flowers] },
});
assert.equal(emptyCoffee.cards.length, 0);
assert.match(emptyCoffee.text, /про кофе/);

const technical = applyLokiResponsePolicy({
  question: 'Помоги',
  result: { text: 'Учёл текущие данные\nПолезный ответ\nСледующее действие: открыть раздел\nЛишняя четвёртая строка', cards: [] },
});
assert.equal(technical.text, 'Полезный ответ\nЛишняя четвёртая строка');

console.log('Loki Response Policy v1: relevance, actions, counts and technical-text checks passed');
