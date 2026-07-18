export function buildMessagingHistoryPatch(memory = {}, snapshot = null) {
  if (!snapshot) return {};
  const previous = Array.isArray(memory.messagingHistory) ? memory.messagingHistory : [];
  const entry = {
    id: `messaging:${Date.now()}`,
    at: new Date().toISOString(),
    total: snapshot.total || 0,
    unread: snapshot.unread || 0,
    realtime: snapshot.realtime,
  };
  const messagingHistory = [entry, ...previous].slice(0, 100);
  return { messagingHistory, lastMessagingSnapshot: snapshot };
}
