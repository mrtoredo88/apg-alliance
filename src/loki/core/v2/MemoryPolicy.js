export const LOKI_MEMORY_POLICY = Object.freeze({
  maxQueries: 20,
  maxConversationItems: 50,
  maxFavoritesPerType: 100,
  maxAgeDays: 180,
  sensitiveFields: ['email', 'phone', 'token', 'password', 'address'],
});

function sanitizeObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeObject);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !LOKI_MEMORY_POLICY.sensitiveFields.some(field => key.toLowerCase().includes(field)))
    .map(([key, item]) => [key, sanitizeObject(item)]));
}

export function compactLokiMemory(memory = {}, now = new Date()) {
  const cutoff = now.getTime() - LOKI_MEMORY_POLICY.maxAgeDays * 86400000;
  const recent = list => (Array.isArray(list) ? list : [])
    .filter(item => !item?.createdAt || new Date(item.createdAt).getTime() >= cutoff);
  return sanitizeObject({
    ...memory,
    lastQueries: recent(memory.lastQueries).slice(0, LOKI_MEMORY_POLICY.maxQueries),
    conversation: recent(memory.conversation).slice(-LOKI_MEMORY_POLICY.maxConversationItems),
    favoritePartners: (memory.favoritePartners || []).slice(0, LOKI_MEMORY_POLICY.maxFavoritesPerType),
    favoriteExperts: (memory.favoriteExperts || []).slice(0, LOKI_MEMORY_POLICY.maxFavoritesPerType),
    updatedAt: now.toISOString(),
  });
}
