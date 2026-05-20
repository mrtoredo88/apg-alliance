import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "ТВОЙ_API_KEY",
  authDomain: "ТВОЙ_PROJECT_ID.firebaseapp.com",
  projectId: "ТВОЙ_PROJECT_ID",
  storageBucket: "ТВОЙ_PROJECT_ID.appspot.com",
  messagingSenderId: "ТВОЙ_ID",
  appId: "ТВОЙ_APP_ID"
};

const app = initializeApp(firebaseConfig);

// КРИТИЧЕСКИ ВАЖНАЯ СТРОКА:
export const db = getFirestore(app);