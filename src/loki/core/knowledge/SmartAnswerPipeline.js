import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { normalizeText, titleOf } from '../lokiCoreUtils.js';
import { detectLokiIntent, intentNeedsLocalAnswer } from '../intent/IntentRouter.js';
import { buildLokiKnowledgeProvider, makeKnowledgeResultCard, searchKnowledge } from './KnowledgeProvider.js';
import { runReasoningEngine } from '../reasoning/ReasoningEngine.js';
import { runJourneyEngine } from '../journey/JourneyEngine.js';
import { runLokiPlanner } from '../planner/Planner.js';
import { runLokiToolLayer } from '../tools/ToolCenter.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function firstFilled(...values) {
  return values.map(value => text(value)).find(Boolean) || '';
}

function findSourceItem(knowledge, row) {
  const sourceKey = row.type === 'article' ? 'news' : row.type === 'gift' ? 'gifts' : `${row.type}s`;
  return list(knowledge.sources?.[sourceKey]).find(item => String(item.id) === String(row.id)) || null;
}

function currentContextItem(knowledge, expectedTypes = []) {
  const context = knowledge.screenContext || {};
  if (context.item && (!expectedTypes.length || expectedTypes.includes(context.item.type || context.type))) return context.item;
  const type = expectedTypes.find(item => list(knowledge.sources?.[`${item}s`]).length) || context.type;
  if (type === 'partner') return knowledge.sources.partners?.[0] || null;
  if (type === 'expert') return knowledge.sources.experts?.[0] || null;
  if (type === 'event') return knowledge.sources.events?.[0] || null;
  if (type === 'news') return knowledge.sources.news?.[0] || null;
  if (type === 'location') return knowledge.sources.locations?.[0] || null;
  return null;
}

function cardsFromRows(knowledge, rows) {
  return rows
    .map(row => {
      const item = findSourceItem(knowledge, row);
      return item ? makeKnowledgeResultCard(item, row.type) : null;
    })
    .filter(Boolean);
}

function answerSearch({ intent, knowledge }) {
  const rows = searchKnowledge(knowledge, intent.query, intent.types, 4);
  const cards = cardsFromRows(knowledge, rows);
  const labels = {
    'search.partners': 'партнёров',
    'search.events': 'мероприятия',
    'search.promotions': 'акции',
    'search.gifts': 'подарки',
    'search.locations': 'филиалы',
    'search.specialists': 'специалистов',
    'news.question': 'публикации',
  };
  if (!cards.length) {
    return {
      intent: intent.id,
      text: `Я проверил данные АПГ, но сейчас не нашёл подходящие ${labels[intent.id] || 'объекты'}. Ничего не придумываю.`,
      card: null,
      cards: [],
      knowledge,
    };
  }
  return {
    intent: intent.id,
    text: `Нашёл ${cards.length} ${labels[intent.id] || 'варианта'} в данных АПГ. Начал бы с «${cards[0].title}».`,
    card: cards[0],
    cards,
    knowledge,
  };
}

function answerHours({ intent, knowledge }) {
  const item = currentContextItem(knowledge, ['location', 'partner']) || findSourceItem(knowledge, searchKnowledge(knowledge, intent.query, ['location', 'partner'], 1)[0] || {});
  if (!item) return null;
  const location = item.type === 'location' ? item : item.mainLocation || item.locations?.[0] || null;
  const hours = firstFilled(location?.workingHours, location?.hours, item.workingHours, item.hours, item.schedule);
  const title = titleOf(location || item, titleOf(item, 'карточки'));
  return {
    intent: 'info.hours',
    text: hours
      ? `По «${title}» вижу график: ${hours}.`
      : `В данных АПГ для «${title}» пока нет заполненного графика работы.`,
    card: makeKnowledgeResultCard(item.type === 'location' ? item : { ...item, address: location?.address || item.address }, item.type === 'location' ? 'location' : 'partner', { locationId: location?.id || '' }),
    cards: [],
    knowledge,
  };
}

function answerContacts({ intent, knowledge }) {
  const item = currentContextItem(knowledge, ['location', 'partner', 'expert']) || findSourceItem(knowledge, searchKnowledge(knowledge, intent.query, ['location', 'partner', 'expert'], 1)[0] || {});
  if (!item) return null;
  const location = item.type === 'location' ? item : item.mainLocation || item.locations?.[0] || null;
  const phone = firstFilled(location?.phone, item.phone);
  const telegram = firstFilled(location?.telegramUrl, location?.telegram, item.telegramUrl, item.telegram);
  const whatsapp = firstFilled(location?.whatsappUrl, location?.whatsapp, item.whatsappUrl, item.whatsapp);
  const website = firstFilled(location?.websiteUrl, location?.website, item.websiteUrl, item.website);
  const rows = [
    phone ? `телефон: ${phone}` : '',
    telegram ? `Telegram: ${telegram}` : '',
    whatsapp ? `WhatsApp: ${whatsapp}` : '',
    website ? `сайт: ${website}` : '',
  ].filter(Boolean);
  return {
    intent: 'info.contacts',
    text: rows.length
      ? `Контакты «${titleOf(item, 'карточки')}»: ${rows.join('; ')}.`
      : `В карточке «${titleOf(item, 'карточки')}» пока нет заполненных контактов.`,
    card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'location' ? 'location' : 'partner', { locationId: location?.id || '' }),
    cards: [],
    knowledge,
  };
}

