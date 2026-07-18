import { resolveLokiMemoryContext } from './MemoryResolver.js';

export function runLokiMemoryEngine({
  question = '',
  intent = {},
  context = {},
} = {}) {
  return resolveLokiMemoryContext({ question, intent, context });
}
