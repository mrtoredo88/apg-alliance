import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { LokiSkill } from '../LokiSkill.js';

export const ExpertSearchSkill = new LokiSkill({
  id: 'expert.search',
  title: 'Expert Search',
  supportedCapabilities: ['SEARCH_EXPERTS', 'OPEN_EXPERT'],
  supportedEntities: ['expert'],
  supportedContexts: ['expert'],
  priority: 84,
  description: 'Поиск экспертов по имени, специализации, категории и контексту услуги.',
  workflow: 'partner',
  tools: [TOOL_IDS.SEARCH, TOOL_IDS.EXPERT_FIND],
  signals: ['эксперт', 'специалист', 'врач', 'консульт', 'стоматолог', 'мастер'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    return {
      entity: 'Expert',
      normalizedQuery: capabilityContext.resolved?.query || question,
      preparedParameters: { ...capabilityContext.resolved, query: capabilityContext.resolved?.query || question },
      recommendations: ['use_existing_expert_search'],
    };
  },
});
