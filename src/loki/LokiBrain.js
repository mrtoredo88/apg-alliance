import { askLokiCore } from './core/LokiCore.js';

export async function askLokiBrain(args) {
  return askLokiCore(args);
}

export { buildLokiBrainContext } from './core/LokiCore.js';
