const MAX_TEXT = 420;

export function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function text(value, max = MAX_TEXT) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function normalizeTopic(value = '') {
  return text(value, 120).toLowerCase().replace(/ё/g, 'е');
}

export function extractEntities(result = {}, knowledgeIndexResult = {}) {
  const rows = [
    ...list(result.cards),
    result.card,
    ...list(result.knowledgeIndexSearch?.entities),
    ...list(knowledgeIndexResult?.knowledgeIndexSearch?.entities),
  ].filter(Boolean);
  const seen = new Set();
  return rows.map(row => ({
    id: text(row.id || row.entityId || row.title, 120),
    type: text(row.type || row.entityType || 'unknown', 40),
    title: text(row.title || row.name || row.label, 160),
  })).filter(row => {
    const key = `${row.type}:${row.id || row.title}`;
    if (!row.id && !row.title) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

export function buildConversationExperience({ question = '', result = {}, context = {}, appState = {}, knowledgeIndexResult = {}, startedAt = null } = {}) {
  const createdAt = new Date().toISOString();
  const ms = startedAt == null ? Number(result?.debug?.totalMs || 0) : Math.max(0, Math.round(Date.now() - startedAt));
  const fallback = Boolean(result?.debug?.timeout || result?.debug?.fallbackUsed || result?.intent === 'fallback' || !text(result?.text));
  const entities = extractEntities(result, knowledgeIndexResult);
  return {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    userId: text(context?.user?.id || appState?.user?.id || context?.userId || '', 160),
    sessionId: text(context?.memory?.lastConversationSession?.id || context?.sessionId || '', 160),
    intent: text(result?.intent || context?.intent?.id || 'unknown', 120),
    query: text(question),
    topic: normalizeTopic(question),
    answer: text(result?.text, 600),
    actionType: text(result?.executeAction?.type || result?.autoAction?.type || result?.card?.action?.type || '', 120),
    source: text(result?.source || result?.debug?.provider || 'loki', 80),
    entities,
    success: !fallback,
    fallback,
    responseTimeMs: ms,
    errors: list(result?.toolContext?.events).filter(row => row?.status === 'error').map(row => text(row.message || row.error, 160)),
  };
}
