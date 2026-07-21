import { list, text } from './ConversationLearning.js';

function entity(kind, row = {}) {
  const title = text(row.title || row.name || row.displayName, 160);
  if (!title) return null;
  return {
    id: text(row.id || row.slug || title, 160),
    kind,
    title,
    category: text(row.category || row.type || row.specialization, 120),
    contacts: [row.phone, row.telegram, row.telegramUrl, row.website, row.websiteUrl].map(item => text(item, 160)).filter(Boolean),
    keywords: [title, row.category, row.description, row.offer, row.address].map(item => text(item, 120)).filter(Boolean),
    topics: [row.category, row.specialization, row.status].map(item => text(item, 80)).filter(Boolean),
    relations: list(row.locations).map(item => ({ type: 'location', id: text(item.id || item.address, 120), title: text(item.title || item.address, 120) })),
  };
}

export function buildStructuredKnowledgeIndex(appState = {}) {
  const entities = [
    ...list(appState.partners).map(row => entity('partner', row)),
    ...list(appState.experts).map(row => entity('expert', row)),
    ...list(appState.events).map(row => entity('event', row)),
    ...list(appState.promotions || appState.offers).map(row => entity('offer', row)),
    ...list(appState.news).map(row => entity('news', row)),
  ].filter(Boolean);
  return {
    source: 'structured_apg_data',
    mode: 'index_only',
    officialKnowledgeMutationAllowed: false,
    updatedAt: new Date().toISOString(),
    counts: {
      entities: entities.length,
      partners: entities.filter(row => row.kind === 'partner').length,
      experts: entities.filter(row => row.kind === 'expert').length,
      events: entities.filter(row => row.kind === 'event').length,
      offers: entities.filter(row => row.kind === 'offer').length,
      news: entities.filter(row => row.kind === 'news').length,
    },
    entities,
  };
}

export function buildKnowledgeUpdatePolicy() {
  return {
    allowed: ['user_memory', 'experience_memory', 'feedback_score', 'knowledge_candidates', 'structured_search_index'],
    forbidden: ['official_knowledge_from_conversation', 'business_data', 'roles', 'settings', 'irreversible_actions'],
    mutations: [],
  };
}
