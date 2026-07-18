const MAX_TEXT = 500;

export const LOCATION_FUTURE_FIELDS = Object.freeze([
  'services',
  'employees',
  'photos',
  'booking',
  'analytics',
  'reviews',
  'promotions',
  'events',
  'inventory',
]);

function text(value, max = MAX_TEXT) {
  return String(value ?? '').trim().slice(0, max);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function coordinatesFrom(source = {}) {
  const raw = source.coordinates && typeof source.coordinates === 'object' ? source.coordinates : {};
  const latitude = Number(source.latitude ?? source.lat ?? raw.latitude ?? raw.lat);
  const longitude = Number(source.longitude ?? source.lng ?? raw.longitude ?? raw.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function hasLocationContent(location = {}) {
  return Boolean(
    text(location.title || location.name)
    || text(location.address || location.location)
    || text(location.description)
    || text(location.phone || location.contactPhone)
    || text(location.whatsapp || location.telegram || location.website)
    || text(location.workingHours || location.hours || location.schedule)
    || coordinatesFrom(location)
  );
}

export function normalizeLocation(raw = {}, index = 0, profile = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const id = text(source.id || source.locationId || source.slug || `location-${index + 1}`, 120).replace(/\s+/g, '-');
  const address = text(source.address || source.location || source.place || source.venue || '');
  const phone = text(source.phone || source.contactPhone || '');
  const workingHours = text(source.workingHours || source.hours || source.schedule || '');
  const coordinates = coordinatesFrom(source);
  const normalized = {
    id: id || `location-${index + 1}`,
    title: text(source.title || source.name || (source.isMain ? 'Основная локация' : `Локация ${index + 1}`), 160),
    address,
    description: text(source.description || source.shortDescription || '', 700),
    phone,
    whatsapp: text(source.whatsapp || source.whatsappUrl || source.whatsApp || '', 220),
    telegram: text(source.telegram || source.telegramUrl || source.telegramChannel || '', 220),
    website: text(source.website || source.websiteUrl || source.site || '', 260),
    workingHours,
    coordinates,
    comment: text(source.comment || source.note || '', 700),
    isMain: Boolean(source.isMain),
  };
  LOCATION_FUTURE_FIELDS.forEach(field => {
    if (source[field] !== undefined) normalized[field] = source[field];
  });
  if (!normalized.title && address) normalized.title = index === 0 ? 'Основная локация' : `Локация ${index + 1}`;
  if (!normalized.phone) normalized.phone = text(profile.phone || profile.contactPhone || '');
  if (!normalized.workingHours) normalized.workingHours = text(profile.workingHours || profile.hours || profile.schedule || '');
  return normalized;
}

export function legacyLocationFromProfile(profile = {}) {
  const source = {
    id: 'main',
    title: profile.locationTitle || profile.branchTitle || 'Основная локация',
    address: profile.address || profile.location || profile.place || profile.venue || '',
    phone: profile.phone || profile.contactPhone || '',
    workingHours: profile.workingHours || profile.hours || profile.schedule || '',
    coordinates: coordinatesFrom(profile),
    isMain: true,
  };
  return hasLocationContent(source) ? normalizeLocation(source, 0, profile) : null;
}

export function getProfileLocations(profile = {}) {
  const rawLocations = list(profile.locations)
    .map((item, index) => normalizeLocation(item, index, profile))
    .filter(hasLocationContent);
  const fallback = legacyLocationFromProfile(profile);
  const withFallback = rawLocations.length ? rawLocations : (fallback ? [fallback] : []);
  if (!withFallback.length) return [];
  const mainIndex = withFallback.findIndex(item => item.isMain);
  return withFallback.map((item, index) => ({
    ...item,
    isMain: mainIndex >= 0 ? index === mainIndex : index === 0,
  }));
}

export function hasMultipleLocations(profile = {}) {
  return getProfileLocations(profile).length > 1;
}

export function getMainLocation(profile = {}) {
  const locations = getProfileLocations(profile);
  return locations.find(item => item.isMain) || locations[0] || null;
}

export function getLocationById(profile = {}, locationId = '') {
  const cleanId = text(locationId, 120);
  const locations = getProfileLocations(profile);
  return locations.find(item => item.id === cleanId) || getMainLocation(profile);
}

export function locationToProvider(provider = {}, location = null) {
  if (!location) return provider;
  const coordinates = coordinatesFrom(location) || {};
  return {
    ...provider,
    locationId: location.id,
    locationTitle: location.title,
    address: location.address || provider.address,
    location: location.address || provider.location,
    phone: location.phone || provider.phone,
    contactPhone: location.phone || provider.contactPhone,
    workingHours: location.workingHours || provider.workingHours,
    hours: location.workingHours || provider.hours,
    latitude: coordinates.latitude ?? provider.latitude,
    longitude: coordinates.longitude ?? provider.longitude,
  };
}

export function locationBookingPayload(location = null) {
  if (!location) return null;
  return {
    id: text(location.id, 120),
    title: text(location.title, 160),
    address: text(location.address, 260),
    phone: text(location.phone, 80),
    workingHours: text(location.workingHours, 220),
    coordinates: coordinatesFrom(location),
  };
}

export function normalizeLocationsForSave(locations = [], profile = {}) {
  const normalized = list(locations)
    .map((item, index) => normalizeLocation(item, index, profile))
    .filter(hasLocationContent)
    .slice(0, 50);
  if (!normalized.length) return [];
  const mainIndex = normalized.findIndex(item => item.isMain);
  return normalized.map((item, index) => ({
    ...item,
    isMain: mainIndex >= 0 ? index === mainIndex : index === 0,
  }));
}
