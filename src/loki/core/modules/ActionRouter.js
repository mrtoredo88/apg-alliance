import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard, normalizeText } from '../lokiCoreUtils.js';

const SCREEN_ACTIONS = [
  { id: 'keys', words: ['мои ключ', 'где ключ', 'баланс', 'сколько ключ'], action: LOKI_APP_ACTIONS.SHOW_PROFILE, title: 'Ключи', text: 'Открою профиль, там виден баланс ключей и прогресс.' },
  { id: 'prizes', words: ['приз', 'подар', 'розыгрыш'], action: LOKI_APP_ACTIONS.OPEN_PRIZE, title: 'Призы', text: 'Открою раздел призов и розыгрышей.' },
  { id: 'achievements', words: ['достижен', 'задани', 'прогресс'], action: LOKI_APP_ACTIONS.OPEN_TASKS, title: 'Достижения и задания', text: 'Открою задания, где виден прогресс.' },
  { id: 'settings', words: ['настройк', 'тема', 'профиль настро'], action: LOKI_APP_ACTIONS.OPEN_SETTINGS, title: 'Настройки', text: 'Открою профиль и настройки приложения.' },
  { id: 'partners', words: ['партнер', 'партнёр', 'места', 'акци', 'скидк'], action: LOKI_APP_ACTIONS.OPEN_PARTNERS, title: 'Партнёры', text: 'Открою подходящий раздел партнёров и акций АПГ.' },
  { id: 'experts', words: ['эксперт', 'специалист', 'консультац', 'психолог', 'юрист'], action: LOKI_APP_ACTIONS.OPEN_EXPERTS, title: 'Эксперты', text: 'Открою каталог экспертов.' },
  { id: 'events', words: ['мероприят', 'событ', 'афиш', 'выходн'], action: LOKI_APP_ACTIONS.OPEN_EVENTS, title: 'События', text: 'Открою ближайшие мероприятия.' },
  { id: 'news', words: ['новост', 'что нового', 'лента'], action: LOKI_APP_ACTIONS.OPEN_NEWS_FEED, title: 'Новости', text: 'Открою ленту новостей АПГ.' },
  { id: 'map', words: ['карта', 'маршрут', 'как добраться'], action: LOKI_APP_ACTIONS.OPEN_MAP, title: 'Карта', text: 'Открою карту АПГ.' },
  { id: 'nearby', words: ['рядом', 'поблизости', 'ближайш'], action: LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS, title: 'Рядом', text: 'Открою раздел рядом с доступными местами.' },
  { id: 'people', words: ['люди', 'друз', 'знаком', 'контакт', 'найди татьян', 'найди анн', 'найди максим', 'добавь', 'напиши'], action: LOKI_APP_ACTIONS.OPEN_PEOPLE, title: 'Люди', text: 'Открою раздел Люди: там можно найти участника, добавить в друзья и написать.' },
  { id: 'notifications', words: ['уведомлен', 'сообщен'], action: LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS, title: 'Уведомления', text: 'Открою уведомления.' },
  { id: 'qr', words: ['скан', 'qr', 'куар'], action: LOKI_APP_ACTIONS.START_QR_SCANNER, title: 'QR-сканер', text: 'Открою сканер QR для получения ключей.' },
  { id: 'faq', words: ['помощ', 'справочник', 'faq', 'как пользоваться'], action: LOKI_APP_ACTIONS.OPEN_REFERENCE, title: 'Справочник', text: 'Открою справочник АПГ.' },
];

const ENTITY_COLLECTIONS = [
  { type: 'partner', key: 'partners', action: LOKI_APP_ACTIONS.OPEN_PARTNER },
  { type: 'expert', key: 'experts', action: LOKI_APP_ACTIONS.OPEN_EXPERTS },
  { type: 'event', key: 'events', action: LOKI_APP_ACTIONS.OPEN_EVENT },
  { type: 'news', key: 'news', action: LOKI_APP_ACTIONS.OPEN_NEWS },
  { type: 'task', key: 'tasks', action: LOKI_APP_ACTIONS.OPEN_TASKS },
];

