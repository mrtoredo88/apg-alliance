import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { imageOf, normalizeText, titleOf, toMillis } from '../lokiCoreUtils.js';
import { LOKI_SCENARIOS } from './lokiScenarios.js';
import { aiProfileSearchText } from '../../../aiProfile.js';

const CATEGORY_HINTS = {
  city_life: ['город', 'сегодня', 'вечер', 'выходн', 'рядом', 'интерес', 'план', 'ново'],
  events: ['мероприят', 'событ', 'афиш', 'встреч', 'лекц', 'мастер', 'регистрац'],
  food: ['еда', 'кофе', 'завтрак', 'обед', 'ужин', 'кафе', 'ресторан', 'доставка'],
  leisure: ['отдых', 'расслаб', 'актив', 'свидан', 'культур', 'фото', 'вечер'],
  specialists: ['специалист', 'услуг', 'мастер', 'консультац', 'здоров', 'психолог', 'юрист'],
  shopping: ['купить', 'покупк', 'подар', 'скидк', 'акци', 'товар', 'магазин'],
  family: ['семь', 'родител', 'праздник', 'надежн', 'проверенн'],
  kids: ['дет', 'ребен', 'ребён', 'кружок', 'развит', 'школ', 'творч'],
  business: ['бизнес', 'партнерств', 'клиент', 'аналитик', 'предприним', 'коллаборац'],
  partners: ['партнер', 'партнёр', 'место', 'рядом', 'избран', 'акци', 'сравни'],
  experts: ['эксперт', 'спикер', 'консультац', 'специалист', 'вебинар'],
  apg: ['апг', 'ключ', 'qr', 'куар', 'профиль', 'уведомлен', 'лока', 'локи'],
};

const DATA_PRIORITY = {
  city_life: ['event', 'partner', 'news'],
  events: ['event', 'partner'],
  food: ['partner', 'event'],
  leisure: ['event', 'partner'],
  specialists: ['expert', 'partner'],
  shopping: ['partner'],
  family: ['event', 'partner', 'expert'],
  kids: ['event', 'partner', 'expert'],
  business: ['event', 'expert', 'partner', 'news'],
  partners: ['partner'],
  experts: ['expert', 'event'],
  apg: ['event', 'partner', 'news'],
};

const STOP_WORDS = new Set(['что', 'как', 'куда', 'мне', 'для', 'или', 'это', 'есть', 'можно', 'хочу', 'нужно', 'надо', 'сейчас', 'сегодня', 'пожалуйста']);