function answerBooking({ knowledge }) {
  const item = currentContextItem(knowledge, ['partner', 'expert', 'location']);
  const future = list(knowledge.sources.bookings).filter(row => !row.status || !['cancelled', 'done'].includes(normalizeText(row.status))).slice(0, 3);
  if (item) {
    const bookingUrl = firstFilled(item.bookingUrl, item.mainLocation?.bookingUrl);
    return {
      intent: 'info.booking',
      text: bookingUrl
        ? `Для «${titleOf(item, 'карточки')}» есть ссылка на запись. Открою карточку, там можно продолжить сценарий.`
        : `Открою карточку «${titleOf(item, 'карточки')}»: если запись доступна, кнопка будет внутри карточки.`,
      card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'location' ? 'location' : 'partner'),
      cards: [],
      knowledge,
    };
  }
  return {
    intent: 'info.booking',
    text: future.length
      ? `Вижу ${future.length} ближайшие записи. Могу помочь открыть профиль или Workspace, чтобы продолжить.`
      : 'По текущим данным не вижу активных записей. Можно открыть партнёра или эксперта и начать запись из карточки.',
    card: { title: 'Профиль', text: 'Записи и действия пользователя.', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE), label: 'Открыть' },
    cards: future.map(row => ({ id: row.id, type: 'booking', title: row.title, text: row.locationTitle || row.providerName || row.status || 'Запись', label: 'Профиль', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE) })),
    knowledge,
  };
}

function answerProfile({ context, knowledge }) {
  const user = context.user || {};
  const profile = knowledge.sources.userProfile || {};
  const keys = Number(user.keys ?? profile.keys ?? 0);
  const favorites = Number(user.favorites?.length ?? context.favorites?.count ?? 0);
  return {
    intent: 'profile.question',
    text: `По профилю: ${keys} ключей, ${favorites} избранных, активный экран — ${user.currentPanel || context.currentScreen?.id || 'АПГ'}.`,
    card: { title: 'Профиль', text: 'Ключи, достижения, избранное и настройки.', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE), label: 'Открыть профиль' },
    cards: [],
    knowledge,
  };
}

function answerWorkspace({ knowledge }) {
  const analytics = knowledge.sources.workspaceAnalytics || {};
  const kpis = analytics.kpis || analytics.summary || analytics;
  const rows = [
    Number(kpis.profileViews || kpis.views || 0) ? `просмотры: ${Number(kpis.profileViews || kpis.views || 0)}` : '',
    Number(kpis.newBookings || kpis.bookings || 0) ? `записи: ${Number(kpis.newBookings || kpis.bookings || 0)}` : '',
    Number(kpis.newDialogs || kpis.dialogs || 0) ? `диалоги: ${Number(kpis.newDialogs || kpis.dialogs || 0)}` : '',
    Number(kpis.conversion || 0) ? `конверсия: ${Number(kpis.conversion)}%` : '',
  ].filter(Boolean);
  return {
    intent: 'workspace.question',
    text: rows.length
      ? `По Workspace вижу: ${rows.join('; ')}.`
      : 'Workspace доступен как рабочая зона партнёра/эксперта: профиль, контент, аналитика, записи, диалоги и подарки.',
    card: { title: 'Workspace', text: 'Рабочая зона АПГ для управления профилем и контентом.', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI), label: 'Продолжить' },
    cards: [],
    knowledge,
  };
}

function answerReviews({ knowledge }) {
  const reviews = list(knowledge.sources.reviews);
  const rated = reviews.filter(row => Number(row.rating || 0) > 0);
  if (!reviews.length) return {
    intent: 'reviews.question',
    text: 'В текущем контексте у меня нет загруженных отзывов. Если они есть в карточке, откройте раздел отзывов внутри профиля.',
    card: null,
    cards: [],
    knowledge,
  };
  const average = rated.length ? Math.round(rated.reduce((sum, row) => sum + Number(row.rating || 0), 0) / rated.length * 10) / 10 : 0;
  return {
    intent: 'reviews.question',
    text: average ? `Вижу ${reviews.length} отзывов, средняя оценка ${average}.` : `Вижу ${reviews.length} отзывов без числовой оценки.`,
    card: null,
    cards: reviews.slice(0, 3).map(row => ({ id: row.id, type: 'review', title: row.title, text: text(row.text || row.comment, 160), label: 'Понятно' })),
    knowledge,
  };
}

