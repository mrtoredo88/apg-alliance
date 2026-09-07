import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeConfig(config = {}) {
  const rawConnectionString = config.connectionString
    || process.env.APG_IDENTITY_DATABASE_URL
    || process.env.IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
  if (!rawConnectionString) return { connectionString: '' };
  try {
    const url = new URL(rawConnectionString);
    url.searchParams.delete('sslmode');
    return { connectionString: url.toString() };
  } catch {
    return { connectionString: rawConnectionString.replace(/[?&]sslmode=[^&]+/, '') };
  }
}

export class PostgresIdentityAdapter {
  constructor(config = {}) {
    this.name = 'postgres-identity';
    this.config = normalizeConfig(config);
    this.pool = null;
    this.schemaReady = false;
    this.schemaPromise = null;
  }

  get available() {
    return Boolean(this.config.connectionString);
  }

  get client() {
    if (!this.available) throw Object.assign(new Error('APG Identity PostgreSQL is not configured.'), { code: 'IDENTITY_POSTGRES_NOT_CONFIGURED' });
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        // Odyssey limits this database user to 8 clients. A serverless rollout
        // can briefly keep several warm revisions alive, and the document and
        // identity repositories each own an adapter. One connection per
        // adapter leaves enough headroom for overlapping revisions.
        max: Math.max(1, Number(process.env.APG_IDENTITY_POOL_SIZE || 1)),
        idleTimeoutMillis: 8_000,
        connectionTimeoutMillis: 10_000,
        ssl: process.env.APG_IDENTITY_PG_SSL === '0' ? false : { rejectUnauthorized: false },
      });
      this.pool.on('error', error => {
        this.lastPoolError = {
          code: error?.code || '',
          message: String(error?.message || error).slice(0, 220),
          at: new Date().toISOString(),
        };
      });
    }
    return this.pool;
  }

  async ensureSchema() {
    if (this.schemaReady || !this.available) return { ok: this.available, skipped: !this.available };
    if (!this.schemaPromise) {
      this.schemaPromise = (async () => {
        const schemaPath = path.resolve(__dirname, '../../identity/schema/identity-v2.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await this.runSchemaMigration('apg:identity-v2-schema', sql);
        this.schemaReady = true;
        return { ok: true };
      })().catch(error => {
        this.schemaPromise = null;
        throw error;
      });
    }
    return this.schemaPromise;
  }

  async runSchemaMigration(lockName, sql) {
    const client = await this.client.connect();
    let locked = false;
    try {
      // Several serverless instances may cold-start at the same time. PostgreSQL
      // DDL can otherwise deadlock while each instance runs the same idempotent
      // schema file. A session advisory lock serializes schema initialization
      // across processes without affecting ordinary application queries.
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [String(lockName)]);
      locked = true;
      await client.query(sql);
    } finally {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [String(lockName)]).catch(() => {});
      }
      client.release();
    }
  }

  async query(sql, params = []) {
    await this.ensureSchema();
    return this.client.query(sql, params);
  }

  async transaction(fn) {
    await this.ensureSchema();
    const client = await this.client.connect();
    const onClientError = error => {
      this.lastPoolError = {
        code: error?.code || '',
        message: String(error?.message || error).slice(0, 220),
        at: new Date().toISOString(),
      };
    };
    client.on('error', onClientError);
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.removeListener('error', onClientError);
      client.release();
    }
  }

  async dispose() {
    if (this.pool) await this.pool.end();
    this.pool = null;
    this.schemaReady = false;
    this.schemaPromise = null;
  }
}
