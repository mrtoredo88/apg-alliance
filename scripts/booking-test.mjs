import assert from 'node:assert/strict';
import {
  buildBookingDialogContext,
  buildBookingProfile,
  buildBookingSlots,
  formatBookingDateKey,
  getUpcomingBookingDates,
  isOnlineBookingEnabled,
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

console.log('Booking V1 contract test passed');
