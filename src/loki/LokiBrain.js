import { LOKI_APP_ACTIONS, LOKI_MESSAGE_PRIORITY, createLokiAction } from './lokiActionTypes.js';

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function titleOf(item, fallback) {
  return item?.name ?? item?.title ?? item?.headline ?? fallback;
}

function imageOf(item) {
  return item?.coverPhoto || item?.imageUrl || item?.photo || item?.logoUrl || item?.photos?.[0] || item?.gallery?.[0] || '';
}

function makeResultCard(item, type, action) {
  return {
    id: item?.id ?? `${type}-${titleOf(item, 'item')}`,
    type,
    title: titleOf(item, type === 'event' ? 'Мероприятие' : type === 'news' ? 'Новость' : 'Партнёр АПГ'),
    text: item?.category || item?.address || item?.location || item?.place || item?.description || item?.text || 'Открою детали.',
    image: imageOf(item),
    action,
    label: type === 'news' ? 'Читать' : 'Открыть',
  };
}

function findPartners(query, partners = []) {
  const text = normalizeText(query);
  const categoryHints = [
    ['кофе', 'кофейн', 'кофей', 'капучино'],
    ['еда', 'поесть', 'ресторан', 'кафе', 'ужин', 'обед', 'завтрак'],
    ['массаж', 'спа', 'spa'],
    ['красота', 'салон', 'маникюр', 'стриж', 'бров'],
    ['спорт', 'фитнес', 'йога'],
    ['дет', 'семь', 'ребен'],
  ].filter(group => includesAny(text, group)).flat();

  return partners
    .map(partner => {
      const haystack = normalizeText([
        partner.name,
        partner.category,
        partner.description,
        partner.address,
        partner.offer,
        partner.promo,
      ].filter(Boolean).join(' '));
      const score = [
        partner.name && text.includes(normalizeText(partner.name)) ? 8 : 0,
        categoryHints.some(hint => haystack.includes(hint)) ? 5 : 0,
        includesAny(text, haystack.split(/\s+/).filter(w => w.length > 4).slice(0, 18)) ? 2 : 0,
        partner.featured ? 1 : 0,
      ].reduce((sum, value) => sum + value, 0);
      return { ...partner, lokiScore: score };
    })
    .filter(partner => partner.lokiScore > 0)
    .sort((a, b) => b.lokiScore - a.lokiScore)
    .slice(0, 3);
}

function upcomingEvents(events = []) {
  const now = Date.now();
  return events
    .map(event => ({ ...event, lokiMs: toMillis(event.date ?? event.startAt ?? event.startsAt ?? event.createdAt) }))
    .filter(event => !event.lokiMs || event.lokiMs >= now - 1000 * 60 * 60 * 24)
    .sort((a, b) => (a.lokiMs || Number.MAX_SAFE_INTEGER) - (b.lokiMs || Number.MAX_SAFE_INTEGER))
    .slice(0, 3);
}

function freshNews(news = []) {
  return news
    .map(item => ({ ...item, lokiMs: toMillis(item.createdAt ?? item.date) }))
    .sort((a, b) => b.lokiMs - a.lokiMs)
    .slice(0, 3);
}

function makePartnerAnswer(partners, query) {
  if (!partners.length) {
    return {
      text: 'В АПГ пока нет информации об этом. Я не буду придумывать места.',
      card: {
        title: 'Можно посмотреть рядом',
        text: 'Открою партнёров поблизости, если хочешь поискать вручную.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Показать рядом',
      },
      cards: [],
    };
  }
  const first = partners[0];
  const reason = first.offer || first.promo
    ? 'сейчас там есть акция'
    : first.featured
      ? 'это заметный партнёр АПГ'
      : 'он подходит под твой запрос';
  const cards = partners.map(partner => makeResultCard(
    partner,
    'partner',
    createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: partner.id }),
  ));
  return {
    text: cards.length > 1
      ? `Нашёл ${cards.length} варианта. Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`
      : `Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`,
    card: {
      title: titleOf(first, 'Партнёр АПГ'),
      text: first.category || first.address || 'Открою карточку с деталями.',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: first.id }),
      label: 'Открыть карточку',
    },
    cards,
  };
}

function makeEventsAnswer(events) {
  if (!events.length) {
    return {
      text: 'В АПГ пока нет информации о ближайших мероприятиях.',
      card: {
        title: 'Афиша мероприятий',
        text: 'Можно открыть раздел и проверить позже.',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT),
        label: 'Открыть афишу',
      },
      cards: [],
    };
  }
  const first = events[0];
  const cards = events.map(event => makeResultCard(
    event,
    'event',
    createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: event.id }),
  ));
  return {
    text: cards.length > 1
      ? `Нашёл ${cards.length} ближайших события. Первым посмотрел бы «${titleOf(first, 'мероприятие')}».`
      : `Я нашёл мероприятие «${titleOf(first, 'мероприятие')}». Оно выглядит хорошим вариантом для ближайшего времени.`,
    card: {
      title: titleOf(first, 'Мероприятие'),
      text: first.location || first.place || 'Открою афишу с подробностями.',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: first.id }),
      label: 'Открыть',
    },
    cards,
  };
}

