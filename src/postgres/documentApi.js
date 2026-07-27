import { API_BASE_URL } from '../constants.js';
import { apgIdentity } from '../apg/index.js';

const getPath = (value, path) => String(path).split('.').reduce((current, key) => current?.[key], value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function compare(left, operator, right) {
  if (operator === '==') return same(left, right);
  if (operator === '!=') return !same(left, right);
  if (operator === 'array-contains') return Array.isArray(left) && left.some(value => same(value, right));
  if (operator === 'array-contains-any') return Array.isArray(left) && right.some(value => left.some(item => same(item, value)));
  if (operator === 'in') return Array.isArray(right) && right.some(value => same(left, value));
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  return false;
}

async function request(path, body) {
  const token = await apgIdentity.getSessionToken?.().catch(() => '');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-apg-auth': token } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw Object.assign(new Error(payload.error || 'Не удалось загрузить данные.'), { code: payload.code });
  return payload;
}

function parse(parts) {
  const values = parts.filter(value => typeof value === 'string' && value);
  return { collectionName: values.at(-1) || '', parentPath: values.slice(0, -1).join('/') };
}

export function collection(_db, ...parts) {
  return { type: 'collection', ...parse(parts), constraints: [] };
}

export function doc(_db, ...parts) {
  return { type: 'document', id: String(parts.at(-1) || ''), ...parse(parts.slice(0, -1)) };
}

export const where = (field, operator, value) => ({ type: 'where', field, operator, value });
export const orderBy = (field, direction = 'asc') => ({ type: 'orderBy', field, direction });
export const limit = value => ({ type: 'limit', value });
export const query = (reference, ...constraints) => ({ ...reference, constraints: [...(reference.constraints || []), ...constraints] });

function snapshot(ref, value) {
  return { id: value?.id || ref.id, ref, exists: () => Boolean(value), data: () => value ? structuredClone(value) : undefined, get: path => getPath(value, path) };
}

export async function getDoc(reference) {
  const result = await request('/api/app-data/get', { collection: reference.collectionName, parentPath: reference.parentPath, id: reference.id });
  return snapshot(reference, result.document);
}

export async function getDocs(reference) {
  const constraints = reference.constraints || [];
  const maximum = constraints.find(item => item.type === 'limit');
  const result = await request('/api/app-data/query', {
    collection: reference.collectionName,
    parentPath: reference.parentPath,
    limit: maximum?.value || 1000,
  });
  let rows = Array.isArray(result.documents) ? result.documents : [];
  constraints.filter(item => item.type === 'where').forEach(filter => {
    rows = rows.filter(row => compare(getPath(row, filter.field), filter.operator, filter.value));
  });
  const orders = constraints.filter(item => item.type === 'orderBy');
  rows.sort((left, right) => {
    for (const order of orders) {
      const a = getPath(left, order.field);
      const b = getPath(right, order.field);
      if (a === b) continue;
      const comparison = a > b ? 1 : -1;
      return order.direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
  if (maximum) rows = rows.slice(0, Number(maximum.value) || 0);
  const docs = rows.map(row => snapshot({ ...reference, id: row.id }, row));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: callback => docs.forEach(callback) };
}

export async function getCountFromServer(reference) {
  const result = await getDocs(reference);
  return { data: () => ({ count: result.size }) };
}

export function onSnapshot(reference, onNext, onError) {
  let active = true;
  const refresh = async () => {
    try {
      const value = reference.type === 'document' ? await getDoc(reference) : await getDocs(reference);
      if (active) onNext(value);
    } catch (error) {
      if (active) onError?.(error);
    }
  };
  refresh();
  const timer = setInterval(refresh, 10_000);
  return () => { active = false; clearInterval(timer); };
}
