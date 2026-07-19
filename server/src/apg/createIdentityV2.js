import { getDb } from '../lib/firebase.js';
import { FirestoreIdentityFallbackAdapter } from './infrastructure/adapters/FirestoreIdentityFallbackAdapter.js';
import { PostgresIdentityAdapter } from './infrastructure/adapters/PostgresIdentityAdapter.js';
import { FirebaseAdminIdentityProvider } from './identity/providers/FirebaseAdminIdentityProvider.js';
import { ApgIdentityV2Service } from './identity/ApgIdentityV2Service.js';
import {
  EmailIndexRepository,
  IdentityLinkRepository,
  IdentityRepository,
  RoleRepository,
  SessionRepository,
  UserRepository,
} from './identity/repositories/index.js';

export function createIdentityV2({
  postgresAdapter = new PostgresIdentityAdapter(),
  legacySource = new FirestoreIdentityFallbackAdapter(getDb),
  tokenProvider = new FirebaseAdminIdentityProvider(),
  flags = {},
} = {}) {
  const users = new UserRepository(postgresAdapter);
  const emails = new EmailIndexRepository(postgresAdapter);
  const links = new IdentityLinkRepository(postgresAdapter);
  const roles = new RoleRepository(postgresAdapter);
  const sessions = new SessionRepository(postgresAdapter);
  const repository = new IdentityRepository({ users, emails, links, roles, sessions });
  return new ApgIdentityV2Service({ repository, sessionRepository: sessions, legacySource, tokenProvider, flags });
}
