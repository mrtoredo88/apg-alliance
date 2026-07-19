import { BaseDataAdapter } from './BaseDataAdapter.js';

export class MemoryAdapter extends BaseDataAdapter {
  constructor(seed = {}) {
    super('memory');
    this.store = new Map(Object.entries(seed).map(([name, rows]) => [name, new Map((rows || []).map(row => [String(row.id), row]))]));
  }

  bucket(name) {
    if (!this.store.has(name)) this.store.set(name, new Map());
    return this.store.get(name);
  }

  async getDocument(collectionName, id) {
    return this.bucket(collectionName).get(String(id)) || null;
  }

  async listDocuments(collectionName, spec = {}) {
    return [...this.bucket(collectionName).values()].slice(0, spec.limit || undefined);
  }

  async queryDocuments(collectionName, spec = {}) {
    return this.listDocuments(collectionName, spec);
  }

  async setDocument(collectionName, id, data) {
    const row = { id: String(id), ...data };
    this.bucket(collectionName).set(String(id), row);
    return row;
  }

  async updateDocument(collectionName, id, data) {
    const prev = await this.getDocument(collectionName, id);
    return this.setDocument(collectionName, id, { ...(prev || {}), ...data });
  }

  async addDocument(collectionName, data) {
    const id = data.id || `${collectionName}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return this.setDocument(collectionName, id, data);
  }

  async deleteDocument(collectionName, id) {
    return this.bucket(collectionName).delete(String(id));
  }
}
