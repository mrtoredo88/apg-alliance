import { randomUUID } from 'node:crypto';
import { PostgresDataAdapter } from '../../data/PostgresDataAdapter.js';

const VALUE_OPERATION = '__apgValueOperation';

export const DocumentValue = Object.freeze({
  serverTimestamp: () => ({ [VALUE_OPERATION]: 'serverTimestamp' }),
  increment: value => ({ [VALUE_OPERATION]: 'increment', value: Number(value) || 0 }),
  arrayUnion: (...values) => ({ [VALUE_OPERATION]: 'arrayUnion', values }),
  arrayRemove: (...values) => ({ [VALUE_OPERATION]: 'arrayRemove', values }),
  delete: () => ({ [VALUE_OPERATION]: 'delete' }),
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getPath(value, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], value);
}

function setPath(target, path, value) {
  const keys = String(path).split('.');
  let current = target;
  keys.slice(0, -1).forEach(key => {
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) current[key] = {};
    current = current[key];
  });
  if (value?.[VALUE_OPERATION] === 'delete') delete current[keys.at(-1)];
  else current[keys.at(-1)] = value;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveValue(operation, previous) {
  if (!operation || typeof operation !== 'object' || !operation[VALUE_OPERATION]) return clone(operation);
  if (operation[VALUE_OPERATION] === 'serverTimestamp') return new Date().toISOString();
  if (operation[VALUE_OPERATION] === 'increment') return (Number(previous) || 0) + operation.value;
  if (operation[VALUE_OPERATION] === 'arrayUnion') {
    const current = Array.isArray(previous) ? clone(previous) : [];
    operation.values.forEach(value => {
      if (!current.some(item => sameValue(item, value))) current.push(clone(value));
    });
    return current;
  }
  if (operation[VALUE_OPERATION] === 'arrayRemove') {
    return (Array.isArray(previous) ? previous : []).filter(
      item => !operation.values.some(value => sameValue(item, value)),
    );
  }
  return operation;
}

function resolveDeep(value, previous) {
  if (value?.[VALUE_OPERATION]) return resolveValue(value, previous);
  if (Array.isArray(value)) return value.map((item, index) => resolveDeep(item, previous?.[index]));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveDeep(item, previous?.[key])]));
  }
  return clone(value);
}

function applyData(existing, patch, merge) {
  const result = merge ? clone(existing || {}) : {};
  Object.entries(patch || {}).forEach(([path, value]) => {
    setPath(result, path, resolveDeep(value, getPath(result, path)));
  });
  return result;
}

function compare(left, operator, right) {
  if (operator === '==') return sameValue(left, right);
  if (operator === '!=') return !sameValue(left, right);
  if (operator === 'array-contains') return Array.isArray(left) && left.some(value => sameValue(value, right));
  if (operator === 'array-contains-any') return Array.isArray(left) && right.some(value => left.some(item => sameValue(item, value)));
  if (operator === 'in') return Array.isArray(right) && right.some(value => sameValue(left, value));
  if (operator === 'not-in') return Array.isArray(right) && !right.some(value => sameValue(left, value));
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  return false;
}

class PostgresDocumentSnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = Boolean(data);
    this._data = data ? clone(data) : null;
  }

  data() { return this._data ? clone(this._data) : undefined; }
  get(path) { return getPath(this._data, path); }
}

class PostgresQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback) { this.docs.forEach(callback); }
}

class PostgresDocumentReference {
  constructor(store, collectionName, id, parentPath = '') {
    this.store = store;
    this.collectionName = collectionName;
    this.id = String(id);
    this.parentPath = parentPath;
    this.path = [parentPath, collectionName, this.id].filter(Boolean).join('/');
  }

  collection(name) {
    return new PostgresCollectionReference(this.store, name, this.path);
  }

  async get() {
    return new PostgresDocumentSnapshot(
      this,
      await this.store.adapter.getDocument(this.collectionName, this.id, { parentPath: this.parentPath }),
    );
  }

  async set(data, options = {}) {
    return this.store.adapter.adapter.transaction(client => (
      this.store.setWithClient(client, this, data, Boolean(options.merge), false)
    ));
  }

  async update(data) {
    return this.store.adapter.adapter.transaction(client => (
      this.store.setWithClient(client, this, data, true, true)
    ));
  }

  async delete() {
    await this.store.adapter.adapter.transaction(client => this.store.deleteWithClient(client, this));
  }
}

class PostgresQuery {
  constructor(store, collectionName, parentPath = '', options = {}) {
    this.store = store;
    this.collectionName = collectionName;
    this.parentPath = parentPath;
    this.filters = options.filters || [];
    this.orders = options.orders || [];
    this.max = options.max || 1000;
    this.offsetCount = options.offsetCount || 0;
  }

  next(changes) {
    return new PostgresQuery(this.store, this.collectionName, this.parentPath, {
      filters: this.filters,
      orders: this.orders,
      max: this.max,
      offsetCount: this.offsetCount,
      ...changes,
    });
  }

