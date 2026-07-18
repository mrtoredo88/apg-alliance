import { normalizeText } from '../lokiCoreUtils.js';
import { buildResolvedQuestion, detectConversationReference, mergeConversationEntities, resolveConversationReference } from './ConversationReferences.js';
import { findTopicByEntityType, inferConversationTopic, mergeConversationTopics } from './ConversationTopics.js';
import { validateConversationResolution } from './ConversationValidator.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compact(value, max = 220) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function intentForEntity(entity = {}, previousIntent = {}) {
  if (!entity?.type) return previousIntent;
  const query = entity.title || previousIntent.query || '';
  if (entity.type === 'partner' || entity.type === 'location') return { id: 'context.card', types: ['partner', 'location'], query };
  if (entity.type === 'expert') return { id: 'context.card', types: ['expert'], query };
  if (entity.type === 'event') return { id: 'context.card', types: ['event'], query };
  if (entity.type === 'news' || entity.type === 'article') return { id: 'news.question', types: ['news'], query };
  if (entity.type === 'promotion') return { id: 'search.promotions', types: ['promotion'], query };
  if (entity.type === 'gift' || entity.type === 'prize') return { id: 'search.gifts', types: ['gift'], query };
  return previousIntent;
}

export function buildConversationContext({
  question = '',
  intent = {},
  session = {},
  resultEntities = [],
  previousEntities = [],
  reasoningResult = null,
  workflowSnapshot = null,
} = {}) {
  const reference = detectConversationReference(question);
  const entities = mergeConversationEntities(previousEntities, resultEntities);
  const referenceEntities = reference.hasReference ? previousEntities : [];
  const resolution = resolveConversationReference({ reference, entities: referenceEntities });
  const validation = validateConversationResolution(resolution);
  const resolvedEntity = validation.ok ? resolution.entity || null : null;
  const topic = inferConversationTopic({ question, intent, result: reasoningResult, entities: resultEntities.length ? resultEntities : entities })
    || findTopicByEntityType(resolvedEntity?.type)
    || session.activeTopics?.[0]
    || null;
  const effectiveQuestion = resolvedEntity ? buildResolvedQuestion(question, resolvedEntity) : question;
  const effectiveIntent = resolvedEntity ? intentForEntity(resolvedEntity, intent) : intent;
  const isContinuation = reference.hasReference || Boolean(resolvedEntity) || (normalizeText(question).length <= 40 && Boolean(session.lastIntent || session.activeTopics?.length));
  return {
    version: 'v1',
    conversationId: session.conversationId,
    question: compact(question, 500),
    effectiveQuestion: compact(effectiveQuestion, 600),
    effectiveIntent,
    activeTopic: topic,
    activeTopics: mergeConversationTopics(session.activeTopics, topic),
    activeEntities: entities,
    resolvedReference: resolvedEntity ? {
      reference: reference.pronoun || (reference.ordinalIndex !== null ? String(reference.ordinalIndex + 1) : 'follow_up'),
      entity: resolvedEntity,
      reason: resolution.reason,
    } : null,
    reference,
    validation,
    isContinuation,
    restoreReason: resolvedEntity ? resolution.reason : isContinuation ? 'short_follow_up_or_existing_topic' : '',
    workflowSnapshot,
  };
}

export function summarizeConversationContext(context = {}) {
  return {
    conversationId: context.conversationId || '',
    activeTopics: list(context.activeTopics).map(topic => topic.id || topic.title).filter(Boolean).slice(0, 5),
    activeEntities: list(context.activeEntities).slice(0, 5).map(entity => ({ id: entity.id, type: entity.type, title: entity.title })),
    resolvedReference: context.resolvedReference ? {
      entityId: context.resolvedReference.entity?.id || '',
      entityType: context.resolvedReference.entity?.type || '',
      title: context.resolvedReference.entity?.title || '',
      reason: context.resolvedReference.reason || '',
    } : null,
    effectiveQuestion: context.effectiveQuestion || '',
    validation: context.validation || null,
    restoreReason: context.restoreReason || '',
  };
}
