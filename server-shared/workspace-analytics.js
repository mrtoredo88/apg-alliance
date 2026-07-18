import { BOOKING_STATUSES, normalizeBooking } from './booking.js';
import { getMainLocation, getProfileLocations } from './locations.js';
import { workspaceEventBelongsToProfile, workspaceEventStatus } from './workspace-events.js';
import { workspaceNewsBelongsToProfile, workspaceNewsStatus } from './workspace-news.js';

const DAY_MS = 86400000;

export const WORKSPACE_ANALYTICS_PERIODS = [
  { id: 'today', label: 'Сегодня', days: 1 },
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d', label: '90 дней', days: 90 },
  { id: 'year', label: 'Год', days: 365 },
  { id: 'custom', label: 'Период', days: 30 },
];

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function num(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function workspaceAnalyticsToMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function buildWorkspaceAnalyticsRange({ period = '30d', from = '', to = '', now = new Date() } = {}) {
  const end = new Date(to || now);
  if (Number.isNaN(end.getTime())) end.setTime(Date.now());
  end.setHours(23, 59, 59, 999);
  if (period === 'today') {
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    return { period, from: start.toISOString(), to: end.toISOString(), label: 'Сегодня' };
  }
  if (period === 'custom' && from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      return { period, from: start.toISOString(), to: end.toISOString(), label: 'Произвольный период' };
    }
  }
  const found = WORKSPACE_ANALYTICS_PERIODS.find(item => item.id === period) || WORKSPACE_ANALYTICS_PERIODS[2];
  const start = new Date(end.getTime() - (Math.max(1, found.days) - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { period: found.id, from: start.toISOString(), to: end.toISOString(), label: found.label };
}

function inRange(item, range, fields = ['createdAt', 'updatedAt']) {
  const from = workspaceAnalyticsToMs(range.from);
  const to = workspaceAnalyticsToMs(range.to) || Date.now();
  const ms = fields.map(field => workspaceAnalyticsToMs(item?.[field])).find(Boolean) || 0;
  return !!ms && ms >= from && ms <= to;
}

function dateMs(item, fields) {
  return fields.map(field => workspaceAnalyticsToMs(item?.[field])).find(Boolean) || 0;
}

function rate(top, bottom) {
  const b = num(bottom);
  if (!b) return 0;
  return Math.round(num(top) / b * 1000) / 10;
}

function profileMetric(profile = {}, keys = []) {
  return keys.reduce((sum, key) => sum + num(key.split('.').reduce((acc, part) => acc?.[part], profile)), 0);
}

function itemLocationId(item = {}, mainLocationId = '') {
  return text(item.locationId || item.location?.id || item.branchId || item.placeId || item.metadata?.locationId || mainLocationId, 120);
}

export function buildWorkspaceLocationAnalytics(profile = {}, sources = {}) {
  const locations = getProfileLocations(profile);
  if (locations.length <= 1) return [];
  const mainLocationId = getMainLocation(profile)?.id || locations[0]?.id || '';
  const stats = profile.locationStats && typeof profile.locationStats === 'object' ? profile.locationStats : {};
  return locations.map(location => {
    const locationId = location.id;
    const bookings = (sources.bookings || []).filter(item => itemLocationId(item, mainLocationId) === locationId);
    const scans = (sources.scans || []).filter(item => itemLocationId(item, mainLocationId) === locationId);
    const notifications = (sources.notifications || []).filter(item => itemLocationId(item, mainLocationId) === locationId);
    const locationStats = stats[locationId] || {};
    const calls = num(locationStats.calls ?? locationStats.phoneClicks)
      + notifications.filter(item => ['call', 'phone', 'partner:call'].includes(String(item.action || item.type || item.eventType || ''))).length;
    const routes = num(locationStats.routes ?? locationStats.routeClicks)
      + notifications.filter(item => ['route', 'map', 'partner:route'].includes(String(item.action || item.type || item.eventType || ''))).length;
    const views = num(locationStats.views ?? locationStats.profileViews ?? locationStats.opens)
      + scans.length
      + notifications.filter(item => ['view', 'open', 'partner:view'].includes(String(item.action || item.type || item.eventType || ''))).length;
    const completedBookings = bookings.filter(item => item.status === BOOKING_STATUSES.completed).length;
    const bookingCount = bookings.length;
    return {
      id: locationId,
      title: text(location.title || location.address || 'Филиал', 180),
      isMain: Boolean(location.isMain),
      address: text(location.address, 260),
      views,
      opens: views,
      calls,
      routes,
      bookings: bookingCount,
      completedBookings,
      conversion: rate(bookingCount || completedBookings, Math.max(1, views)),
    };
  });
}

export function filterWorkspaceAnalyticsSources(sources = {}, profile = {}, role = 'partner', range = buildWorkspaceAnalyticsRange()) {
  const profileId = text(profile?.id, 180);
  const profileName = text(profile?.name || profile?.title || profile?.displayName, 240).toLowerCase();
  const allAccess = ['admin', 'owner', 'super_admin', 'moderator', 'editor', 'analyst'].includes(String(role || '').toLowerCase()) || profileId === 'all';
  const news = (Array.isArray(sources.news) ? sources.news : [])
    .filter(item => allAccess || workspaceNewsBelongsToProfile(item, profile, role))
    .filter(item => inRange(item, range, ['publishedAt', 'scheduledAt', 'updatedAt', 'createdAt']));
  const events = (Array.isArray(sources.events) ? sources.events : [])
    .filter(item => allAccess || workspaceEventBelongsToProfile(item, profile, role))
    .filter(item => inRange(item, range, ['startAt', 'eventDate', 'date', 'updatedAt', 'createdAt']));
  const bookings = (Array.isArray(sources.bookings) ? sources.bookings : [])
    .map(normalizeBooking)
    .filter(item => allAccess || (String(item.providerId || '') === profileId && (role === 'expert' ? item.providerType === 'expert' : item.providerType !== 'expert')))
    .filter(item => inRange(item, range, ['startAt', 'createdAt', 'updatedAt']));
  const dialogs = (Array.isArray(sources.dialogs) ? sources.dialogs : [])
    .filter(item => {
      if (allAccess) return true;
      const context = item.context || {};
      return String(item.objectId || context.objectId || context.partnerId || context.expertId || '') === profileId
        || String(context.parentId || '') === profileId
        || text(context.parentTitle || context.title, 240).toLowerCase() === profileName;
    })
    .filter(item => inRange(item, range, ['lastMessageAt', 'updatedAt', 'createdAt']));
  const comments = (Array.isArray(sources.comments) ? sources.comments : [])
    .filter(item => allAccess || news.some(newsItem => String(newsItem.id) === String(item.newsId)))
    .filter(item => inRange(item, range, ['createdAt', 'updatedAt']));
  const notifications = (Array.isArray(sources.notifications) ? sources.notifications : [])
    .filter(item => allAccess || String(item.objectId || item.partnerId || item.expertId || item.providerId || '') === profileId || String(item.profileId || '') === profileId)
    .filter(item => inRange(item, range, ['createdAt', 'updatedAt']));
  const scans = (Array.isArray(sources.scans) ? sources.scans : [])
    .filter(item => allAccess || String(item.partnerId || item.expertId || item.subjectId || item.profileId || '') === profileId)
    .filter(item => inRange(item, range, ['createdAt', 'ts', 'timestamp', 'updatedAt']));
  return { news, events, bookings, dialogs, comments, notifications, scans };
}

function buildTopObjects(items, type, statPicker, dateFields) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const stats = statPicker(item);
      return {
        id: text(item.id, 180),
        type,
        title: text(item.title || item.name || item.serviceTitle || item.context?.title || 'Объект АПГ', 220),
        status: text(item.status || item.lifecycleStatus || item.contentStatus || '', 80),
        date: new Date(dateMs(item, dateFields) || Date.now()).toISOString(),
        ...stats,
        score: Object.values(stats).reduce((sum, value) => sum + num(value), 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildWorkspaceAnalyticsSnapshot({ profile = {}, role = 'partner', sources = {}, range = buildWorkspaceAnalyticsRange() } = {}) {
  const filtered = filterWorkspaceAnalyticsSources(sources, profile, role, range);
  const profileViews = profileMetric(profile, ['stats.views', 'stats.profileViews', 'views', 'viewCount', 'openCount', 'opensCount', 'qrOpenCount', 'publicQRScans']);
  const profileClicks = profileMetric(profile, ['stats.clicks', 'stats.websiteClicks', 'stats.routeClicks', 'stats.phoneClicks', 'stats.telegramClicks', 'clicks', 'linkClicks']);
  const newsViews = filtered.news.reduce((sum, item) => sum + num(item.stats?.views ?? item.views ?? item.viewCount), 0);
  const newsClicks = filtered.news.reduce((sum, item) => sum + num(item.stats?.clicks ?? item.clicks ?? item.linkClicks ?? item.stats?.reposts), 0);
  const eventViews = filtered.events.reduce((sum, item) => sum + num(item.views ?? item.viewCount ?? item.opensCount ?? item.stats?.views), 0);
  const eventRegistrations = filtered.events.reduce((sum, item) => sum + num(item.registeredCount ?? item.registrationsCount ?? item.participantsCount), 0);
  const completedBookings = filtered.bookings.filter(item => item.status === BOOKING_STATUSES.completed);
  const confirmedBookings = filtered.bookings.filter(item => [BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status));
  const cancelledBookings = filtered.bookings.filter(item => [BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider].includes(item.status));
  const noShowBookings = filtered.bookings.filter(item => item.status === BOOKING_STATUSES.noShow);
  const repeatedUsers = new Set();
  const seenUsers = new Set();
  filtered.bookings.forEach(item => {
    const userId = text(item.userId || item.userPhone || item.userName, 180);
    if (!userId) return;
    if (seenUsers.has(userId)) repeatedUsers.add(userId);
    seenUsers.add(userId);
  });
  const profileActions = {
    website: profileMetric(profile, ['stats.websiteClicks', 'websiteClicks']),
    telegram: profileMetric(profile, ['stats.telegramClicks', 'telegramClicks']),
    phone: profileMetric(profile, ['stats.phoneClicks', 'phoneClicks', 'calls']),
    route: profileMetric(profile, ['stats.routeClicks', 'routeClicks', 'routes']),
    social: profileMetric(profile, ['stats.socialClicks', 'socialClicks']),
  };
  const kpis = {
    profileViews,
    newsViews,
    eventViews,
    clicks: profileClicks + newsClicks + profileActions.website + profileActions.telegram + profileActions.phone + profileActions.route + profileActions.social,
    newRequests: filtered.notifications.length + filtered.dialogs.filter(item => item.createdAt).length,
    newDialogs: filtered.dialogs.length,
    newBookings: filtered.bookings.length,
    confirmedBookings: confirmedBookings.length,
    completedBookings: completedBookings.length,
    repeatedBookings: repeatedUsers.size,
    newFollowers: num(profile.stats?.followers ?? profile.followersCount ?? profile.subscribersCount),
    comments: filtered.comments.length + filtered.news.reduce((sum, item) => sum + num(item.stats?.comments ?? item.comments), 0),
    conversion: rate(completedBookings.length || filtered.bookings.length, Math.max(1, profileViews + newsViews + eventViews)),
  };
  const funnel = [
    { id: 'news_views', label: 'Просмотры новостей', value: newsViews },
    { id: 'profile_open', label: 'Открытие карточки', value: profileViews },
    { id: 'clicks', label: 'Переходы', value: kpis.clicks },
    { id: 'dialogs', label: 'Диалоги', value: filtered.dialogs.length },
    { id: 'bookings', label: 'Встречи', value: filtered.bookings.length },
    { id: 'completed', label: 'Завершение встречи', value: completedBookings.length },
    { id: 'repeat', label: 'Повторное обращение', value: repeatedUsers.size },
  ].filter(item => item.value > 0);
  const newsAnalytics = {
    total: filtered.news.length,
    published: filtered.news.filter(item => workspaceNewsStatus(item) === 'published').length,
    comments: filtered.comments.length,
    views: newsViews,
    clicks: newsClicks,
    ctr: rate(newsClicks, newsViews),
    top: buildTopObjects(filtered.news, 'news', item => ({
      views: num(item.stats?.views ?? item.views ?? item.viewCount),
      comments: num(item.stats?.comments ?? item.comments),
      clicks: num(item.stats?.clicks ?? item.clicks ?? item.linkClicks),
    }), ['publishedAt', 'updatedAt', 'createdAt']),
  };
  const eventsAnalytics = {
    total: filtered.events.length,
    views: eventViews,
    registrations: eventRegistrations,
    visits: filtered.events.reduce((sum, item) => sum + num(item.visitsCount ?? item.attendedCount), 0),
    cancellations: filtered.events.reduce((sum, item) => sum + num(item.cancelledCount ?? item.unregisteredCount), 0),
    repeatRegistrations: 0,
    top: buildTopObjects(filtered.events, 'event', item => ({
      views: num(item.views ?? item.viewCount ?? item.opensCount ?? item.stats?.views),
      registrations: num(item.registeredCount ?? item.registrationsCount ?? item.participantsCount),
      visits: num(item.visitsCount ?? item.attendedCount),
    }), ['startAt', 'eventDate', 'date', 'updatedAt', 'createdAt']),
  };
  const averageLeadHours = filtered.bookings.length
    ? Math.round(filtered.bookings.reduce((sum, item) => sum + Math.max(0, workspaceAnalyticsToMs(item.startAt) - workspaceAnalyticsToMs(item.createdAt)), 0) / filtered.bookings.length / 3600000)
    : 0;
  const bookingsAnalytics = {
    new: filtered.bookings.length,
    completed: completedBookings.length,
    cancelled: cancelledBookings.length,
    noShow: noShowBookings.length,
    rescheduled: filtered.bookings.filter(item => [BOOKING_STATUSES.rescheduled, BOOKING_STATUSES.rescheduleRequested].includes(item.status)).length,
    averageLeadHours,
    repeated: repeatedUsers.size,
  };
  const dialogsAnalytics = {
    new: filtered.dialogs.length,
    active: filtered.dialogs.filter(item => item.workspacePrivate?.archived !== true).length,
    unread: filtered.dialogs.reduce((sum, item) => sum + num(item.unreadCount ?? Object.values(item.unreadBy || {}).reduce((a, b) => a + num(b), 0)), 0),
    closed: filtered.dialogs.filter(item => item.workspacePrivate?.archived === true || item.workspacePrivate?.status === 'closed').length,
    averageResponseMinutes: 0,
  };
  const sourcesBreakdown = [
    { id: 'catalog', label: 'Каталог', value: filtered.bookings.filter(item => ['booking-flow', 'catalog'].includes(item.source)).length + profileViews },
    { id: 'news', label: 'Новости', value: newsClicks + filtered.bookings.filter(item => item.source === 'news').length },
    { id: 'events', label: 'Мероприятия', value: eventRegistrations + filtered.bookings.filter(item => item.source === 'event').length },
    { id: 'qr', label: 'QR', value: filtered.scans.length + filtered.bookings.filter(item => item.source === 'qr').length },
    { id: 'direct', label: 'Прямая ссылка', value: filtered.bookings.filter(item => item.source === 'direct').length },
    { id: 'push', label: 'Push', value: filtered.notifications.filter(item => item.source === 'push' || item.channel === 'push').length },
  ].filter(item => item.value > 0);
  const recommendations = buildWorkspaceAnalyticsRecommendations({ kpis, newsAnalytics, eventsAnalytics, bookingsAnalytics, dialogsAnalytics });
  const locationsAnalytics = buildWorkspaceLocationAnalytics(profile, filtered);
  const exportRows = buildWorkspaceAnalyticsExportRows({ kpis, newsAnalytics, eventsAnalytics, bookingsAnalytics, dialogsAnalytics, sourcesBreakdown, locationsAnalytics });
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    profile: { id: text(profile.id, 180), type: role === 'expert' ? 'expert' : 'partner', name: text(profile.name || profile.title || profile.displayName, 240) },
    range,
    kpis,
    funnel,
    news: newsAnalytics,
    events: eventsAnalytics,
    bookings: bookingsAnalytics,
    dialogs: dialogsAnalytics,
    profileActions,
    sources: sourcesBreakdown,
    locations: locationsAnalytics,
    recommendations,
    lokiContext: {
      range,
      kpis,
      funnel,
      recommendations,
      topNews: newsAnalytics.top.slice(0, 3),
      topEvents: eventsAnalytics.top.slice(0, 3),
    },
    exportRows,
    sourceCounts: Object.fromEntries(Object.entries(filtered).map(([key, value]) => [key, value.length])),
    dataPolicy: 'real-system-data-only',
  };
}

export function buildWorkspaceAnalyticsRecommendations({ kpis = {}, newsAnalytics = {}, eventsAnalytics = {}, bookingsAnalytics = {}, dialogsAnalytics = {} } = {}) {
  const rows = [];
  if (newsAnalytics.views > 0 && eventsAnalytics.views > 0) {
    const winner = eventsAnalytics.views > newsAnalytics.views ? 'мероприятия' : 'новости';
    rows.push({ id: 'content-views', title: `${winner[0].toUpperCase()}${winner.slice(1)} сейчас дают больше просмотров`, reason: `Новости: ${newsAnalytics.views}, мероприятия: ${eventsAnalytics.views}.`, confidence: 'real-data' });
  }
  if (dialogsAnalytics.unread > 0) rows.push({ id: 'dialog-unread', title: 'Есть непрочитанные обращения', reason: `${dialogsAnalytics.unread} сообщений остаются непрочитанными.`, confidence: 'real-data' });
  if (bookingsAnalytics.cancelled > 0 || bookingsAnalytics.noShow > 0) rows.push({ id: 'booking-risk', title: 'Проверьте качество подтверждения встреч', reason: `Отмены: ${bookingsAnalytics.cancelled}, неявки: ${bookingsAnalytics.noShow}.`, confidence: 'real-data' });
  if (kpis.conversion > 0 && kpis.conversion < 2) rows.push({ id: 'low-conversion', title: 'Конверсия ниже 2%', reason: `Текущая конверсия ${kpis.conversion}% по доступной воронке.`, confidence: 'real-data' });
  if (!rows.length) rows.push({ id: 'not-enough-data', title: 'Данных пока недостаточно для уверенного вывода', reason: 'Раздел показывает только уже сохранённые события и не достраивает прогнозы.', confidence: 'real-data' });
  return rows.slice(0, 6);
}

export function buildWorkspaceAnalyticsExportRows({ kpis = {}, newsAnalytics = {}, eventsAnalytics = {}, bookingsAnalytics = {}, dialogsAnalytics = {}, sourcesBreakdown = [], locationsAnalytics = [] } = {}) {
  return [
    ['Раздел', 'Показатель', 'Значение'],
    ...Object.entries(kpis).map(([key, value]) => ['KPI', key, value]),
    ['Новости', 'views', newsAnalytics.views || 0],
    ['Новости', 'comments', newsAnalytics.comments || 0],
    ['Новости', 'ctr', newsAnalytics.ctr || 0],
    ['Мероприятия', 'views', eventsAnalytics.views || 0],
    ['Мероприятия', 'registrations', eventsAnalytics.registrations || 0],
    ['Встречи', 'new', bookingsAnalytics.new || 0],
    ['Встречи', 'completed', bookingsAnalytics.completed || 0],
    ['Встречи', 'cancelled', bookingsAnalytics.cancelled || 0],
    ['Диалоги', 'new', dialogsAnalytics.new || 0],
    ['Диалоги', 'unread', dialogsAnalytics.unread || 0],
    ...sourcesBreakdown.map(item => ['Источники', item.label, item.value]),
    ...locationsAnalytics.flatMap(item => [
      ['Филиалы', `${item.title}: views`, item.views || 0],
      ['Филиалы', `${item.title}: bookings`, item.bookings || 0],
      ['Филиалы', `${item.title}: routes`, item.routes || 0],
      ['Филиалы', `${item.title}: conversion`, item.conversion || 0],
    ]),
  ];
}

export function workspaceAnalyticsRowsToCsv(rows = []) {
  return (Array.isArray(rows) ? rows : []).map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
}
