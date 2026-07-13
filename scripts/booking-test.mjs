import assert from 'node:assert/strict';
import {
  BOOKING_STATUSES,
  bookingBlocksSlot,
  buildBookingDialogContext,
  buildBookingHistoryEntry,
  canTransitionBookingStatus,
  buildBookingProfile,
  buildBookingReminders,
  buildBookingSlots,
  formatBookingDateKey,
  groupBookingsForProfile,
  getUpcomingBookingDates,
  isOnlineBookingEnabled,
  normalizeBooking,
  rangesOverlap,
} from '../server-shared/booking.js';

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

assert.equal(normalizeBooking({ id: 'b1', status: 'new' }).status, BOOKING_STATUSES.pending);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.pending, BOOKING_STATUSES.confirmed), true);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.completed, BOOKING_STATUSES.confirmed), false);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.confirmed, BOOKING_STATUSES.cancelledByProvider), true);
assert.equal(canTransitionBookingStatus(BOOKING_STATUSES.rescheduleRequested, BOOKING_STATUSES.rescheduled), true);

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

console.log('Booking/Meetings V1.1 contract test passed');
