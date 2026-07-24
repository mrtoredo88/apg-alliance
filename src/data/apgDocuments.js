import { API_BASE_URL } from '../constants.js';
import { apgSession } from '../auth/apgSession.js';

class ApgTimestamp {
  constructor(value) { this.value = value; }
  toDate() { return new Date(this.value); }
  toMillis() { return this.toDate().getTime(); }
}

function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (!value || typeof value !== 'object') return value;
  if (value.__apg_timestamp__) return new ApgTimestamp(value.__apg_timestamp__);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
}

function clone(value) {
  if (value instanceof ApgTimestamp) return new ApgTimestamp(value.value);
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function pathOf(parts) {
  return parts.flatMap(part => String(part || '').split('/')).filter(Boolean).join('/');
}

async function read(payload) {
  const response = await fetch(`${API_BASE_URL}/api/documents/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apgSession.token ? { Authorization: `Bearer ${apgSession.token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `document_read_${response.status}`), { code: data.error || `HTTP_${response.status}` });
  return data;
}

class DocumentSnapshot {
  constructor(ref, exists, data) { this.ref = ref; this.id = ref.id; this._exists = exists; this._data = revive(data); }
  exists() { return this._exists; }
  data() { return this._exists ? clone(this._data) : undefined; }
  get(field) { return String(field).split('.').reduce((value, key) => value?.[key], this._data); }
}

class QuerySnapshot {
  constructor(docs) { this.docs = docs; this.size = docs.length; this.empty = docs.length === 0; }
  forEach(callback) { this.docs.forEach(callback); }
}

export const db = Object.freeze({ provider: 'apg-postgres-api' });
export function collection(parent, ...parts) {
  const path = pathOf([parent?.path || '', ...parts]);
  return { type: 'collection', path, id: path.split('/').at(-1) };
}
export function doc(parent, ...parts) {
  const path = pathOf([parent?.path || '', ...parts]);
  return { type: 'document', path, id: path.split('/').at(-1) };
}
export function where(field, operator, value) { return { type: 'where', field, operator, value }; }
export function orderBy(field, direction = 'asc') { return { type: 'orderBy', field, direction }; }
export function limit(value) { return { type: 'limit', value: Number(value) }; }
export function query(ref, ...constraints) { return { ...ref, constraints: [...(ref.constraints || []), ...constraints] }; }

export async function getDoc(ref) {
  const result = await read({ kind: 'document', path: ref.path });
  return new DocumentSnapshot(ref, result.exists, result.data);
}

export async function getDocs(ref) {
  const constraints = ref.constraints || [];
  const result = await read({
    kind: 'collection',
    path: ref.path,
    filters: constraints.filter(item => item.type === 'where').map(item => [item.field, item.operator, item.value]),
    orders: constraints.filter(item => item.type === 'orderBy').map(item => [item.field, item.direction]),
    limit: constraints.find(item => item.type === 'limit')?.value || 500,
  });
  return new QuerySnapshot(result.docs.map(item => new DocumentSnapshot({ id: item.id, path: `${ref.path}/${item.id}` }, true, item.data)));
}

export async function getCountFromServer(ref) {
  const snapshot = await getDocs(ref);
  return { data: () => ({ count: snapshot.size }) };
}

export function onSnapshot(ref, onNext, onError) {
  let stopped = false;
  let timer = null;
  const poll = async () => {
    try {
      const snapshot = ref.type === 'document' ? await getDoc(ref) : await getDocs(ref);
      if (!stopped) onNext(snapshot);
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      if (!stopped) timer = setTimeout(poll, 15_000);
    }
  };
  poll();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

function backendWriteOnly() {
  throw Object.assign(new Error('Запись документов разрешена только через APG API.'), { code: 'APG_BACKEND_WRITE_REQUIRED' });
}
export const addDoc = backendWriteOnly;
export const setDoc = backendWriteOnly;
export const updateDoc = backendWriteOnly;
export const deleteDoc = backendWriteOnly;