function scoreItem(query, item) {
  const haystack = normalizeText([
    item?.name,
    item?.title,
    item?.specialization,
    item?.category,
    item?.categoryLabel,
    item?.categories?.join?.(' '),
    item?.description,
    item?.services,
    item?.experience,
    item?.summary,
    item?.text,
    item?.offer,
    item?.address,
    item?.tags?.join?.(' '),
  ].filter(Boolean).join(' '));
  if (!haystack) return 0;
  if (haystack.includes(query)) return 20;
  return query.split(/\s+/)
    .filter(word => word.length > 2)
    .reduce((sum, word) => sum + (haystack.includes(word) ? Math.min(6, word.length) : 0), 0);
}

function peoplePayload(query = '') {
  const clean = normalizeText(query).replace(/^(найди|покажи|добавь|напиши|открой|моих|мои|мне|в)\s+/g, '').replace(/\s+(в друзья|друзья|люди|человека|участника|сообщение)$/g, '').trim();
  if (/друз/.test(normalizeText(query)) && !/(найди|добавь|напиши)/.test(normalizeText(query))) return { tab: 'friends', mode: 'friends', intent: 'friends' };
  if (/напиши|сообщен|диалог|чат/.test(normalizeText(query))) return { tab: 'dialogs', mode: 'dialogs', intent: 'message', peopleQuery: clean };
  if (/заявк/.test(normalizeText(query))) return { tab: 'requests', mode: 'requests', intent: 'requests' };
  return { tab: 'all', mode: /добавь/.test(normalizeText(query)) ? 'add' : 'search', peopleQuery: clean };
}

function makeActionCard(screen, query = '') {
  const action = createLokiAction(screen.action, screen.id === 'people' ? peoplePayload(query) : {});
  return { id: screen.id, type: 'screen', title: screen.title, text: screen.text, action, label: 'Открыть', actions: [{ label: 'Открыть', action }] };
}

function searchAll(query, context) {
  return ENTITY_COLLECTIONS.flatMap(config => {
    const list = context.apg?.[config.key] ?? [];
    return list
      .map(item => ({ item, score: scoreItem(query, item), config }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(row => makeResultCard(
        row.item,
        row.config.type,
        createLokiAction(row.config.action, {
          id: row.item.id,
          partnerId: row.config.type === 'partner' ? row.item.id : undefined,
          eventId: row.config.type === 'event' ? row.item.id : undefined,
          newsId: row.config.type === 'news' ? row.item.id : undefined,
        }),
      ));
  }).sort((a, b) => (a.type === 'partner' ? -1 : 0) - (b.type === 'partner' ? -1 : 0)).slice(0, 8);
}

export const ActionRouter = {
  id: 'actionRouter',
  label: 'Action Router',
  canHandle({ query }) {
    return includesAny(query, ['открой', 'покажи', 'где', 'найди', 'добавь', 'напиши', 'хочу', 'нужен', 'нужна', 'куда', 'что есть', 'мои']);
  },
  handle({ query, context }) {
    const direct = SCREEN_ACTIONS.find(screen => includesAny(query, screen.words));
    if (direct && includesAny(query, ['открой', 'покажи', 'где мои', 'где находится', 'где найти', 'найди', 'добавь', 'напиши'])) {
      const card = makeActionCard(direct, query);
      return {
        intent: `action.${direct.id}`,
        text: `${direct.text} Можно перейти сразу.`,
        card,
        cards: [card],
        executeAction: card.action,
      };
    }

    const cards = searchAll(query, context);
    if (cards.length) {
      return {
        intent: 'search.global',
        text: cards.length === 1 ? 'Нашёл один подходящий результат.' : `Нашёл ${cards.length} результатов по всему АПГ.`,
        card: cards[0],
        cards,
      };
    }

    if (direct) {
      const card = makeActionCard(direct, query);
      return {
        intent: `action.${direct.id}`,
        text: direct.text,
        card,
        cards: [card],
      };
    }

    return null;
  },
};
