export const BOOKING_STATUSES = {
  new: 'new',
  confirmed: 'confirmed',
  rescheduled: 'rescheduled',
  cancelled: 'cancelled',
  completed: 'completed',
  noShow: 'no_show',
};

export const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUSES.new]: 'Новая',
  [BOOKING_STATUSES.confirmed]: 'Подтверждена',
  [BOOKING_STATUSES.rescheduled]: 'Перенесена',
  [BOOKING_STATUSES.cancelled]: 'Отменена',
  [BOOKING_STATUSES.completed]: 'Завершена',
  [BOOKING_STATUSES.noShow]: 'Не пришел',
};

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
  return {
    type: 'booking',
    objectId: text(booking.id || booking.bookingId, 180),
    bookingId: text(booking.id || booking.bookingId, 180),
    title: text(booking.providerName || booking.title || 'Запись'),
    subtitle: [booking.serviceTitle, booking.dateLabel, booking.time].filter(Boolean).join(' · '),
    parentTitle: text(booking.providerName || ''),
    label: 'Запись',
    description: text(booking.comment || booking.serviceDescription || ''),
    address: text(booking.address || ''),
    phone: text(booking.providerPhone || ''),
    date: [booking.dateLabel, booking.time].filter(Boolean).join(' '),
    partnerId: booking.providerType === 'partner' ? text(booking.providerId) : '',
    expertId: booking.providerType === 'expert' ? text(booking.providerId) : '',
    ownerUserIds: Array.isArray(booking.ownerUserIds) ? booking.ownerUserIds.map(id => text(id, 180)).filter(Boolean) : [],
    source: 'booking',
  };
}
