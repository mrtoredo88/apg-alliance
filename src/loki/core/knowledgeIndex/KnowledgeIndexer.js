import { normalizeText } from '../lokiCoreUtils.js';
import { createKnowledgeEntity, toList, uniqueStrings } from './KnowledgeEntity.js';
import { buildKnowledgeRelations } from './KnowledgeRelations.js';

function addEntity(entities, type, source, extras = {}) {
  if (!source) return;
  entities.push(createKnowledgeEntity({ type, source, ...extras }));
}

function extractCategoriesAndTags(entities = []) {
  const existingTitles = new Set(entities.map(item => normalizeText(item.title)));
  const categories = uniqueStrings(entities.flatMap(item => item.categories));
  const tags = uniqueStrings(entities.flatMap(item => item.keywords)).filter(label => !existingTitles.has(normalizeText(label)));
  return {
    categories: categories.map(label => createKnowledgeEntity({ type: 'category', id: label, title: label, keywords: [label] })),
    tags: tags.map(label => createKnowledgeEntity({ type: 'tag', id: label, title: label, keywords: [label] })),
  };
}

export function buildKnowledgeEntities(knowledge = {}, appState = {}) {
  const sources = knowledge.sources || {};
  const entities = [];
  toList(sources.partners).forEach(item => addEntity(entities, 'partner', item, { keywords: [item.services, item.directions, item.features] }));
  toList(sources.experts).forEach(item => addEntity(entities, 'expert', item));
  toList(sources.locations).forEach(item => addEntity(entities, 'location', item, { keywords: [item.partnerTitle, item.address] }));
  toList(sources.events).forEach(item => addEntity(entities, 'event', item));
  toList(sources.promotions).forEach(item => addEntity(entities, 'promotion', item));
  toList(sources.news || sources.articles).forEach(item => addEntity(entities, 'news', item));
  toList(sources.dialogs).forEach(item => addEntity(entities, 'dialog', item));
  toList(sources.bookings || sources.meetings).forEach(item => addEntity(entities, 'booking', item));
  toList(sources.gifts).forEach(item => addEntity(entities, 'gift', item));
  toList(appState.rewards).forEach(item => addEntity(entities, 'reward', item));
  toList(appState.keys || appState.keyEvents).forEach(item => addEntity(entities, 'key', item));
  toList(appState.faq || appState.faqs).forEach(item => addEntity(entities, 'faq', item, { title: item.question || item.title, extraText: [item.answer] }));
  if (sources.workspaceAnalytics || appState.workspace || appState.homeExperience) {
    addEntity(entities, 'workspace', { id: 'workspace', title: 'Workspace АПГ', description: 'Рабочий контекст партнёров, экспертов, аналитики, встреч, событий и контента.' });
  }
  const extracted = extractCategoriesAndTags(entities);
  return [...entities, ...extracted.categories, ...extracted.tags];
}

export function buildKnowledgeIndex({ knowledge = {}, appState = {} } = {}) {
  const entities = buildKnowledgeEntities(knowledge, appState);
  const entityMap = new Map(entities.map(entity => [entity.key, entity]));
  const relations = buildKnowledgeRelations({ sources: knowledge.sources || {}, entities }).filter(row => entityMap.has(row.from) && entityMap.has(row.to));
  const counts = entities.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1;
    return acc;
  }, {});
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entities,
    entityMap,
    relations,
    counts,
  };
}
