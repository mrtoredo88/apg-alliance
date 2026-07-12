export const DEFAULT_EVENT_CURRENCY = '₽';

function legacyPriceText(event) {
  return `${event?.pricePublic || ''} ${event?.priceClub || ''} ${event?.price || ''} ${event?.cost || ''}`.trim();
}

function legacyLooksFree(event) {
  const text = legacyPriceText(event).toLowerCase();
  return !text || text.includes('бесплат') || text.includes('free') || text === '0';
}

export function isPaidEvent(event) {
  if (!event) return false;
  if (event.priceType === 'paid') return true;
  if (event.priceType === 'free') return false;
  return !legacyLooksFree(event);
}

export function isFreeEvent(event) {
  return !isPaidEvent(event);
}

export function formatEventPrice(event) {
  if (!event) return '';
  if (event.priceType === 'free') return 'Бесплатно';
  if (event.priceType === 'paid') {
    const amount = Number(event.price);
    if (Number.isFinite(amount) && amount > 0) {
      const formatted = amount.toLocaleString('ru-RU');
      const currency = event.currency || DEFAULT_EVENT_CURRENCY;
      return `${event.priceIsFrom ? 'от ' : ''}${formatted} ${currency}`;
    }
    const legacy = String(event.pricePublic || event.priceClub || '').trim();
    return legacy || 'Платное';
  }
  const legacy = legacyPriceText(event);
  if (legacyLooksFree(event)) return 'Бесплатно';
  return String(event.pricePublic || event.priceClub || event.price || event.cost || legacy).trim();
}
