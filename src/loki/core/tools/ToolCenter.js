import { executeLokiTool } from './ToolExecutor.js';
import { resolveLokiTool } from './ToolResolver.js';

export function runLokiToolLayer({
  question = '',
  intent = {},
  reasoningResult = null,
  journeyResult = null,
  knowledge = {},
  context = {},
  appState = {},
} = {}) {
  const call = resolveLokiTool({ question, intent, reasoningResult, journeyResult, context });
  if (!call) return null;
  return executeLokiTool(call, { knowledge, context, appState });
}
