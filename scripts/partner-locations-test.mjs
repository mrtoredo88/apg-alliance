import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LOCATION_FUTURE_FIELDS,
  getLocationById,
  getLocationsSearchText,
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
    { id: 'north', title: 'Филиал в 12 районе', address: 'Корпус 1201', description: 'Второй зал', phone: '+79992222222', whatsapp: 'https://wa.me/79992222222', telegram: 'https://t.me/apg', website: 'https://example.com/north', workingHours: '10:00-19:00' },
  ],
};

assert.equal(hasMultipleLocations(networkPartner), true);
assert.equal(getMainLocation(networkPartner).id, 'center');
assert.equal(getLocationById(networkPartner, 'north').title, 'Филиал в 12 районе');
assert.equal(getLocationById(networkPartner, 'north').description, 'Второй зал');
assert.equal(getLocationById(networkPartner, 'north').whatsapp, 'https://wa.me/79992222222');
assert.equal(getLocationById(networkPartner, 'north').telegram, 'https://t.me/apg');
assert.equal(getLocationById(networkPartner, 'north').website, 'https://example.com/north');
assert.ok(getLocationsSearchText(networkPartner).includes('12 районе'));
assert.ok(getLocationsSearchText(networkPartner).includes('корпус 1201'));

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
  { id: 'main', title: 'Главная', address: 'Корпус 2', description: 'Основное пространство', whatsapp: 'wa', telegram: 'tg', website: 'site', comment: 'вход справа', isMain: true, services: ['Маникюр'] },
], legacyPartner);
assert.equal(saved.length, 2);
assert.equal(saved[0].isMain, false);
assert.equal(saved[1].isMain, true);
assert.equal(saved[1].description, 'Основное пространство');
assert.equal(saved[1].comment, 'вход справа');
assert.equal(saved[1].whatsapp, 'wa');
assert.equal(saved[1].telegram, 'tg');
assert.equal(saved[1].website, 'site');
assert.deepEqual(saved[1].services, ['Маникюр']);

for (const futureField of ['services', 'employees', 'photos', 'booking', 'analytics', 'reviews', 'promotions', 'events', 'inventory']) {
  assert.ok(LOCATION_FUTURE_FIELDS.includes(futureField));
}

const adminPanel = fs.readFileSync('src/AdminPanel.jsx', 'utf8');
assert.match(adminPanel, /pLocations/, 'Admin partner editor keeps locations in form state');
assert.match(adminPanel, /normalizeLocationsForSave/, 'Admin partner save uses shared locations normalizer');
assert.match(adminPanel, /Филиалы/, 'Admin partner editor exposes branch section');
assert.match(adminPanel, /Копировать/, 'Admin partner editor supports copy-as-template');

const partnerCabinet = fs.readFileSync('src/PartnerCabinetPage.jsx', 'utf8');
assert.match(partnerCabinet, /fLocations/, 'Mobile partner cabinet keeps locations in autosave state');
assert.match(partnerCabinet, /Филиалы/, 'Mobile partner cabinet exposes branch tab');
assert.match(partnerCabinet, /setMainLocation/, 'Mobile partner cabinet can set main location');

const partnerPage = fs.readFileSync('src/PartnerPage.jsx', 'utf8');
assert.match(partnerPage, /params\.get\('location'\)/, 'Partner profile supports location deep link query');
assert.match(partnerPage, /Филиалы \(\{locations\.length\}\)/, 'Partner profile renders compact branches summary');
assert.match(partnerPage, /locationId: location\?\.id/, 'Partner profile tracks branch-aware route and call actions');

const partnersPage = fs.readFileSync('src/PartnersPage.jsx', 'utf8');
assert.match(partnersPage, /getLocationsSearchText/, 'Partner catalog search indexes all branch addresses and titles');

const mapPage = fs.readFileSync('src/MapPage.jsx', 'utf8');
assert.match(mapPage, /mapLocationRows/, 'Map page flattens partner locations into map rows');
assert.match(mapPage, /mapPointsParam/, 'Map page can render multiple branch coordinates');

const bookingFlow = fs.readFileSync('src/booking/BookingFlow.jsx', 'utf8');
assert.match(bookingFlow, /provider\?\.locationId/, 'Booking flow starts from selected branch when provided');

const userApp = fs.readFileSync('src/UserApp.jsx', 'utf8');
assert.match(userApp, /parsed\.searchParams\.get\('location'\)/, 'Public QR scanner preserves branch location query');
assert.match(userApp, /locationToProvider\(partner, location\)/, 'Public QR scanner opens partner with selected branch provider data');

console.log('partner-locations-test: ok');
