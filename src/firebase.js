import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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