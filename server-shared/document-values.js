const OP = '__apg_document_operation__';
const operation = (type, value) => ({ [OP]: type, value });

export const FieldValue = Object.freeze({
  serverTimestamp: () => operation('serverTimestamp'),
  increment: value => operation('increment', Number(value) || 0),
  arrayUnion: (...value) => operation('arrayUnion', value),
  arrayRemove: (...value) => operation('arrayRemove', value),
  delete: () => operation('delete'),
});
