export const MESSAGING_DIALOG_TYPES = Object.freeze({
  direct: { id: 'direct', label: 'Личный диалог', category: 'PERSONAL' },
  partner: { id: 'partner', label: 'Партнер', category: 'PARTNER' },
  expert: { id: 'expert', label: 'Эксперт', category: 'PARTNER' },
  booking: { id: 'booking', label: 'Запись', category: 'PARTNER' },
  event: { id: 'event', label: 'Мероприятие', category: 'EVENT' },
  promotion: { id: 'promotion', label: 'Акция', category: 'PARTNER' },
  support: { id: 'support', label: 'Поддержка', category: 'SUPPORT' },
  news: { id: 'news', label: 'Новость', category: 'SYSTEM' },
  group: { id: 'group', label: 'Группа', category: 'GROUP' },
  review: { id: 'review', label: 'Отзыв', category: 'PARTNER' },
  order: { id: 'order', label: 'Заказ', category: 'PARTNER' },
});

export const MESSAGING_CATEGORIES = Object.freeze({
  PERSONAL: 'PERSONAL',
  PARTNER: 'PARTNER',
  EVENT: 'EVENT',
  SYSTEM: 'SYSTEM',
  GROUP: 'GROUP',
  SUPPORT: 'SUPPORT',
});

export const MESSAGING_FILTERS = Object.freeze([
  { id: 'all', label: 'Все', category: '' },
  { id: 'personal', label: 'Личные', category: 'PERSONAL' },
  { id: 'partners', label: 'Партнеры', category: 'PARTNER' },
  { id: 'events', label: 'Мероприятия', category: 'EVENT' },
  { id: 'groups', label: 'Группы', category: 'GROUP' },
  { id: 'unread', label: 'Непрочитанные', category: '' },
  { id: 'pinned', label: 'Закреплённые', category: '' },
  { id: 'archive', label: 'Архив', category: '' },
]);

export function normalizeMessagingType(type = '') {
  const value = String(type || '').trim().toLowerCase();
  if (MESSAGING_DIALOG_TYPES[value]) return value;
  if (value === 'contextdialogmessage' || value === 'message') return 'direct';
  return value || 'direct';
}

export function getMessagingTypeMeta(type = '') {
  const normalized = normalizeMessagingType(type);
  return MESSAGING_DIALOG_TYPES[normalized] || MESSAGING_DIALOG_TYPES.direct;
}

export function getMessagingCategory(type = '', context = {}) {
  const explicit = String(context?.category || context?.conversationCategory || '').trim().toUpperCase();
  if (MESSAGING_CATEGORIES[explicit]) return explicit;
  return getMessagingTypeMeta(type || context?.type).category;
}
