import { getCapabilityById } from './CapabilityRegistry.js';
import { matchCapabilities, splitCapabilityClauses } from './CapabilityMatcher.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function firstId(items = []) {
  return list(items)[0]?.id || null;
}

function resolveParameters(capability = {}, { question = '', knowledge = {}, context = {} } = {}) {
  const screenItem = knowledge?.screenContext?.item || null;
  const resolved = {};
  const lower = String(question || '').toLowerCase();
  if (screenItem?.type === 'partner') resolved.partnerId = screenItem.id;
  if (screenItem?.type === 'expert') resolved.expertId = screenItem.id;
  if (screenItem?.type === 'event') resolved.eventId = screenItem.id;
  if (screenItem?.type === 'news') resolved.newsId = screenItem.id;
  if (!resolved.partnerId && ['partnerId', 'promotionId'].some(key => list(capability.requiredParameters).includes(key))) resolved.partnerId = firstId(knowledge?.sources?.partners);
  if (!resolved.expertId && list(capability.requiredParameters).includes('expertId')) resolved.expertId = firstId(knowledge?.sources?.experts);
  if (!resolved.eventId && list(capability.requiredParameters).includes('eventId')) resolved.eventId = firstId(knowledge?.sources?.events);
  if (!resolved.newsId && list(capability.requiredParameters).includes('newsId')) resolved.newsId = firstId(knowledge?.sources?.news);
  if (list(capability.requiredParameters).includes('query')) resolved.query = question;
  if (/(сегодня|завтра|\d{1,2}[./-]\d{1,2}|понедельник|вторник|среду|среда|четверг|пятниц|суббот|воскрес)/i.test(lower)) resolved.date = lower.match(/сегодня|завтра|\d{1,2}[./-]\d{1,2}|понедельник|вторник|среду|среда|четверг|пятниц\w*|суббот\w*|воскрес\w*/i)?.[0] || '';
  if (/(массаж|стрижк|маникюр|стоматолог|консультац|кофе|ужин|обед|тренировк)/i.test(lower)) resolved.serviceId = lower.match(/массаж|стрижк\w*|маникюр|стоматолог\w*|консультац\w*|кофе|ужин|обед|тренировк\w*/i)?.[0] || '';
  if (context?.actor?.role) resolved.role = context.actor.role;
  const required = list(capability.requiredParameters);
  const missing = required.filter(name => !resolved[name]);
  return { required, resolved, missing };
}

function confidenceFrom(score = 0, missing = [], capability = {}) {
  const value = Math.max(0, Math.min(99, 38 + score + Number(capability.priority || 0) * 0.08 - missing.length * 10));
  return Math.round(value);
}

function orderedCapabilities({ question = '', intent = {}, conversation = null, context = {}, memory = {}, knowledge = {} } = {}) {
  const clauses = splitCapabilityClauses(question);
  if (clauses.length < 2) return [];
  const rows = clauses.map(clause => matchCapabilities({ question: clause, intent, conversation, context, memory })[0]).filter(Boolean);
  const seen = new Set();
  return rows
    .filter(row => {
      if (seen.has(row.capability.id)) return false;
      seen.add(row.capability.id);
      return true;
    })
    .map((row, index) => {
      const params = resolveParameters(row.capability, { question, knowledge, context });
      return {
        order: index + 1,
        capability: row.capability.id,
        title: row.capability.title,
        confidence: confidenceFrom(row.score, params.missing, row.capability),
        requiredParameters: params.required,
        resolvedParameters: params.resolved,
        missingParameters: params.missing,
      };
    });
}

export function resolveCapability(input = {}) {
  const matches = matchCapabilities(input);
  const best = matches[0] || null;
  const fallback = getCapabilityById(input.intent?.id === 'profile.question' ? 'OPEN_PROFILE' : '');
  const capability = best?.capability || fallback;
  if (!capability) {
    return {
      bestCapability: null,
      capability: '',
      confidence: 0,
      alternatives: [],
      requiredParameters: [],
      resolvedParameters: {},
      missingParameters: [],
      executionOrder: [],
      matchedAliases: [],
    };
  }
  const params = resolveParameters(capability, input);
  const executionOrder = orderedCapabilities(input);
  const alternatives = matches
    .filter(item => item.capability.id !== capability.id)
    .slice(0, 4)
    .map(item => ({ id: item.capability.id, title: item.capability.title, confidence: confidenceFrom(item.score, resolveParameters(item.capability, input).missing, item.capability) }));
  const primaryOrder = executionOrder.length ? executionOrder : [{
    order: 1,
    capability: capability.id,
    title: capability.title,
    confidence: confidenceFrom(best?.score || 0, params.missing, capability),
    requiredParameters: params.required,
    resolvedParameters: params.resolved,
    missingParameters: params.missing,
  }];
  return {
    bestCapability: capability,
    capability: capability.id,
    confidence: confidenceFrom(best?.score || 0, params.missing, capability),
    alternatives,
    requiredParameters: params.required,
    resolvedParameters: params.resolved,
    missingParameters: params.missing,
    executionOrder: primaryOrder,
    matchedAliases: best?.matchedAliases || [],
  };
}

export class CapabilityResolver {
  resolve(input = {}) {
    return resolveCapability(input);
  }
}
