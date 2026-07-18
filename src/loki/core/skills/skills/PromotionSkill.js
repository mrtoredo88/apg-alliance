import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { LokiSkill } from '../LokiSkill.js';

export const PromotionSkill = new LokiSkill({
  id: 'promotion',
  title: 'Promotion',
  supportedCapabilities: ['SEARCH_PROMOTIONS', 'OPEN_PROMOTION', 'OPEN_PROMOTIONS_MANAGER'],
  supportedEntities: ['promotion', 'partner'],
  supportedContexts: ['partner', 'promotion'],
  priority: 86,
  description: 'Акции: активные, новые, заканчивающиеся сегодня, рядом и по категории.',
  workflow: 'partner',
  tools: [TOOL_IDS.SEARCH, TOOL_IDS.PROMOTION_ACTIVE, TOOL_IDS.PROMOTION_NEW, TOOL_IDS.PROMOTION_EXPIRING_TODAY],
  signals: ['акци', 'скидк', 'предложен', 'выгод', 'сегодня', 'рядом', 'нов'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    const lower = String(question || '').toLowerCase();
    return {
      entity: 'Promotion',
      normalizedQuery: capabilityContext.resolved?.query || question,
      preparedParameters: {
        ...capabilityContext.resolved,
        query: capabilityContext.resolved?.query || question,
        freshness: lower.includes('нов') ? 'new' : '',
        expiring: lower.includes('сегодня') || lower.includes('заканч') ? 'today' : '',
        location: lower.includes('рядом') ? 'nearby' : '',
      },
      recommendations: ['use_existing_promotion_tools'],
    };
  },
});
