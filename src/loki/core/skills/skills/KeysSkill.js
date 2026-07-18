import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const KeysSkill = new LokiSkill({
  id: 'keys',
  title: 'Keys',
  supportedCapabilities: ['OPEN_KEYS'],
  supportedEntities: ['user', 'profile'],
  supportedContexts: ['profile'],
  priority: 86,
  description: 'Баланс ключей, способы заработать и ближайшая награда.',
  planner: PLANNER_GOALS.OPTIMIZE_KEYS,
  workflow: 'journey',
  tools: [TOOL_IDS.USER_KEYS, TOOL_IDS.JOURNEY_PROGRESS, TOOL_IDS.JOURNEY_NEXT_REWARD],
  signals: ['ключ', 'баланс', 'заработ', 'потратить'],
  prepare({ capabilityContext = {} } = {}) {
    return {
      entity: 'User',
      preparedParameters: { ...capabilityContext.resolved },
      planner: PLANNER_GOALS.OPTIMIZE_KEYS,
      workflow: 'journey',
      recommendations: ['check_key_balance', 'show_next_reward'],
    };
  },
});
