import { CHARISMATIC_TEMPLATES, FRIENDLY_TEMPLATES, PERSONALITY_CONTEXTS, personalityLibraryCapacity } from '../../personality/personalityPhrasePacks.js';
import { wasRecentlyUsed } from '../../personality/PersonalityMemory.js';
import { isPersonalityUnsafe } from '../../personality/PersonalitySafety.js';

export const LOKI_PERSONALITY_MODES = {
  PROFESSIONAL: 'professional',
  FRIENDLY: 'friendly',
  CHARISMATIC: 'charismatic',
};

const VALID_MODES = new Set(Object.values(LOKI_PERSONALITY_MODES));
const ADMIN_PANELS = new Set(['dashboard', 'users', 'partners', 'experts', 'events', 'events-center', 'news', 'comments', 'moderation', 'activity', 'prizes', 'rotation', 'analytics', 'notifs', 'errors', 'access', 'system', 'automation']);

function normalizeMode(value) {
  return VALID_MODES.has(value) ? value : LOKI_PERSONALITY_MODES.FRIENDLY;
}

function contextIdOf(context = {}) {
  const panel = context.user?.currentPanel || context.currentScreen?.id || context.contextEngine?.currentScreen?.id || 'default';
  if (ADMIN_PANELS.has(panel)) return PERSONALITY_CONTEXTS[panel] ? panel : 'admin';
  if (['owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst'].includes(context?.actor?.role) && panel === 'default') return 'admin';
  return PERSONALITY_CONTEXTS[panel] ? panel : 'default';
}

function fill(template, words) {
  return template.replaceAll('{subject}', words.subject).replaceAll('{result}', words.result).replaceAll('{place}', words.place);
}

function randomIndex(length, random) {
  return Math.min(length - 1, Math.floor(random() * length));
}

function inferredEvent(result, context, now) {
  if (result?.personalityEvent) return result.personalityEvent;
  if (result?.intent === 'admin.opened') return 'admin_opened';
  const sessionStartedAt = new Date(context?.memory?.sessionStartedAt || 0).getTime();
  if (sessionStartedAt && now.getTime() - sessionStartedAt >= 3 * 60 * 60 * 1000) return 'long_session';
  if (Number(context?.memory?.sameActionCount || context?.activity?.sameActionCount || 0) >= 10) return 'complex_complete';
  if (context?.memory?.firstLaunch === true || (!context?.memory?.lastSeenAt && !Number(context?.memory?.conversationCount || 0))) return 'first_launch';
  const lastSeen = new Date(context?.memory?.lastSeenAt || 0).getTime();
  if (lastSeen && now.getTime() - lastSeen > 21 * 86400000) return 'long_absence';
  if (result?.cards?.length || result?.card) return 'search_success';
  return null;
}

function frequencyAllows(mode, context, random) {
  const dialogCount = Number(context?.memory?.conversationCount || context?.userMemory?.conversationCount || 0);
  const recentCount = Array.isArray(context?.memory?.personalityHistory) ? context.memory.personalityHistory.length : 0;
  const base = mode === LOKI_PERSONALITY_MODES.CHARISMATIC ? 0.72 : 0.38;
  const familiarity = dialogCount > 12 ? 0.12 : dialogCount > 4 ? 0.06 : 0;
  const roleAdjustment = ['owner', 'super_admin', 'admin'].includes(context?.actor?.role) ? 0.04 : context?.actor?.role === 'user' ? 0 : -0.03;
  const fatigue = recentCount >= 8 ? 0.12 : 0;
  return random() < Math.max(0.18, Math.min(0.84, base + familiarity + roleAdjustment - fatigue));
}

export function selectPersonalityPhrase({ event, mode, context = {}, history, critical = false, text = '', random = Math.random, force = false, now = new Date() } = {}) {
  const selectedMode = normalizeMode(mode);
  if (selectedMode === LOKI_PERSONALITY_MODES.PROFESSIONAL) return null;
  if (!event || isPersonalityUnsafe({ event, critical, text, context })) return null;
  if (!force && !frequencyAllows(selectedMode, context, random)) return null;
  const pack = selectedMode === LOKI_PERSONALITY_MODES.CHARISMATIC ? CHARISMATIC_TEMPLATES : FRIENDLY_TEMPLATES;
  const eventKey = now.getHours() < 5 && pack.night_work && ['waiting', 'long_session'].includes(event) ? 'night_work' : event;
  const templates = pack[eventKey] || pack.success || [];
  if (!templates.length) return null;
  const contextId = contextIdOf(context);
  const words = PERSONALITY_CONTEXTS[contextId] || PERSONALITY_CONTEXTS.default;
  const candidates = templates.map((template, index) => ({ id: `${selectedMode}.${eventKey}.${contextId}.${index}`, text: fill(template, words) }));
  const unused = candidates.filter(candidate => !wasRecentlyUsed(history, candidate.id));
  const pool = unused.length ? unused : candidates;
  return pool[randomIndex(pool.length, random)] || null;
}

export const PersonalityEngine = {
  id: 'personalityEngine',
  label: 'Loki Personality Engine V1',
  libraryCapacity: personalityLibraryCapacity(),
  shape({ result, context, random = Math.random, now = new Date() }) {
    const base = result ?? { text: 'Пока я этого не знаю. В АПГ пока нет информации об этом.', card: null, cards: [] };
    const hasAction = !!(base.executeAction || base.autoAction || base.card?.action || base.cards?.some(card => card.action));
    const shortText = String(base.text || '').trim();
    const limit = base.preserveText || base.format === 'decision' ? 720 : 180;
    const helpText = shortText.length > limit ? `${shortText.slice(0, limit - 6).trim()}...` : shortText;
    const mode = normalizeMode(context?.personality?.mode || context?.settings?.personalityMode);
    const event = inferredEvent(base, context, now);
    const phrase = selectPersonalityPhrase({
      event,
      mode,
      context,
      history: context?.memory?.personalityHistory,
      critical: base.critical || base.severity === 'critical',
      text: helpText,
      random,
      now,
    });
    return {
      ...base,
      text: phrase ? `${helpText}\n\n${phrase.text}` : helpText,
      personalityMode: mode,
      personalityPhraseId: phrase?.id || null,
      personalityEvent: event,
      emotion: base.emotion ?? (hasAction ? 'helper' : 'thinking'),
      tone: mode,
    };
  },
};
