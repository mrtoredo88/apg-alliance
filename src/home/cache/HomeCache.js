export const HOME_CACHE_VERSION = 'home-cache-v1';
export const HOME_CACHE_PREFIX = 'apg_home_cache_v1_';
export const HOME_CACHE_MAX_BYTES = 1024 * 1024;

export const HOME_CACHE_SECTIONS = {
  NEWS: 'news',
  PARTNERS: 'partners',
  EVENTS: 'events',
  RECOMMENDATIONS: 'recommendations',
  JOURNEY: 'journey',
};

export const HOME_CACHE_TTL_MS = {
  [HOME_CACHE_SECTIONS.NEWS]: 5 * 60 * 1000,
  [HOME_CACHE_SECTIONS.PARTNERS]: 10 * 60 * 1000,
  [HOME_CACHE_SECTIONS.EVENTS]: 5 * 60 * 1000,
  [HOME_CACHE_SECTIONS.RECOMMENDATIONS]: 5 * 60 * 1000,
  [HOME_CACHE_SECTIONS.JOURNEY]: 5 * 60 * 1000,
};

export const HOME_CACHE_STORAGE_KEYS = {
  [HOME_CACHE_SECTIONS.NEWS]: `${HOME_CACHE_PREFIX}newsCache`,
  [HOME_CACHE_SECTIONS.PARTNERS]: `${HOME_CACHE_PREFIX}partnersCache`,
  [HOME_CACHE_SECTIONS.EVENTS]: `${HOME_CACHE_PREFIX}eventsCache`,
  [HOME_CACHE_SECTIONS.RECOMMENDATIONS]: `${HOME_CACHE_PREFIX}recommendationsCache`,
  [HOME_CACHE_SECTIONS.JOURNEY]: `${HOME_CACHE_PREFIX}journeyCache`,
};

const BUILD_VERSION = typeof __APG_BUILD_VERSION__ !== 'undefined' ? __APG_BUILD_VERSION__ : '';

export function getHomeCacheBuildVersion() {
  if (BUILD_VERSION) return BUILD_VERSION;
  if (typeof window === 'undefined') return 'test';
  return window.__APG_BUILD_VERSION__ || window.__APG_BUILD_DIAGNOSTICS__?.buildVersion || 'dev';
}

export function isHomeCacheSection(section) {
  return Object.values(HOME_CACHE_SECTIONS).includes(section);
}
