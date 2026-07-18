import { searchKnowledgeIndex } from './KnowledgeSearch.js';

export function isKnowledgeIndexExplainQuery(question = '') {
  const text = String(question || '').toLowerCase();
  return text.includes('из каких сущностей') || text.includes('какие связи') || text.includes('почему найден') || text.includes('knowledge index');
}

export function explainKnowledgeIndex(index = {}, query = '') {
  const search = searchKnowledgeIndex(index, query, { limit: 5, depth: 1 });
  const first = search.entities[0];
  const relations = first ? index.relations.filter(row => row.from === first.key || row.to === first.key).slice(0, 6) : [];
  return {
    intent: 'knowledgeIndex.explain',
    preserveText: true,
    text: first
      ? `Ответ собран из индекса АПГ: главный результат «${first.title}» (${first.type}). Использованы совпадения по названию, категориям, ключевым словам и ${relations.length} связям.`
      : 'В последнем Knowledge Index нет подходящего результата для объяснения.',
    cards: [],
    knowledgeIndexSearch: search,
  };
}

export function explainLastKnowledgeIndex(memory = {}) {
  const snapshot = memory.lastKnowledgeSnapshot || {};
  const search = memory.lastKnowledgeIndexSearch || {};
  const first = search.entities?.[0];
  return {
    intent: 'knowledgeIndex.explain',
    preserveText: true,
    text: first
      ? `Последний поиск Knowledge Index нашёл «${first.title}» (${first.type}) по запросу «${search.query || 'без запроса'}». Индекс содержит ${snapshot.Entities || 0} сущностей и ${snapshot.Relations || 0} связей.`
      : `Последний Knowledge Index содержит ${snapshot.Entities || 0} сущностей и ${snapshot.Relations || 0} связей. Последнего поискового результата пока нет.`,
    cards: [],
    knowledgeSnapshot: snapshot,
    knowledgeIndexSearch: search,
  };
}
