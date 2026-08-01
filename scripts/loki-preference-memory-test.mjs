import assert from 'node:assert/strict';
import {
  applyLokiPreferences,
  buildExplicitPreferencePatch,
  describeLokiPreferences,
} from '../src/loki/core/memory/PreferenceMemory.js';
import { applyLokiResponsePolicy } from '../src/loki/core/response/ResponsePolicy.js';
import { createTaskSuccess } from '../src/loki/core/taskSuccess/TaskSuccess.js';

const cards = [
  { id: 'far', type: 'partner', title: 'Дальняя кофейня', text: 'Кофе', meta: ['4 км'] },
  { id: 'near', type: 'partner', title: 'Кофе рядом', text: 'Кофе', meta: ['400 м'] },
  { id: 'closed', type: 'partner', title: 'Закрытое кафе', text: 'Сейчас закрыто', meta: ['200 м'] },
];
const task = createTaskSuccess({ question: 'Хочу кофе', result: { intent: 'coffee', cards: [cards[0]] }, now: 1000 });
const farFeedback = { type: 'negative', reason: 'too_far', createdAt: new Date(2000).toISOString() };
const nearbyPreferences = buildExplicitPreferencePatch({}, farFeedback, task);
assert.equal(nearbyPreferences.preferNearby, 1);
assert.equal(applyLokiPreferences(cards.slice(0, 2), nearbyPreferences).cards[0].id, 'near');

const closedPreferences = buildExplicitPreferencePatch(nearbyPreferences, { type: 'negative', reason: 'closed' }, task);
assert.deepEqual(applyLokiPreferences(cards, closedPreferences).cards.map(card => card.id), ['near', 'far']);

const irrelevantPreferences = buildExplicitPreferencePatch({}, { type: 'negative', reason: 'irrelevant' }, task);
assert.deepEqual(irrelevantPreferences.avoidEntities, ['far']);
assert.equal(applyLokiPreferences(cards, irrelevantPreferences).cards.some(card => card.id === 'far'), false);

const result = applyLokiResponsePolicy({
  question: 'Хочу кофе',
  result: { text: 'Варианты', cards },
  userMemory: { preferences: closedPreferences },
});
assert.deepEqual(result.cards.map(card => card.id), ['near', 'far']);
assert.equal(result.responsePolicy.preferences.avoidClosed, true);
assert.ok(describeLokiPreferences(closedPreferences).some(item => item.key === 'preferNearby'));

console.log('Loki preference memory tests passed');
