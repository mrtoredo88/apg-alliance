import { buildLokiRecommendations } from './lokiRecommendations.js';
import { canShowProactiveAdvice, pickBestAdvice } from './lokiPriority.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { evaluateLokiIntelligence } from './LokiIntelligence.js';

export function evaluateLokiObserver({ appState, memory, history, userMemory, lastUserActionAt, lastPanelChangeAt }) {
  const intelligence = evaluateLokiIntelligence({ appState, memory, history, userMemory, lastUserActionAt, lastPanelChangeAt });
  const advice = intelligence?.payload
    ? {
        id: intelligence.payload.adviceId,
        priority: intelligence.payload.priority,
        suppressedPanels: intelligence.payload.suppressedPanels,
      }
    : pickBestAdvice(buildLokiRecommendations(appState, memory));
  if (!canShowProactiveAdvice({
    advice,
    history,
    lastUserActionAt,
    lastPanelChangeAt,
    activePanel: appState?.activePanel,
  })) return null;

  if (intelligence) return intelligence;

  return {
    eventType: LOKI_EVENTS.PROACTIVE_SUGGESTION,
    payload: {
      adviceId: advice.id,
      kind: advice.kind,
      message: advice.message,
      card: advice.card,
      priority: advice.priority,
      action: LOKI_ACTIONS.LOOK_AROUND,
    },
  };
}
