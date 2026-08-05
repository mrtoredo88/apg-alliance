import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SessionRepository } from '../server/src/apg/identity/repositories/SessionRepository.js';

class MemoryAdapter {
  constructor() {
    this.rows = [];
  }

  async query(sql, params) {
    if (sql.includes('INSERT INTO apg_identity_sessions')) {
      this.rows.push({ id: params[0], userId: params[1], tokenHash: params[2], expiresAt: params[5] });
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
}

const repository = new SessionRepository(new MemoryAdapter());
const session = await repository.createBearerSession({
  userId: 'email:rustore-1.3@example.com',
  claims: { role: 'user', roles: ['user'] },
  ttlDays: 30,
});

const parts = session.token.split('.');
assert.equal(parts.length, 3, 'RuStore 1.3 can decode the stateful bearer envelope');
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
assert.equal(payload.uid, 'email:rustore-1.3@example.com');
assert.equal(payload.role, 'user');
assert.ok(payload.exp * 1000 > Date.now() + 29 * 86_400_000);
assert.notEqual(repository.adapter.rows[0].tokenHash, session.token, 'only the token hash is persisted');

const routes = readFileSync(new URL('../server/src/routes/auth-session.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/src/server.js', import.meta.url), 'utf8');
const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const account = readFileSync(new URL('../server/src/routes/account.js', import.meta.url), 'utf8');
assert.match(routes, /\/api\/session\/refresh/, 'legacy RuStore refresh route remains available');
assert.match(routes, /\/api\/session\/me/, 'legacy RuStore session verification route remains available');
assert.match(routes, /\/api\/session\/anonymous/, 'legacy first-launch session route remains available');
assert.match(server, /allowedHeaders:[^\n]*'X-Firebase-Auth'/, 'CORS permits the RuStore 1.3 legacy auth header');
assert.match(userActions, /req\.headers\['x-apg-auth'\] \|\| req\.headers\['x-firebase-auth'\]/, 'user actions accept the RuStore 1.3 legacy auth header');
assert.match(account, /request\.headers\['x-apg-auth'\] \|\| request\.headers\['x-firebase-auth'\]/, 'account bootstrap accepts the RuStore 1.3 legacy auth header');

console.log('RUSTORE_AUTH_COMPATIBILITY_OK');
