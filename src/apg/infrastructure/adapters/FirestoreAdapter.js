import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase.js';
import { BaseDataAdapter } from './BaseDataAdapter.js';

function serializeDoc(snapshot) {
  if (!snapshot?.exists?.()) return null;
  return { id: snapshot.id, ...(snapshot.data() || {}) };
}

function applyQuery(ref, spec = {}) {
  const clauses = [];
  for (const filter of spec.where || []) clauses.push(where(filter.field, filter.op || '==', filter.value));
  for (const item of spec.orderBy || []) clauses.push(orderBy(item.field, item.direction || 'asc'));
  if (spec.limit) clauses.push(limit(spec.limit));
  return clauses.length ? query(ref, ...clauses) : ref;
}

export class FirestoreAdapter extends BaseDataAdapter {
  constructor(firestoreDb = db) {
    super('firestore');
    this.db = firestoreDb;
  }

  async getDocument(collectionName, id) {
    return serializeDoc(await getDoc(doc(this.db, collectionName, String(id))));
  }

  async listDocuments(collectionName, spec = {}) {
    const snap = await getDocs(applyQuery(collection(this.db, collectionName), spec));
    return snap.docs.map(serializeDoc).filter(Boolean);
  }

  async queryDocuments(collectionName, spec = {}) {
    return this.listDocuments(collectionName, spec);
  }

  async setDocument(collectionName, id, data, options = { merge: true }) {
    await setDoc(doc(this.db, collectionName, String(id)), data, options);
    return { id: String(id), ...data };
  }

  async updateDocument(collectionName, id, data) {
    await updateDoc(doc(this.db, collectionName, String(id)), data);
    return { id: String(id), ...data };
  }

  async addDocument(collectionName, data) {
    const ref = await addDoc(collection(this.db, collectionName), data);
    return { id: ref.id, ...data };
  }

  async deleteDocument(collectionName, id) {
    await deleteDoc(doc(this.db, collectionName, String(id)));
    return true;
  }
}
