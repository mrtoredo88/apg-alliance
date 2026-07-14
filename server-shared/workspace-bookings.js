import {
  BOOKING_ACTIVE_STATUSES,
  BOOKING_STATUSES,
  bookingBlocksSlot,
  formatBookingDateKey,
  normalizeBooking,
} from './booking.js';

export const BOOKING_SOURCE_LABELS = {
  'booking-flow': 'Каталог',
  catalog: 'Каталог',
  event: 'Мероприятие',
  qr: 'QR',
  invite: 'Приглашение',
  news: 'Новости',
  direct: 'Прямая ссылка',
  admin: 'Администратор',
  manual: 'Ручное создание',
  api: 'API',
  workspace: 'Workspace',
};

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function toMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatBookingDateKey(date);
}

export function getBookingSourceLabel(booking = {}) {
  const source = text(booking.source || booking.bookingSource || booking.origin || '', 80).toLowerCase();
  return BOOKING_SOURCE_LABELS[source] || (source ? source : 'Каталог');
}

export function isWorkspaceBookingArchived(booking = {}) {
  return booking.archived === true || booking.workspaceArchived === true || booking.status === BOOKING_STATUSES.archived;
}

export function filterWorkspaceBookings(bookings = [], options = {}) {
  const includeArchived = options.includeArchived === true;
  return (Array.isArray(bookings) ? bookings : [])
    .map(normalizeBooking)
    .filter(item => includeArchived || !isWorkspaceBookingArchived(item));
}

export function buildWorkspaceBookingSearchText(booking = {}) {
  const item = normalizeBooking(booking);
  return [
    item.userName,
    item.userPhone,
    item.userTelegram,
    item.userEmail,
    item.serviceTitle,
    item.specialistName,
    item.dateLabel,
    item.time,
    item.comment,
    item.internalNotes,
    item.providerName,
    getBookingSourceLabel(item),
  ].map(value => text(value, 400).toLowerCase()).join(' ');
}

export function buildWorkspaceBookingKpis(bookings = [], now = new Date()) {
  const rows = filterWorkspaceBookings(bookings);
  const today = dayKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dayKey(tomorrowDate);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const nowMs = toMs(now);
  const weekEndMs = weekEnd.getTime();
  return {
    today: rows.filter(item => item.dateKey === today || dayKey(item.startAt) === today).length,
    tomorrow: rows.filter(item => item.dateKey === tomorrow || dayKey(item.startAt) === tomorrow).length,
    week: rows.filter(item => item.startMs >= nowMs && item.startMs < weekEndMs).length,
    pending: rows.filter(item => item.status === BOOKING_STATUSES.pending || item.status === BOOKING_STATUSES.new).length,
    rescheduled: rows.filter(item => item.status === BOOKING_STATUSES.rescheduled || item.status === BOOKING_STATUSES.rescheduleRequested).length,
    completed: rows.filter(item => item.status === BOOKING_STATUSES.completed).length,
    noShow: rows.filter(item => item.status === BOOKING_STATUSES.noShow).length,
    cancelled: rows.filter(item => [BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider].includes(item.status)).length,
  };
}

export function sanitizeBookingInternalNotes(value) {
  return text(value, 3000);
}

export function buildBookingChangeEntry({ type = 'note', actorId = '', actorRole = '', text: body = '', changes = {}, at = null } = {}) {
  return {
    type: text(type, 80),
    actorId: text(actorId, 180),
    actorRole: text(actorRole, 60),
    text: text(body, 1000),
    changes: changes && typeof changes === 'object' ? changes : {},
    at: at || new Date().toISOString(),
  };
}

export function findBookingConflicts(bookings = [], slot = {}, ignoreBookingId = '') {
  return filterWorkspaceBookings(bookings, { includeArchived: false })
    .filter(item => bookingBlocksSlot(item, slot, { ignoreBookingId }))
    .map(item => ({ id: item.id || item.bookingId, title: item.userName || item.serviceTitle || 'Встреча', startAt: item.startAt, endAt: item.endAt }))
    .slice(0, 10);
}

export function buildFreeTimeSlots({ bookings = [], date = new Date(), slotTimes = [], durationMinutes = 60, providerType = '', providerId = '', specialistId = 'default' } = {}) {
  const dateKey = dayKey(date);
  const times = Array.isArray(slotTimes) && slotTimes.length ? slotTimes : ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];
  return times.slice(0, 18).map(time => {
    const startAt = new Date(`${dateKey}T${time}:00`);
    const endAt = new Date(startAt.getTime() + Math.max(15, Number(durationMinutes || 60)) * 60000);
    const slot = { providerType, providerId, specialistId, startAt: startAt.toISOString(), endAt: endAt.toISOString() };
    const conflicts = findBookingConflicts(bookings, slot);
    return {
      time,
      startAt: slot.startAt,
      endAt: slot.endAt,
      occupied: conflicts.length > 0,
      conflicts,
    };
  }).filter(item => !Number.isNaN(new Date(item.startAt).getTime()));
}

export function buildBookingContactActions(booking = {}) {
  const item = normalizeBooking(booking);
  return {
    phone: text(item.userPhone || item.phone || ''),
    telegram: text(item.userTelegram || item.telegramUrl || ''),
    whatsapp: text(item.userWhatsapp || item.whatsappUrl || ''),
    email: text(item.userEmail || item.email || ''),
  };
}
