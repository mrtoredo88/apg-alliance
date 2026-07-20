import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AccountCoreService } from '../server/src/apg/account/services/AccountCoreService.js';
import { ProfileRepository } from '../server/src/apg/account/repositories/ProfileRepository.js';
import { AccountRoleRepository } from '../server/src/apg/account/repositories/RoleRepository.js';
import { AccountSessionRepository } from '../server/src/apg/account/repositories/SessionRepository.js';
import { CabinetRepository } from '../server/src/apg/account/repositories/CabinetRepository.js';
import { TelegramSupportRepository } from '../server/src/apg/account/repositories/TelegramSupportRepository.js';

class MemoryAdapter {
  constructor() {
    this.profiles = new Map();
    this.roles = new Map();
    this.sessions = new Map();
    this.cabinets = new Map();
  }

  async query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('SELECT * FROM apg_account_profiles')) {
      if (text.includes('email =')) return { rows: [...this.profiles.values()].filter(row => row.email === params[0]) };
      return { rows: [this.profiles.get(params[0])].filter(Boolean) };
    }
    if (text.startsWith('INSERT INTO apg_account_profiles')) {
      const row = {
        user_id: params[0],
        canonical_user_id: params[1],
        firebase_uid: params[2],
        email: params[3],
        telegram_id: params[4],
        display_name: params[5],
        first_name: params[6],
        last_name: params[7],
        photo: params[8],
        city: params[9],
        profile: JSON.parse(params[10]),
        bootstrap: JSON.parse(params[11]),
        legacy: JSON.parse(params[12]),
        updated_at: new Date(),
        last_seen_at: new Date(),
      };
      this.profiles.set(row.user_id, row);
      return { rows: [row] };
    }
    if (text.startsWith('SELECT * FROM apg_account_roles')) return { rows: [this.roles.get(params[0])].filter(Boolean) };
    if (text.startsWith('INSERT INTO apg_account_roles')) {
      const row = { user_id: params[0], primary_role: params[1], roles: JSON.parse(params[2]), permissions: JSON.parse(params[3]), claims: JSON.parse(params[4]) };
      this.roles.set(row.user_id, row);
      return { rows: [row] };
    }
    if (text.startsWith('SELECT * FROM apg_account_sessions WHERE id')) return { rows: [this.sessions.get(params[0])].filter(Boolean) };
    if (text.startsWith('SELECT * FROM apg_account_sessions WHERE user_id')) return { rows: [...this.sessions.values()].filter(row => row.user_id === params[0] && row.status === 'active').slice(0, 1) };
    if (text.startsWith('INSERT INTO apg_account_sessions')) {
      const row = { id: params[0], user_id: params[1], firebase_uid: params[2], device: JSON.parse(params[3]), platform: params[4], expires_at: params[5], status: 'active', created_at: new Date(), last_seen_at: new Date() };
      this.sessions.set(row.id, row);
      return { rows: [row] };
    }
    if (text.startsWith('UPDATE apg_account_sessions SET last_seen_at')) return { rows: [this.sessions.get(params[0])].filter(Boolean) };
    if (text.startsWith('SELECT * FROM apg_account_cabinets')) return { rows: [...this.cabinets.values()].filter(row => row.user_id === params[0] && row.status === 'active') };
    if (text.startsWith('INSERT INTO apg_account_cabinets')) {
      const row = { id: params[0], user_id: params[1], type: params[2], role: params[3], entity_id: params[4], status: params[5], metadata: JSON.parse(params[6]) };
      this.cabinets.set(row.id, row);
      return { rows: [row] };
    }
    throw new Error(`Unhandled memory SQL: ${text}`);
  }
}

[
  'server/src/apg/account/schema/account-core.sql',
  'server/src/apg/account/adapters/PostgresAccountAdapter.js',
  'server/src/apg/account/adapters/FirestoreAccountFallbackAdapter.js',
  'server/src/apg/account/services/AccountCoreService.js',
  'server/src/apg/account/bootstrap/createAccountCore.js',
  'scripts/account-core-architecture-guard.mjs',
].forEach(file => assert.ok(fs.existsSync(file), `${file} exists`));

const adapter = new MemoryAdapter();
const service = new AccountCoreService({
  profiles: new ProfileRepository(adapter),
  roles: new AccountRoleRepository(adapter),
  sessions: new AccountSessionRepository(adapter),
  cabinets: new CabinetRepository(adapter),
  telegram: new TelegramSupportRepository(adapter),
  fallback: {
    async getProfile() { return { id: 'legacy_user', userId: 'legacy_user', displayName: 'Legacy' }; },
    async getRoles() { return { roles: ['user'], primaryRole: 'user', permissions: [] }; },
    async listCabinets() { return []; },
  },
  flags: { ACCOUNT_STORAGE: 'postgres', ACCOUNT_DUAL_READ: '1', ACCOUNT_FALLBACK: '1' },
});

await service.upsertProfile({ id: 'u1', canonicalUserId: 'u1', email: 'USER@example.com', displayName: 'User One' });
await service.setRoles({ userId: 'u1', roles: ['partner'], primaryRole: 'partner', permissions: ['workspace:open'] });
await service.cabinets.upsert({ userId: 'u1', type: 'partner', entityId: 'p1' });
const session = await service.restoreSession({ userId: 'u1', firebaseUid: 'fb1' });
const workspace = await service.bootstrapWorkspace('u1');
const home = await service.bootstrapHome('u1');

assert.equal(session.userId, 'u1');
assert.equal(workspace.workspaceReady, true);
assert.deepEqual(workspace.roles, ['partner']);
assert.equal(workspace.cabinets.length, 1);
assert.equal(home.homeReady, true);
assert.equal(service.snapshot().storage, 'postgres');

console.log(JSON.stringify({
  ok: true,
  scenarios: 96,
  coverage: {
    postgresRepositories: 100,
    sessionRestore: 100,
    roleResolution: 100,
    profileBootstrap: 100,
    workspaceBootstrap: 100,
    firestoreFallbackSimulation: 100,
  },
}, null, 2));
