import { LOKI_APP_ACTIONS, LOKI_MESSAGE_PRIORITY, createLokiAction } from './lokiActionTypes.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { makeResultCard, toMillis } from './core/lokiCoreUtils.js';
import { buildLearningSnapshot, getRecommendationPenalty, scoreItemByLearning } from './LokiLearning.js';

function daysSince(value) {
  if (!value) return Infinity;
  const ms = toMillis(value);
  if (!ms) return Infinity;
  return (Date.now() - ms) / 86400000;
}

function isBirthdaySoon(user = {}) {
  const raw = user.birthDate || user.birthday || user.dob;
  if (!raw) return false;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return false;
  const now = new Date();
  const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return next.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 10;
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function activeOfferEndingSoon(partners = []) {
  const now = Date.now();
  return partners
    .map(partner => ({ ...partner, endMs: toMillis(partner.offerUntil || partner.promoUntil || partner.discountUntil || partner.endsAt) }))
    .filter(partner => hasOffer(partner) && partner.endMs > now && partner.endMs - now < 1000 * 60 * 60 * 48)
    .sort((a, b) => a.endMs - b.endMs)[0] ?? null;
}

function nearbyPartner(appState, learning) {
  const partners = appState.partners ?? [];
  return partners
    .map(partner => ({ item: partner, score: scoreItemByLearning(partner, learning) + (partner.featured ? 1 : 0) + (hasOffer(partner) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function upcomingEvent(events = [], learning) {
  const now = Date.now();
  return events
    .map(event => ({ ...event, eventMs: toMillis(event.date ?? event.startAt ?? event.startsAt ?? event.createdAt) }))
    .filter(event => event.eventMs > now && event.eventMs - now < 1000 * 60 * 90)
    .map(event => ({ item: event, score: 4 + scoreItemByLearning(event, learning) }))
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function newestItem(items = []) {
  return items
    .map(item => ({ ...item, lokiMs: toMillis(item.createdAt ?? item.updatedAt ?? item.date) }))
    .filter(item => item.lokiMs && Date.now() - item.lokiMs < 1000 * 60 * 60 * 24 * 10)
    .sort((a, b) => b.lokiMs - a.lokiMs)[0] ?? null;
}

function makeAdvice(advice) {
  return {
    kind: 'proactive',
    priority: LOKI_MESSAGE_PRIORITY.NORMAL,
    ...advice,
    reason: advice.reason || 'Локи заметил полезный момент в текущем контексте АПГ.',
  };
}

function buildCandidates({ appState, memory, history, learning }) {
  const partners = appState.partners ?? [];
  const events = appState.events ?? [];
  const news = appState.news ?? [];
  const userKeys = Number(appState.userKeys ?? 0);
  const partner = nearbyPartner(appState, learning);
  const soonEvent = upcomingEvent(events, learning);
  const freshPartner = newestItem(partners);
  const freshNews = newestItem(news);
  const offer = activeOfferEndingSoon(partners);
  const lastNewsOpen = memory.panelVisits?.home ? 0 : Infinity;
  const noPartnerVisits = daysSince(appState.lastScanDate);
  const ignoredPanels = new Set(history.filter(item => item.status === 'ignored').slice(0, 10).map(item => item.panel).filter(Boolean));

  return [
    soonEvent && makeAdvice({
      id: `event-starting-${soonEvent.id}`,
      priority: LOKI_MESSAGE_PRIORITY.HIGH,
      message: 'Скоро начинается мероприятие. Хочешь открыть его?',
      reason: 'Мероприятие начинается в ближайшие полтора часа.',
      suppressedPanels: ['events'],
      card: {
        ...makeResultCard(soonEvent, 'event', createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: soonEvent.id })),
        text: soonEvent.location || soonEvent.place || 'До начала осталось совсем немного.',
      },
    }),
    userKeys >= 3 && appState.activePanel !== 'rewards' && makeAdvice({
      id: 'keys-ready-for-raffle',
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'У тебя уже хватает ключей для участия в розыгрыше.',
      reason: `На балансе ${userKeys} ключей, можно проверить доступные розыгрыши.`,
      card: {
        title: `${userKeys} ключей`,
        text: 'Можно посмотреть призы и розыгрыши.',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE),
        label: 'К призам',
      },
    }),
    offer && makeAdvice({
      id: `offer-ending-${offer.id}`,
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'У одного партнёра скоро закончится акция.',
      reason: 'У акции указан ближайший срок завершения.',
      card: makeResultCard(offer, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: offer.id })),
    }),
    freshPartner && !ignoredPanels.has('nearby') && makeAdvice({
      id: `fresh-partner-${freshPartner.id}`,
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'В АПГ появился новый партнёр. Можно заглянуть.',
      reason: 'Партнёр был добавлен недавно.',
      suppressedPanels: ['nearby'],
      card: makeResultCard(freshPartner, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: freshPartner.id })),
    }),
    noPartnerVisits > 6 && partner && makeAdvice({
      id: 'long-time-no-partner-visit',
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'Ты давно не получал ключ. Показать места, где можно начать?',
      reason: 'Последнее начисление ключа было давно или пока не найдено.',
      suppressedPanels: ['nearby'],
      card: {
        ...makeResultCard(partner, 'partner', createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS)),
        label: 'Показать рядом',
      },
    }),
    freshNews && lastNewsOpen !== Infinity && appState.activePanel !== 'home' && makeAdvice({
      id: `fresh-news-${freshNews.id}`,
      priority: LOKI_MESSAGE_PRIORITY.LOW,
      message: 'В городе появилась свежая новость.',
      reason: 'Новость опубликована недавно.',
      card: makeResultCard(freshNews, 'news', createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: freshNews.id })),
    }),
    isBirthdaySoon(appState.user) && makeAdvice({
      id: 'birthday-soon',
      priority: LOKI_MESSAGE_PRIORITY.LOW,
      message: 'Скоро день рождения. Можно поискать идеи для приятного дня.',
      reason: 'В профиле есть дата рождения, и она близко.',
      card: {
        title: 'Идеи ко дню рождения',
        text: 'Покажу партнёров и места рядом.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Посмотреть',
      },
    }),
  ].filter(Boolean);
}

