import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { normalizeText, toMillis, titleOf } from '../lokiCoreUtils.js';

const DAY_MS = 1000 * 60 * 60 * 24;
const EVENT_SOON_MS = 1000 * 60 * 60 * 6;

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isFuture(ms, now = Date.now()) {
  return ms && ms >= now - 1000 * 60 * 5;
}

function isConfirmedBooking(booking = {}) {
  const status = normalizeText(booking.status || booking.state || booking.lifecycleStatus);
  return !['cancelled', 'canceled', 'declined', 'deleted', 'archived', 'draft'].includes(status);
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText || item.promotionTitle);
}

function offerUpdatedAt(item = {}) {
  return toMillis(item.offerUpdatedAt || item.promotionUpdatedAt || item.updatedAt || item.createdAt);
}

function bookingTime(booking = {}) {
  return toMillis(booking.startAt || booking.startsAt || booking.dateTime || booking.date || booking.createdAt);
}

function eventTime(event = {}) {
  return toMillis(event.startAt || event.startsAt || event.eventDate || event.date || event.createdAt);
}

function getProviderId(booking = {}) {
  return String(booking.providerId || booking.partnerId || booking.expertId || booking.entityId || '').trim();
}

function getVisitedPartnerIds(appState = {}) {
  const ids = new Set();
  Object.entries(appState.visitCounts || {}).forEach(([id, count]) => {
    if (Number(count) > 0) ids.add(String(id));
  });
  Object.entries(appState.scannedPartnerIds || {}).forEach(([id, scanned]) => {
    if (scanned) ids.add(String(id));
  });
  cleanList(appState.bookings).forEach(booking => {
    const id = getProviderId(booking);
    if (id) ids.add(id);
  });
  cleanList(appState.favorites).forEach(id => ids.add(String(id)));
  return ids;
}

function prizeCost(item = {}) {
  return Number(item.keys || item.cost || item.priceKeys || item.requiredKeys || item.keysRequired || 0);
}

function roleOf(user = {}, appState = {}) {
  const roles = cleanList(user.roles || appState.user?.roles).map(normalizeText);
  const role = normalizeText(user.role || user.userRole || appState.user?.role || appState.user?.userRole);
  if (roles.includes('admin') || role === 'admin' || user.isAdmin) return 'admin';
  if (roles.includes('partner') || role === 'partner' || appState.ownedPartner) return 'partner';
  if (roles.includes('expert') || role === 'expert' || appState.ownedExpert) return 'expert';
  return 'user';
}

function buildBookingOpportunity(appState = {}, now = Date.now()) {
  const booking = cleanList(appState.bookings || appState.userBookings)
    .map(item => ({ item, ms: bookingTime(item) }))
    .filter(row => isConfirmedBooking(row.item) && isFuture(row.ms, now) && row.ms - now <= DAY_MS)
    .sort((a, b) => a.ms - b.ms)[0];
  if (!booking) return null;
  const providerId = getProviderId(booking.item);
  const provider = cleanList(appState.partners).find(item => String(item.id) === providerId)
    || cleanList(appState.experts).find(item => String(item.id) === providerId)
    || null;
  return {
    id: `booking-soon-${booking.item.id || providerId || booking.ms}`,
    type: 'BOOKING_SOON',
    entityType: 'booking',
    entityId: String(booking.item.id || providerId || booking.ms),
    conditionKey: `${booking.item.status || 'confirmed'}:${booking.ms}`,
    providerId: provider?.id || providerId,
    entity: booking.item,
    confidence: 0.96,
    urgency: Math.round(Math.max(0, DAY_MS - (booking.ms - now)) / 600000),
    summary: provider ? `У вас скоро запись в ${titleOf(provider, 'партнёра')}.` : 'У вас скоро подтверждённая запись.',
    reason: provider ? `Потому что до записи в ${titleOf(provider, 'партнёра')} осталось меньше суток.` : 'Потому что до подтверждённой записи осталось меньше суток.',
  };
}

function buildEventOpportunity(appState = {}, now = Date.now()) {
  const registered = new Set(cleanList(appState.registeredEventIds).map(String));
  const event = cleanList(appState.events)
    .map(item => ({ item, ms: eventTime(item) }))
    .filter(row => registered.has(String(row.item.id)) && isFuture(row.ms, now) && row.ms - now <= EVENT_SOON_MS)
    .sort((a, b) => a.ms - b.ms)[0];
  if (!event) return null;
  return {
    id: `event-soon-${event.item.id}:${event.ms}`,
    type: 'EVENT_SOON',
    entityType: 'event',
    entityId: String(event.item.id),
    conditionKey: `${event.ms}`,
    entity: event.item,
    confidence: 0.94,
    urgency: Math.round(Math.max(0, EVENT_SOON_MS - (event.ms - now)) / 600000),
    summary: `${titleOf(event.item, 'Мероприятие')} скоро начинается.`,
    reason: `Потому что вы зарегистрированы на мероприятие «${titleOf(event.item, 'Мероприятие')}», и оно скоро начинается.`,
  };
}

