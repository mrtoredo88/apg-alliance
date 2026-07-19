import { FieldValue } from 'firebase-admin/firestore';
import { resolveEmailIdentity, resolveFirebaseIdentity } from '../../../lib/identityCore.js';

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

export class FirestoreIdentityFallbackAdapter {
  constructor(dbFactory) {
    this.name = 'firestore-identity-fallback';
    this.dbFactory = dbFactory;
    this.reads = 0;
    this.writes = 0;
    this.fallbacks = 0;
  }

  get db() {
    return this.dbFactory();
  }

  snapshot() {
    return {
      provider: this.name,
      reads: this.reads,
      writes: this.writes,
      fallbacks: this.fallbacks,
    };
  }

  async resolveEmailIdentity(input) {
    this.fallbacks += 1;
    this.reads += 8;
    this.writes += input?.createIfMissing === false ? 0 : 4;
    return resolveEmailIdentity(this.db, input);
  }

  async resolveFirebaseIdentity(uid) {
    this.fallbacks += 1;
    this.reads += 6;
    this.writes += 1;
    return resolveFirebaseIdentity(this.db, uid);
  }

  async writeUser(userId, user = {}) {
    this.writes += 1;
    await this.db.collection('users').doc(String(userId)).set({
      ...user,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async linkEmail({ email, userId, firebaseUid = '' }) {
    this.writes += 2;
    await this.db.collection('emailIndex').doc(String(email)).set({
      userId: String(userId),
      canonicalUserId: String(userId),
      firebaseUid: safeString(firebaseUid, 260) || null,
      identityVersion: 'identity-v2-dual-write',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await this.db.collection('identityLinks').doc(`email:${email}`).set({
      type: 'email',
      value: String(email),
      canonicalUserId: String(userId),
      userId: String(userId),
      identityVersion: 'identity-v2-dual-write',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async linkTelegram({ telegramId, userId, telegram = {}, firebaseUid = '' }) {
    this.writes += 2;
    await this.db.collection('tgLinks').doc(String(telegramId)).set({
      userId: String(userId),
      telegramId: String(telegramId),
      firebaseUid: safeString(firebaseUid, 260) || null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await this.db.collection('users').doc(String(userId)).set({
      linkedTelegram: {
        ...telegram,
        tgId: String(telegramId),
        linkedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}
