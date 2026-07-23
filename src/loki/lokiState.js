export const LOKI_STORAGE_KEY = 'apg_loki_settings_v1';
export const LOKI_GREETING_KEY = 'apg_loki_greeting_seen_v1';
export const LOKI_DAILY_KEY = 'apg_loki_daily_visit_v1';

export const LOKI_MODES = {
  ON_DEMAND: 'on_demand',
  MINIMAL: 'minimal',
  STANDARD: 'standard',
  ACTIVE: 'active',
};

export const DEFAULT_LOKI_SETTINGS = {
  enabled: true,
  hiddenPanels: [],
  bubbleEnabled: true,
  dockedToHeader: false,
  mode: 'on_demand',
  personalityMode: 'friendly',
};

export function normalizeLokiSettings(value) {
  const settings = value && typeof value === 'object' ? value : {};
  const validModes = ['on_demand', 'minimal', 'standard', 'active'];
  const validPersonalityModes = ['professional', 'friendly', 'charismatic'];
  return {
    ...DEFAULT_LOKI_SETTINGS,
    ...settings,
    hiddenPanels: Array.isArray(settings.hiddenPanels) ? settings.hiddenPanels.filter(Boolean) : [],
    dockedToHeader: settings.dockedToHeader === true,
    mode: validModes.includes(settings.mode) ? settings.mode : 'on_demand',
    personalityMode: validPersonalityModes.includes(settings.personalityMode) ? settings.personalityMode : 'friendly',
  };
}

export function loadLokiSettings() {
  try {
    return normalizeLokiSettings(JSON.parse(localStorage.getItem(LOKI_STORAGE_KEY) || '{}'));
  } catch {
    return DEFAULT_LOKI_SETTINGS;
  }
}

export function saveLokiSettings(settings) {
  try {
    localStorage.setItem(LOKI_STORAGE_KEY, JSON.stringify(normalizeLokiSettings(settings)));
  } catch {}
}

export function getLokiUserKey(baseKey, userId) {
  return `${baseKey}:${userId || 'guest'}`;
}

export function hasSeenLokiGreeting(userId) {
  try {
    return localStorage.getItem(getLokiUserKey(LOKI_GREETING_KEY, userId)) === '1';
  } catch {
    return false;
  }
}

export function markLokiGreetingSeen(userId) {
  try {
    localStorage.setItem(getLokiUserKey(LOKI_GREETING_KEY, userId), '1');
  } catch {}
}

export function hasLokiDailyVisit(userId, dayKey) {
  try {
    return localStorage.getItem(getLokiUserKey(LOKI_DAILY_KEY, userId)) === dayKey;
  } catch {
    return false;
  }
}

export function markLokiDailyVisit(userId, dayKey) {
  try {
    localStorage.setItem(getLokiUserKey(LOKI_DAILY_KEY, userId), dayKey);
  } catch {}
}
