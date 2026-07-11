const BLOCKED_EVENTS = new Set(['auth_error', 'data_loss', 'delete', 'financial', 'critical_error', 'security_issue']);
const CRITICAL_PATTERNS = /авторизац|authentication|потер(?:я|яны) данн|удален|списан|оплат|финанс|критическ|security|безопасност|fatal|утечк|компрометац/i;

export function isPersonalityUnsafe({ event, critical, text, context } = {}) {
  if (critical || BLOCKED_EVENTS.has(event)) return true;
  if (context?.severity === 'critical' || context?.securityIssue || context?.dataLoss || context?.financialOperation || context?.destructiveAction) return true;
  return CRITICAL_PATTERNS.test(String(text || ''));
}

export { BLOCKED_EVENTS as PERSONALITY_BLOCKED_EVENTS };
