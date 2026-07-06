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

export const KnowledgeExpert = {
  id: 'knowledgeExpert',
  label: 'Knowledge Expert',
  canHandle({ query }) {
    return includesAny(query, ['что нового', 'как работает', 'что такое', 'когда появ', 'истори', 'хроник', 'раздел', 'функци', 'обновлен', 'обновлён']);
  },
  handle({ query, context }) {
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
