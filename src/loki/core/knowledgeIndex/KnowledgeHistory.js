export function buildKnowledgeHistoryPatch(memory = {}, snapshot = {}, searchResult = null) {
  const row = {
    id: snapshot.snapshotId || `knowledge-index-${Date.now()}`,
    createdAt: snapshot.LastUpdate || new Date().toISOString(),
    entities: snapshot.Entities || 0,
    relations: snapshot.Relations || 0,
    indexed: snapshot.Indexed || 'OK',
    query: searchResult?.query || '',
    results: searchResult?.entities?.length || 0,
    expanded: searchResult?.expandedContext?.length || 0,
  };
  const current = memory.lastKnowledgeHistory || memory.knowledgeIndexHistory || [];
  return { knowledgeIndexHistory: [row, ...current].slice(0, 100) };
}
