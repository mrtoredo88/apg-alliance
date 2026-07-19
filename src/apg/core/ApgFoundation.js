import { DependencyContainer } from './DependencyContainer.js';
import { getFoundationFlags } from './FeatureFlags.js';
import { apgData } from '../data/ApgDataLayer.js';
import { apgIdentity } from '../identity/index.js';

export function createApgFoundation() {
  const container = new DependencyContainer();
  container.register('identity', apgIdentity);
  container.register('data', apgData);
  container.register('flags', getFoundationFlags());
  return {
    container,
    identity: apgIdentity,
    data: apgData,
    flags: getFoundationFlags(),
  };
}

export const apgFoundation = createApgFoundation();
