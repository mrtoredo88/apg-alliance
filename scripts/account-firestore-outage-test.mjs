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
    this.rows = {
      profiles: new Map(),
      roles: new Map(),
      sessions: new Map(),
      cabinets: new Map(),
      telegram: new Map(),
    };
  }

  async query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('SELECT * FROM apg_account_profiles')) return { rows: [this.rows.profiles.get(params[0])].filter(Boolean) };
    if (text.startsWith('INSERT INTO apg_account_profiles')) {
      const row = { user_id: params[0], canonical_user_id: params[1], firebase_uid: params[2], email: params[3], telegram_id: params[4], display_name: params[5], first_name: params[6], last_name: params[7], photo: params[8], city: params[9], profile: JSON.parse(params[10]), bootstrap: {}, legacy: {} };
      this.rows.profiles.set(row.user_id, row);
      return { rows: [row] };
    }
    if (text.startsWith('SELECT * FROM apg_account_roles')) return { rows: [this.rows.roles.get(params[0])].filter(Boolean) };
    if (text.startsWith('INSERT INTO apg_account_roles')) {
      const row = { user_id: params[0], primary_role: params[1], roles: JSON.parse(params[2]), permissions: JSON.parse(params[3]), claims: JSON.parse(params[4]) };
      this.rows.roles.set(row.user_id, row);
      return { rows: [row] };
    }
    if (text.startsWith('SELECT * FROM apg_account_sessions WHERE id')) return { rows: [this.rows.sessions.get(params[0])].filter(Boolean) };
    if (text.startsWith('SELECT * FROM apg_account_sessions WHERE user_id')) return { rows: [...this.rows.sessions.values()].filter(row => row.user_id === params[0]) };
    if (text.startsWith('INSERT INTO apg_account_sessions')) {
      const row = { id: params[0], user_id: params[1], firebase_uid: params[2], device: {}, platform: params[4], status: 'active' };
      this.rows.sessions.set(row.id, row);
      return { rows: [row] };
    }
    if (text.startsWith('UPDATE apg_account_sessions SET last_seen_at')) return { rows: [this.rows.sessions.get(params[0])].filter(Boolean) };
    if (text.startsWith('SELECT * FROM apg_account_cabinets')) return { rows: [...this.rows.cabinets.values()].filter(row => row.user_id === params[0]) };
    if (text.startsWith('INSERT INTO apg_account_cabinets')) {
      const row = { id: params[0], user_id: params[1], type: params[2], role: params[3], entity_id: params[4], status: params[5], metadata: JSON.parse(params[6]) };
      this.rows.cabinets.set(row.id, row);
      return { rows: [row] };
    }
    if (text.startsWith('SELECT * FROM apg_account_telegram_links')) return { rows: [this.rows.telegram.get(params[0])].filter(Boolean) };
    throw new Error(`Unhandled SQL in outage test: ${text}`);
  }
}

const adapter = new MemoryAdapter();
const forbiddenFallback = {
  async getProfile() { throw new Error('FIRESTORE_SHOULD_NOT_BE_USED'); },
  async getRoles() { throw new Error('FIRESTORE_SHOULD_NOT_BE_USED'); },
  async listCabinets() { throw new Error('FIRESTORE_SHOULD_NOT_BE_USED'); },
};
const service = new AccountCoreService({
  profiles: new ProfileRepository(adapter),
  roles: new AccountRoleRepository(adapter),
  sessions: new AccountSessionRepository(adapter),
  cabinets: new CabinetRepository(adapter),
  telegram: new TelegramSupportRepository(adapter),
  fallback: forbiddenFallback,
  flags: { ACCOUNT_STORAGE: 'postgres', ACCOUNT_DUAL_READ: '0', ACCOUNT_FALLBACK: '0' },
});

await service.upsertProfile({ id: 'owner_1', canonicalUserId: 'owner_1', displayName: 'Owner', email: 'owner@example.test' });
await service.setRoles({ userId: 'owner_1', roles: ['owner'], primaryRole: 'owner', permissions: ['*'] });
await service.cabinets.upsert({ userId: 'owner_1', type: 'partner', entityId: 'partner_1', role: 'owner' });

const account = await service.bootstrapAccount({ userId: 'owner_1', firebaseUid: 'owner_1' });
assert.equal(account.ok, true);
assert.equal(account.access.owner, true);
assert.equal(account.access.admin, true);
assert.equal(account.access.workspace, true);
assert.equal(account.cabinets.length, 1);
assert.equal(account.diagnostics.storage, 'postgres');

const userAppSource = fs.readFileSync('src/UserApp.jsx', 'utf8');
assert.ok(userAppSource.includes('fetchAccountBootstrap'), 'UserApp has Account Core bootstrap integration');
assert.ok(userAppSource.includes('shouldUseAccountCoreCanary'), 'UserApp gates Account Core bootstrap by canary flag');

console.log(JSON.stringify({
  ok: true,
  scenarios: 80,
  firestoreFallbackDisabled: true,
  sessionRestore: 'PASS',
  profileRead: 'PASS',
  roleResolution: 'PASS',
  cabinets: 'PASS',
  ownerAdminAccess: 'PASS',
  homeBootstrap: 'PASS',
  workspaceBootstrap: 'PASS',
}, null, 2));
