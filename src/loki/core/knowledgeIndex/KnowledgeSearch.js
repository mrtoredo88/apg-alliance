import { normalizeText } from '../lokiCoreUtils.js';
import { expandKnowledgeRelations } from './KnowledgeRelations.js';

const SYNONYMS = {
  массаж: ['спа', 'релакс', 'тело', 'оздоровление'],
  еда: ['кафе', 'ресторан', 'обед', 'ужин'],
  ребёнок: ['дети', 'семья', 'семейный'],
  запись: ['бронь', 'встреча', 'приём', 'booking'],
  акция: ['скидка', 'предложение', 'промо', 'бонус'],
  подарок: ['приз', 'награда', 'reward'],
  мероприятие: ['событие', 'афиша', 'встреча'],
  эксперт: ['специалист', 'мастер', 'консультант'],
  партнёр: ['организация', 'место', 'бизнес'],
};

function words(value) {
  return normalizeText(value).split(/\s+/).filter(word => word.length > 2);
}

function expandQueryWords(query) {
  const base = words(query);
  const extra = base.flatMap(word => SYNONYMS[word] || []);
  return [...new Set([...base, ...extra.map(normalizeText)])].filter(Boolean);
}

export function searchKnowledgeIndex(index = {}, query = '', options = {}) {
  const q = normalizeText(query);
  const queryWords = expandQueryWords(query);
  const allowedTypes = new Set((options.types || []).filter(Boolean));
  const rows = (index.entities || [])
    .filter(entity => !allowedTypes.size || allowedTypes.has(entity.type))
    .map(entity => {
      const title = normalizeText(entity.title);
      const aliases = normalizeText(entity.aliases?.join(' '));
      const categories = normalizeText(entity.categories?.join(' '));
      const keywords = normalizeText(entity.keywords?.join(' '));
      const direct = q && (title === q || aliases.split(/\s+/).includes(q)) ? 30 : 0;
      const partial = q && (title.includes(q) || aliases.includes(q) || entity.searchText.includes(q)) ? 12 : 0;
      const category = queryWords.reduce((sum, word) => sum + (categories.includes(word) ? 4 : 0), 0);
      const keyword = queryWords.reduce((sum, word) => sum + (keywords.includes(word) ? 3 : 0), 0);
      const text = queryWords.reduce((sum, word) => sum + (entity.searchText.includes(word) ? 1.5 : 0), 0);
      return { entity, score: direct + partial + category + keyword + text };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entity.title.localeCompare(b.entity.title, 'ru'))
    .slice(0, options.limit || 12);
  const expandedEntities = expandKnowledgeRelations(index, rows.map(row => row.entity), options.depth ?? 1);
  return {
    query,
    entities: rows.map(row => ({ ...row.entity, score: Math.round(row.score * 10) / 10 })),
    expandedContext: expandedEntities,
    usedSynonyms: queryWords.filter(word => !words(query).includes(word)),
  };
}
