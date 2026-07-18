import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const WorkspaceSkill = new LokiSkill({
  id: 'workspace',
  title: 'Workspace',
  supportedCapabilities: ['OPEN_WORKSPACE', 'OPEN_ANALYTICS', 'OPEN_DAY_PLANNER', 'OPEN_MEETINGS', 'OPEN_EVENTS_MANAGER', 'OPEN_PROMOTIONS_MANAGER', 'OPEN_CONTENT_MANAGER'],
  supportedEntities: ['workspace', 'partner', 'expert'],
  supportedContexts: ['workspace'],
  priority: 90,
  description: 'Workspace: аналитика, встречи, мероприятия, контент, акции и рабочий день.',
  planner: PLANNER_GOALS.REVIEW_WORKSPACE,
  workflow: 'workspace',
  tools: [TOOL_IDS.WORKSPACE_SUMMARY, TOOL_IDS.MEETING_LIST, TOOL_IDS.EVENT_UPCOMING, TOOL_IDS.PROMOTION_ACTIVE],
  signals: ['workspace', 'кабинет', 'аналитик', 'встреч', 'мероприят', 'контент', 'акци', 'рабоч'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    const lower = String(question || '').toLowerCase();
    return {
      entity: 'Workspace',
      normalizedQuery: question,
      preparedParameters: {
        ...capabilityContext.resolved,
        section: lower.includes('аналит') ? 'analytics' : lower.includes('встреч') ? 'meetings' : lower.includes('контент') ? 'content' : lower.includes('акци') ? 'promotions' : '',
      },
      planner: lower.includes('план') || lower.includes('день') ? PLANNER_GOALS.PLAN_DAY : PLANNER_GOALS.REVIEW_WORKSPACE,
      workflow: 'workspace',
      recommendations: ['use_workspace_summary'],
    };
  },
});
