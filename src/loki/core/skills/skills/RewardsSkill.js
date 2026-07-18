import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const RewardsSkill = new LokiSkill({
  id: 'rewards',
  title: 'Rewards',
  supportedCapabilities: ['OPEN_REWARDS'],
  supportedEntities: ['reward', 'gift', 'prize'],
  supportedContexts: ['profile'],
  priority: 82,
  description: 'Награды, достижения и вознаграждения пользователя.',
  planner: PLANNER_GOALS.OPTIMIZE_KEYS,
  workflow: 'journey',
  tools: [TOOL_IDS.JOURNEY_PROGRESS, TOOL_IDS.JOURNEY_NEXT_REWARD, TOOL_IDS.GIFT_AVAILABLE],
  signals: ['награ', 'вознаграж', 'достиж', 'подар'],
  prepare({ capabilityContext = {} } = {}) {
    return {
      entity: 'Reward',
      preparedParameters: { ...capabilityContext.resolved },
      planner: PLANNER_GOALS.OPTIMIZE_KEYS,
      workflow: 'journey',
      recommendations: ['show_rewards_progress'],
    };
  },
});
