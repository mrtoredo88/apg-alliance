import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { LokiSkill } from '../LokiSkill.js';

export const ProfileSkill = new LokiSkill({
  id: 'profile',
  title: 'Profile',
  supportedCapabilities: ['OPEN_PROFILE', 'OPEN_SETTINGS', 'VIEW_BOOKINGS', 'VIEW_FRIENDS', 'VIEW_ACTIVITY'],
  supportedEntities: ['user', 'profile'],
  supportedContexts: ['profile'],
  priority: 80,
  description: 'Профиль пользователя, настройки, записи, друзья и активность.',
  workflow: 'journey',
  tools: [TOOL_IDS.USER_PROFILE, TOOL_IDS.USER_KEYS, TOOL_IDS.MEETING_LIST],
  signals: ['профиль', 'настрой', 'записи', 'друз', 'активн'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    return {
      entity: 'User',
      normalizedQuery: question,
      preparedParameters: { ...capabilityContext.resolved },
      workflow: 'journey',
      recommendations: ['open_existing_profile_sections'],
    };
  },
});
