import { FirestoreAccountFallbackAdapter } from '../adapters/FirestoreAccountFallbackAdapter.js';
import { PostgresAccountAdapter } from '../adapters/PostgresAccountAdapter.js';
import {
  AccountRoleRepository,
  AccountSessionRepository,
  CabinetRepository,
  ProfileRepository,
  TelegramSupportRepository,
} from '../repositories/index.js';
import { AccountCoreService } from '../services/AccountCoreService.js';

export function createAccountCore({
  postgresAdapter = new PostgresAccountAdapter(),
  fallback = new FirestoreAccountFallbackAdapter(),
  flags = {},
} = {}) {
  const profiles = new ProfileRepository(postgresAdapter);
  const roles = new AccountRoleRepository(postgresAdapter);
  const sessions = new AccountSessionRepository(postgresAdapter);
  const cabinets = new CabinetRepository(postgresAdapter);
  const telegram = new TelegramSupportRepository(postgresAdapter);
  return new AccountCoreService({ profiles, roles, sessions, cabinets, telegram, fallback, flags });
}
