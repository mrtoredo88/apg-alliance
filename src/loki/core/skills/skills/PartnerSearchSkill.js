import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { LokiSkill } from '../LokiSkill.js';

export const PartnerSearchSkill = new LokiSkill({
  id: 'partner.search',
  title: 'Partner Search',
  supportedCapabilities: ['SEARCH_PARTNERS', 'OPEN_PARTNER', 'VIEW_PARTNER_PROFILE', 'CALL_PARTNER', 'BUILD_ROUTE', 'OPEN_SITE', 'OPEN_WHATSAPP', 'OPEN_TELEGRAM'],
  supportedEntities: ['partner', 'location'],
  supportedContexts: ['partner', 'location'],
  priority: 88,
  description: 'Поиск и открытие партнёров по названию, категории, услуге, близости, акции и рейтингу.',
  workflow: 'partner',
  tools: [TOOL_IDS.SEARCH, TOOL_IDS.PARTNER_FIND, TOOL_IDS.PARTNER_OPEN, TOOL_IDS.PROMOTION_ACTIVE],
  signals: ['партн', 'мест', 'рядом', 'категор', 'услуг', 'акци', 'рейтинг', 'маршрут', 'телефон', 'сайт'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    const query = capabilityContext.resolved?.query || question;
    const lower = String(question || '').toLowerCase();
    return {
      entity: 'Partner',
      normalizedQuery: query,
      preparedParameters: {
        ...capabilityContext.resolved,
        query,
        location: lower.includes('рядом') ? 'nearby' : capabilityContext.resolved?.location || '',
        sort: lower.includes('рейтинг') ? 'rating' : lower.includes('рядом') ? 'nearby' : '',
        filter: lower.includes('акци') ? 'promotion' : '',
      },
      recommendations: ['use_existing_search', 'prefer_partner_cards'],
    };
  },
});
