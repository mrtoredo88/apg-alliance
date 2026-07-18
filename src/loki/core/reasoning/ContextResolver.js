import { normalizeText } from '../lokiCoreUtils.js';

const FOLLOW_UP_WORDS = ['какая', 'какой', 'какие', 'где', 'а где', 'а какая', 'почему', 'до 22', 'парковк', 'маршрут', 'запис', 'отзывы', 'акци', 'ещё', 'еще'];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isFollowUp(query) {
  const text = normalizeText(query);
  return FOLLOW_UP_WORDS.some(word => text.includes(word)) && !text.includes('покажи все');
}

export function resolveReasoningContext({ query = '', intent = {}, context = {}, knowledge = {} } = {}) {
  const memoryContext = context?.memory?.lastReasoningContext || context?.memory?.reasoningContext || null;
  const screenContext = knowledge?.screenContext || null;
  const followUp = Boolean(memoryContext?.items?.length && isFollowUp(query));
  const types = followUp && memoryContext.types?.length ? memoryContext.types : intent.types || [];
  const items = followUp ? list(memoryContext.items) : [];
  return {
    followUp,
    previousIntent: memoryContext?.intent || '',
    query,
    intent,
    types,
    items,
    screenContext,
    source: followUp ? 'memory' : screenContext?.type ? 'screen' : 'intent',
  };
}

export function makeReasoningMemory({ intent = {}, ranked = [], explanation = [], confidence = {}, source = 'intent', followUp = false } = {}) {
  return {
    intent: intent.id || '',
    types: intent.types || [],
    source,
    followUp,
    items: ranked.slice(0, 5).map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      score: row.score,
      reasons: row.reasons,
      confidence: row.confidence,
    })),
    explanation: explanation.slice(0, 5),
    confidence: confidence.value || 0,
    updatedAt: new Date().toISOString(),
  };
}
