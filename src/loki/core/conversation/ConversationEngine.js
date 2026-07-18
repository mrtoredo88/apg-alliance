import { nowMs } from '../tools/ToolResult.js';
import { resolveConversation } from './ConversationResolver.js';

export function runLokiConversationEngine({
  question = '',
  intent = {},
  reasoningResult = null,
  context = {},
} = {}) {
  const started = nowMs();
  const conversationContext = resolveConversation({ question, intent, reasoningResult, context });
  return {
    conversationContext: {
      ...conversationContext,
      durationMs: Math.round(nowMs() - started),
    },
    effectiveQuestion: conversationContext.effectiveQuestion || question,
    effectiveIntent: conversationContext.effectiveIntent || intent,
    needsClarification: conversationContext.validation && conversationContext.validation.ok === false,
    clarificationText: conversationContext.validation?.text || '',
  };
}
