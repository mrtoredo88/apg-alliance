import { LOKI_APP_ACTIONS } from '../../lokiActionTypes.js';
import { normalizeText } from '../lokiCoreUtils.js';

const ACTION_OUTCOMES = {
  [LOKI_APP_ACTIONS.OPEN_PARTNER]: ['card_opened', 70],
  [LOKI_APP_ACTIONS.OPEN_EVENT]: ['event_opened', 70],
  [LOKI_APP_ACTIONS.OPEN_NEWS]: ['news_opened', 65],
  [LOKI_APP_ACTIONS.OPEN_PRIZE]: ['reward_opened', 90],
  [LOKI_APP_ACTIONS.OPEN_MAP]: ['route_started', 95],
  [LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS]: ['nearby_opened', 75],
  [LOKI_APP_ACTIONS.START_EVENT_REGISTRATION]: ['registration_started', 100],
  [LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER]: ['favorite_added', 90],
  [LOKI_APP_ACTIONS.OPEN_EXPERTS]: ['experts_opened', 60],
  [LOKI_APP_ACTIONS.OPEN_EVENTS]: ['events_opened', 60],
  [LOKI_APP_ACTIONS.OPEN_NEWS_FEED]: ['news_feed_opened', 55],
  [LOKI_APP_ACTIONS.OPEN_OFFERS]: ['offers_opened', 60],
  [LOKI_APP_ACTIONS.OPEN_PARTNERS]: ['partners_opened', 55],
};

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function tokens(value) {
  return normalizeText(value).split(/[^a-zа-я0-9]+/i).filter(word => word.length > 3);
}

function topicSimilarity(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let hits = 0;
  a.forEach(word => { if (b.has(word)) hits += 1; });
  return hits / Math.max(1, Math.min(a.size, b.size));
}

export function createTaskSuccess({ question = '', result = {}, now = Date.now() } = {}) {
  const id = `task-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const cards = Array.isArray(result.cards) ? result.cards.filter(Boolean) : result.card ? [result.card] : [];
  return {
    version: 'v1',
    id,
    question: String(question || '').trim().slice(0, 500),
    intent: result.intent || 'unknown',
    status: cards.length ? 'results_presented' : 'answered',
    outcome: cards.length ? 'results_presented' : 'answer_presented',
    score: cards.length ? 35 : 25,
    resultCount: cards.length,
    results: cards.slice(0, 6).map(card => ({
      id: String(card.id || '').slice(0, 160),
      title: String(card.title || card.name || '').slice(0, 160),
      type: String(card.type || '').slice(0, 60),
    })),
    actionType: '',
    source: 'loki_experience',
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    resolvedAt: null,
  };
}

export function markTaskAction(task, actionType, { ok = true, now = Date.now() } = {}) {
  if (!task?.id) return task || null;
  if (!ok) {
    return {
      ...task,
      status: 'action_failed',
      outcome: 'action_failed',
      score: Math.min(Number(task.score || 0), 20),
      actionType: actionType || '',
      updatedAt: nowIso(now),
    };
  }
  const [outcome, score] = ACTION_OUTCOMES[actionType] || ['action_completed', 70];
  return {
    ...task,
    status: 'succeeded',
    outcome,
    score,
    actionType: actionType || '',
    updatedAt: nowIso(now),
    resolvedAt: nowIso(now),
  };
}

export function markExternalTaskAction(task, kind, { now = Date.now() } = {}) {
  if (!task?.id) return task || null;
  const outcomes = {
    call: ['call_started', 100],
    website: ['website_opened', 75],
    booking: ['booking_opened', 90],
  };
  const [outcome, score] = outcomes[kind] || ['external_action', 70];
  return {
    ...task,
    status: 'succeeded',
    outcome,
    score,
    actionType: `external:${kind}`,
    updatedAt: nowIso(now),
    resolvedAt: nowIso(now),
  };
}

export function isTaskReformulation(task, nextQuestion, { now = Date.now(), windowMs = 5 * 60 * 1000 } = {}) {
  if (!task?.id || task.status === 'succeeded' || !nextQuestion) return false;
  const createdAt = new Date(task.createdAt || 0).getTime();
  if (!createdAt || now - createdAt > windowMs) return false;
  return topicSimilarity(task.question, nextQuestion) >= 0.5;
}

export function markTaskReformulated(task, { now = Date.now() } = {}) {
  if (!task?.id) return task || null;
  return {
    ...task,
    status: 'reformulated',
    outcome: 'query_reformulated',
    score: 10,
    updatedAt: nowIso(now),
    resolvedAt: nowIso(now),
  };
}

export function markTaskFeedback(task, value, reason = '', { now = Date.now() } = {}) {
  if (!task?.id || !['positive', 'negative'].includes(value)) return task || null;
  const positive = value === 'positive';
  return {
    ...task,
    status: positive ? 'succeeded' : 'not_helpful',
    outcome: positive ? 'positive_feedback' : 'negative_feedback',
    score: positive ? Math.max(85, Number(task.score || 0)) : 0,
    feedback: {
      value,
      reason: String(reason || '').slice(0, 80),
      createdAt: nowIso(now),
    },
    updatedAt: nowIso(now),
    resolvedAt: nowIso(now),
  };
}

export function taskSuccessMetric(task = null) {
  if (!task?.id) return { available: false, status: 'unknown', outcome: 'unknown', score: 50 };
  return {
    available: true,
    status: task.status || 'unknown',
    outcome: task.outcome || 'unknown',
    score: Math.max(0, Math.min(100, Number(task.score || 0))),
  };
}
