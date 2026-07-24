const OP = '__apg_document_operation__';

export class Timestamp {
  constructor(milliseconds = Date.now()) {
    this._milliseconds = Number(milliseconds);
  }

  static now() { return new Timestamp(); }
  static fromDate(value) { return new Timestamp(value.getTime()); }
  static fromMillis(value) { return new Timestamp(value); }
  toDate() { return new Date(this._milliseconds); }
  toMillis() { return this._milliseconds; }
  toJSON() { return { __apg_timestamp__: new Date(this._milliseconds).toISOString() }; }
}

function operation(type, value) {
  return { [OP]: type, value };
}

export const FieldValue = Object.freeze({
  serverTimestamp: () => operation('serverTimestamp'),
  increment: value => operation('increment', Number(value) || 0),
  arrayUnion: (...value) => operation('arrayUnion', value),
  arrayRemove: (...value) => operation('arrayRemove', value),
  delete: () => operation('delete'),
});

export function reviveDocumentValue(value) {
  if (Array.isArray(value)) return value.map(reviveDocumentValue);
  if (!value || typeof value !== 'object') return value;
  if (value.__apg_timestamp__) return Timestamp.fromDate(new Date(value.__apg_timestamp__));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveDocumentValue(item)]));
}

export function cloneDocumentValue(value) {
  if (value instanceof Timestamp) return Timestamp.fromMillis(value.toMillis());
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneDocumentValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneDocumentValue(item)]));
}

function equalValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyDocumentPatch(current = {}, patch = {}, merge = true) {
  const next = merge ? cloneDocumentValue(current || {}) : {};
  for (const [key, raw] of Object.entries(patch || {})) {
    const op = raw?.[OP];
    if (!op) {
      next[key] = raw;
    } else if (op === 'serverTimestamp') {
      next[key] = Timestamp.now();
    } else if (op === 'increment') {
      next[key] = (Number(next[key]) || 0) + raw.value;
    } else if (op === 'arrayUnion') {
      const values = Array.isArray(next[key]) ? [...next[key]] : [];
      for (const item of raw.value) if (!values.some(existing => equalValue(existing, item))) values.push(item);
      next[key] = values;
    } else if (op === 'arrayRemove') {
      const values = Array.isArray(next[key]) ? next[key] : [];
      next[key] = values.filter(item => !raw.value.some(removed => equalValue(item, removed)));
    } else if (op === 'delete') {
      delete next[key];
    }
  }
  return next;
}
