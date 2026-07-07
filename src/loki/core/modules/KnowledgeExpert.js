import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { findKnowledgeItems, getLatestChronicles } from '../../knowledge/index.js';
import { includesAny } from '../lokiCoreUtils.js';

function makeKnowledgeCard(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    text: item.purpose || item.description || 'Раздел Хроник АПГ.',
    image: '',
    action: item.type === 'screen' ? createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS) : createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE),
    label: 'Понятно',
  };
}

function scoreCustomKnowledge(query, item) {
  const haystack = [
    item.title,
    item.question,
    item.answer,
    item.type,
    item.tags?.join?.(' '),
  ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е');
  if (!haystack) return 0;
  if (haystack.includes(query)) return 12;
  return query.split(/\s+/)
    .filter(word => word.length > 2)
    .reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
}

function findCustomKnowledge(query, context) {
  return (context.knowledge?.custom ?? [])
    .filter(item => item.active !== false)
    .map(item => ({ item, score: scoreCustomKnowledge(query, item) + Number(item.priority || 0) / 10 }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(row => row.item);
}

export const KnowledgeExpert = {
  id: 'knowledgeExpert',
  label: 'Knowledge Expert',
  canHandle({ query, context }) {
    return includesAny(query, ['что нового', 'как работает', 'что такое', 'когда появ', 'истори', 'хроник', 'раздел', 'функци', 'обновлен', 'обновлён'])
      || findCustomKnowledge(query, context).length > 0;
  },
  handle({ query, context }) {
    const customMatches = findCustomKnowledge(query, context);
    if (customMatches.length) {
      const cards = customMatches.map(item => ({
        id: item.id,
        type: item.type || 'knowledge',
        title: item.title,
        text: item.answer,
        image: '',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_REFERENCE),
        label: 'Справочник',
      }));
      return {
        intent: 'knowledge.custom',
        text: customMatches[0].answer || `Нашёл ответ в базе знаний Локи: «${customMatches[0].title}».`,
        card: cards[0],
        cards,
      };
    }
    if (includesAny(query, ['что нового', 'обновлен', 'обновлён', 'истори', 'хроник', 'когда появ'])) {
      const chapters = getLatestChronicles(3, context.knowledge);
      if (!chapters.length) return { intent: 'knowledge.empty', text: 'В Хрониках АПГ пока нет записей об обновлениях.', card: null, cards: [] };
      return {
        intent: 'knowledge.chronicles',
        text: `Последняя глава Хроник: «${chapters[0].title}». Я храню историю обновлений АПГ, чтобы помнить, как развивался проект.`,
        card: {
          id: chapters[0].version,
          title: chapters[0].title,
          text: chapters[0].changes?.[0] || chapters[0].date,
          action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS),
          label: 'Открыть ленту',
        },
        cards: chapters.map(chapter => ({
          id: chapter.version,
          type: 'chronicle',
          title: chapter.title,
          text: chapter.changes?.[0] || chapter.date,
          image: '',
          action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS),
          label: 'К ленте',
        })),
      };
    }
    const matches = findKnowledgeItems(query, context.knowledge);
    if (!matches.length) return { intent: 'knowledge.unknown', text: 'В Хрониках АПГ пока нет такой записи.', card: null, cards: [] };
    const cards = matches.map(makeKnowledgeCard);
    return {
      intent: 'knowledge.items',
      text: `Нашёл в Хрониках АПГ: «${matches[0].title}».`,
      card: cards[0],
      cards,
    };
  },
};
