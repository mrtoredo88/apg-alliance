export const LOKI_EVENTS = {
  USER_LOGIN: 'user_login',
  KEY_RECEIVED: 'key_received',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  PARTNER_OPENED: 'partner_opened',
  EVENT_OPENED: 'event_opened',
  PRIZE_OPENED: 'prize_opened',
  PROFILE_OPENED: 'profile_opened',
  APP_ERROR: 'app_error',
  USER_IDLE: 'user_idle',
  DAILY_VISIT: 'daily_visit',
};

export const LOKI_EVENT_CONFIG = {
  [LOKI_EVENTS.USER_LOGIN]: { emotion: 'happy', duration: 7200 },
  [LOKI_EVENTS.KEY_RECEIVED]: { emotion: 'excited', duration: 7600 },
  [LOKI_EVENTS.ACHIEVEMENT_UNLOCKED]: { emotion: 'happy', duration: 6800 },
  [LOKI_EVENTS.PARTNER_OPENED]: { emotion: 'helper', duration: 6200 },
  [LOKI_EVENTS.EVENT_OPENED]: { emotion: 'thinking', duration: 6200 },
  [LOKI_EVENTS.PRIZE_OPENED]: { emotion: 'excited', duration: 6200 },
  [LOKI_EVENTS.PROFILE_OPENED]: { emotion: 'helper', duration: 5600 },
  [LOKI_EVENTS.APP_ERROR]: { emotion: 'sad', duration: 7600 },
  [LOKI_EVENTS.USER_IDLE]: { emotion: 'sleep', duration: 6200 },
  [LOKI_EVENTS.DAILY_VISIT]: { emotion: 'idle', duration: 5600 },
};

export const LOKI_EMOTIONS = ['idle', 'happy', 'thinking', 'excited', 'sad', 'helper', 'sleep'];
