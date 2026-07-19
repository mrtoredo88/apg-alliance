import { createHomeHydrationState, startHomeHydration } from './HomeHydrationScheduler.js';
import { HOME_HYDRATION_STAGE_ORDER, HOME_HYDRATION_STAGES } from './HomeHydrationTask.js';

export class HomeHydrationEngine {
  constructor(options = {}) {
    this.options = options;
    this.scheduler = null;
  }

  start() {
    this.scheduler = startHomeHydration(this.options);
    return this.scheduler;
  }

  stop() {
    this.scheduler?.cancel();
  }

  snapshot() {
    return this.scheduler?.snapshot() || null;
  }
}

export function createInitialHomeHydrationState() {
  return createHomeHydrationState([]);
}

export function isHomeHydrationReady(state, stage) {
  return Boolean(state?.[stage]);
}

export { HOME_HYDRATION_STAGE_ORDER, HOME_HYDRATION_STAGES };
