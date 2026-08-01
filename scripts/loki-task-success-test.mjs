import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createTaskSuccess,
  isTaskReformulation,
  markExternalTaskAction,
  markTaskAction,
  markTaskFeedback,
  markTaskReformulated,
  taskSuccessMetric,
} from '../src/loki/core/taskSuccess/TaskSuccess.js';
import { LOKI_APP_ACTIONS } from '../src/loki/lokiActionTypes.js';

const presented = createTaskSuccess({
  question: 'Хочу вкусный кофе',
  result: { intent: 'search.partners', cards: [{ id: 'coffee', type: 'partner' }] },
  now: 1000,
});
assert.equal(presented.status, 'results_presented');
assert.equal(presented.score, 35);

const opened = markTaskAction(presented, LOKI_APP_ACTIONS.OPEN_PARTNER, { now: 2000 });
assert.equal(opened.status, 'succeeded');
assert.equal(opened.outcome, 'card_opened');
assert.equal(opened.score, 70);

const routed = markTaskAction(presented, LOKI_APP_ACTIONS.OPEN_MAP, { now: 2000 });
assert.equal(routed.outcome, 'route_started');
assert.equal(routed.score, 95);

const called = markExternalTaskAction(presented, 'call', { now: 2000 });
assert.equal(called.outcome, 'call_started');
assert.equal(called.score, 100);

assert.equal(isTaskReformulation(presented, 'А где ещё выпить кофе?', { now: 3000 }), true);
const reformulated = markTaskReformulated(presented, { now: 3000 });
assert.equal(reformulated.outcome, 'query_reformulated');
assert.equal(reformulated.score, 10);
assert.equal(isTaskReformulation(opened, 'А где ещё выпить кофе?', { now: 3000 }), false);

const liked = markTaskFeedback(presented, 'positive', '', { now: 4000 });
assert.equal(liked.outcome, 'positive_feedback');
assert.equal(liked.score, 85);
const disliked = markTaskFeedback(opened, 'negative', 'irrelevant', { now: 4000 });
assert.equal(disliked.status, 'not_helpful');
assert.equal(disliked.feedback.reason, 'irrelevant');
assert.equal(disliked.score, 0);

assert.deepEqual(taskSuccessMetric(null), { available: false, status: 'unknown', outcome: 'unknown', score: 50 });
assert.equal(taskSuccessMetric(routed).score, 95);

const providerSource = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('../src/loki/LokiExperience.jsx', import.meta.url), 'utf8');
const scorerSource = readFileSync(new URL('../src/loki/core/evaluation/EvaluationScorer.js', import.meta.url), 'utf8');
assert.match(providerSource, /persistTaskSuccess\(taskSuccess, 'results_presented'\)/);
assert.match(providerSource, /persistTaskSuccess\(markTaskAction/);
assert.match(providerSource, /query_reformulated/);
assert.match(experienceSource, /recordExternalTaskAction/);
assert.match(scorerSource, /taskSuccess \* 0\.10/);

console.log('Loki Task Success v1: presented, opened, route, call and reformulation checks passed');
