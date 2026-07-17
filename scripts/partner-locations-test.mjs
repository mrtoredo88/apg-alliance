import assert from 'node:assert/strict';
import {
  LOCATION_FUTURE_FIELDS,
  getLocationById,
  getMainLocation,
  getProfileLocations,
  hasMultipleLocations,
  locationBookingPayload,
  locationToProvider,
  normalizeLocationsForSave,
} from '../server-shared/locations.js';
import { buildBookingProfile } from '../server-shared/booking.js';

const legacyPartner = {
  id: 'legacy',
  name: 'Legacy Coffee',
  address: 'Зеленоград, Центральный проспект',
  phone: '+79990000000',
  hours: '10:00-20:00',
  bookingUrl: 'https://example.com/book',
};

const legacyLocations = getProfileLocations(legacyPartner);
assert.equal(legacyLocations.length, 1);
assert.equal(legacyLocations[0].id, 'main');
assert.equal(legacyLocations[0].isMain, true);
assert.equal(legacyLocations[0].address, legacyPartner.address);
assert.equal(getMainLocation(legacyPartner).phone, legacyPartner.phone);
assert.equal(hasMultipleLocations(legacyPartner), false);

const networkPartner = {
  ...legacyPartner,
  locations: [
    { id: 'center', title: 'Центральный салон', address: 'Корпус 100', phone: '+79991111111', workingHours: '09:00-21:00', isMain: true },
    { id: 'north', title: 'Филиал в 12 районе', address: 'Корпус 1201', phone: '+79992222222', workingHours: '10:00-19:00' },
  ],
};

assert.equal(hasMultipleLocations(networkPartner), true);
assert.equal(getMainLocation(networkPartner).id, 'center');
assert.equal(getLocationById(networkPartner, 'north').title, 'Филиал в 12 районе');

const selectedProvider = locationToProvider(networkPartner, getLocationById(networkPartner, 'north'));
assert.equal(selectedProvider.locationId, 'north');
assert.equal(selectedProvider.address, 'Корпус 1201');
assert.equal(selectedProvider.phone, '+79992222222');

const bookingProfile = buildBookingProfile(selectedProvider, 'partner');
assert.equal(bookingProfile.locationId, 'north');
assert.equal(bookingProfile.address, 'Корпус 1201');
assert.equal(bookingProfile.phone, '+79992222222');

const payload = locationBookingPayload(getLocationById(networkPartner, 'north'));
assert.deepEqual(payload, {
  id: 'north',
  title: 'Филиал в 12 районе',
  address: 'Корпус 1201',
  phone: '+79992222222',
  workingHours: '10:00-19:00',
  coordinates: null,
});

const saved = normalizeLocationsForSave([
  { title: 'Без id', address: 'Корпус 1' },
  { id: 'main', title: 'Главная', address: 'Корпус 2', isMain: true, services: ['Маникюр'] },
], legacyPartner);
assert.equal(saved.length, 2);
assert.equal(saved[0].isMain, false);
assert.equal(saved[1].isMain, true);
assert.deepEqual(saved[1].services, ['Маникюр']);

for (const futureField of ['services', 'employees', 'photos', 'booking', 'analytics', 'reviews', 'promotions', 'events', 'inventory']) {
  assert.ok(LOCATION_FUTURE_FIELDS.includes(futureField));
}

console.log('partner-locations-test: ok');