export function evaluateLokiIntelligence({ appState = {}, memory = {}, history = [], userMemory = {}, lastUserActionAt, lastPanelChangeAt } = {}) {
  const learning = buildLearningSnapshot({ memory, userMemory, appState });
  const candidates = buildCandidates({ appState, memory, history, learning })
    .map(advice => ({
      ...advice,
      score: (advice.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL) + scoreItemByLearning(advice.card, learning) * 0.08 - getRecommendationPenalty(learning, advice.id),
    }))
    .sort((a, b) => b.score - a.score);
  const advice = candidates[0] ?? null;
  if (!advice) return null;
  return {
    eventType: LOKI_EVENTS.PROACTIVE_SUGGESTION,
    payload: {
      adviceId: advice.id,
      kind: advice.kind,
      message: advice.message,
      card: advice.card,
      priority: advice.priority,
      reason: advice.reason,
      suppressedPanels: advice.suppressedPanels,
      action: LOKI_ACTIONS.LOOK_AROUND,
      source: 'loki_intelligence',
      quietMeta: { lastUserActionAt, lastPanelChangeAt },
    },
  };
}

export function explainLastRecommendation(memory = {}) {
  const rec = memory.lastRecommendation;
  if (!rec?.reason) {
    return {
      intent: 'recommendation.explain_empty',
      text: 'Сейчас нет активной рекомендации, которую нужно объяснить.',
      card: null,
      cards: [],
    };
  }
  return {
    intent: 'recommendation.explain',
    text: rec.reason,
    card: rec.card ?? null,
    cards: rec.card ? [rec.card] : [],
  };
}