function answerContext({ intent, knowledge }) {
  const item = currentContextItem(knowledge, intent.types);
  if (!item) return null;
  const locations = list(item.locations);
  const bits = [
    item.category || item.specialization,
    item.address || item.mainLocation?.address,
    hasOfferText(item),
    locations.length > 1 ? `${locations.length} филиала` : '',
  ].filter(Boolean);
  return {
    intent: 'context.card',
    text: `Сейчас контекст — «${titleOf(item, 'карточка')}». ${bits.length ? `Коротко: ${bits.join('; ')}.` : 'Вижу основную карточку и могу отвечать по её данным.'}`,
    card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'event' ? 'event' : item.type === 'news' ? 'news' : 'partner'),
    cards: [],
    knowledge,
  };
}

function hasOfferText(item = {}) {
  return firstFilled(item.offer, item.promo, item.discount, item.specialOffer, item.actionText);
}

export function runLokiKnowledgeEngine({ text: question, appState = {}, context = null } = {}) {
  const sourceState = context?.appState || appState?.appState || appState;
  const knowledge = buildLokiKnowledgeProvider({ ...sourceState, activeContext: context?.memory?.activeContext || sourceState.activeContext });
  const intent = detectLokiIntent(question, knowledge);
  const contextReasoning = runReasoningEngine({ question, intent, knowledge, context });
  const contextJourney = runJourneyEngine({ question, intent, knowledge, reasoningResult: contextReasoning, context });
  const plannerResult = runLokiPlanner({ question, intent, reasoningResult: contextReasoning, journeyResult: contextJourney, knowledge, context, appState: sourceState });
  if (plannerResult) return { ...plannerResult, knowledge, reasoningContext: contextReasoning?.reasoningContext, journeyContext: contextJourney?.journeyContext };
  const toolResult = runLokiToolLayer({ question, intent, reasoningResult: contextReasoning, journeyResult: contextJourney, knowledge, context, appState: sourceState });
  if (toolResult && toolResult.toolContext?.status !== 'denied') return { ...toolResult, knowledge, reasoningContext: contextReasoning?.reasoningContext, journeyContext: contextJourney?.journeyContext };
  if (contextJourney?.journeyHandled) return contextJourney;
  if (contextJourney && (context?.memory?.lastJourneyContext || context?.memory?.journeyContext)) return contextJourney;
  if (contextReasoning?.reasoningHandled) return contextReasoning;
  if (contextReasoning?.reasoningContext?.source === 'memory') return contextReasoning;
  if (!intentNeedsLocalAnswer(intent)) {
    if (contextJourney) return contextJourney;
    if (contextReasoning) return contextReasoning;
    const fallbackRows = searchKnowledge(knowledge, intent.query || question, [], 4);
    if (fallbackRows.length) {
      const fallbackIntent = { ...intent, id: 'knowledge.search', types: [], query: intent.query || question };
      const reasoned = runReasoningEngine({ question, intent: fallbackIntent, knowledge, context });
      const journey = runJourneyEngine({ question, intent: fallbackIntent, knowledge, reasoningResult: reasoned, context });
      if (journey) return journey;
      return reasoned || answerSearch({ intent: fallbackIntent, knowledge });
    }
    return null;
  }

  if (intent.id.startsWith('search.') || intent.id === 'news.question') {
    const reasoned = runReasoningEngine({ question, intent, knowledge, context });
    const journey = runJourneyEngine({ question, intent, knowledge, reasoningResult: reasoned, context });
    if (journey) return journey;
    return reasoned || answerSearch({ intent, knowledge });
  }
  if (intent.id === 'context.card') {
    const reasoned = runReasoningEngine({ question, intent, knowledge, context });
    const journey = runJourneyEngine({ question, intent, knowledge, reasoningResult: reasoned, context });
    if (journey) return journey;
    if (reasoned) return reasoned;
  }

  if (intent.id === 'info.hours') return answerHours({ intent, knowledge });
  if (intent.id === 'info.contacts') return answerContacts({ intent, knowledge });
  if (intent.id === 'info.booking') return answerBooking({ intent, knowledge });
  if (intent.id === 'profile.question') return answerProfile({ context: context || {}, knowledge });
  if (intent.id === 'workspace.question') return answerWorkspace({ knowledge });
  if (intent.id === 'reviews.question') return answerReviews({ knowledge });
  if (intent.id === 'context.card') return answerContext({ intent, knowledge });
  return null;
}
