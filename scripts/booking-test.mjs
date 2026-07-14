import assert from 'node:assert/strict';
import {
  BOOKING_STATUSES,
  bookingBlocksSlot,
  buildBookingDialogContext,
  buildBookingHistoryEntry,
  buildBookingJourneySummary,
  buildPostVisitMomentState,
  canTransitionBookingStatus,
  buildBookingProfile,
  buildBookingReminders,
  buildBookingSlots,
  formatBookingDateKey,
  groupBookingsForProfile,
  getUpcomingBookingDates,
  isOnlineBookingEnabled,
  normalizeBooking,
  normalizeBookingJourney,
  rangesOverlap,
} from '../server-shared/booking.js';
import {
  buildBookingChangeEntry,
  buildFreeTimeSlots,
  buildWorkspaceBookingKpis,
  buildWorkspaceBookingSearchText,
  filterWorkspaceBookings,
  findBookingConflicts,
  getBookingSourceLabel,
  sanitizeBookingInternalNotes,
} from '../server-shared/workspace-bookings.js';

const partner = {
  id: 'coffee-time',
  name: 'Coffee Time',
  categoryLabel: 'Кофейня',
  services: ['Бранч', 'Кофейная дегустация'],
  prices: ['1200 ₽', '900 ₽'],
  bookingUrl: 'https://example.com/book',
  ownerId: 'owner-1',
};

assert.equal(isOnlineBookingEnabled(partner), true);

const profile = buildBookingProfile(partner, 'partner');
assert.equal(profile.providerType, 'partner');
assert.equal(profile.services.length, 2);
assert.equal(profile.services[0].title, 'Бранч');
assert.equal(profile.services[0].price, '1200 ₽');
assert.equal(profile.specialists.length, 1);

const dates = getUpcomingBookingDates(4, new Date('2026-07-13T10:00:00+03:00'));
assert.ok(dates.length > 0);
assert.equal(formatBookingDateKey(dates[0]), '2026-07-13');

const slots = buildBookingSlots({ date: dates[1], service: profile.services[0], specialist: profile.specialists[0], profile: partner });
assert.ok(slots.length > 0);
assert.match(slots[0].startAt, /^2026-07-/);
assert.equal(slots[0].durationMinutes, 60);

const context = buildBookingDialogContext({
  id: 'booking-1',
  providerType: 'partner',
  providerId: 'coffee-time',
  providerName: 'Coffee Time',
  serviceTitle: 'Бранч',
  dateLabel: '14 июля',
  time: '10:00',
  ownerUserIds: ['owner-1'],
});
assert.equal(context.type, 'booking');
assert.equal(context.bookingId, 'booking-1');
assert.equal(context.partnerId, 'coffee-time');
assert.equal(context.ownerUserIds[0], 'owner-1');
assert.equal(context.label, 'Встреча');

const journey = normalizeBookingJourney({
  reviewPromptAvailable: true,
  keysAwarded: 2,
  stampAwarded: true,
  stampProgress: { providerId: 'coffee-time', current: 3, target: 6 },
  nextSteps: [{ id: 'review', label: 'Оставить отзыв', action: 'openReview' }],
});
assert.equal(journey.keysAwarded, 2);
assert.equal(journey.stampProgress.current, 3);
assert.equal(journey.nextSteps[0].action, 'openReview');

const completedContext = buildBookingDialogContext({
  id: 'booking-done',
  providerType: 'partner',
  providerId: 'coffee-time',
  providerName: 'Coffee Time',
  status: BOOKING_STATUSES.completed,
  journey,
});
assert.equal(completedContext.reviewPromptAvailable, true);
assert.equal(completedContext.keysAwarded, 2);
assert.equal(buildBookingJourneySummary(completedContext), '+2 ключа · штамп 3/6 · можно оставить отзыв');

const postVisit = buildPostVisitMomentState({
  id: 'booking-done',
  providerType: 'partner',
  providerId: 'coffee-time',
  providerName: 'Coffee Time',
  serviceTitle: 'Маникюр',
  status: BOOKING_STATUSES.completed,
  dateLabel: '14 июля',
  time: '18:30',
  journey: {
    ...journey,
    rewardedAt: '2026-07-14T18:40:00.000Z',
  },
}, { provider: { stampTarget: 6 }, userKeys: 138 });
assert.equal(postVisit.visible, true);
assert.equal(postVisit.hasStampCard, true);
assert.equal(postVisit.stampsLeft, 3);
assert.equal(postVisit.canRepeat, true);
assert.equal(postVisit.balance, 138);

assert.equal(normalizeBooking({ id: 'b1', status: 'new' }).status, BOOKING_STATUSES.pending);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.pending, BOOKING_STATUSES.confirmed), true);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.completed, BOOKING_STATUSES.confirmed), false);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.confirmed, BOOKING_STATUSES.cancelledByProvider), true);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.rescheduleRequested, BOOKING_STATUSES.rescheduled), true);
assert.equal(normalizeBooking({ id: 'arch', status: BOOKING_STATUSES.archived, archived: true }).status, BOOKING_STATUSES.archived);

