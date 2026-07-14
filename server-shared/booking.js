export const BOOKING_STATUSES = {
  pending: 'pending',
  new: 'new',
  confirmed: 'confirmed',
  rescheduleRequested: 'reschedule_requested',
  rescheduled: 'rescheduled',
  cancelled: 'cancelled',
  cancelledByUser: 'cancelled_by_user',
  cancelledByProvider: 'cancelled_by_provider',
  completed: 'completed',
  noShow: 'no_show',
  archived: 'archived',
};

export const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUSES.pending]: 'Ожидает подтверждения',
  [BOOKING_STATUSES.new]: 'Новая',
  [BOOKING_STATUSES.confirmed]: 'Подтверждена',
  [BOOKING_STATUSES.rescheduleRequested]: 'Запрошен перенос',
  [BOOKING_STATUSES.rescheduled]: 'Перенесена',
  [BOOKING_STATUSES.cancelled]: 'Отменена',
  [BOOKING_STATUSES.cancelledByUser]: 'Отменена пользователем',
  [BOOKING_STATUSES.cancelledByProvider]: 'Отменена партнером',
  [BOOKING_STATUSES.completed]: 'Завершена',
  [BOOKING_STATUSES.noShow]: 'Не пришел',
  [BOOKING_STATUSES.archived]: 'Архив',
};

export const BOOKING_STATUS_TONES = {
  [BOOKING_STATUSES.pending]: 'pending',
  [BOOKING_STATUSES.new]: 'pending',
  [BOOKING_STATUSES.confirmed]: 'confirmed',
  [BOOKING_STATUSES.rescheduleRequested]: 'reschedule',
  [BOOKING_STATUSES.rescheduled]: 'confirmed',
  [BOOKING_STATUSES.cancelled]: 'cancelled',
  [BOOKING_STATUSES.cancelledByUser]: 'cancelled',
  [BOOKING_STATUSES.cancelledByProvider]: 'cancelled',
  [BOOKING_STATUSES.completed]: 'completed',
  [BOOKING_STATUSES.noShow]: 'cancelled',
  [BOOKING_STATUSES.archived]: 'completed',
};

export const BOOKING_TRANSITIONS = Object.freeze({
  [BOOKING_STATUSES.pending]: [
    BOOKING_STATUSES.confirmed,
    BOOKING_STATUSES.rescheduleRequested,
    BOOKING_STATUSES.cancelledByUser,
    BOOKING_STATUSES.cancelledByProvider,
  ],
  [BOOKING_STATUSES.new]: [
    BOOKING_STATUSES.confirmed,
    BOOKING_STATUSES.rescheduleRequested,
    BOOKING_STATUSES.cancelledByUser,
    BOOKING_STATUSES.cancelledByProvider,
  ],
  [BOOKING_STATUSES.confirmed]: [
    BOOKING_STATUSES.rescheduleRequested,
    BOOKING_STATUSES.rescheduled,
    BOOKING_STATUSES.cancelledByUser,
    BOOKING_STATUSES.cancelledByProvider,
    BOOKING_STATUSES.completed,
    BOOKING_STATUSES.noShow,
  ],
  [BOOKING_STATUSES.rescheduleRequested]: [
    BOOKING_STATUSES.confirmed,
    BOOKING_STATUSES.rescheduled,
    BOOKING_STATUSES.cancelledByUser,
    BOOKING_STATUSES.cancelledByProvider,
  ],
  [BOOKING_STATUSES.rescheduled]: [
    BOOKING_STATUSES.confirmed,
    BOOKING_STATUSES.rescheduleRequested,
    BOOKING_STATUSES.cancelledByUser,
    BOOKING_STATUSES.cancelledByProvider,
    BOOKING_STATUSES.completed,
    BOOKING_STATUSES.noShow,
  ],
  [BOOKING_STATUSES.cancelled]: [],
  [BOOKING_STATUSES.cancelledByUser]: [],
  [BOOKING_STATUSES.cancelledByProvider]: [],
  [BOOKING_STATUSES.completed]: [],
  [BOOKING_STATUSES.noShow]: [],
  [BOOKING_STATUSES.archived]: [],
});

export const BOOKING_BLOCKING_STATUSES = [
  BOOKING_STATUSES.pending,
  BOOKING_STATUSES.new,
  BOOKING_STATUSES.confirmed,
  BOOKING_STATUSES.rescheduleRequested,
  BOOKING_STATUSES.rescheduled,
];

export const BOOKING_ACTIVE_STATUSES = [
  BOOKING_STATUSES.pending,
  BOOKING_STATUSES.new,
  BOOKING_STATUSES.confirmed,
  BOOKING_STATUSES.rescheduleRequested,
  BOOKING_STATUSES.rescheduled,
];

