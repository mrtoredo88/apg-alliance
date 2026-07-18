function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildConversationSnapshot(memory = {}) {
  const session = memory.lastConversationSession || memory.conversationSession || null;
  return {
    version: 'v1',
    source: 'local',
    conversationId: session?.conversationId || '',
    activeTopics: list(session?.activeTopics).slice(0, 8),
    activeEntities: list(session?.activeEntities).slice(0, 12),
    lastIntent: session?.lastIntent || '',
    lastWorkflow: session?.lastWorkflow || null,
    lastTool: session?.lastTool || null,
    lastResponse: session?.lastResponse || null,
    lastResolution: session?.lastResolution || null,
    empty: !session?.conversationId,
  };
}
