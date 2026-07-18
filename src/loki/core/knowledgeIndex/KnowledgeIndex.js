import { buildKnowledgeIndex } from './KnowledgeIndexer.js';
import { searchKnowledgeIndex } from './KnowledgeSearch.js';
import { buildKnowledgeSnapshot } from './KnowledgeSnapshot.js';
import { validateKnowledgeIndex } from './KnowledgeValidator.js';

export function runLokiKnowledgeIndex({ question = '', knowledge = {}, appState = {} } = {}) {
  const index = buildKnowledgeIndex({ knowledge, appState });
  const validation = validateKnowledgeIndex(index);
  const searchResult = question ? searchKnowledgeIndex(index, question, { limit: 8, depth: 1 }) : null;
  const snapshot = buildKnowledgeSnapshot(index, validation);
  return {
    knowledgeIndex: index,
    knowledgeSnapshot: snapshot,
    knowledgeIndexSearch: searchResult,
    expandedKnowledgeContext: searchResult?.expandedContext || [],
    validation,
  };
}
