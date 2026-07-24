import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { applyDocumentPatch, reviveDocumentValue } from './documentValues.js';

function connectionString() {
  return process.env.APG_DATA_DATABASE_URL
    || process.env.APG_IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
}

function normalizePath(parts) {
  return parts.flatMap(part => String(part || '').split('/')).filter(Boolean).join('/');
}

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function fieldValue(data, field) {
  return String(field).split('.').reduce((value, key) => value?.[key], data);
}

function compare(left, operator, right) {
  const a = left?.toMillis ? left.toMillis() : left;
  const b = right?.toMillis ? right.toMillis() : right;
  if (operator === '==') return a === b;
  if (operator === '!=') return a !== b;
  if (operator === '<') return a < b;
  if (operator === '<=') return a <= b;
  if (operator === '>') return a > b;
  if (operator === '>=') return a >= b;
  if (operator === 'in') return Array.isArray(b) && b.includes(a);
  if (operator === 'not-in') return Array.isArray(b) && !b.includes(a);
  if (operator === 'array-contains') return Array.isArray(a) && a.includes(b);
  if (operator === 'array-contains-any') return Array.isArray(a) && Array.isArray(b) && b.some(value => a.includes(value));
  return false;
}

class DocumentSnapshot {
  constructor(ref, row = null) {
    this.ref = ref;
    this.id = ref.id;
    this._data = row ? reviveDocumentValue(row.data) : null;
    this.createTime = row?.created_at ? new Date(row.created_at) : null;
    this.updateTime = row?.updated_at ? new Date(row.updated_at) : null;
  }
  get exists() { return this._data !== null; }
  data() { return this._data === null ? undefined : structuredClone(this._data); }
  get(field) { return fieldValue(this._data, field); }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(fn) { this.docs.forEach(fn); }
}

class DocumentReference {
  constructor(db, path) {
    this.firestore = db;
    this.path = normalizePath([path]);
    this.id = this.path.split('/').at(-1);
    this.parent = new CollectionReference(db, this.path.split('/').slice(0, -1).join('/'));
  }
  collection(name) { return new CollectionReference(this.firestore, normalizePath([this.path, name])); }
  async get() { return this.firestore._get(this); }
  async set(data, options = {}) { await this.firestore._write(this, data, Boolean(options.merge)); return { writeTime: new Date() }; }
  async update(data) { await this.firestore._write(this, data, true, true); return { writeTime: new Date() }; }
  async delete() { await this.firestore._delete(this); return { writeTime: new Date() }; }
}

class Query {
  constructor(db, path, filters = [], orders = [], max = null) {
    this.firestore = db;
    this.path = path;
    this.filters = filters;
    this.orders = orders;
    this.max = max;
  }
  where(field, operator, value) { return new Query(this.firestore, this.path, [...this.filters, [field, operator, value]], this.orders, this.max); }
  orderBy(field, direction = 'asc') { return new Query(this.firestore, this.path, this.filters, [...this.orders, [field, direction]], this.max); }
  limit(value) { return new Query(this.firestore, this.path, this.filters, this.orders, Math.max(0, Number(value) || 0)); }
  async get(client = this.firestore.client) {
    let docs = await this.firestore._collection(this.path, client);
    docs = docs.filter(doc => this.filters.every(([field, operator, value]) => compare(doc.get(field), operator, value)));
    for (const [field, direction] of [...this.orders].reverse()) {
      docs.sort((left, right) => {
        const a = left.get(field)?.toMillis?.() ?? left.get(field);
        const b = right.get(field)?.toMillis?.() ?? right.get(field);
        const result = a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1;
        return direction === 'desc' ? -result : result;
      });
    }
    if (this.max !== null) docs = docs.slice(0, this.max);
    return new QuerySnapshot(docs);
  }
  count() {
    return {
      get: async () => {
        const count = (await this.get()).size;
        return { data: () => ({ count }) };
      },
    };
  }
}

class CollectionReference extends Query {
  constructor(db, path) {
    super(db, normalizePath([path]));
    this.id = this.path.split('/').at(-1);
    this.parent = this.path.split('/').length > 1
      ? new DocumentReference(db, this.path.split('/').slice(0, -1).join('/'))
      : null;
  }
  doc(id = randomUUID()) { return new DocumentReference(this.firestore, normalizePath([this.path, id])); }
  async add(data) { const ref = this.doc(); await ref.set(data); return ref; }
}

