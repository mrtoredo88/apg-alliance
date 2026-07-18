import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';

function hasPhone(item = {}) {
  return Boolean(item.phone || item.mainLocation?.phone);
}

function hasAddress(item = {}) {
  return Boolean(item.address || item.mainLocation?.address);
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText || item.type === 'promotion');
}

function openAction(item = {}) {
  if (item.type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id, id: item.id });
  if (item.type === 'news') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id, id: item.id });
  if (item.type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.id, id: item.id });
  if (item.type === 'gift') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: item.id, id: item.id });
  if (item.type === 'location') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId, locationId: item.id });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || item.id, id: item.partnerId || item.id });
}

export function buildSuggestions({ top = null, ranked = [], intent = {} } = {}) {
  const item = top || ranked[0] || null;
  if (!item) {
    return [
      { label: 'Найти рядом', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS) },
      { label: 'Открыть каталог', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS) },
    ];
  }
  const suggestions = [
    { label: item.type === 'news' ? 'Открыть статью' : 'Открыть карточку', action: openAction(item) },
    hasAddress(item) ? { label: 'Показать маршрут', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP, { partnerId: item.partnerId || item.id, locationId: item.type === 'location' ? item.id : '' }) } : null,
    item.bookingUrl || item.bookingEnabled ? { label: 'Записаться', action: openAction(item) } : null,
    hasOffer(item) ? { label: 'Показать акции', action: openAction(item) } : null,
    item.locations?.length > 1 ? { label: 'Посмотреть филиалы', action: openAction(item) } : null,
    hasPhone(item) ? { label: 'Связаться', action: openAction(item) } : null,
    ranked.length > 3 ? { label: 'Показать ещё', action: intent.id === 'search.specialists' ? createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS) : createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS) } : null,
  ].filter(Boolean);
  const seen = new Set();
  return suggestions.filter(item => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  }).slice(0, 3);
}
