function nowIso() {
  return new Date().toISOString();
}

function idPart() {
  return Math.random().toString(36).slice(2, 8);
}

export function createConversationSession(seed = {}) {
  const now = nowIso();
  return {
    version: 'v1',
    conversationId: seed.conversationId || `conversation-${Date.now()}-${idPart()}`,
    activeTopics: [],
    activeEntities: [],
    lastIntent: '',
    lastWorkflow: null,
    lastTool: null,
    lastResponse: null,
    lastResolution: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function sessionFromMemory(memory = {}) {
  const source = memory.lastConversationSession || memory.conversationSession || null;
  if (!source || typeof source !== 'object') return createConversationSession();
  return {
    ...createConversationSession({ conversationId: source.conversationId }),
    ...source,
    activeTopics: Array.isArray(source.activeTopics) ? source.activeTopics.filter(Boolean) : [],
    activeEntities: Array.isArray(source.activeEntities) ? source.activeEntities.filter(Boolean) : [],
    updatedAt: source.updatedAt || nowIso(),
  };
}

export function updateConversationSession(session = createConversationSession(), patch = {}) {
  return {
    ...session,
    ...patch,
    activeTopics: Array.isArray(patch.activeTopics) ? patch.activeTopics.filter(Boolean).slice(0, 8) : session.activeTopics,
    activeEntities: Array.isArray(patch.activeEntities) ? patch.activeEntities.filter(Boolean).slice(0, 24) : session.activeEntities,
    updatedAt: nowIso(),
  };
}
