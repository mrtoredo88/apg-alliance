import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const ReferralWorkflow = {
  id: 'referral',
  title: 'Приглашения',
  goals: ['INVITE_FRIEND', 'OPTIMIZE_KEYS'],
  plannerGoals: ['OPTIMIZE_KEYS'],
  intents: ['planner.key_opportunity', 'profile.question'],
  keywords: ['рефера', 'приглас', 'друз', 'ссылк', 'ключи через приглаш'],
  reason: 'запрос связан с приглашением друзей и прогрессом наград',
  steps: [
    { id: 'profile', title: 'Проверить профиль', kind: 'tool', toolId: TOOL_IDS.USER_PROFILE },
    { id: 'keys', title: 'Проверить ключи', kind: 'tool', toolId: TOOL_IDS.USER_KEYS },
    { id: 'journey', title: 'Проверить награды пути', kind: 'tool', toolId: TOOL_IDS.JOURNEY_PROGRESS },
    { id: 'create-invite', title: 'Открыть приглашение', kind: 'user_action', actionId: 'SHARE', dependencies: ['profile'] },
    { id: 'track-progress', title: 'Отслеживать прогресс', kind: 'user_action', actionId: 'OPEN_PROFILE', optional: true, dependencies: ['create-invite'] },
  ],
};