function words(value) {
  return normalizeText(value)
    .replace(/[^a-zа-я0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function semanticScore(queryWords, textWords) {
  if (!queryWords.length || !textWords.length) return 0;
  return queryWords.reduce((sum, queryWord) => {
    if (textWords.includes(queryWord)) return sum + 5;
    const soft = textWords.some(word => word.startsWith(queryWord.slice(0, 4)) || queryWord.startsWith(word.slice(0, 4)));
    return sum + (soft ? 2.2 : 0);
  }, 0);
}

function detectScenario({ query, context }) {
  const queryWords = words(query);
  const activeContext = context?.memory?.activeContext ?? context?.memory?.lastContext ?? null;
  const scored = LOKI_SCENARIOS.map(scenario => {
    const scenarioText = [scenario.title, scenario.userGoal, ...(scenario.utterances ?? [])].join(' ');
    const scenarioWords = words(scenarioText);
    const direct = (scenario.utterances ?? []).some(phrase => normalizeText(query).includes(normalizeText(phrase)));
    const categoryScore = semanticScore(queryWords, CATEGORY_HINTS[scenario.category] ?? []);
    const textScore = semanticScore(queryWords, scenarioWords);
    const contextBoost = activeContext?.type === 'news' && scenario.id === 'apg.news_context' ? 8 : 0;
    const score = textScore + categoryScore + contextBoost + (direct ? 12 : 0);
    return { scenario, score };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0] ?? null;
  if (!best || best.score < 4) return { scenario: null, confidence: 0, score: 0 };
  const confidence = Math.min(0.98, best.score / 24);
  return { scenario: best.scenario, confidence, score: best.score };
}

function runtimeContext(context, history) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const timeOfDay = hour < 11 ? 'утро' : hour < 17 ? 'день' : hour < 22 ? 'вечер' : 'поздний вечер';
  const interests = unique([
    ...(context?.userMemory?.favoriteCategories ?? []),
    ...(context?.userMemory?.interests ?? []),
    ...Object.entries(context?.userMemory?.interestWeights ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key),
    ...(context?.memory?.preferences?.categories ?? []),
  ].map(item => String(item || '').trim()).filter(Boolean));
  return {
    now,
    hour,
    dayOfWeek: day,
    isWeekend: day === 0 || day === 6,
    timeOfDay,
    activePanel: context?.user?.currentPanel ?? null,
    interests,
    hasLocation: !!context?.user?.location,
    recentDialogSize: Array.isArray(history) ? history.length : 0,
  };
}

function isActiveItem(item) {
  return item?.archived !== true && item?.hidden !== true && item?.deleted !== true;
}

function itemText(item) {
  const type = item?.specialization ? 'expert' : 'partner';
  const aiText = item?.aiProfile ? aiProfileSearchText(item, type) : '';
  return [
    aiText,
    item?.name,
    item?.title,
    item?.headline,
    item?.category,
    item?.categoryLabel,
    item?.specialization,
    item?.description,
    item?.summary,
    item?.text,
    item?.address,
    item?.offer,
    item?.promo,
    item?.tags?.join?.(' '),
    item?.keywords?.join?.(' '),
  ].filter(Boolean).join(' ');
}

function scoreEntity({ item, type, scenario, queryWords, runtime }) {
  const haystackWords = words(itemText(item));
  let score = semanticScore(queryWords, haystackWords);
  score += semanticScore(words(scenario.userGoal), haystackWords) * 0.45;
  score += semanticScore(CATEGORY_HINTS[scenario.category] ?? [], haystackWords) * 0.35;
  if (type === 'event') {
    const ms = toMillis(item?.date ?? item?.startAt ?? item?.startsAt ?? item?.createdAt);
    if (ms) {
      const diffDays = (ms - runtime.now.getTime()) / 86400000;
      if (diffDays >= -1 && diffDays <= 2) score += 8;
      else if (diffDays > 2 && diffDays <= 14) score += 4;
      else if (diffDays < -1) score -= 8;
    }
    if (item?.registrationsCount || item?.registeredCount) score += 1.5;
  }
  if (type === 'partner') {
    if (item?.featured) score += 3;
    if (item?.offer || item?.promo || item?.discount) score += 2;
    if (item?.rating || item?.avgRating) score += Math.min(3, Number(item.rating ?? item.avgRating) || 0);
  }
  if (type === 'expert') {
    if (item?.rating || item?.avgRating) score += Math.min(3, Number(item.rating ?? item.avgRating) || 0);
    if (item?.verified || item?.featured) score += 2;
  }
  if (runtime.interests.length) score += semanticScore(runtime.interests, haystackWords) * 0.4;
  return score;
}

function collectCandidates({ context, scenario, queryWords, runtime }) {
  if ([
    'apg.keys',
    'apg.qr',
    'apg.profile',
    'apg.favorites',
    'apg.notifications',
    'apg.how_to_use',
  ].includes(scenario.id)) {
    return [];
  }
  const lists = {
    event: context?.apg?.events ?? [],
    partner: context?.apg?.partners ?? [],
    expert: context?.apg?.experts ?? [],
    news: context?.apg?.news ?? [],
  };
  const priority = DATA_PRIORITY[scenario.category] ?? ['event', 'partner', 'expert', 'news'];
  return priority.flatMap(type => (lists[type] ?? [])
    .filter(isActiveItem)
    .map(item => ({ item, type, score: scoreEntity({ item, type, scenario, queryWords, runtime }) + (priority.length - priority.indexOf(type)) }))
    .filter(row => row.score > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function payloadFor(type, item, actionType) {
  return {
    id: item?.id,
    partnerId: type === 'partner' || actionType === LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER ? item?.id : undefined,
    eventId: type === 'event' || actionType === LOKI_APP_ACTIONS.START_EVENT_REGISTRATION ? item?.id : undefined,
    newsId: type === 'news' ? item?.id : undefined,
  };
}

function actionFor(type, item, scenario) {
  if (type === 'event' && scenario.availableActions?.includes('START_EVENT_REGISTRATION')) {
    return createLokiAction(LOKI_APP_ACTIONS.START_EVENT_REGISTRATION, payloadFor(type, item, LOKI_APP_ACTIONS.START_EVENT_REGISTRATION));
  }
  if (type === 'partner' && scenario.availableActions?.includes('ADD_FAVORITE_PARTNER')) {
    return createLokiAction(LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER, payloadFor(type, item, LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER));
  }
  if (type === 'partner') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, payloadFor(type, item, LOKI_APP_ACTIONS.OPEN_PARTNER));
  if (type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, payloadFor(type, item, LOKI_APP_ACTIONS.OPEN_EVENT));
  if (type === 'news') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, payloadFor(type, item, LOKI_APP_ACTIONS.OPEN_NEWS));
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, payloadFor(type, item, LOKI_APP_ACTIONS.OPEN_EXPERTS));
}

function cardFor(row, scenario) {
  const { item, type } = row;
  const action = actionFor(type, item, scenario);
  const label = action.type === LOKI_APP_ACTIONS.START_EVENT_REGISTRATION ? 'К регистрации' : action.type === LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER ? 'В избранное' : type === 'news' ? 'Читать' : 'Открыть';
  const profile = item?.aiProfile && (type === 'partner' || type === 'expert') ? item.aiProfile : null;
  return {
    id: item?.id ?? `${type}-${titleOf(item, type)}`,
    type,
    title: titleOf(item, type === 'event' ? 'Мероприятие' : type === 'expert' ? 'Эксперт' : type === 'news' ? 'Новость' : 'Партнёр'),
    text: profile?.summary || item?.description || item?.summary || item?.address || item?.specialization || item?.category || 'Открою карточку, чтобы посмотреть детали.',
    image: imageOf(item),
    meta: [profile?.specialization || item?.categoryLabel || item?.category || item?.specialization || '', item?.address || item?.place || '', item?.offer || item?.promo || ''].filter(Boolean).slice(0, 3),
    action,
    label,
    actions: [
      { label, action },
      item?.address ? { label: 'Маршрут', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP) } : null,
    ].filter(Boolean),
  };
}

function fallbackActionCard(scenario) {
  const actionType = scenario.id === 'apg.qr' && scenario.availableActions?.includes('START_QR_SCANNER') ? LOKI_APP_ACTIONS.START_QR_SCANNER
    : scenario.availableActions?.includes('SHOW_PROFILE') ? LOKI_APP_ACTIONS.SHOW_PROFILE
      : scenario.availableActions?.includes('START_QR_SCANNER') ? LOKI_APP_ACTIONS.START_QR_SCANNER
        : scenario.availableActions?.includes('SHOW_ACHIEVEMENTS') ? LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS
          : scenario.availableActions?.includes('SHOW_FAVORITES') ? LOKI_APP_ACTIONS.SHOW_FAVORITES
            : scenario.availableActions?.includes('SHOW_NOTIFICATIONS') ? LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS
              : scenario.availableActions?.includes('OPEN_EVENTS') ? LOKI_APP_ACTIONS.OPEN_EVENTS
    : scenario.availableActions?.includes('OPEN_PARTNERS') ? LOKI_APP_ACTIONS.OPEN_PARTNERS
      : scenario.availableActions?.includes('OPEN_EXPERTS') ? LOKI_APP_ACTIONS.OPEN_EXPERTS
        : LOKI_APP_ACTIONS.OPEN_REFERENCE;
  return {
    id: `scenario-${scenario.id}`,
    type: 'scenario',
    title: scenario.title,
    text: 'Открою раздел, где можно продолжить действие в приложении.',
    action: createLokiAction(actionType),
    label: 'Открыть',
    actions: [{ label: 'Открыть', action: createLokiAction(actionType) }],
  };
}

function decisionText({ scenario, runtime, best, hasData }) {
  const title = best ? titleOf(best.item, scenario.title) : scenario.title;
  const reason = best
    ? best.type === 'event'
      ? 'оно лучше всего совпадает с задачей по теме и ближайшему времени'
      : best.type === 'partner'
        ? 'он сильнее других совпадает с задачей, категорией и доступными действиями'
        : best.type === 'expert'
          ? 'его профиль ближе всего к вопросу'
          : 'это самый релевантный материал по теме'
    : 'сейчас в загруженных данных нет уверенного объекта, поэтому безопаснее открыть профильный раздел';
  return [
    `Понял задачу: ${scenario.userGoal}`,
    `Анализ: учитываю ${runtime.timeOfDay}, экран ${runtime.activePanel || 'приложения'}, историю диалога и доступные данные АПГ.`,
    `Лучшее решение: ${hasData ? `«${title}»` : title}.`,
    `Почему: ${reason}.`,
    'Дальше: можно открыть карточку и сразу перейти к действию.',
  ].join('\n');
}

export function runBrainLayer({ query, context, history = [], debug = false }) {
  const detected = detectScenario({ query, context });
  if (!detected.scenario || detected.confidence < 0.28) return null;
  const runtime = runtimeContext(context, history);
  const queryWords = words(query);
  const candidates = collectCandidates({ context, scenario: detected.scenario, queryWords, runtime });
  const best = candidates[0] ?? null;
  const cards = candidates.length ? candidates.map(row => cardFor(row, detected.scenario)) : [fallbackActionCard(detected.scenario)];
  const result = {
    intent: `brain.${detected.scenario.id}`,
    format: 'decision',
    preserveText: true,
    text: decisionText({ scenario: detected.scenario, runtime, best, hasData: !!best }),
    card: cards[0] ?? null,
    cards,
    emotion: best ? 'helper' : 'thinking',
    brain: {
      scenarioId: detected.scenario.id,
      scenarioCategory: detected.scenario.category,
      scenarioTitle: detected.scenario.title,
      confidence: Number(detected.confidence.toFixed(2)),
      requiredData: detected.scenario.requiredData,
      availableActions: detected.scenario.availableActions,
      context: runtime,
    },
  };
  return debug ? { ...result, debugBrain: { score: detected.score, candidates: candidates.map(row => ({ type: row.type, id: row.item?.id, score: Number(row.score.toFixed(2)) })) } } : result;
}
