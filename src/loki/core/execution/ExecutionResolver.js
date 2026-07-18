import { getCapabilityById } from '../capabilities/CapabilityRegistry.js';
import { getExecutionDefinition } from './ExecutionRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clean(value) {
  return String(value ?? '').trim();
}

function firstId(rows = []) {
  return list(rows)[0]?.id || null;
}

function resolveFromKnowledge(capability = '', knowledge = {}) {
  const item = knowledge?.screenContext?.item || {};
  const sources = knowledge?.sources || {};
  const resolved = {};
  if (item.type === 'partner') resolved.partnerId = item.id;
  if (item.type === 'expert') resolved.expertId = item.id;
  if (item.type === 'event') resolved.eventId = item.id;
  if (item.type === 'news') resolved.newsId = item.id;
  if (!resolved.partnerId && ['OPEN_PARTNER', 'VIEW_PARTNER_PROFILE', 'CALL_PARTNER', 'BUILD_ROUTE', 'OPEN_SITE', 'OPEN_WHATSAPP', 'OPEN_TELEGRAM', 'BOOK_APPOINTMENT'].includes(capability)) resolved.partnerId = firstId(sources.partners);
  if (!resolved.expertId && capability === 'OPEN_EXPERT') resolved.expertId = firstId(sources.experts);
  if (!resolved.eventId && capability === 'OPEN_EVENT') resolved.eventId = firstId(sources.events);
  if (!resolved.newsId && capability === 'OPEN_NEWS') resolved.newsId = firstId(sources.news);
  if (!resolved.promotionId && capability === 'OPEN_PROMOTION') resolved.promotionId = firstId(sources.promotions) || firstId(sources.partners);
  return resolved;
}

function resolveQuestionParameters(question = '') {
  const lower = clean(question).toLowerCase();
  const resolved = {};
  const date = lower.match(/сегодня|завтра|\d{1,2}[./-]\d{1,2}|понедельник|вторник|среду|среда|четверг|пятниц\w*|суббот\w*|воскрес\w*/i)?.[0] || '';
  const service = lower.match(/массаж|стрижк\w*|маникюр|стоматолог\w*|консультац\w*|кофе|ужин|обед|тренировк\w*/i)?.[0] || '';
  if (date) resolved.date = date;
  if (service) resolved.serviceId = service;
  if (lower.includes('рядом')) resolved.location = 'рядом';
  return resolved;
}

function mergeResolved(...rows) {
  return rows.reduce((acc, row) => {
    Object.entries(row || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && clean(value)) acc[key] = value;
    });
    return acc;
  }, {});
}

function titleForParameter(parameter = '') {
  const labels = {
    partnerId: 'партнёра',
    serviceId: 'услугу',
    date: 'дату',
    time: 'время',
    bookingId: 'какую запись',
    dialogId: 'какой диалог',
    recipientId: 'получателя',
    messageText: 'текст сообщения',
    eventId: 'мероприятие',
    promotionId: 'акцию',
    expertId: 'эксперта',
    query: 'что искать',
  };
  return labels[parameter] || parameter;
}

export function buildClarificationQuestion(capability = '', missing = []) {
  const first = list(missing)[0];
  if (!first) return '';
  if (capability === 'BOOK_APPOINTMENT' && first === 'date') return 'На какую дату вас записать?';
  if (capability === 'BOOK_APPOINTMENT' && first === 'partnerId') return 'К какому партнёру вас записать?';
  if (capability === 'BOOK_APPOINTMENT' && first === 'serviceId') return 'На какую услугу вас записать?';
  if (capability === 'RESCHEDULE_BOOKING') return first === 'bookingId' ? 'Какую запись нужно перенести?' : 'На какую дату перенести запись?';
  if (capability === 'CANCEL_BOOKING') return 'Какую запись нужно отменить?';
  if (capability === 'OPEN_DIALOG') return 'Какой диалог открыть?';
  if (capability === 'SEND_MESSAGE') return first === 'recipientId' ? 'Кому отправить сообщение?' : 'Какой текст отправить?';
  return `Уточните ${titleForParameter(first)}.`;
}

export function resolveExecution(input = {}) {
  const capabilityContext = input.capabilityContext || {};
  const capabilityId = capabilityContext.capability || input.capability || '';
  const capability = getCapabilityById(capabilityId);
  const execution = getExecutionDefinition(capabilityId);
  if (!capability || !execution) {
    return {
      capability: capabilityId,
      capabilityFound: Boolean(capability),
      executionFound: Boolean(execution),
      resolvedParameters: {},
      missingParameters: capabilityContext.missing || [],
      executionOrder: [],
      ready: false,
      reason: capability ? 'execution_missing' : 'capability_missing',
      clarificationQuestion: '',
    };
  }
  const required = list(execution.requiredParameters.length ? execution.requiredParameters : capability.requiredParameters);
  const resolvedParameters = mergeResolved(
    resolveFromKnowledge(capabilityId, input.knowledge),
    resolveQuestionParameters(input.question),
    capabilityContext.resolved,
    input.parameters
  );
  if (required.includes('query') && !resolvedParameters.query) resolvedParameters.query = input.question || capabilityContext.question || '';
  const missingParameters = required.filter(name => !clean(resolvedParameters[name]));
  const sourceOrder = list(capabilityContext.executionOrder).length ? capabilityContext.executionOrder : [{ order: 1, capability: capabilityId }];
  const executionOrder = sourceOrder.map((row, index) => {
    const rowExecution = getExecutionDefinition(row.capability);
    const rowCapability = getCapabilityById(row.capability);
    const rowRequired = list(rowExecution?.requiredParameters?.length ? rowExecution.requiredParameters : rowCapability?.requiredParameters);
    const rowResolved = mergeResolved(resolveFromKnowledge(row.capability, input.knowledge), resolveQuestionParameters(input.question), row.resolvedParameters, capabilityContext.resolved);
    const rowMissing = rowRequired.filter(name => !clean(rowResolved[name]));
    return {
      order: row.order || index + 1,
      capability: row.capability,
      mode: rowExecution?.mode || '',
      plannerGoal: rowExecution?.plannerGoal || '',
      workflowId: rowExecution?.workflowId || '',
      navigation: rowExecution?.navigation || null,
      actionId: rowExecution?.actionId || '',
      actionType: rowExecution?.actionType || '',
      toolIds: list(rowExecution?.toolIds),
      requiredParameters: rowRequired,
      resolvedParameters: rowResolved,
      missingParameters: rowMissing,
      ready: Boolean(rowExecution) && !rowMissing.length,
    };
  });
  const ready = !missingParameters.length && executionOrder.every(row => row.ready);
  return {
    capability: capabilityId,
    title: capability.title || capabilityId,
    category: capability.category || '',
    capabilityFound: true,
    executionFound: true,
    execution,
    requiredParameters: required,
    resolvedParameters,
    missingParameters,
    executionOrder,
    ready,
    reason: ready ? 'ready' : 'missing_parameters',
    clarificationQuestion: ready ? '' : buildClarificationQuestion(capabilityId, missingParameters.length ? missingParameters : executionOrder.find(row => row.missingParameters.length)?.missingParameters),
  };
}

export class ExecutionResolver {
  resolve(input = {}) {
    return resolveExecution(input);
  }
}
