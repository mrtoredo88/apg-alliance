import { conversationEvent, LOKI_CONVERSATION_EVENTS } from './ConversationHistory.js';
import { buildConversationContext, summarizeConversationContext } from './ConversationContext.js';
import { entitiesFromResult } from './ConversationReferences.js';
import { buildConversationSnapshot } from './ConversationSnapshot.js';
import { sessionFromMemory, updateConversationSession } from './ConversationSession.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function responseSummary(result = {}) {
  return {
    intent: result?.intent || '',
    text: String(result?.text || '').slice(0, 320),
    cardId: result?.card?.id || '',
    cardType: result?.card?.type || '',
    cardsCount: list(result?.cards).length,
  };
}

function buildEvents({ previousSession, session, conversation, hadPreviousSession = false }) {
  const events = [];
  if (!hadPreviousSession || !previousSession?.conversationId || previousSession.conversationId !== session.conversationId) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.CREATED, { conversationId: session.conversationId, status: 'created' }));
  }
  const previousTopic = previousSession?.activeTopics?.[0]?.id || '';
  const nextTopic = session.activeTopics?.[0]?.id || '';
  if (nextTopic && previousTopic !== nextTopic) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.TOPIC_CHANGED, { conversationId: session.conversationId, topicId: nextTopic, source: 'conversation_engine' }));
  }
  if (conversation.resolvedReference?.entity) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.REFERENCE_RESOLVED, {
      conversationId: session.conversationId,
      topicId: nextTopic,
      entityId: conversation.resolvedReference.entity.id,
      entityType: conversation.resolvedReference.entity.type,
      reference: conversation.resolvedReference.reference,
      reason: conversation.resolvedReference.reason,
      source: 'local_session',
    }));
  }
  if (!conversation.validation?.ok) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.REFERENCE_FAILED, {
      conversationId: session.conversationId,
      topicId: nextTopic,
      status: 'failed',
      reason: conversation.validation?.reason,
    }));
  }
  if (conversation.restoreReason) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.CONTEXT_RESTORED, {
      conversationId: session.conversationId,
      topicId: nextTopic,
      reason: conversation.restoreReason,
      source: 'local_session',
    }));
  }
  if (conversation.activeEntities.length) {
    events.push(conversationEvent(LOKI_CONVERSATION_EVENTS.ENTITY_RESOLVED, {
      conversationId: session.conversationId,
      topicId: nextTopic,
      entityId: conversation.activeEntities[0].id,
      entityType: conversation.activeEntities[0].type,
      source: 'result_cards',
    }));
  }
  return events;
}

export function resolveConversation({ question = '', intent = {}, reasoningResult = null, context = {} } = {}) {
  const hadPreviousSession = Boolean(context?.memory?.lastConversationSession || context?.memory?.conversationSession);
  const previousSession = sessionFromMemory(context?.memory || {});
  const snapshot = buildConversationSnapshot(context?.memory || {});
  const resultEntities = entitiesFromResult(reasoningResult || {});
  const conversation = buildConversationContext({
    question,
    intent,
    session: previousSession,
    resultEntities,
    previousEntities: snapshot.activeEntities,
    reasoningResult,
    workflowSnapshot: context?.memory?.workflowSnapshot || null,
  });
  const session = updateConversationSession(previousSession, {
    activeTopics: conversation.activeTopics,
    activeEntities: conversation.activeEntities,
    lastIntent: conversation.effectiveIntent?.id || intent.id || '',
    lastWorkflow: context?.memory?.lastWorkflowContext || null,
    lastTool: context?.memory?.lastToolContext || null,
    lastResponse: responseSummary(reasoningResult),
    lastResolution: conversation.resolvedReference || null,
  });
  const events = buildEvents({ previousSession, session, conversation, hadPreviousSession });
  return {
    ...conversation,
    session,
    snapshot: summarizeConversationContext(conversation),
    events,
    source: 'local_conversation_session',
  };
}
