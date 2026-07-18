import { LOKI_EVENTS } from '../../lokiEvents.js';
import { LOKI_ACTIONS } from '../../lokiBehavior.js';
import { includesAny, normalizeText } from '../lokiCoreUtils.js';
import { detectOpportunities } from './OpportunityDetector.js';
import { pickTopOpportunity } from './PriorityResolver.js';
import { canShowOpportunity } from './TimingResolver.js';
import { buildProactiveCard } from './ProactiveCardBuilder.js';
import {
  LOKI_OPPORTUNITY_EVENTS,
  loadOpportunityHistory,
  recordOpportunityEvent,
} from './OpportunityHistory.js';

function isExplainQuery(text = '') {
  const query = normalizeText(text);
  return includesAny(query, [
    'почему ты мне это показал',
    'почему показал',
    'зачем показал',
    'почему эта подсказка',
    'почему такая подсказка',
  ]);
}

export function explainLastProactiveOpportunity(memory = {}) {
  const recommendation = memory.lastRecommendation || null;
  if (!recommendation?.reason) {
    return {
      intent: 'proactive.explain_empty',
      text: 'Сейчас нет активной подсказки, которую нужно объяснить.',
      card: null,
      cards: [],
    };
  }
  return {
    intent: 'proactive.explain',
    text: recommendation.reason,
    card: recommendation.card || null,
    cards: recommendation.card ? [recommendation.card] : [],
  };
}

export function runProactiveEngine({
  appState = {},
  memory = {},
  history = [],
  userMemory = {},
  lastUserActionAt = 0,
  lastPanelChangeAt = 0,
  now = Date.now(),
} = {}) {
  const opportunityHistory = loadOpportunityHistory();
  const found = detectOpportunities({ appState, memory, user: appState.user, userMemory, now });
  found.forEach(opportunity => recordOpportunityEvent(LOKI_OPPORTUNITY_EVENTS.FOUND, opportunity));
  const opportunity = pickTopOpportunity(found);
  const timing = canShowOpportunity({
    opportunity,
    appState,
    memory,
    history,
    opportunityHistory,
    lastUserActionAt,
    lastPanelChangeAt,
  });
  if (!timing.ok) return null;

  const card = buildProactiveCard(opportunity);
  return {
    eventType: LOKI_EVENTS.PROACTIVE_SUGGESTION,
    payload: {
      adviceId: opportunity.id,
      kind: 'proactive',
      message: opportunity.message || opportunity.summary,
      card,
      priority: opportunity.priority,
      reason: opportunity.reason,
      opportunity,
      opportunityType: opportunity.type,
      opportunityKey: opportunity.id,
      suppressedPanels: opportunity.suppressedPanels,
      action: LOKI_ACTIONS.LOOK_AROUND,
      source: 'loki_proactive_engine',
      quietMeta: { lastUserActionAt, lastPanelChangeAt, timing: timing.reason },
    },
  };
}

export function runProactiveAnswer({ question = '', memory = {} } = {}) {
  if (!isExplainQuery(question)) return null;
  return explainLastProactiveOpportunity(memory);
}
