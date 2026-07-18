import { TOOL_IDS } from './ToolRegistry.js';
import { ensureKnownTypes } from './ToolValidator.js';
import { normalizeQuery } from './ToolResult.js';

function includesAny(query, values = []) {
  return values.some(value => query.includes(value));
}

function baseCall(id, params = {}) {
  return { id, params };
}

export function resolveLokiTool({ question = '', intent = {}, reasoningResult = null, journeyResult = null, context = {} } = {}) {
  const query = normalizeQuery(question);
  const intentId = String(intent.id || reasoningResult?.intent || journeyResult?.intent || '').toLowerCase();
  if (!query) return null;
  if (includesAny(query, ['что мы уже сделали', 'что уже сделали'])) return null;

  if (includesAny(query, ['сколько у меня ключ', 'мои ключ', 'баланс ключ', 'ключей у меня'])) return baseCall(TOOL_IDS.USER_KEYS);
  if (includesAny(query, ['мой уровень', 'мой профиль', 'мои достижения', 'моя активность', 'моя серия', 'моя репутация'])) return baseCall(TOOL_IDS.USER_PROFILE);
  if (includesAny(query, ['баллы', 'очки', 'points'])) return baseCall(TOOL_IDS.USER_POINTS);

  if (includesAny(query, ['акции заканчиваются сегодня', 'скидки заканчиваются сегодня'])) return baseCall(TOOL_IDS.PROMOTION_EXPIRING_TODAY);
  if (includesAny(query, ['акции заканчиваются завтра', 'скидки заканчиваются завтра'])) return baseCall(TOOL_IDS.PROMOTION_EXPIRING_TOMORROW);
  if (includesAny(query, ['заканчиваются', 'истекают', 'последний день акции'])) return baseCall(TOOL_IDS.PROMOTION_EXPIRING);
  if (includesAny(query, ['новые акции', 'новые скидки', 'новые предложения'])) return baseCall(TOOL_IDS.PROMOTION_NEW);
  if (includesAny(query, ['акции', 'скидки', 'предложения', 'промо']) || intentId.includes('promotion')) return baseCall(TOOL_IDS.PROMOTION_ACTIVE);

  if (includesAny(query, ['что у меня завтра', 'мои записи завтра', 'запланировано завтра', 'встречи завтра'])) return baseCall(TOOL_IDS.MEETING_TOMORROW);
  if (includesAny(query, ['ближайшая запись', 'следующая запись', 'следующая встреча'])) return baseCall(TOOL_IDS.MEETING_NEXT);
  if (includesAny(query, ['мои записи', 'мои встречи', 'бронь', 'записи'])) return baseCall(TOOL_IDS.MEETING_LIST);

  if (includesAny(query, ['сегодня мероприятия', 'мероприятия сегодня', 'события сегодня'])) return baseCall(TOOL_IDS.EVENT_TODAY);
  if (includesAny(query, ['мои регистрации', 'куда я зарегистрирован', 'на что я записан'])) return baseCall(TOOL_IDS.EVENT_MY_REGISTRATIONS);
  if (includesAny(query, ['мероприятия', 'события', 'афиша']) || intentId.includes('event')) return baseCall(TOOL_IDS.EVENT_UPCOMING);

  if (includesAny(query, ['подарки доступны', 'доступные подарки', 'что получить за ключи', 'какие подарки мне доступны', 'что подарить за ключи', 'что за ключи', 'подарки за ключи', 'призы за ключи'])) return baseCall(TOOL_IDS.GIFT_AVAILABLE);
  if (includesAny(query, ['новые подарки', 'новые призы'])) return baseCall(TOOL_IDS.GIFT_NEW);
  if (includesAny(query, ['непросмотренные подарки', 'не видел подарки'])) return baseCall(TOOL_IDS.GIFT_UNVIEWED);

  if (includesAny(query, ['текущий путь', 'на каком этапе', 'продолжить путь'])) return baseCall(TOOL_IDS.JOURNEY_PROGRESS);
  if (includesAny(query, ['незавершенный путь', 'незавершённый путь', 'прерванный сценарий'])) return baseCall(TOOL_IDS.JOURNEY_UNFINISHED);
  if (includesAny(query, ['ближайшая награда', 'следующая награда'])) return baseCall(TOOL_IDS.JOURNEY_NEXT_REWARD);

  if (includesAny(query, ['workspace', 'кабинет', 'задачи workspace', 'непрочитанные диалоги', 'сводка workspace'])) return baseCall(TOOL_IDS.WORKSPACE_SUMMARY);

  if (includesAny(query, ['новости сегодня', 'публикации сегодня', 'что появилось сегодня', 'появились сегодня'])) return baseCall(TOOL_IDS.NEWS_TODAY);
  if (includesAny(query, ['последние новости', 'свежие новости', 'что нового', 'новости']) || intentId.includes('news')) return baseCall(TOOL_IDS.NEWS_LATEST);

  if (intentId.includes('search.partners') || includesAny(query, ['найди парт', 'покажи парт', 'где купить', 'где сделать', 'хочу услугу'])) return baseCall(TOOL_IDS.PARTNER_FIND, { query });
  if (intentId.includes('search.specialists') || includesAny(query, ['найди эксперт', 'покажи эксперт', 'нужен специалист', 'нужен стоматолог'])) return baseCall(TOOL_IDS.EXPERT_FIND, { query });
  if (intentId.includes('search.') || includesAny(query, ['найди', 'покажи', 'искать'])) {
    return baseCall(TOOL_IDS.SEARCH, { query, types: ensureKnownTypes(intent.types || []) });
  }

  const active = context?.memory?.activeContext || context?.memory?.lastContext || null;
  if (active?.type === 'partner' && includesAny(query, ['эту карточку', 'этого партнера', 'этого партнёра'])) return baseCall(TOOL_IDS.PARTNER_OPEN, { id: active.partnerId || active.id });
  return null;
}
