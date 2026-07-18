import { normalizeText } from '../lokiCoreUtils.js';

const YES = ['да', 'ок', 'ага', 'подтверждаю', 'продолжай', 'продолжить', 'хорошо', 'go', 'yes'];
const NO = ['нет', 'не надо', 'отмена', 'отмени', 'стоп', 'cancel', 'не продолжай'];

export function detectAgentConfirmation(text = '') {
  const query = normalizeText(text);
  const tokens = new Set(query.split(/\s+/).filter(Boolean));
  if (!query) return { type: 'none', confidence: 0 };
  if (NO.some(item => query === item || query.startsWith(`${item} `) || query.endsWith(` ${item}`))) return { type: 'cancel', confidence: 0.9 };
  if (YES.some(item => query === item || tokens.has(item))) return { type: 'confirm', confidence: 0.86 };
  return { type: 'none', confidence: 0 };
}

export function buildConfirmationText(agentContext = {}) {
  const actionTitle = agentContext.decision?.pendingAction?.label || agentContext.session?.pendingConfirmation?.label || 'продолжить действие';
  const workflowTitle = agentContext.workflowContext?.title || agentContext.session?.currentWorkflow?.title || 'сценарий';
  return `Чтобы продолжить «${workflowTitle}», подтвердите действие: ${actionTitle}.`;
}
