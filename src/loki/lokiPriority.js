import { LOKI_MESSAGE_PRIORITY } from './lokiActionTypes.js';
import { getRecentAdviceIds } from './lokiHistory.js';

const ADVICE_COOLDOWN_MS = 1000 * 60 * 7;
const ACTIVE_SILENCE_MS = 5200;
const SAME_ADVICE_WINDOW_MS = 1000 * 60 * 60 * 18;

export function canShowProactiveAdvice({ advice, history, lastUserActionAt, lastPanelChangeAt, activePanel }) {
  if (!advice) return false;
  const now = Date.now();
  const lastAdvice = history.find(item => item.kind === 'proactive');
  if (lastAdvice && now - lastAdvice.ts < ADVICE_COOLDOWN_MS && advice.priority < LOKI_MESSAGE_PRIORITY.HIGH) return false;
  if (now - lastUserActionAt < ACTIVE_SILENCE_MS && advice.priority < LOKI_MESSAGE_PRIORITY.HIGH) return false;
  if (now - lastPanelChangeAt < ACTIVE_SILENCE_MS && advice.priority < LOKI_MESSAGE_PRIORITY.HIGH) return false;
  if (advice.suppressedPanels?.includes(activePanel)) return false;
  const recentIds = getRecentAdviceIds(history, SAME_ADVICE_WINDOW_MS);
  if (recentIds.has(advice.id) && advice.priority < LOKI_MESSAGE_PRIORITY.CRITICAL) return false;
  return true;
}

export function pickBestAdvice(items) {
  return [...items]
    .filter(Boolean)
    .sort((a, b) => (b.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL) - (a.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL))[0] ?? null;
}
