import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";

export function App() {
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(0);

  useEffect(() => {
    bridge.send('VKWebAppInit');
    bridge.send('VKWebAppGetUserInfo')
      .then((data) => setUserId(data.id.toString()))
      .catch(() => setUserId("test_user_999"));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const initUser = async () => {
      try {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          setUserKeys(docSnap.data().keys);
        } else {
          await setDoc(userRef, { keys: 3 });
          setUserKeys(3);
        }
      } catch (e) {
        console.error("Ошибка Firebase:", e);
      }
    };
    initUser();
  }, [userId]);

  return (
    <div style={{ background: '#0d0d13', color: 'white', padding: '20px', height: '100vh' }}>
      <h1>ID: {userId}</h1>
      <h1>🔑 Ключей: {userKeys}</h1>
    </div>
  );
}