  where(field, operator, value) {
    return this.next({ filters: [...this.filters, { field, operator, value }] });
  }

  orderBy(field, direction = 'asc') {
    return this.next({ orders: [...this.orders, { field, direction }] });
  }

  limit(value) { return this.next({ max: Math.max(1, Number(value) || 1) }); }
  offset(value) { return this.next({ offsetCount: Math.max(0, Number(value) || 0) }); }

  async get() {
    const rows = await this.store.adapter.listDocuments(this.collectionName, {
      parentPath: this.parentPath,
      limit: 10000,
      orderBy: 'updated_at',
      direction: 'desc',
    });
    const filtered = rows
      .filter(row => this.filters.every(filter => compare(getPath(row, filter.field), filter.operator, filter.value)))
      .sort((left, right) => {
        for (const order of this.orders) {
          const a = getPath(left, order.field);
          const b = getPath(right, order.field);
          if (a === b) continue;
          const result = a > b ? 1 : -1;
          return order.direction === 'desc' ? -result : result;
        }
        return 0;
      })
      .slice(this.offsetCount, this.offsetCount + this.max);
    return new PostgresQuerySnapshot(filtered.map(row => (
      new PostgresDocumentSnapshot(
        new PostgresDocumentReference(this.store, this.collectionName, row.id, this.parentPath),
        row,
      )
    )));
  }
}

class PostgresCollectionReference extends PostgresQuery {
  constructor(store, collectionName, parentPath = '') {
    super(store, collectionName, parentPath);
    this.id = collectionName;
    this.path = [parentPath, collectionName].filter(Boolean).join('/');
  }

  doc(id = randomUUID()) {
    return new PostgresDocumentReference(this.store, this.collectionName, id, this.parentPath);
  }

  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class PostgresDocumentStore {
  constructor(adapter = new PostgresDataAdapter()) {
    this.adapter = adapter;
  }

  collection(name) { return new PostgresCollectionReference(this, name); }
  doc(path) {
    const parts = String(path).split('/').filter(Boolean);
    if (parts.length < 2 || parts.length % 2 !== 0) throw new Error(`Invalid document path: ${path}`);
    return new PostgresDocumentReference(
      this,
      parts.at(-2),
      parts.at(-1),
      parts.slice(0, -2).join('/'),
    );
  }

  batch() {
    const operations = [];
    const batch = {
      set: (ref, data, options) => { operations.push({ type: 'set', ref, data, options }); return batch; },
      update: (ref, data) => { operations.push({ type: 'update', ref, data }); return batch; },
      delete: ref => { operations.push({ type: 'delete', ref }); return batch; },
      commit: async () => this.adapter.adapter.transaction(async client => {
        for (const operation of operations) {
          if (operation.type === 'delete') await this.deleteWithClient(client, operation.ref);
          else await this.setWithClient(client, operation.ref, operation.data, operation.type === 'update' || operation.options?.merge, operation.type === 'update');
        }
        return [];
      }),
    };
    return batch;
  }

  async runTransaction(callback) {
    return this.adapter.adapter.transaction(async client => {
      const operations = [];
      const transaction = {
        get: ref => this.getWithClient(client, ref, true),
        set: (ref, data, options) => { operations.push({ type: 'set', ref, data, merge: Boolean(options?.merge) }); return transaction; },
        update: (ref, data) => { operations.push({ type: 'update', ref, data, merge: true }); return transaction; },
        delete: ref => { operations.push({ type: 'delete', ref }); return transaction; },
      };
      const result = await callback(transaction);
      for (const operation of operations) {
        if (operation.type === 'delete') await this.deleteWithClient(client, operation.ref);
        else await this.setWithClient(client, operation.ref, operation.data, operation.merge, operation.type === 'update');
      }
      return result;
    });
  }

  async getWithClient(client, ref, lock = false) {
    if (!(ref instanceof PostgresDocumentReference)) return ref.get();
    const result = await client.query(
      `SELECT * FROM apg_app_documents
       WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3
       LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`,
      [ref.collectionName, ref.parentPath, ref.id],
    );
    const row = result.rows[0];
    const data = row ? { id: row.document_id, ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {}) } : null;
    return new PostgresDocumentSnapshot(ref, data);
  }

  async setWithClient(client, ref, data, merge = false, requireExisting = false) {
    const current = await this.getWithClient(client, ref, true);
    if (requireExisting && !current.exists) throw Object.assign(new Error('Document not found.'), { code: 'not-found' });
    const payload = applyData(current.data(), data, merge);
    await client.query(
      `INSERT INTO apg_app_documents (collection_name, document_id, parent_path, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (collection_name, parent_path, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [ref.collectionName, ref.id, ref.parentPath, JSON.stringify({ ...payload, id: ref.id })],
    );
  }

  async deleteWithClient(client, ref) {
    await client.query(
      'DELETE FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3',
      [ref.collectionName, ref.parentPath, ref.id],
    );
  }
}