export const BOOKING_HISTORY_STATUSES = [
  BOOKING_STATUSES.cancelled,
  BOOKING_STATUSES.cancelledByUser,
  BOOKING_STATUSES.cancelledByProvider,
  BOOKING_STATUSES.completed,
  BOOKING_STATUSES.noShow,
  BOOKING_STATUSES.archived,
];

const DEFAULT_SLOT_TIMES = ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];
const DEFAULT_SERVICE_DURATION = 60;

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function asList(value) {
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.name || item?.title || '').map(item => text(item)).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\n|;|,/).map(item => text(item)).filter(Boolean);
  }
  return [];
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function timeMs(value) {
  if (!value) return 0;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function normalizeBookingStatus(status) {
  const value = text(status, 80);
  if (value === BOOKING_STATUSES.new) return BOOKING_STATUSES.pending;
  if (value === BOOKING_STATUSES.cancelled) return BOOKING_STATUSES.cancelledByUser;
  return Object.values(BOOKING_STATUSES).includes(value) ? value : BOOKING_STATUSES.pending;
}

export function getBookingStatusLabel(status) {
  return BOOKING_STATUS_LABELS[normalizeBookingStatus(status)] || BOOKING_STATUS_LABELS[BOOKING_STATUSES.pending];
}

export function getBookingStatusTone(status) {
  return BOOKING_STATUS_TONES[normalizeBookingStatus(status)] || 'pending';
}

export function canTransitionBookingStatus(fromStatus, toStatus) {
  const from = normalizeBookingStatus(fromStatus);
  const to = normalizeBookingStatus(toStatus);
  return from === to || (BOOKING_TRANSITIONS[from] || []).includes(to);
}

export function isBookingSlotBlocking(status) {
  return BOOKING_BLOCKING_STATUSES.includes(normalizeBookingStatus(status));
}

export function isBookingFinalStatus(status) {
  return BOOKING_HISTORY_STATUSES.includes(normalizeBookingStatus(status));
}

export function rangesOverlap(startA, endA, startB, endB) {
  const a1 = timeMs(startA);
  const a2 = timeMs(endA);
  const b1 = timeMs(startB);
  const b2 = timeMs(endB);
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

export function bookingBlocksSlot(booking = {}, slot = {}, options = {}) {
  if (!booking || options.ignoreBookingId && String(booking.id || booking.bookingId || '') === String(options.ignoreBookingId)) return false;
  if (!isBookingSlotBlocking(booking.status)) return false;
  const sameProvider = !slot.providerType || !slot.providerId || (booking.providerType === slot.providerType && String(booking.providerId || '') === String(slot.providerId || ''));
  if (!sameProvider) return false;
  const bookingSpecialist = String(booking.specialistId || 'default');
  const slotSpecialist = String(slot.specialistId || 'default');
  const sameSpecialist = bookingSpecialist === slotSpecialist || bookingSpecialist === 'any' || slotSpecialist === 'any';
  if (!sameSpecialist) return false;
  return rangesOverlap(booking.startAt, booking.endAt, slot.startAt, slot.endAt);
}

export function buildBookingHistoryEntry({ fromStatus = '', toStatus = '', actorId = '', actorRole = '', reason = '', changes = {}, at = null } = {}) {
  return {
    fromStatus: fromStatus ? normalizeBookingStatus(fromStatus) : '',
    toStatus: toStatus ? normalizeBookingStatus(toStatus) : '',
    actorId: text(actorId, 180),
    actorRole: text(actorRole, 40),
    reason: text(reason, 800),
    changes: changes && typeof changes === 'object' ? changes : {},
    at: at || new Date().toISOString(),
  };
}

export function buildBookingReminders(startAt) {
  const startMs = timeMs(startAt);
  if (!startMs) return [];
  return [
    { type: '24h', label: 'За сутки', scheduledAt: new Date(startMs - 24 * 60 * 60 * 1000).toISOString(), status: 'scheduled' },
    { type: '2h', label: 'За два часа', scheduledAt: new Date(startMs - 2 * 60 * 60 * 1000).toISOString(), status: 'scheduled' },
  ].filter(item => new Date(item.scheduledAt).getTime() > Date.now());
}

export function normalizeBooking(booking = {}) {
  const status = normalizeBookingStatus(booking.status);
  const startMs = timeMs(booking.startAt);
  const endMs = timeMs(booking.endAt);
  const journey = normalizeBookingJourney(booking.journey || booking);
  return {
    ...booking,
    id: text(booking.id || booking.bookingId, 180),
    bookingId: text(booking.bookingId || booking.id, 180),
    status,
    statusLabel: getBookingStatusLabel(status),
    statusTone: getBookingStatusTone(status),
    statusHistory: Array.isArray(booking.statusHistory) ? booking.statusHistory : [],
    startMs,
    endMs,
    journey,
    isActive: BOOKING_ACTIVE_STATUSES.includes(status),
    isFinal: BOOKING_HISTORY_STATUSES.includes(status),
  };
}

export function normalizeBookingJourney(source = {}) {
  const stampProgress = source.stampProgress && typeof source.stampProgress === 'object' ? source.stampProgress : {};
  const nextSteps = Array.isArray(source.nextSteps) ? source.nextSteps : [];
  return {
    visitCompletedAt: text(source.visitCompletedAt || ''),
    rewardedAt: text(source.rewardedAt || ''),
    reviewPromptAvailable: Boolean(source.reviewPromptAvailable),
    reviewPublishedAt: text(source.reviewPublishedAt || ''),
    keysAwarded: Math.max(0, Number(source.keysAwarded || 0)),
    reputationAwarded: Math.max(0, Number(source.reputationAwarded || 0)),
    stampAwarded: Boolean(source.stampAwarded),
    stampProgress: {
      providerId: text(stampProgress.providerId || source.providerId || '', 160),
      current: Math.max(0, Number(stampProgress.current || 0)),
      target: Math.max(0, Number(stampProgress.target || 0)),
      completed: Boolean(stampProgress.completed),
    },
    nextSteps: nextSteps.map(item => ({
      id: text(item?.id || '', 80),
      label: text(item?.label || '', 160),
      action: text(item?.action || '', 80),
    })).filter(item => item.id && item.label),
  };
}

export function buildBookingJourneySummary(booking = {}) {
  const normalized = normalizeBooking(booking);
  const journey = normalized.journey || {};
  const parts = [];
  if (journey.keysAwarded > 0) parts.push(`+${journey.keysAwarded} ключа`);
  if (journey.stampAwarded) {
    const progress = journey.stampProgress || {};
    parts.push(progress.target > 0 ? `штамп ${progress.current}/${progress.target}` : 'штамп начислен');
  }
  if (journey.reviewPromptAvailable && !journey.reviewPublishedAt) parts.push('можно оставить отзыв');
  return parts.join(' · ');
}

export function buildPostVisitMomentState(booking = {}, { provider = {}, userKeys = 0 } = {}) {
  const sourceBooking = booking && typeof booking === 'object' ? booking : {};
  const sourceProvider = provider && typeof provider === 'object' ? provider : {};
  const normalized = normalizeBooking(sourceBooking);
  const journey = normalized.journey || {};
  const progress = journey.stampProgress || {};
  const providerName = text(normalized.providerName || sourceProvider.name || normalized.title || 'Партнёр АПГ', 180);
  const keysAwarded = Math.max(0, Number(journey.keysAwarded || normalized.keysAwarded || 0));
  const stampTarget = Math.max(0, Number(progress.target || sourceProvider.stampTarget || sourceProvider.loyaltyStampTarget || 0));
  const stampCurrent = Math.max(0, Number(progress.current || 0));
  const hasStampCard = stampTarget > 0;
  const stampsLeft = hasStampCard ? Math.max(0, stampTarget - stampCurrent) : 0;
  const serviceTitle = text(normalized.serviceTitle || '', 160);
  const regularWords = ['массаж', 'маникюр', 'педикюр', 'стриж', 'салон', 'стомат', 'психолог', 'трен', 'йога', 'фитнес', 'космет', 'консультац'];
  const regularText = `${serviceTitle} ${sourceProvider.categoryLabel || ''} ${sourceProvider.specialization || ''}`.toLowerCase();
  const canRepeat = regularWords.some(word => regularText.includes(word)) || Boolean(normalized.providerId);
  const achievement = stampCurrent > 0 && (stampCurrent === 1 || stampCurrent === 5 || (hasStampCard && stampCurrent >= stampTarget))
    ? {
        id: hasStampCard && stampCurrent >= stampTarget ? 'stamp_card_complete' : stampCurrent >= 5 ? 'fifth_visit' : 'first_meeting_visit',
        title: hasStampCard && stampCurrent >= stampTarget ? 'Штамп-карта заполнена' : stampCurrent >= 5 ? 'Пятое посещение' : 'Первый визит после записи',
      }
    : null;

  return {
    visible: normalized.status === BOOKING_STATUSES.completed && Boolean(journey.rewardedAt),
    bookingId: normalized.id || normalized.bookingId,
    providerType: normalized.providerType === 'expert' ? 'expert' : 'partner',
    providerId: text(normalized.providerId || '', 180),
    providerName,
    serviceTitle,
    dateText: [normalized.dateLabel, normalized.time].filter(Boolean).join(' '),
    keysAwarded,
    balance: Math.max(0, Number(userKeys || 0)),
    hasStampCard,
    stampCurrent,
    stampTarget,
    stampsLeft,
    stampCompleted: hasStampCard && stampCurrent >= stampTarget,
    achievement,
    canReview: Boolean(journey.reviewPromptAvailable && !journey.reviewPublishedAt),
    canRepeat,
    dialogId: text(normalized.dialogId || '', 260),
    lokiText: 'Спасибо! Надеюсь, вам понравилось. Если возникли вопросы, я помогу связаться с партнёром.',
  };
}

export function groupBookingsForProfile(bookings = [], now = Date.now()) {
  const normalized = (Array.isArray(bookings) ? bookings : []).map(normalizeBooking).sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  return {
    pending: normalized.filter(item => item.status === BOOKING_STATUSES.pending || item.status === BOOKING_STATUSES.new),
    actionRequired: normalized.filter(item => item.status === BOOKING_STATUSES.rescheduleRequested),
    upcoming: normalized.filter(item => item.isActive && item.status !== BOOKING_STATUSES.pending && item.startMs >= now),
    past: normalized.filter(item => !item.isFinal && item.startMs && item.startMs < now),
    cancelled: normalized.filter(item => [BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider].includes(item.status)),
    completed: normalized.filter(item => item.status === BOOKING_STATUSES.completed || item.status === BOOKING_STATUSES.noShow),
    all: normalized,
  };
}

export function buildBookingCalendar({ bookings = [], from, to, specialistId = '', status = '' } = {}) {
  const fromMs = timeMs(from) || 0;
  const toMs = timeMs(to) || Number.MAX_SAFE_INTEGER;
  const wantedSpecialist = text(specialistId, 80);
  const wantedStatus = text(status, 80);
  return (Array.isArray(bookings) ? bookings : [])
    .map(normalizeBooking)
    .filter(item => item.startMs >= fromMs && item.startMs < toMs)
    .filter(item => !wantedSpecialist || String(item.specialistId || '') === wantedSpecialist)
    .filter(item => !wantedStatus || item.status === normalizeBookingStatus(wantedStatus))
    .sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
}

export function isOnlineBookingEnabled(profile = {}) {
  return profile.bookingEnabled === true || profile.onlineBookingEnabled === true || profile.bookingMode === 'apg' || Boolean(profile.bookingUrl && asList(profile.services || profile.serviceDescription || profile.directions).length);
}

export function buildBookingServices(profile = {}) {
  const configured = Array.isArray(profile.bookingServices) ? profile.bookingServices : [];
  const fromConfigured = configured.map((item, index) => ({
    id: text(item?.id || `service_${index + 1}`, 80),
    title: text(item?.title || item?.name || `Услуга ${index + 1}`, 160),
    description: text(item?.description, 600),
    durationMinutes: numberOr(item?.durationMinutes || item?.duration, DEFAULT_SERVICE_DURATION),
    price: text(item?.price || item?.cost || item?.serviceCost, 80),
    category: text(item?.category || profile.categoryLabel || profile.category, 120),
    color: text(item?.color || '#D7B86A', 30),
  })).filter(item => item.title);
  if (fromConfigured.length) return fromConfigured;

  const fallbackServices = asList(profile.services || profile.serviceDescription || profile.directions);
  const fallbackPrices = asList(profile.prices || profile.serviceCost || profile.consultationPrice);
  return (fallbackServices.length ? fallbackServices : ['Консультация']).slice(0, 12).map((title, index) => ({
    id: `service_${index + 1}`,
    title,
    description: '',
    durationMinutes: DEFAULT_SERVICE_DURATION,
    price: fallbackPrices[index] || fallbackPrices[0] || '',
    category: text(profile.categoryLabel || profile.category, 120),
    color: '#D7B86A',
  }));
}

export function buildBookingSpecialists(profile = {}, services = []) {
  const configured = Array.isArray(profile.bookingSpecialists) ? profile.bookingSpecialists : [];
  const allServiceIds = services.map(item => item.id);
  const specialists = configured.map((item, index) => ({
    id: text(item?.id || `specialist_${index + 1}`, 80),
    name: text(item?.name || item?.title || `Специалист ${index + 1}`, 160),
    photo: text(item?.photo || item?.image || '', 1000),
    description: text(item?.description || item?.specialization || '', 600),
    serviceIds: Array.isArray(item?.serviceIds) && item.serviceIds.length ? item.serviceIds.map(id => text(id, 80)) : allServiceIds,
    schedule: item?.schedule && typeof item.schedule === 'object' ? item.schedule : null,
  })).filter(item => item.name);
  if (specialists.length) return [{ id: 'any', name: 'Любой специалист', photo: '', description: 'АПГ подберет свободное окно.', serviceIds: allServiceIds, schedule: null }, ...specialists];
  return [{ id: 'default', name: text(profile.name || 'Специалист', 160), photo: text(profile.photo || profile.logoUrl || '', 1000), description: text(profile.specialization || profile.categoryLabel || '', 600), serviceIds: allServiceIds, schedule: null }];
}

export function getUpcomingBookingDates(days = 14, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    date.setHours(0, 0, 0, 0);
    return date;
  }).filter(date => date.getDay() !== 0);
}

