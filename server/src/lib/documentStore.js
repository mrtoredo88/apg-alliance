import { PostgresDocumentStore } from '../apg/infrastructure/adapters/PostgresDocumentStore.js';

let documentStore;

export function getDb()          {
  if (!documentStore) documentStore = new PostgresDocumentStore();
  return documentStore;
}