function buildPromotionOpportunity(appState = {}, now = Date.now()) {
  const visited = getVisitedPartnerIds(appState);
  if (!visited.size) return null;
  const partner = cleanList(appState.partners)
    .filter(item => visited.has(String(item.id)) && hasOffer(item))
    .map(item => ({ item, ms: offerUpdatedAt(item) }))
    .filter(row => row.ms && now - row.ms <= DAY_MS * 3)
    .sort((a, b) => b.ms - a.ms)[0]?.item || null;
  if (!partner) return null;
  return {
    id: `promotion-new-${partner.id}`,
    type: 'PROMOTION_NEW',
    entityType: 'partner',
    entityId: String(partner.id),
    conditionKey: String(offerUpdatedAt(partner) || partner.offer || partner.promo || partner.discount || 'offer'),
    entity: partner,
    confidence: 0.86,
    summary: `У ${titleOf(partner, 'партнёра')} появилась актуальная акция.`,
    reason: `Потому что вы уже взаимодействовали с ${titleOf(partner, 'этим партнёром')}, а его акция обновлялась недавно.`,
  };
}

function buildRewardOpportunity(appState = {}) {
  const userKeys = Number(appState.userKeys ?? appState.keys?.balance ?? 0);
  if (userKeys <= 0) return null;
  const prize = cleanList(appState.prizes || appState.rewards)
    .map(item => ({ item, cost: prizeCost(item) }))
    .filter(row => row.cost > 0 && row.cost <= userKeys)
    .sort((a, b) => b.cost - a.cost)[0]?.item || null;
  if (!prize) return null;
  return {
    id: `reward-available-${prize.id || prize.title || prize.name}`,
    type: 'REWARD_AVAILABLE',
    entityType: 'reward',
    entityId: String(prize.id || prize.title || prize.name),
    conditionKey: `${userKeys}:${prizeCost(prize)}`,
    entity: prize,
    confidence: 0.9,
    summary: `У вас ${userKeys} ключей, этого хватает на подарок.`,
    reason: `Потому что на балансе ${userKeys} ключей, а подарок «${titleOf(prize, 'подарок')}» доступен за ${prizeCost(prize)}.`,
  };
}

function buildJourneyOpportunity(appState = {}, memory = {}) {
  const journey = memory.lastJourneyContext || appState.lastJourneyContext || null;
  if (!journey || journey.completed === true) return null;
  const goal = normalizeText(journey.goal || journey.goalType || journey.intent || '');
  if (!goal || !['book_service', 'find_partner', 'find_expert', 'contact_partner'].some(token => goal.includes(token))) return null;
  const target = journey.selectedItem || journey.currentItem || journey.target || null;
  return {
    id: `journey-resume-${goal}:${target?.id || journey.step || 'active'}`,
    type: 'JOURNEY_RESUME',
    entityType: target?.type || 'journey',
    entityId: String(target?.id || journey.step || goal),
    conditionKey: String(journey.step || journey.currentStep || 'in_progress'),
    entity: target,
    confidence: 0.78,
    summary: 'Вы начали путь, но не дошли до следующего шага.',
    reason: 'Потому что в этой сессии остался незавершённый путь Локи.',
    action: target?.id
      ? createLokiAction(target.type === 'expert' ? LOKI_APP_ACTIONS.OPEN_EXPERTS : LOKI_APP_ACTIONS.OPEN_PARTNER, target.type === 'expert' ? { expertId: target.id } : { partnerId: target.id })
      : createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS),
  };
}

function buildWorkspaceOpportunity(appState = {}, user = {}) {
  const role = roleOf(user, appState);
  const workspace = appState.workspace || {};
  if (role === 'admin') {
    const alerts = Number(workspace.adminWarnings || workspace.openAlerts || appState.admin?.openAlerts || 0);
    if (alerts > 0) return {
      id: `admin-attention-${alerts}`,
      type: 'ADMIN_ATTENTION',
      entityType: 'workspace',
      entityId: 'admin',
      conditionKey: String(alerts),
      confidence: 0.88,
      summary: `Есть ${alerts} предупреждений, требующих внимания.`,
      reason: `Потому что в загруженном состоянии админки видно ${alerts} открытых предупреждений.`,
    };
  }
  if (role === 'partner') {
    const pendingBookings = Number(workspace.pendingBookings || appState.pendingBookings || cleanList(appState.bookings).filter(item => ['new', 'pending', 'requested'].includes(normalizeText(item.status))).length);
    if (pendingBookings > 0) return {
      id: `workspace-bookings-${pendingBookings}`,
      type: 'WORKSPACE_BOOKINGS',
      entityType: 'workspace',
      entityId: 'bookings',
      conditionKey: String(pendingBookings),
      confidence: 0.82,
      summary: `Есть новые записи: ${pendingBookings}.`,
      reason: `Потому что в Workspace уже загружено ${pendingBookings} новых записей.`,
    };
  }
  if (role === 'expert') {
    const unreadDialogs = Number(workspace.unreadDialogs || appState.unreadDialogs || appState.unreadCount || 0);
    if (unreadDialogs > 0) return {
      id: `workspace-dialogs-${unreadDialogs}`,
      type: 'WORKSPACE_DIALOGS',
      entityType: 'workspace',
      entityId: 'dialogs',
      conditionKey: String(unreadDialogs),
      confidence: 0.82,
      summary: `Есть непрочитанные диалоги: ${unreadDialogs}.`,
      reason: `Потому что в загруженном состоянии есть ${unreadDialogs} непрочитанных диалогов.`,
    };
  }
  return null;
}

export function detectOpportunities({ appState = {}, memory = {}, user = appState.user, now = Date.now() } = {}) {
  return [
    buildBookingOpportunity(appState, now),
    buildJourneyOpportunity(appState, memory),
    buildEventOpportunity(appState, now),
    buildPromotionOpportunity(appState, now),
    buildRewardOpportunity(appState),
    buildWorkspaceOpportunity(appState, user),
  ].filter(Boolean);
}
