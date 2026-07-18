import { normalizeText } from '../lokiCoreUtils.js';
import { buildDecisionEvents } from './DecisionHistory.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function topTitle(result = {}) {
  return result.card?.title || list(result.cards)[0]?.title || result.reasoningContext?.ranked?.[0]?.title || '';
}

export function isDecisionExplainQuery(question = '') {
  const query = normalizeText(question);
  return ['почему ты это предложил', 'почему ты предложил', 'почему это предложил', 'объясни решение', 'почему такой выбор', 'почему ты выбрал'].some(item => query.includes(item));
}

export function composeDecisionExplanation({ decision = {}, result = {} } = {}) {
  const title = topTitle(result) || decision.target?.title || 'этот вариант';
  const bits = [
    decision.reason ? `я выбрал путь: ${decision.reason}` : '',
    decision.confidence ? `уверенность: ${Math.round(decision.confidence * 100)}%` : '',
    decision.trace?.engines?.length ? `учёл ${decision.trace.engines.filter(item => !['personality'].includes(item)).join(', ')}` : '',
    decision.alternatives?.length ? `альтернативы тоже были, но этот вариант выглядит сильнее по текущему контексту` : '',
  ].filter(Boolean);
  return `Я предложил «${title}», потому что ${bits.join('; ')}.`;
}

export function explainLastDecision(memory = {}) {
  const decision = memory.lastDecisionContext || memory.decisionSnapshot || null;
  if (!decision) {
    return {
      intent: 'decision.explain.empty',
      preserveText: true,
      text: 'Пока нет предыдущего решения, которое можно объяснить. Сначала спросите меня про партнёра, событие, запись или подарок.',
      card: null,
      cards: [],
    };
  }
  return {
    intent: 'decision.explain',
    preserveText: true,
    text: composeDecisionExplanation({ decision, result: decision.sourceResult || {} }),
    card: null,
    cards: [],
    decisionContext: {
      ...decision,
      explained: true,
      events: buildDecisionEvents({ ...decision, explained: true }),
    },
  };
}