const history = buildBookingHistoryEntry({
  fromStatus: BOOKING_STATUSES.pending,
  toStatus: BOOKING_STATUSES.confirmed,
  actorId: 'owner-1',
  actorRole: 'provider',
  reason: 'Подтверждено',
});
assert.equal(history.fromStatus, BOOKING_STATUSES.pending);
assert.equal(history.toStatus, BOOKING_STATUSES.confirmed);
assert.equal(history.actorRole, 'provider');

const reminders = buildBookingReminders(new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString());
assert.equal(reminders.length, 2);
assert.deepEqual(reminders.map(item => item.type), ['24h', '2h']);

assert.equal(rangesOverlap('2026-07-14T10:00:00+03:00', '2026-07-14T11:00:00+03:00', '2026-07-14T10:30:00+03:00', '2026-07-14T11:30:00+03:00'), true);
assert.equal(rangesOverlap('2026-07-14T10:00:00+03:00', '2026-07-14T11:00:00+03:00', '2026-07-14T11:00:00+03:00', '2026-07-14T12:00:00+03:00'), false);
assert.equal(bookingBlocksSlot({ id: 'b1', providerType: 'partner', providerId: 'p1', specialistId: 's1', status: BOOKING_STATUSES.confirmed, startAt: '2026-07-14T10:00:00+03:00', endAt: '2026-07-14T11:00:00+03:00' }, { providerType: 'partner', providerId: 'p1', specialistId: 's1', startAt: '2026-07-14T10:30:00+03:00', endAt: '2026-07-14T11:30:00+03:00' }), true);
assert.equal(bookingBlocksSlot({ id: 'b1', providerType: 'partner', providerId: 'p1', specialistId: 's1', status: BOOKING_STATUSES.cancelledByUser, startAt: '2026-07-14T10:00:00+03:00', endAt: '2026-07-14T11:00:00+03:00' }, { providerType: 'partner', providerId: 'p1', specialistId: 's1', startAt: '2026-07-14T10:30:00+03:00', endAt: '2026-07-14T11:30:00+03:00' }), false);

const grouped = groupBookingsForProfile([
  { id: 'p', status: BOOKING_STATUSES.pending, startAt: '2026-07-14T10:00:00+03:00', endAt: '2026-07-14T11:00:00+03:00' },
  { id: 'r', status: BOOKING_STATUSES.rescheduleRequested, startAt: '2026-07-15T10:00:00+03:00', endAt: '2026-07-15T11:00:00+03:00' },
  { id: 'c', status: BOOKING_STATUSES.cancelledByProvider, startAt: '2026-07-16T10:00:00+03:00', endAt: '2026-07-16T11:00:00+03:00' },
], new Date('2026-07-13T10:00:00+03:00').getTime());
assert.equal(grouped.pending.length, 1);
assert.equal(grouped.actionRequired.length, 1);
assert.equal(grouped.cancelled.length, 1);

const crmBookings = [
  { id: 'today', status: BOOKING_STATUSES.confirmed, userName: 'Иван Петров', userPhone: '+79990000000', userTelegram: '@ivan', serviceTitle: 'Стрижка', source: 'manual', startAt: '2026-07-14T10:00:00+03:00', endAt: '2026-07-14T11:00:00+03:00' },
  { id: 'pending', status: BOOKING_STATUSES.pending, userName: 'Мария', serviceTitle: 'Маникюр', source: 'event', startAt: '2026-07-15T10:00:00+03:00', endAt: '2026-07-15T11:00:00+03:00' },
  { id: 'archived', status: BOOKING_STATUSES.archived, archived: true, userName: 'Старый клиент', startAt: '2026-07-12T10:00:00+03:00', endAt: '2026-07-12T11:00:00+03:00' },
];
const crmKpis = buildWorkspaceBookingKpis(crmBookings, new Date('2026-07-14T08:00:00+03:00'));
assert.equal(crmKpis.today, 1);
assert.equal(crmKpis.tomorrow, 1);
assert.equal(crmKpis.pending, 1);
assert.equal(getBookingSourceLabel(crmBookings[0]), 'Ручное создание');
assert.equal(getBookingSourceLabel(crmBookings[1]), 'Мероприятие');
assert.equal(filterWorkspaceBookings(crmBookings).map(item => item.id).includes('archived'), false);
assert.equal(filterWorkspaceBookings(crmBookings, { includeArchived: true }).map(item => item.id).includes('archived'), true);
assert.ok(buildWorkspaceBookingSearchText(crmBookings[0]).includes('иван'));
assert.equal(sanitizeBookingInternalNotes('a'.repeat(4000)).length, 3000);
const change = buildBookingChangeEntry({ type: 'note', actorId: 'owner-1', actorRole: 'provider', text: 'Заметка' });
assert.equal(change.type, 'note');
assert.equal(change.actorRole, 'provider');
const conflicts = findBookingConflicts(crmBookings, { providerType: '', providerId: '', specialistId: 'default', startAt: '2026-07-14T10:30:00+03:00', endAt: '2026-07-14T11:30:00+03:00' });
assert.equal(conflicts.length, 1);
const freeSlots = buildFreeTimeSlots({ bookings: crmBookings, date: new Date('2026-07-14T08:00:00+03:00'), slotTimes: ['10:00', '11:30'], durationMinutes: 60 });
assert.equal(freeSlots[0].occupied, true);
assert.equal(freeSlots[1].occupied, false);

console.log('Booking/Meetings V1.1 contract test passed');
