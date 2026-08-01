import assert from 'node:assert/strict';
import { chooseLokiCard, compareLokiCards } from '../src/loki/core/decision/ChoiceAssistant.js';

const cards = [
  { id: 'premium', title: 'Премиум кафе', text: 'Дорого', meta: ['★ 4.9', '3 км'] },
  { id: 'near', title: 'Кафе рядом', text: 'Скидка 10%', meta: ['★ 4.7', '300 м', '₽'] },
  { id: 'closed', title: 'Закрытое кафе', text: 'Сейчас закрыто', meta: ['★ 5', '100 м'] },
];

const comparison = compareLokiCards(cards);
assert.equal(comparison.length, 3);
assert.equal(comparison[1].distance, '300 м');
assert.equal(comparison[1].benefit, 'есть предложение');

const defaultChoice = chooseLokiCard(cards);
assert.equal(defaultChoice.card.id, 'near');
assert.match(defaultChoice.reason, /расстояние 300 м/);

const nearbyChoice = chooseLokiCard(cards, { preferNearby: 2, preferAffordable: 1 });
assert.equal(nearbyChoice.card.id, 'near');
assert.notEqual(nearbyChoice.card.id, 'closed');

console.log('Loki choice assistant tests passed');
