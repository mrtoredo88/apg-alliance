import { LOKI_APP_ACTIONS, createLokiAction } from '../lokiActionTypes.js';

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

export function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function titleOf(item, fallback) {
  return item?.name ?? item?.title ?? item?.headline ?? fallback;
}

export function imageOf(item) {
  return item?.coverPhoto || item?.imageUrl || item?.photo || item?.logoUrl || item?.photos?.[0] || item?.gallery?.[0] || '';
}

export function makeResultCard(item, type, action) {
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

export function emptyResult(text = 'Пока я этого не знаю. В АПГ пока нет информации об этом.') {
  return { text, card: null, cards: [] };
}

export function openNearbyResult({ auto = false } = {}) {
  const action = createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS);
  return {
    text: 'Я могу показать партнёров рядом. Геолокацию использую только если она разрешена в приложении.',
    card: {
      title: 'Рядом со мной',
      text: 'Открою карту ближайших партнёров АПГ.',
      action,
      label: 'Показать рядом',
    },
    cards: [],
    autoAction: auto ? action : null,
  };
}
