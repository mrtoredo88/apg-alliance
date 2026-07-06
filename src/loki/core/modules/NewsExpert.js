import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard, titleOf, toMillis } from '../lokiCoreUtils.js';

function freshNews(news = []) {
  return news
    .map(item => ({ ...item, lokiMs: toMillis(item.createdAt ?? item.date) }))
    .sort((a, b) => b.lokiMs - a.lokiMs)
    .slice(0, 3);
}

export const NewsExpert = {
  id: 'newsExpert',
  label: 'News Expert',
  canHandle({ query }) {
    return includesAny(query, ['ново', 'новост', 'что нового', 'город']);
  },
  handle({ context }) {
    const news = freshNews(context.apg.news);
    if (!news.length) return { intent: 'news.empty', text: 'В АПГ пока нет свежих новостей.', card: null, cards: [] };
    const first = news[0];
    const cards = news.map(item => makeResultCard(item, 'news', createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id })));
    return {
      intent: 'news.fresh',
      text: cards.length > 1
        ? `Нашёл ${cards.length} свежих новости. Начал бы с «${titleOf(first, 'новость')}».`
        : `Из нового: «${titleOf(first, 'новость')}». Могу открыть главную, там это будет видно в ленте АПГ.`,
      card: cards[0],
      cards,
    };
  },
};
