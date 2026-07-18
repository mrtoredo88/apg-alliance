import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const EventSkill = new LokiSkill({
  id: 'event',
  title: 'Event',
  supportedCapabilities: ['SEARCH_EVENTS', 'OPEN_EVENT', 'OPEN_EVENTS_MANAGER'],
  supportedEntities: ['event'],
  supportedContexts: ['event'],
  priority: 84,
  description: 'Мероприятия: сегодня, завтра, неделя, рядом и по теме.',
  planner: PLANNER_GOALS.PLAN_DAY,
  workflow: 'event',
  tools: [TOOL_IDS.SEARCH, TOOL_IDS.EVENT_TODAY, TOOL_IDS.EVENT_UPCOMING, TOOL_IDS.EVENT_MY_REGISTRATIONS],
  signals: ['событ', 'мероприят', 'афиша', 'сегодня', 'завтра', 'недел', 'рядом', 'тема'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    const lower = String(question || '').toLowerCase();
    return {
      entity: 'Event',
      normalizedQuery: capabilityContext.resolved?.query || question,
      preparedParameters: {
        ...capabilityContext.resolved,
        query: capabilityContext.resolved?.query || question,
        date: capabilityContext.resolved?.date || (lower.includes('сегодня') ? 'сегодня' : lower.includes('завтра') ? 'завтра' : ''),
        period: lower.includes('недел') ? 'week' : '',
        location: lower.includes('рядом') ? 'nearby' : '',
      },
      planner: PLANNER_GOALS.PLAN_DAY,
      workflow: 'event',
      recommendations: ['use_existing_event_tools'],
    };
  },
});
