import { LOKI_EVENTS } from './lokiEvents.js';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { LOKI_MESSAGE_PRIORITY } from './lokiActionTypes.js';

export const LOKI_MOODS = {
  CALM: 'calm',
  HAPPY: 'happy',
  INSPIRED: 'inspired',
  CURIOUS: 'curious',
  THOUGHTFUL: 'thoughtful',
  SLEEPY: 'sleepy',
  PROUD: 'proud',
  TENDER: 'tender',
};

export const DEFAULT_LOKI_EMOTIONAL_STATE = {
  mood: LOKI_MOODS.CALM,
  warmth: 0.42,
  trust: 0.24,
  energy: 0.56,
  curiosity: 0.48,
  quietUntil: 0,
  lastEventType: null,
  lastSpokenAt: 0,
  repeatedEvents: {},
  timePhase: 'day',
  season: 'summer',
  phraseNonce: 1,
  updatedAt: null,
};

const EVENT_MOOD = {
  [LOKI_EVENTS.USER_LOGIN]: { mood: LOKI_MOODS.HAPPY, warmth: 0.05, trust: 0.02, energy: 0.05 },
  [LOKI_EVENTS.KEY_RECEIVED]: { mood: LOKI_MOODS.PROUD, warmth: 0.04, trust: 0.03, energy: 0.08 },
  [LOKI_EVENTS.ACHIEVEMENT_UNLOCKED]: { mood: LOKI_MOODS.PROUD, warmth: 0.05, trust: 0.04, energy: 0.06 },
  [LOKI_EVENTS.PARTNER_OPENED]: { mood: LOKI_MOODS.CURIOUS, curiosity: 0.04 },
  [LOKI_EVENTS.EVENT_OPENED]: { mood: LOKI_MOODS.INSPIRED, curiosity: 0.04, energy: 0.03 },
  [LOKI_EVENTS.PRIZE_OPENED]: { mood: LOKI_MOODS.HAPPY, curiosity: 0.03 },
  [LOKI_EVENTS.PROFILE_OPENED]: { mood: LOKI_MOODS.TENDER, warmth: 0.03 },
  [LOKI_EVENTS.REFERENCE_OPENED]: { mood: LOKI_MOODS.THOUGHTFUL, curiosity: 0.02 },
  [LOKI_EVENTS.RETURN_VISIT]: { mood: LOKI_MOODS.HAPPY, warmth: 0.06, trust: 0.03 },
  [LOKI_EVENTS.BRAIN_RESPONSE]: { mood: LOKI_MOODS.THOUGHTFUL, trust: 0.02 },
  [LOKI_EVENTS.APP_ERROR]: { mood: LOKI_MOODS.TENDER, energy: -0.07 },
  [LOKI_EVENTS.USER_IDLE]: { mood: LOKI_MOODS.SLEEPY, energy: -0.04 },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function getLokiTimePhase(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

export function getLokiSeason(now = new Date()) {
  const month = now.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function normalizeLokiEmotionState(value = {}) {
  return {
    ...DEFAULT_LOKI_EMOTIONAL_STATE,
    ...(value && typeof value === 'object' ? value : {}),
    warmth: clamp01(value?.warmth ?? DEFAULT_LOKI_EMOTIONAL_STATE.warmth),
    trust: clamp01(value?.trust ?? DEFAULT_LOKI_EMOTIONAL_STATE.trust),
    energy: clamp01(value?.energy ?? DEFAULT_LOKI_EMOTIONAL_STATE.energy),
    curiosity: clamp01(value?.curiosity ?? DEFAULT_LOKI_EMOTIONAL_STATE.curiosity),
    repeatedEvents: value?.repeatedEvents && typeof value.repeatedEvents === 'object' ? value.repeatedEvents : {},
  };
}

export function evolveLokiEmotion({ previous, eventType, now = new Date() }) {
  const base = normalizeLokiEmotionState(previous);
  const timePhase = getLokiTimePhase(now);
  const season = getLokiSeason(now);
  const patch = EVENT_MOOD[eventType] ?? {};
  const isNight = timePhase === 'night';
  const repeatedEvents = {
    ...base.repeatedEvents,
    [eventType]: (base.repeatedEvents?.[eventType] ?? 0) + 1,
  };
  const phraseNonce = (base.phraseNonce ?? 1) + 1;

  return normalizeLokiEmotionState({
    ...base,
    mood: isNight && eventType === LOKI_EVENTS.USER_IDLE ? LOKI_MOODS.SLEEPY : (patch.mood ?? base.mood),
    warmth: base.warmth + (patch.warmth ?? 0),
    trust: base.trust + (patch.trust ?? 0),
    energy: base.energy + (patch.energy ?? 0) + (isNight ? -0.05 : 0.015),
    curiosity: base.curiosity + (patch.curiosity ?? 0),
    quietUntil: Date.now() + getQuietWindow({ eventType, timePhase, repeatedCount: repeatedEvents[eventType] }),
    lastEventType: eventType,
    lastSpokenAt: Date.now(),
    repeatedEvents,
    timePhase,
    season,
    phraseNonce,
    updatedAt: now.toISOString(),
  });
}

export function getLokiEmotionalPresentation({ config, eventType, payload = {}, emotionalState }) {
  const state = normalizeLokiEmotionState(emotionalState);
  const atNight = state.timePhase === 'night';
  const mood = state.mood;
  const emotion = atNight && eventType === LOKI_EVENTS.USER_IDLE
    ? 'sleep'
    : mood === LOKI_MOODS.PROUD || mood === LOKI_MOODS.INSPIRED
      ? 'excited'
      : mood === LOKI_MOODS.THOUGHTFUL || mood === LOKI_MOODS.CURIOUS
        ? 'helper'
        : config.emotion;

  const action = payload.action
    ?? (atNight ? LOKI_ACTIONS.YAWN : null)
    ?? getMoodAction(mood)
    ?? config.action
    ?? LOKI_ACTIONS.IDLE;

  return {
    emotion,
    action,
    duration: Math.round((config.duration ?? 6000) * (atNight ? 1.12 : 1)),
  };
}

export function shouldLokiStayQuiet({ eventType, priority, emotionalState, nowMs = Date.now() }) {
  if (priority >= LOKI_MESSAGE_PRIORITY.HIGH) return false;
  if (eventType === LOKI_EVENTS.APP_ERROR || eventType === LOKI_EVENTS.KEY_RECEIVED) return false;
  const state = normalizeLokiEmotionState(emotionalState);
  if (nowMs < Number(state.quietUntil || 0)) return true;
  const repeated = state.repeatedEvents?.[eventType] ?? 0;
  return repeated >= 3 && Math.random() < 0.42;
}

export function getEmotionalMicroAction(emotionalState) {
  const state = normalizeLokiEmotionState(emotionalState);
  if (state.timePhase === 'night') return Math.random() < 0.5 ? LOKI_ACTIONS.YAWN : LOKI_ACTIONS.BLINK;
  if (state.mood === LOKI_MOODS.CURIOUS) return Math.random() < 0.55 ? LOKI_ACTIONS.LOOK_AROUND : LOKI_ACTIONS.SPARK;
  if (state.mood === LOKI_MOODS.PROUD || state.mood === LOKI_MOODS.HAPPY) return Math.random() < 0.45 ? LOKI_ACTIONS.WAVE : LOKI_ACTIONS.SPARK;
  if (state.energy < 0.34) return LOKI_ACTIONS.BLINK;
  return null;
}

export function getLokiEmotionalPayload(emotionalState) {
  const state = normalizeLokiEmotionState(emotionalState);
  return {
    emotionalState: {
      mood: state.mood,
      warmth: state.warmth,
      trust: state.trust,
      timePhase: state.timePhase,
      season: state.season,
      phraseNonce: state.phraseNonce,
    },
  };
}

function getMoodAction(mood) {
  if (mood === LOKI_MOODS.HAPPY || mood === LOKI_MOODS.PROUD) return LOKI_ACTIONS.WAVE;
  if (mood === LOKI_MOODS.CURIOUS || mood === LOKI_MOODS.THOUGHTFUL) return LOKI_ACTIONS.LOOK_AROUND;
  if (mood === LOKI_MOODS.SLEEPY) return LOKI_ACTIONS.YAWN;
  return null;
}

function getQuietWindow({ eventType, timePhase, repeatedCount }) {
  if (eventType === LOKI_EVENTS.CHARACTER_TAP) return 2200;
  if (eventType === LOKI_EVENTS.BRAIN_RESPONSE) return 3200;
  if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION) return 42000;
  if (eventType === LOKI_EVENTS.USER_IDLE) return timePhase === 'night' ? 70000 : 48000;
  return repeatedCount > 2 ? 16000 : 7200;
}
