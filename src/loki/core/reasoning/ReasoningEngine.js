import { normalizeText } from '../lokiCoreUtils.js';
import { makeKnowledgeResultCard, searchKnowledge } from '../knowledge/KnowledgeProvider.js';
import { composeExplanation, composeReasonedAnswer } from './AnswerComposer.js';
import { calculateConfidence } from './ConfidenceCalculator.js';
import { makeReasoningMemory, resolveReasoningContext } from './ContextResolver.js';
import { explainRanking, rankCandidates } from './RankingEngine.js';
import { buildSuggestions } from './SuggestionEngine.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isExplanationQuery(query = '') {
  const text = normalizeText(query);
  return ['почему именно', 'почему этот', 'почему выбрал', 'почему она', 'почему он'].some(item => text.includes(item));
}

function fuzzyRows({ knowledge, query = '', types = [] } = {}) {
  const words = normalizeText(query).split(/\s+/).filter(word => word.length > 4);
  if (!words.length) return [];
  const stems = words.map(word => word.slice(0, 5));
  const allowed = new Set(types.filter(Boolean));
  return list(knowledge.searchIndex)
    .filter(row => !allowed.size || allowed.has(row.type))
    .map(row => {
      const haystack = normalizeText(`${row.title || ''} ${row.searchText || ''}`);
      const score = stems.reduce((sum, stem) => sum + (haystack.includes(stem) ? 1.2 : 0), 0);
      return { ...row, score };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

function candidateRows({ knowledge, intent, reasoningContext }) {
  if (reasoningContext.followUp && reasoningContext.items.length) {
    return reasoningContext.items.map(item => ({ ...item, score: item.score || 5 }));
  }
  const found = searchKnowledge(knowledge, intent.query, intent.types, 24);
  if (found.length) return found;
  const fuzzyFound = fuzzyRows({ knowledge, query: intent.query, types: intent.types });
  if (fuzzyFound.length) return fuzzyFound;
  if (!intent.types?.length) return [];
  const sourceKey = {
    partner: 'partners',
    expert: 'experts',
    event: 'events',
    news: 'news',
    location: 'locations',
    promotion: 'promotions',
    gift: 'gifts',
  };
  return intent.types.flatMap(type => list(knowledge.sources?.[sourceKey[type]]).map(item => ({ id: item.id, type, title: item.title, score: 1, item })));
}

export function runReasoningEngine({ question = '', intent = {}, knowledge = {}, context = {} } = {}) {
  const reasoningContext = resolveReasoningContext({ query: question, intent, context, knowledge });
  if (isExplanationQuery(question)) {
    const explained = composeExplanation({ memoryContext: context?.memory?.lastReasoningContext });
    if (explained) return { ...explained, reasoningHandled: true };
  }
  const rows = candidateRows({ knowledge, intent, reasoningContext });
  if (!rows.length) return null;
  const ranked = rankCandidates({ candidates: rows, knowledge, context, query: question })
    .map(item => ({ ...item, card: makeKnowledgeResultCard(item, item.type) }));
  const explanation = explainRanking(ranked);
  const confidence = calculateConfidence({ ranked, intent, reasoningContext });
  const suggestions = buildSuggestions({ top: ranked[0], ranked, intent });
  const memory = makeReasoningMemory({ intent, ranked, explanation, confidence, source: reasoningContext.source, followUp: reasoningContext.followUp });
  const composed = composeReasonedAnswer({ intent, ranked, confidence, suggestions, explanation, totalFound: rows.length });
  const cards = composed.cards?.length ? composed.cards : ranked.slice(0, 5).map(item => item.card).filter(Boolean);
  return {
    intent: `reasoning.${intent.id || 'search'}`,
    preserveText: true,
    text: composed.text,
    card: composed.card || cards[0] || null,
    cards,
    confidence,
    suggestions,
    explanation,
    reasoningContext: memory,
    ranked: ranked.map(item => ({ id: item.id, type: item.type, title: item.title, score: item.score, reasons: list(item.reasons).map(row => row.label) })),
  };
}
