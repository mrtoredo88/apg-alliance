import { FirestoreAdminAdapter } from './data/FirestoreAdminAdapter.js';
import { ServerRepository } from './data/ServerRepository.js';
import { FirebaseAdminIdentityProvider } from './identity/providers/FirebaseAdminIdentityProvider.js';
import { NativeApgServerIdentityProvider } from './identity/providers/NativeApgServerIdentityProvider.js';
import { YandexServerIdentityProvider } from './identity/providers/YandexServerIdentityProvider.js';

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

export function createServerFoundation({ dataAdapter = new FirestoreAdminAdapter(), identityProvider = new FirebaseAdminIdentityProvider() } = {}) {
  return {
    identity: identityProvider,
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
      firebase: identityProvider,
      yandex: new YandexServerIdentityProvider(),
      nativeApg: new NativeApgServerIdentityProvider(),
    },
  };
}

export const serverFoundation = createServerFoundation();

export { ServerIdentityProvider } from './identity/ServerIdentityProvider.js';
export { FirebaseAdminIdentityProvider } from './identity/providers/FirebaseAdminIdentityProvider.js';
export { YandexServerIdentityProvider } from './identity/providers/YandexServerIdentityProvider.js';
export { NativeApgServerIdentityProvider } from './identity/providers/NativeApgServerIdentityProvider.js';
export { ServerDataAdapter } from './data/ServerDataAdapter.js';
export { FirestoreAdminAdapter } from './data/FirestoreAdminAdapter.js';
export { ServerRepository } from './data/ServerRepository.js';