export function formatBookingDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildBookingSlots({ date, service, specialist, profile } = {}) {
  const duration = numberOr(service?.durationMinutes, DEFAULT_SERVICE_DURATION);
  const times = Array.isArray(profile?.bookingSlotTimes) && profile.bookingSlotTimes.length ? profile.bookingSlotTimes : DEFAULT_SLOT_TIMES;
  const dateKey = formatBookingDateKey(date);
  return times.map(time => {
    const start = new Date(`${dateKey}T${time}:00`);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return {
      id: `${dateKey}_${time.replace(':', '')}_${specialist?.id || 'any'}`,
      dateKey,
      time,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      durationMinutes: duration,
    };
  }).filter(slot => !Number.isNaN(new Date(slot.startAt).getTime()) && new Date(slot.startAt).getTime() > Date.now() + 15 * 60 * 1000);
}

export function buildBookingProfile(profile = {}, type = 'partner') {
  const providerType = type === 'expert' ? 'expert' : 'partner';
  const services = buildBookingServices(profile);
  const specialists = buildBookingSpecialists(profile, services);
  return {
    providerType,
    providerId: text(profile.id, 160),
    title: text(profile.name || profile.title || (providerType === 'expert' ? 'Эксперт АПГ' : 'Партнер АПГ'), 180),
    subtitle: text(profile.specialization || profile.categoryLabel || profile.address || '', 220),
    address: text(profile.address || profile.location || '', 260),
    phone: text(profile.phone || '', 80),
    image: text(profile.logoUrl || profile.photo || profile.coverPhoto || '', 1000),
    enabled: isOnlineBookingEnabled(profile),
    services,
    specialists,
    schedule: profile.bookingSchedule || profile.workingHours || profile.hours || null,
    settings: profile.bookingSettings || {},
  };
}

