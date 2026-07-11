import { LOKI_APP_ACTIONS, createLokiAction } from '../lokiActionTypes.js';
import { getExpertTelHref } from '../../../server-shared/expert-directory.js';

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
  const rating = item?.avgRating || item?.rating || item?.stats?.rating || null;
  const hours = item?.hours || item?.workHours || '';
  const offer = item?.offer || item?.promo || item?.discount || '';
  const phone = item?.phone || '';
  const telHref = getExpertTelHref(phone);
  const url = item?.bookingUrl || item?.websiteUrl || item?.linkUrl || item?.vkUrl || item?.socialUrl || '';
  return {
    id: item?.id ?? `${type}-${titleOf(item, 'item')}`,
    type,
    title: titleOf(item, type === 'event' ? 'Мероприятие' : type === 'news' ? 'Новость' : 'Партнёр АПГ'),
    text: item?.address || item?.location || item?.place || item?.specialization || item?.categoryLabel || item?.category || item?.description || item?.text || 'Открою детали.',
    image: imageOf(item),
    meta: [
      rating ? `★ ${rating}` : '',
      hours ? `⌚ ${hours}` : '',
      item?.address ? `📍 ${item.address}` : '',
      offer ? `✨ ${offer}` : '',
    ].filter(Boolean).slice(0, 3),
    phone,
    url,
    action,
    label: type === 'news' ? 'Читать' : 'Открыть',
    actions: [
      { label: type === 'news' ? 'Читать' : 'Открыть', action },
      telHref ? { label: 'Позвонить', href: telHref } : null,
      item?.address ? { label: 'Маршрут', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP) } : null,
      url ? { label: 'Записаться', href: url } : null,
    ].filter(Boolean).slice(0, 4),
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
