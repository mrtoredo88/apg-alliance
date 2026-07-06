import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  // Приоритет 1: GOOGLE_APPLICATION_CREDENTIALS — путь к файлу внутри контейнера
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp();
  }

  // Приоритет 2: FIREBASE_SERVICE_ACCOUNT — JSON-строка (локальная разработка)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }

  throw new Error('Firebase не настроен: нужна GOOGLE_APPLICATION_CREDENTIALS или FIREBASE_SERVICE_ACCOUNT');
}

export function getDb()          { return getFirestore(getAdminApp()); }
export function getDbMessaging() { return getMessaging(getAdminApp()); }
export function getDbAuth()      { return getAuth(getAdminApp()); }
