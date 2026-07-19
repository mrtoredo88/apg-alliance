export class Repository {
  constructor({ name, collectionName, adapter }) {
    this.name = name;
    this.collectionName = collectionName;
    this.adapter = adapter;
  }

  get(id) { return this.adapter.getDocument(this.collectionName, id); }
  list(spec) { return this.adapter.listDocuments(this.collectionName, spec); }
  query(spec) { return this.adapter.queryDocuments(this.collectionName, spec); }
  set(id, data, options) { return this.adapter.setDocument(this.collectionName, id, data, options); }
  update(id, data) { return this.adapter.updateDocument(this.collectionName, id, data); }
  add(data) { return this.adapter.addDocument(this.collectionName, data); }
  delete(id) { return this.adapter.deleteDocument(this.collectionName, id); }
}

export function createRepository(name, collectionName, adapter) {
  return new Repository({ name, collectionName, adapter });
}