function makeNewsAnswer(news) {
  if (!news.length) {
    return { text: 'В АПГ пока нет свежих новостей.', card: null, cards: [] };
  }
  const first = news[0];
  const cards = news.map(item => makeResultCard(
    item,
    'news',
    createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id }),
  ));
  return {
    text: cards.length > 1
      ? `Нашёл ${cards.length} свежих новости. Начал бы с «${titleOf(first, 'новость')}».`
      : `Из нового: «${titleOf(first, 'новость')}». Могу открыть главную, там это будет видно в ленте АПГ.`,
    card: {
      title: titleOf(first, 'Новости АПГ'),
      text: first.description || first.text || 'Свежая новость проекта.',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS),
      label: 'Читать',
    },
    cards,
  };
}

export function buildLokiBrainContext(appState = {}, memory = {}) {
  return {
    user: {
      name: appState.user?.first_name || appState.user?.name || null,
      keys: Number(appState.userKeys ?? 0),
      completedTasks: appState.completedTasks ?? [],
      favorites: appState.favorites ?? [],
      city: 'Зеленоград',
      currentPanel: appState.activePanel,
      lastScanDate: appState.lastScanDate ?? null,
      lastAction: memory.lastAction ?? null,
      lastMessage: memory.lastMessage ?? null,
    },
    apg: {
      partners: appState.partners ?? [],
      experts: appState.experts ?? [],
      events: appState.events ?? [],
      news: appState.news ?? [],
      tasks: appState.customTasks ?? [],
      notifications: appState.notifications ?? [],
      prizesKnown: false,
    },
  };
}

export async function askLokiBrain({ text, appState, memory }) {
  const query = normalizeText(text);
  const context = buildLokiBrainContext(appState, memory);
  const lastAction = memory?.lastMessage?.payload?.card?.action ?? memory?.lastAction;

  if (!query) {
    return { text: 'Спроси меня про места, мероприятия, акции, ключи или новости АПГ.', card: null };
  }

  if (includesAny(query, ['покажи', 'открой', 'давай', 'перейди']) && lastAction) {
    return {
      text: 'Показываю.',
      card: null,
      cards: [],
      executeAction: lastAction,
    };
  }

  if (includesAny(query, ['кофе', 'поесть', 'еда', 'массаж', 'акци', 'скидк', 'салон', 'красот', 'спорт', 'йога', 'дет', 'выходн'])) {
    const partners = findPartners(query, context.apg.partners);
    return makePartnerAnswer(partners, query);
  }

  if (includesAny(query, ['рядом', 'поблизости', 'где', 'места'])) {
    const partners = findPartners(query, context.apg.partners);
    if (partners.length) return makePartnerAnswer(partners, query);
    return {
      text: 'Я могу показать партнёров рядом. Геолокацию использую только если она разрешена в приложении.',
      card: {
        title: 'Рядом со мной',
        text: 'Открою карту ближайших партнёров АПГ.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Показать рядом',
      },
      cards: [],
      autoAction: includesAny(query, ['покажи', 'открой']) ? createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS) : null,
    };
  }

  if (includesAny(query, ['мероприят', 'событ', 'афиш', 'сегодня', 'интересн', 'выходн'])) {
    return makeEventsAnswer(upcomingEvents(context.apg.events));
  }

  if (includesAny(query, ['ново', 'новост', 'что нового'])) {
    return makeNewsAnswer(freshNews(context.apg.news));
  }

  if (includesAny(query, ['ключ', 'заработ', 'получить'])) {
    return {
      text: `Сейчас у тебя ${context.user.keys} ключей. Самый надёжный способ получить ещё — посетить партнёра и отсканировать QR сотрудника.`,
      card: {
        title: 'Получить ключ',
        text: 'Открою сканер QR.',
        action: createLokiAction(LOKI_APP_ACTIONS.START_QR_SCANNER),
        label: 'Сканировать QR',
      },
      cards: [],
    };
  }

  if (includesAny(query, ['приз', 'розыгрыш', 'подар'])) {
    return {
      text: context.user.keys > 0
        ? 'Могу открыть раздел призов и розыгрышей. Доступность зависит от текущих условий в АПГ.'
        : 'Призы есть в отдельном разделе, но сначала стоит накопить ключи.',
      card: {
        title: 'Призы и розыгрыши',
        text: `${context.user.keys} ключей на балансе`,
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE),
        label: 'Открыть',
      },
      cards: [],
    };
  }

  if (includesAny(query, ['профиль', 'достижен', 'задани'])) {
    return {
      text: 'Открою твой прогресс. Там видны задания, ключи и достижения.',
      card: {
        title: 'Прогресс АПГ',
        text: 'Профиль и задания пользователя.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS),
        label: 'Открыть',
      },
      cards: [],
    };
  }

  return {
    text: 'Пока я этого не знаю. В АПГ пока нет информации об этом.',
    card: null,
    cards: [],
  };
}
