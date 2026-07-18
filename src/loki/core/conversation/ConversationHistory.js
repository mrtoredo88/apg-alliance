export const LOKI_CONVERSATION_EVENTS = {
  CREATED: 'CONVERSATION_CREATED',
  TOPIC_CHANGED: 'CONVERSATION_TOPIC_CHANGED',
  ENTITY_RESOLVED: 'CONVERSATION_ENTITY_RESOLVED',
  REFERENCE_RESOLVED: 'CONVERSATION_REFERENCE_RESOLVED',
  REFERENCE_FAILED: 'CONVERSATION_REFERENCE_FAILED',
  CONTEXT_RESTORED: 'CONVERSATION_CONTEXT_RESTORED',
  FINISHED: 'CONVERSATION_FINISHED',
};

function nowIso() {
  return new Date().toISOString();
}

function compact(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 220);
}

export function conversationEvent(type, payload = {}) {
  return {
    type,
    at: nowIso(),
    conversationId: compact(payload.conversationId),
    topicId: compact(payload.topicId),
    entityId: compact(payload.entityId),
    entityType: compact(payload.entityType),
    reference: compact(payload.reference),
    status: compact(payload.status, 'ok'),
    reason: compact(payload.reason),
    source: compact(payload.source),
  };
}

export function buildConversationHistoryPatch(memory = {}, conversationContext = {}) {
  const events = Array.isArray(conversationContext.events) ? conversationContext.events.filter(Boolean) : [];
  if (!events.length) return {};
  const previous = Array.isArray(memory.conversationHistory) ? memory.conversationHistory : [];
  return {
    conversationHistory: [...events, ...previous].slice(0, 120),
  };
}
