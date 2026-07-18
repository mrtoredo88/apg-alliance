import { buildMemorySnapshot } from './MemorySnapshot.js';

export function resolveLokiMemoryContext({ question = '', intent = {}, context = {} } = {}) {
  const store = context?.userMemory?.lokiMemory || context?.memory?.lokiMemory || {};
  const snapshot = buildMemorySnapshot({ memory: store, query: question, intent });
  const nextContext = {
    ...context,
    memory: {
      ...(context?.memory || {}),
      memorySnapshot: snapshot,
    },
    userMemory: {
      ...(context?.userMemory || {}),
      memorySnapshot: snapshot,
    },
  };
  return {
    context: nextContext,
    memoryContext: {
      version: 'v1',
      source: snapshot.source,
      used: snapshot.used,
      skipped: snapshot.skipped,
      events: snapshot.events,
      empty: snapshot.empty,
    },
  };
}
