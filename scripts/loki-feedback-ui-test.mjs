import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreFeedback } from '../src/loki/core/evolution/FeedbackEngine.js';
import { createTaskSuccess, markTaskFeedback } from '../src/loki/core/taskSuccess/TaskSuccess.js';

const task = createTaskSuccess({
  question: 'Куда сходить сегодня?',
  result: { intent: 'search.events', cards: [{ id: 'event-1', type: 'event' }] },
  now: 1000,
});
const positive = markTaskFeedback(task, 'positive', '', { now: 2000 });
const negative = markTaskFeedback(task, 'negative', 'too_far', { now: 3000 });
assert.equal(positive.score, 85);
assert.equal(negative.score, 0);
assert.equal(negative.feedback.reason, 'too_far');
assert.deepEqual(scoreFeedback([{ score: 1 }, { score: -1 }, { score: 1 }]), { total: 3, positive: 2, negative: 1, score: 33 });

const experienceSource = readFileSync(new URL('../src/loki/LokiExperience.jsx', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
assert.match(experienceSource, /Ответ Локи помог/);
assert.match(experienceSource, /Ответ Локи не помог/);
assert.match(experienceSource, /Что оказалось не так\?/);
for (const reason of ['irrelevant', 'too_far', 'closed', 'expensive', 'other']) {
  assert.ok(experienceSource.includes(reason), `Feedback UI must expose ${reason}`);
}
assert.match(providerSource, /recordTaskFeedback/);
assert.match(providerSource, /source: 'explicit_ui'/);
assert.match(providerSource, /feedbackEvents:/);

console.log('Loki Feedback UI v1: positive, negative, reasons and learning-memory checks passed');
