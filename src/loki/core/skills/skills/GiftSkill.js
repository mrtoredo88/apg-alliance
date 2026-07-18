import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const GiftSkill = new LokiSkill({
  id: 'gift',
  title: 'Gift',
  supportedCapabilities: ['OPEN_GIFTS'],
  supportedEntities: ['gift', 'prize'],
  supportedContexts: ['gift', 'prize'],
  priority: 78,
  description: 'Каталог подарков и доступных призов.',
  planner: PLANNER_GOALS.OPTIMIZE_KEYS,
  workflow: 'gift',
  tools: [TOOL_IDS.GIFT_AVAILABLE, TOOL_IDS.GIFT_NEW, TOOL_IDS.USER_KEYS],
  signals: ['подар', 'приз', 'получить', 'каталог'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    return {
      entity: 'Gift',
      normalizedQuery: question,
      preparedParameters: { ...capabilityContext.resolved },
      planner: PLANNER_GOALS.OPTIMIZE_KEYS,
      workflow: 'gift',
      recommendations: ['check_keys_before_gift'],
    };
  },
});
