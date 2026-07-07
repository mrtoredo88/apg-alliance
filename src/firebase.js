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

export const FIREBASE_CLIENT_DIAGNOSTICS = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  appId: firebaseConfig.appId,
  emulatorRequested: false,
  emulatorConnected: false,
  emulatorHost: null,
  emulatorPort: null,
  staleAdminEmulatorCleared: false,
  environment: import.meta.env.MODE,
};

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});

try {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const hashPath = typeof window !== 'undefined' ? (window.location.hash.split('?')[0] || '') : '';
  const hashQuery = typeof window !== 'undefined' ? (window.location.hash.split('?')[1] || '') : '';
  const params = new URLSearchParams(hashQuery);
  const localHost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const adminRoute = hashPath === '#/admin' || hashPath === '#/admin-app';
  const storedDemoEmulator = window.localStorage?.getItem('apg_demo_content') === 'emulator';
  const storedEmulatorAllowed = window.localStorage?.getItem('apg_firestore_emulator_enabled') === '1';
  if (adminRoute && storedDemoEmulator) {
    window.localStorage?.removeItem('apg_demo_content');
    window.localStorage?.removeItem('apg_firestore_emulator_host');
    window.localStorage?.removeItem('apg_firestore_emulator_port');
    window.localStorage?.removeItem('apg_firestore_emulator_enabled');
    FIREBASE_CLIENT_DIAGNOSTICS.staleAdminEmulatorCleared = true;
  }
  const demoRequested = !adminRoute && (params.get('demo') === '1' || (storedDemoEmulator && storedEmulatorAllowed));
  FIREBASE_CLIENT_DIAGNOSTICS.emulatorRequested = Boolean(localHost && demoRequested);
  if (localHost && demoRequested && !globalThis.__APG_FIRESTORE_EMULATOR_CONNECTED__) {
    const emulatorHost = window.localStorage?.getItem('apg_firestore_emulator_host') || host;
    const emulatorPort = Number(window.localStorage?.getItem('apg_firestore_emulator_port') || 8080);
    connectFirestoreEmulator(db, emulatorHost, emulatorPort);
    globalThis.__APG_FIRESTORE_EMULATOR_CONNECTED__ = true;
    FIREBASE_CLIENT_DIAGNOSTICS.emulatorConnected = true;
    FIREBASE_CLIENT_DIAGNOSTICS.emulatorHost = emulatorHost;
    FIREBASE_CLIENT_DIAGNOSTICS.emulatorPort = emulatorPort;
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
