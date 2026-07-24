import { getDb } from '../../lib/firebase.js';
import { ServerDataAdapter } from './ServerDataAdapter.js';

function serialize(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...(doc.data() || {}) };
}

export class FirestoreAdminAdapter extends ServerDataAdapter {
  constructor(dbFactory = getDb) {
    super('apg-postgres-documents');
    this.dbFactory = dbFactory;
  }

  get db() {
    return this.dbFactory();
  }

  collection(name) {
    return this.db.collection(name);
  }

  async getDocument(collectionName, id) {
    return serialize(await this.collection(collectionName).doc(String(id)).get());
  }

  async listDocuments(collectionName, { limit = 100 } = {}) {
    const snap = await this.collection(collectionName).limit(limit).get();
    return snap.docs.map(serialize).filter(Boolean);
  }

  async setDocument(collectionName, id, data, options = { merge: true }) {
    await this.collection(collectionName).doc(String(id)).set(data, options);
    return { id: String(id), ...data };
  }

  async updateDocument(collectionName, id, data) {
    await this.collection(collectionName).doc(String(id)).update(data);
    return { id: String(id), ...data };
  }

  async addDocument(collectionName, data) {
    const ref = await this.collection(collectionName).add(data);
    return { id: ref.id, ...data };
  }

  async runTransaction(fn) {
    return this.db.runTransaction(fn);
  }
}
