import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const JourneyWorkflow = {
  id: 'journey',
  title: 'Путь и ключи',
  goals: ['OPTIMIZE_KEYS', 'GET_REWARD'],
  plannerGoals: ['OPTIMIZE_KEYS'],
  intents: ['planner.key_opportunity'],
  keywords: ['ключ', 'награ', 'получить', 'выгод', 'серия', 'достижен'],
  reason: 'запрос требует выбрать лучший следующий шаг по ключам и прогрессу',
  steps: [
    { id: 'user-keys', title: 'Проверить баланс ключей', kind: 'tool', toolId: TOOL_IDS.USER_KEYS },
    { id: 'current-journey', title: 'Проверить текущий путь', kind: 'tool', toolId: TOOL_IDS.JOURNEY_PROGRESS },
    { id: 'next-reward', title: 'Найти ближайшую награду', kind: 'tool', toolId: TOOL_IDS.JOURNEY_NEXT_REWARD },
    { id: 'promotions', title: 'Проверить акции', kind: 'tool', toolId: TOOL_IDS.PROMOTION_ACTIVE },
    { id: 'recommended-action', title: 'Выбрать следующий шаг', kind: 'user_action', actionId: 'OPEN_PROFILE', dependencies: ['next-reward'] },
  ],
};