class WriteBatch {
  constructor(db) { this.db = db; this.operations = []; }
  set(ref, data, options) { this.operations.push(['set', ref, data, options]); return this; }
  update(ref, data) { this.operations.push(['update', ref, data]); return this; }
  delete(ref) { this.operations.push(['delete', ref]); return this; }
  async commit() {
    return this.db._transaction(async tx => {
      for (const [type, ref, data, options] of this.operations) {
        if (type === 'delete') await this.db._delete(ref, tx);
        else await this.db._write(ref, data, type === 'update' || Boolean(options?.merge), type === 'update', tx);
      }
      return this.operations.map(() => ({ writeTime: new Date() }));
    });
  }
}

class Transaction {
  constructor(db, client) { this.db = db; this.client = client; }
  get(ref) {
    return ref instanceof DocumentReference
      ? this.db._get(ref, this.client, true)
      : ref.get(this.client);
  }
  set(ref, data, options) { this.db._pending.push(() => this.db._write(ref, data, Boolean(options?.merge), false, this.client)); return this; }
  update(ref, data) { this.db._pending.push(() => this.db._write(ref, data, true, true, this.client)); return this; }
  delete(ref) { this.db._pending.push(() => this.db._delete(ref, this.client)); return this; }
}

export class PostgresDocumentDb {
  constructor() {
    this.pool = null;
    this.schemaReady = false;
    this._pending = [];
  }
  get available() { return Boolean(connectionString()); }
  get client() {
    if (!this.available) throw Object.assign(new Error('APG PostgreSQL document store is not configured.'), { code: 'APG_POSTGRES_NOT_CONFIGURED' });
    if (!this.pool) this.pool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.APG_DATA_POOL_SIZE || 8),
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.APG_DATA_PG_SSL === '0' ? false : { rejectUnauthorized: false },
    });
    return this.pool;
  }
  async ensureSchema(client = this.client) {
    if (this.schemaReady) return;
    await client.query(`
      CREATE TABLE IF NOT EXISTS apg_documents (
        path TEXT PRIMARY KEY,
        collection_path TEXT NOT NULL,
        document_id TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS apg_documents_collection_idx ON apg_documents(collection_path);
      CREATE INDEX IF NOT EXISTS apg_documents_data_idx ON apg_documents USING GIN(data);
    `);
    this.schemaReady = true;
  }
  collection(path) { return new CollectionReference(this, path); }
  doc(path) { return new DocumentReference(this, path); }
  batch() { return new WriteBatch(this); }
  async _query(client, sql, params) { await this.ensureSchema(client); return client.query(sql, params); }
  async _get(ref, client = this.client, lock = false) {
    const result = await this._query(client, `SELECT * FROM apg_documents WHERE path=$1${lock ? ' FOR UPDATE' : ''}`, [ref.path]);
    return new DocumentSnapshot(ref, result.rows[0] || null);
  }
  async _collection(path, client = this.client) {
    const result = await this._query(client, 'SELECT * FROM apg_documents WHERE collection_path=$1', [path]);
    return result.rows.map(row => new DocumentSnapshot(new DocumentReference(this, row.path), row));
  }
  async _write(ref, patch, merge, mustExist = false, client = this.client) {
    const current = await this._get(ref, client, true);
    if (mustExist && !current.exists) throw Object.assign(new Error(`Document does not exist: ${ref.path}`), { code: 5 });
    const data = applyDocumentPatch(current.data() || {}, patch, merge);
    await this._query(client, `
      INSERT INTO apg_documents(path, collection_path, document_id, data)
      VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(path) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()
    `, [ref.path, ref.parent.path, ref.id, JSON.stringify(jsonValue(data))]);
  }
  async _delete(ref, client = this.client) { await this._query(client, 'DELETE FROM apg_documents WHERE path=$1', [ref.path]); }
  async _transaction(fn) {
    const client = await this.client.connect();
    try {
      await client.query('BEGIN');
      await this.ensureSchema(client);
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
  async runTransaction(fn) {
    return this._transaction(async client => {
      this._pending = [];
      const result = await fn(new Transaction(this, client));
      for (const operation of this._pending) await operation();
      this._pending = [];
      return result;
    });
  }
}

export const postgresDocumentDb = new PostgresDocumentDb();
