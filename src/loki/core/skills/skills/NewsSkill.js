import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { LokiSkill } from '../LokiSkill.js';

export const NewsSkill = new LokiSkill({
  id: 'news',
  title: 'News',
  supportedCapabilities: ['SEARCH_NEWS', 'OPEN_NEWS', 'OPEN_FEED'],
  supportedEntities: ['news', 'article'],
  supportedContexts: ['news'],
  priority: 78,
  description: 'Новости, публикации, лента и связанные сущности.',
  tools: [TOOL_IDS.SEARCH, TOOL_IDS.NEWS_LATEST, TOOL_IDS.NEWS_TODAY],
  signals: ['новост', 'стать', 'публикац', 'лента', 'что нового'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    return {
      entity: 'News',
      normalizedQuery: capabilityContext.resolved?.query || question,
      preparedParameters: { ...capabilityContext.resolved, query: capabilityContext.resolved?.query || question },
      recommendations: ['use_existing_news_search'],
    };
  },
});
