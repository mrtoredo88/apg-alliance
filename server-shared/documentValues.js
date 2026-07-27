const VALUE_OPERATION = '__apgValueOperation';

export const FieldValue = Object.freeze({
  serverTimestamp: () => ({ [VALUE_OPERATION]: 'serverTimestamp' }),
  increment: value => ({ [VALUE_OPERATION]: 'increment', value: Number(value) || 0 }),
  arrayUnion: (...values) => ({ [VALUE_OPERATION]: 'arrayUnion', values }),
  arrayRemove: (...values) => ({ [VALUE_OPERATION]: 'arrayRemove', values }),
  delete: () => ({ [VALUE_OPERATION]: 'delete' }),
});
