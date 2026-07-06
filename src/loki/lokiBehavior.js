import { LOKI_EVENTS, LOKI_EVENT_CONFIG } from './lokiEvents.js';

export const LOKI_ACTIONS = {
  IDLE: 'idle',
  BLINK: 'blink',
  LOOK_AROUND: 'lookAround',
  WAVE: 'wave',
  POINT: 'point',
  SPARK: 'spark',
  CATCH_KEY: 'catchKey',
  LISTEN: 'listen',
  YAWN: 'yawn',
  PEEK: 'peek',
};

export const LOKI_ANCHORS = {
  HOME: 'home',
  FIRST_CARD: 'firstCard',
  EVENT_CARD: 'eventCard',
  PROFILE: 'profile',
  REWARD_SHELF: 'rewardShelf',
  MAP: 'map',
  CENTER: 'center',
  CELEBRATE: 'celebrate',
  NOTICE: 'notice',
};

export const MICRO_ACTIONS = [
  LOKI_ACTIONS.BLINK,
  LOKI_ACTIONS.LOOK_AROUND,
  LOKI_ACTIONS.WAVE,
  LOKI_ACTIONS.SPARK,
  LOKI_ACTIONS.YAWN,
];

export const TAP_ACTIONS = [
  LOKI_ACTIONS.WAVE,
  LOKI_ACTIONS.BLINK,
  LOKI_ACTIONS.SPARK,
  LOKI_ACTIONS.LOOK_AROUND,
];

export function getBehaviorForEvent(eventType) {
  return LOKI_EVENT_CONFIG[eventType] ?? LOKI_EVENT_CONFIG[LOKI_EVENTS.DAILY_VISIT];
}

export function getRandomLokiAction(list = MICRO_ACTIONS) {
  return list[Math.floor(Math.random() * list.length)] ?? LOKI_ACTIONS.BLINK;
}

export function getNextMicroDelay() {
  return 18000 + Math.floor(Math.random() * 19000);
}

export function shouldUseNightAction() {
  const hour = new Date().getHours();
  return hour >= 23 || hour < 7;
}
