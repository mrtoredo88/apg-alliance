import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDieP_idJhPrOYA8drW3cZjFNibmnPzBxQ",
  authDomain: "project-apg-bbfc8.firebaseapp.com",
  projectId: "project-apg-bbfc8",
  storageBucket: "project-apg-bbfc8.firebasestorage.app",
  messagingSenderId: "946188358768",
  appId: "1:946188358768:web:a7fb6f6586ffdaf0b010b5"
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});

try {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const hashQuery = typeof window !== 'undefined' ? (window.location.hash.split('?')[1] || '') : '';
  const params = new URLSearchParams(hashQuery);
  const localHost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const demoRequested = params.get('demo') === '1' || window.localStorage?.getItem('apg_demo_content') === 'emulator';
  if (localHost && demoRequested && !globalThis.__APG_FIRESTORE_EMULATOR_CONNECTED__) {
    const emulatorHost = window.localStorage?.getItem('apg_firestore_emulator_host') || host;
    const emulatorPort = Number(window.localStorage?.getItem('apg_firestore_emulator_port') || 8080);
    connectFirestoreEmulator(db, emulatorHost, emulatorPort);
    globalThis.__APG_FIRESTORE_EMULATOR_CONNECTED__ = true;
  }
} catch {}

export const auth = getAuth(app);

export async function getMessagingIfSupported() {
  try {
    const { getMessaging, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}
