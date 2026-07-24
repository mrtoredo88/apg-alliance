import { FirestoreAdminAdapter } from './data/FirestoreAdminAdapter.js';
import { ServerRepository } from './data/ServerRepository.js';
import { createIdentityV2 } from './createIdentityV2.js';
import { NativeApgServerIdentityProvider } from './identity/providers/NativeApgServerIdentityProvider.js';
import { YandexServerIdentityProvider } from './identity/providers/YandexServerIdentityProvider.js';
import { createAccountCore } from './account/index.js';

export const SERVER_REPOSITORY_DEFINITIONS = {
  UserRepository: 'users',
  PartnerRepository: 'partners',
  ExpertRepository: 'experts',
  EventRepository: 'events',
  NewsRepository: 'news',
  BookingRepository: 'bookings',
  DialogRepository: 'contextDialogs',
  MessageRepository: 'messages',
  RewardRepository: 'prizes',
  ReferralRepository: 'referralEvents',
  NotificationRepository: 'notifications',
  ConfigRepository: 'config',
  AnalyticsRepository: 'diagnostics',
};

export function createServerFoundation({ dataAdapter = new FirestoreAdminAdapter(), identityProvider = new NativeApgServerIdentityProvider() } = {}) {
  const identityV2 = createIdentityV2({ tokenProvider: identityProvider });
  const account = createAccountCore();
  return {
    identity: identityProvider,
    identityV2,
    account,
    data: {
      adapter: dataAdapter,
      repositories: Object.fromEntries(
        Object.entries(SERVER_REPOSITORY_DEFINITIONS).map(([name, collectionName]) => [
          name,
          new ServerRepository({ name, collectionName, adapter: dataAdapter }),
        ]),
      ),
    },
    providers: {
      yandex: new YandexServerIdentityProvider(),
      nativeApg: new NativeApgServerIdentityProvider(),
    },
  };
}

export const serverFoundation = createServerFoundation();

export { ServerIdentityProvider } from './identity/ServerIdentityProvider.js';
export { YandexServerIdentityProvider } from './identity/providers/YandexServerIdentityProvider.js';
export { NativeApgServerIdentityProvider } from './identity/providers/NativeApgServerIdentityProvider.js';
export { ApgIdentityV2Service } from './identity/ApgIdentityV2Service.js';
export { createIdentityV2 } from './createIdentityV2.js';
export * from './identity/repositories/index.js';
export { ServerDataAdapter } from './data/ServerDataAdapter.js';
export { FirestoreAdminAdapter } from './data/FirestoreAdminAdapter.js';
export { ServerRepository } from './data/ServerRepository.js';
export { PostgresIdentityAdapter } from './infrastructure/adapters/PostgresIdentityAdapter.js';
export * from './account/index.js';
