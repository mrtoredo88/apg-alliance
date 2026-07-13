export const CONTEXT_DIALOG_TYPES = {
  partner: {
    label: 'Партнер',
    collection: 'partners',
    idField: 'partnerId',
    titleFallback: 'Партнер АПГ',
  },
  expert: {
    label: 'Эксперт',
    collection: 'experts',
    idField: 'expertId',
    titleFallback: 'Эксперт АПГ',
  },
  event: {
    label: 'Мероприятие',
    collection: 'events',
    idField: 'eventId',
    titleFallback: 'Мероприятие АПГ',
  },
  promotion: {
    label: 'Акция',
    collection: 'partners',
    idField: 'promotionId',
    titleFallback: 'Акция АПГ',
  },
  booking: {
    label: 'Запись',
    collection: 'bookings',
    idField: 'bookingId',
    titleFallback: 'Запись',
  },
  review: {
    label: 'Отзыв',
    collection: 'reviews',
    idField: 'reviewId',
    titleFallback: 'Отзыв',
  },
  order: {
    label: 'Заказ',
    collection: 'orders',
    idField: 'orderId',
    titleFallback: 'Заказ',
  },
  support: {
    label: 'Поддержка',
    collection: 'support',
    idField: 'supportId',
    titleFallback: 'Обращение',
  },
};

export function normalizeDialogType(type) {
  const value = String(type || '').trim().toLowerCase();
  return CONTEXT_DIALOG_TYPES[value] ? value : '';
}

export function safeDialogIdPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ:_-]+/g, '_')
    .slice(0, 160);
}

export function buildContextDialogId(userId, type, objectId) {
  const safeUser = safeDialogIdPart(userId);
  const safeType = safeDialogIdPart(normalizeDialogType(type));
  const safeObject = safeDialogIdPart(objectId);
  if (!safeUser || !safeType || !safeObject) return '';
  return `${safeUser}__${safeType}__${safeObject}`;
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && typeof value !== 'object' && String(value).trim()) return String(value).trim();
  }
  return '';
}

function compactList(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).flat().map(value => String(value || '').trim()).filter(Boolean))];
}

export function buildDialogContext(type, item = {}, extra = {}) {
  const normalizedType = normalizeDialogType(type);
  const meta = CONTEXT_DIALOG_TYPES[normalizedType];
  if (!meta) return null;
  const objectId = firstText(
    extra.objectId,
    item.id,
    item[meta.idField],
    normalizedType === 'promotion' ? item.partnerId : '',
  );
  if (!objectId) return null;
  const isPromotion = normalizedType === 'promotion';
  const title = isPromotion
    ? firstText(item.offerTitle, item.promotionTitle, item.offer, item.name, meta.titleFallback)
    : firstText(item.title, item.name, item.displayName, item.eventTitle, meta.titleFallback);
  const parentTitle = firstText(item.partnerName, item.partner, item.organizer, isPromotion ? item.name : '');
  const subtitle = firstText(
    extra.subtitle,
    isPromotion ? parentTitle : '',
    item.categoryLabel,
    item.specialization,
    item.date,
    item.startAt,
    item.address,
    meta.label,
  );
  const ownerUserIds = compactList([
    extra.ownerUserIds,
    item.ownerUserIds,
    item.ownerIds,
    item.ownerId,
    item.ownerUserId,
    item.userId,
    item.managerUserId,
    item.createdByUserId,
  ]);
  return {
    type: normalizedType,
    objectId,
    title,
    subtitle,
    parentTitle,
    label: meta.label,
    image: firstText(item.logoUrl, item.photo, item.coverPhoto, item.coverUrl, item.imageUrl, item.image),
    description: firstText(item.description, item.fullDescription, item.details, item.about, item.offer),
    address: firstText(item.address, item.location, item.place, item.venue),
    hours: firstText(item.hours, item.workingHours, item.scheduleText),
    phone: firstText(item.phone, item.tel, item.phoneNumber),
    date: firstText(item.date, item.startAt, item.eventDate),
    status: firstText(item.statusLabel, item.status),
    partnerId: firstText(item.partnerId, normalizedType === 'partner' || isPromotion ? objectId : ''),
    expertId: firstText(item.expertId, normalizedType === 'expert' ? objectId : ''),
    eventId: firstText(item.eventId, normalizedType === 'event' ? objectId : ''),
    promotionId: firstText(item.promotionId, isPromotion ? objectId : ''),
    bookingId: firstText(item.bookingId, normalizedType === 'booking' ? objectId : ''),
    reviewId: firstText(item.reviewId, normalizedType === 'review' ? objectId : ''),
    ownerUserIds,
    source: firstText(extra.source, item.source, 'context-dialog'),
  };
}

