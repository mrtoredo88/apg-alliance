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
  }

  get available() {
    return Boolean(this.config.connectionString);
  }

  get client() {
    if (!this.available) throw Object.assign(new Error('APG Identity PostgreSQL is not configured.'), { code: 'IDENTITY_POSTGRES_NOT_CONFIGURED' });
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: Number(process.env.APG_IDENTITY_POOL_SIZE || 4),
        idleTimeoutMillis: 20_000,
        connectionTimeoutMillis: 4_000,
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
    const schemaPath = path.resolve(__dirname, '../../identity/schema/identity-v2.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await this.client.query(sql);
    this.schemaReady = true;
    return { ok: true };
  }

  async query(sql, params = []) {
    await this.ensureSchema();
    return this.client.query(sql, params);
  }

  async transaction(fn) {
    await this.ensureSchema();
    const client = await this.client.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async dispose() {
    if (this.pool) await this.pool.end();
    this.pool = null;
    this.schemaReady = false;
  }
}
