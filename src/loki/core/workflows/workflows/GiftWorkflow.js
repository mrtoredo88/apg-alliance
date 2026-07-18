import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const GiftWorkflow = {
  id: 'gift',
  title: 'Подарок',
  goals: ['CLAIM_GIFT', 'OPTIMIZE_KEYS'],
  plannerGoals: ['OPTIMIZE_KEYS'],
  intents: ['search.gifts', 'planner.key_opportunity'],
  keywords: ['подар', 'приз', 'получить', 'хватает ключ', 'ключи'],
  reason: 'запрос связан с подарками и условиями получения',
  steps: [
    { id: 'user-keys', title: 'Проверить баланс ключей', kind: 'tool', toolId: TOOL_IDS.USER_KEYS },
    { id: 'available-gifts', title: 'Найти доступные подарки', kind: 'tool', toolId: TOOL_IDS.GIFT_AVAILABLE },
    { id: 'open-gift', title: 'Открыть подарок', kind: 'user_action', actionId: 'OPEN_GIFT', dependencies: ['available-gifts'] },
    { id: 'conditions', title: 'Проверить условия', kind: 'user_action', actionId: 'OPEN_GIFT', optional: true, dependencies: ['open-gift'] },
  ],
};
