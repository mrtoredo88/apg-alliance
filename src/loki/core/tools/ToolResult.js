import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { imageOf, normalizeText, titleOf, toMillis } from '../lokiCoreUtils.js';
import { makeKnowledgeResultCard, searchKnowledge } from '../knowledge/KnowledgeProvider.js';

export function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function text(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function dayKey(value = Date.now()) {
  const date = new Date(toMillis(value) || value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('sv') : '';
}

export function isSameDay(value, offsetDays = 0) {
  const ms = toMillis(value);
  if (!ms) return false;
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  const date = new Date(ms);
  return date.getFullYear() === target.getFullYear()
    && date.getMonth() === target.getMonth()
    && date.getDate() === target.getDate();
}

export function isUpcoming(value) {
  const ms = toMillis(value);
  return ms > Date.now() - 3600000;
}

export function itemDate(item = {}) {
  return toMillis(item.publishedAt ?? item.createdAt ?? item.startAt ?? item.startsAt ?? item.date ?? item.updatedAt);
}

export function isNew(item = {}, days = 7) {
  const ms = itemDate(item);
  return ms ? Date.now() - ms <= days * 86400000 : false;
}

export function actionForToolItem(item = {}, type = item.type) {
  const id = item.id || item.partnerId || item.expertId || item.eventId || item.newsId || item.prizeId;
  if (type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: id, id });
  if (type === 'news' || type === 'article') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: id, id });
  if (type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: id, id });
  if (type === 'gift' || type === 'prize') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: id, id });
  if (type === 'promotion') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || item.source?.id || id, id: item.partnerId || item.source?.id || id });
  if (type === 'booking' || type === 'meeting') return createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE, { bookingId: id, meetingId: id });
  if (type === 'location') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || id, locationId: item.locationId || item.id, id: item.partnerId || id });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || id, id: item.partnerId || id });
}

export function cardForToolItem(item = {}, type = item.type, extra = {}) {
  const sourceType = type === 'promotion' ? 'partner' : type === 'meeting' ? 'booking' : type;
  const card = ['partner', 'expert', 'event', 'news', 'article', 'gift', 'location'].includes(sourceType)
    ? makeKnowledgeResultCard(item.source || item, sourceType, extra)
    : null;
  const action = extra.action || actionForToolItem(item, type);
  if (card) {
    return {
      ...card,
      image: card.image || imageOf(item),
      action: card.action || action,
      label: card.label || (type === 'news' ? 'Читать' : type === 'gift' ? 'Посмотреть' : 'Открыть'),
    };
  }
  return {
    id: String(item.id || `${type}-${titleOf(item, type)}`),
    type,
    title: titleOf(item, type === 'booking' ? 'Запись' : 'Данные АПГ'),
    text: text(item.summary || item.description || item.text || item.status || item.locationTitle || item.providerName || 'Открою детали в АПГ.', 180),
    image: imageOf(item),
    label: type === 'booking' || type === 'meeting' ? 'Открыть профиль' : 'Открыть',
    action,
  };
}

export function buildToolResult({
  tool,
  method,
  intent,
  title,
  text: answer,
  items = [],
  itemType = '',
  data = {},
  emptyText = 'По текущим данным ничего не нашёл. Ничего не придумываю.',
  meta = {},
} = {}) {
  const rows = list(items);
  const cards = rows.slice(0, 5).map(item => cardForToolItem(item, itemType || item.type)).filter(Boolean);
  return {
    intent: intent || `tool.${tool}.${method}`,
    preserveText: true,
    text: rows.length || answer ? answer || `Нашёл ${rows.length} ${title || 'объектов'} в актуальных данных АПГ.` : emptyText,
    card: cards[0] || null,
    cards,
    data,
    toolResult: {
      tool,
      method,
      count: rows.length,
      success: true,
      source: 'loki_tool_layer',
      meta,
    },
  };
}

export function sourceSearch(knowledge, query, types = [], limit = 5) {
  return searchKnowledge(knowledge, query, types, limit)
    .map(row => {
      const key = row.type === 'gift' ? 'gifts' : row.type === 'article' ? 'news' : `${row.type}s`;
      return list(knowledge.sources?.[key]).find(item => String(item.id) === String(row.id)) || row;
    });
}

export function normalizeQuery(value) {
  return normalizeText(value);
}