export function buildBookingDialogContext(booking = {}) {
  const normalized = normalizeBooking(booking);
  const journey = normalizeBookingJourney(normalized.journey || {});
  return {
    type: 'booking',
    objectId: text(booking.id || booking.bookingId, 180),
    bookingId: text(booking.id || booking.bookingId, 180),
    title: text(booking.providerName || booking.title || 'Встреча'),
    subtitle: [booking.serviceTitle, booking.dateLabel, booking.time].filter(Boolean).join(' · '),
    parentTitle: text(booking.providerName || ''),
    label: 'Встреча',
    description: text(booking.comment || booking.serviceDescription || ''),
    address: text(booking.address || ''),
    phone: text(booking.providerPhone || ''),
    date: [booking.dateLabel, booking.time].filter(Boolean).join(' '),
    durationMinutes: Number(booking.durationMinutes || 0) || '',
    price: text(booking.price || ''),
    serviceTitle: text(booking.serviceTitle || ''),
    specialistName: text(booking.specialistName || ''),
    status: normalized.status,
    statusLabel: normalized.statusLabel,
    journey,
    journeySummary: buildBookingJourneySummary(normalized),
    reviewPromptAvailable: journey.reviewPromptAvailable,
    keysAwarded: journey.keysAwarded,
    stampProgress: journey.stampProgress,
    startAt: text(booking.startAt || ''),
    endAt: text(booking.endAt || ''),
    partnerId: booking.providerType === 'partner' ? text(booking.providerId) : '',
    expertId: booking.providerType === 'expert' ? text(booking.providerId) : '',
    ownerUserIds: Array.isArray(booking.ownerUserIds) ? booking.ownerUserIds.map(id => text(id, 180)).filter(Boolean) : [],
    source: 'booking',
  };
}
