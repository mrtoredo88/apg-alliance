import { getFoundationFlag } from '../core/FeatureFlags.js';
import { FirestoreAdapter, MemoryAdapter, PostgresAdapter, YdbAdapter } from '../infrastructure/adapters/index.js';
import { createRepository } from './Repository.js';

export const APG_REPOSITORY_DEFINITIONS = {
  UserRepository: 'users',
  PartnerRepository: 'partners',
  ExpertRepository: 'experts',
  EventRepository: 'events',
  NewsRepository: 'news',
  PromotionRepository: 'promotions',
  BookingRepository: 'bookings',
  MeetingRepository: 'bookings',
  DialogRepository: 'contextDialogs',
  MessageRepository: 'messages',
  RewardRepository: 'prizes',
  KeyRepository: 'users',
  ReferralRepository: 'referralEvents',
  WorkspaceRepository: 'users',
  NotificationRepository: 'notifications',
  ConfigRepository: 'config',
  AnalyticsRepository: 'diagnostics',
};

export function createDataAdapter(name = getFoundationFlag('DATA_PROVIDER')) {
  if (name === 'postgres-api') return new FirestoreAdapter();
  if (name === 'postgres') return new PostgresAdapter();
  if (name === 'ydb') return new YdbAdapter();
  if (name === 'memory') return new MemoryAdapter();
  return new FirestoreAdapter();
}

export class ApgDataLayer {
  constructor({ adapter = createDataAdapter(), definitions = APG_REPOSITORY_DEFINITIONS } = {}) {
    this.adapter = adapter;
    this.repositories = Object.fromEntries(
      Object.entries(definitions).map(([name, collectionName]) => [name, createRepository(name, collectionName, adapter)]),
    );
  }

  repository(name) {
    if (!this.repositories[name]) throw new Error(`repository_not_registered:${name}`);
    return this.repositories[name];
  }

  listRepositories() {
    return Object.keys(this.repositories);
  }
}

export const apgData = new ApgDataLayer();