export function getDialogObjectLabel(context = {}) {
  const type = normalizeDialogType(context.type);
  return CONTEXT_DIALOG_TYPES[type]?.label || 'Объект';
}

export function buildDialogDeepLink(dialogId) {
  const id = safeDialogIdPart(dialogId);
  return id ? `/dialogs?dialogId=${encodeURIComponent(id)}` : '/dialogs';
}

export function buildDialogNotificationTitle(context = {}) {
  const type = normalizeDialogType(context.type);
  const title = firstText(context.title, context.parentTitle, CONTEXT_DIALOG_TYPES[type]?.titleFallback, 'Новое сообщение');
  if (type === 'event') return `🎫 ${title}`;
  if (type === 'expert') return `✦ ${title}`;
  if (type === 'promotion') return `🎁 ${firstText(context.parentTitle, title)}`;
  if (type === 'partner') return `💬 ${title}`;
  return `💬 ${title}`;
}

export function buildDialogNotificationBody(context = {}, { senderRole = '', messageCount = 1, senderName = '' } = {}) {
  const type = normalizeDialogType(context.type);
  const count = Math.max(Number(messageCount || 1), 1);
  if (count > 1) {
    const title = firstText(context.parentTitle, context.title, senderName, 'АПГ');
    const more = count - 1;
    const moreWord = more === 1 ? 'сообщение' : 'сообщения';
    return count >= 4 ? `У вас ${count} новых сообщения` : `${title} отправил еще ${more} ${moreWord}`;
  }
  if (senderRole === 'loki') return 'Локи ответил в диалоге.';
  if (type === 'event') return senderRole === 'owner' ? 'Организатор отправил сообщение.' : 'Новое сообщение по мероприятию.';
  if (type === 'expert') return senderRole === 'owner' ? 'Ответил на ваш вопрос.' : 'Новый вопрос эксперту.';
  if (type === 'promotion') return 'Новое сообщение по акции.';
  if (type === 'partner') return senderRole === 'owner' ? 'Ответил на ваше сообщение.' : 'Новый вопрос партнеру.';
  return 'Новое сообщение в диалоге.';
}

export function buildDialogAutoAnswer(context = {}, text = '') {
  const query = String(text || '').toLowerCase();
  if (!query.trim()) return null;
  if (/(до скольк|когда|график|работа|открыт|закрыт|час)/i.test(query) && context.hours) {
    return `По данным карточки: ${context.hours}.`;
  }
  if (/(где|адрес|как добраться|маршрут|находит)/i.test(query) && context.address) {
    return `Адрес из карточки: ${context.address}.`;
  }
  if (/(телефон|позвон|контакт|связ)/i.test(query) && context.phone) {
    return `Контактный телефон: ${context.phone}.`;
  }
  if (/(когда|дата|время|начал)/i.test(query) && context.date) {
    return `В карточке указано: ${context.date}.`;
  }
  const description = String(context.description || '').toLowerCase();
  if (query.includes('ребен') || query.includes('дет')) {
    if (description.includes('дет') || description.includes('сем')) {
      return 'В описании есть упоминание детского или семейного формата. Для точных условий лучше уточнить у организатора.';
    }
  }
  return null;
}
