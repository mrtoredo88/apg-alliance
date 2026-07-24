import { getFoundationFlag } from '../core/FeatureFlags.js';
import { ApgIdentityLayer } from './ApgIdentityLayer.js';
import { NativeApgProvider } from './providers/NativeApgProvider.js';
import { YandexIdentityProvider } from './providers/YandexIdentityProvider.js';

export { ApgIdentityLayer } from './ApgIdentityLayer.js';
export { IdentityProvider } from './IdentityProvider.js';
export { YandexIdentityProvider } from './providers/YandexIdentityProvider.js';
export { NativeApgProvider } from './providers/NativeApgProvider.js';

export function createIdentityProvider(name = getFoundationFlag('IDENTITY_PROVIDER')) {
  if (name === 'yandex') return new YandexIdentityProvider();
  if (name === 'native-apg') return new NativeApgProvider();
  return new NativeApgProvider();
}

export const apgIdentity = new ApgIdentityLayer({
  provider: createIdentityProvider(),
  fallbackProviders: {
    yandex: new YandexIdentityProvider(),
    nativeApg: new NativeApgProvider(),
  },
});
