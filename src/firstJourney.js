export const FIRST_JOURNEY_STORAGE_KEY = 'apg_first_journey_v1';
export const FIRST_JOURNEY_EVENT = 'apg:first-journey:update';
export const FIRST_JOURNEY_LOKI_QUESTION_EVENT = 'apg:first-journey:loki-question';

export const FIRST_JOURNEY_STEPS = [
  { id: 'installed', title: 'Приложение установлено', icon: '📲' },
  { id: 'email', title: 'Войдите по электронной почте', icon: '📧' },
  { id: 'loki', title: 'Познакомьтесь с Локи', icon: '🤖' },
  { id: 'rewards', title: 'Посмотрите подарки', icon: '🎁' },
  { id: 'explore', title: 'Исследуйте АПГ', icon: '🌟' },
];

export const FIRST_JOURNEY_LOKI_QUESTIONS = [
  { label: '☕ Где выпить кофе?', text: 'Где выпить кофе?' },
  { label: '🎁 Какие подарки рядом?', text: 'Какие подарки рядом?' },
  { label: '📅 Что интересного сегодня?', text: 'Что интересного сегодня?' },
  { label: '👥 Покажи партнёров рядом.', text: 'Покажи партнёров рядом.' },
];

function safeParse(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeGet() {
  try {
    return safeParse(localStorage.getItem(FIRST_JOURNEY_STORAGE_KEY));
  } catch {
    return {};
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(FIRST_JOURNEY_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

export function isFirstJourneyStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

export function isFirstJourneyMobile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia?.('(pointer: coarse)')?.matches;
}

export function isFirstJourneyAvailable() {
  return isFirstJourneyStandalone() || isFirstJourneyMobile();
}

export function isFirstJourneyEmailUser(user) {
  const id = String(user?.id || '');
  return id.startsWith('email:') || id.startsWith('email_') || Boolean(user?.email || user?.emailVerified);
}

export function isFirstJourneyGuest(user) {
  const id = String(user?.id || '');
  return !id || id.startsWith('guest_');
}

export function loadFirstJourneyProgress() {
  return safeGet();
}

export function saveFirstJourneyProgress(patch = {}) {
  const current = safeGet();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  safeSet(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FIRST_JOURNEY_EVENT, { detail: next }));
  }
  return next;
}

export function markFirstJourneyStep(stepId, extra = {}) {
  if (!stepId) return safeGet();
  const key = `${stepId}Done`;
  const atKey = `${stepId}DoneAt`;
  const current = safeGet();
  if (current[key]) return current;
  return saveFirstJourneyProgress({
    [key]: true,
    [atKey]: new Date().toISOString(),
    ...extra,
  });
}

export function getFirstJourneyState({ user, activePanel, stored = loadFirstJourneyProgress() } = {}) {
  const derived = {
    installedDone: Boolean(stored.installedDone || isFirstJourneyStandalone()),
    emailDone: Boolean(stored.emailDone || isFirstJourneyEmailUser(user)),
    lokiDone: Boolean(stored.lokiDone),
    rewardsDone: Boolean(stored.rewardsDone || activePanel === 'rewards'),
    exploreDone: Boolean(stored.exploreDone || ['partners', 'events', 'dialogs', 'rewards'].includes(activePanel)),
  };
  const completedIds = FIRST_JOURNEY_STEPS.filter(step => derived[`${step.id}Done`]).map(step => step.id);
  const currentStep = FIRST_JOURNEY_STEPS.find(step => !derived[`${step.id}Done`]) || null;
  return {
    ...stored,
    ...derived,
    steps: FIRST_JOURNEY_STEPS.map(step => ({ ...step, done: derived[`${step.id}Done`] })),
    completedIds,
    completedCount: completedIds.length,
    totalCount: FIRST_JOURNEY_STEPS.length,
    currentStep,
    complete: completedIds.length === FIRST_JOURNEY_STEPS.length,
    hidden: Boolean(stored.hidden) || !isFirstJourneyAvailable(),
  };
}

export function syncFirstJourneyDerived({ user, activePanel } = {}) {
  const patch = {};
  if (isFirstJourneyStandalone()) patch.installedDone = true;
  if (isFirstJourneyEmailUser(user)) patch.emailDone = true;
  if (activePanel === 'rewards') patch.rewardsDone = true;
  if (['partners', 'events', 'dialogs', 'rewards'].includes(activePanel)) {
    patch.exploreDone = true;
    patch.explorePanel = activePanel;
  }
  return Object.keys(patch).length ? saveFirstJourneyProgress(patch) : safeGet();
}

export function requestFirstJourneyLokiQuestion(text) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FIRST_JOURNEY_LOKI_QUESTION_EVENT, {
    detail: { text, source: 'first_journey', id: `${Date.now()}-${Math.random().toString(16).slice(2)}` },
  }));
}
