import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";

export function App() {
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(0);
  const [status, setStatus] = useState("Инициализация...");

  useEffect(() => {
    bridge.send('VKWebAppInit');

    // Таймаут на случай, если bridge не отвечает
    const timer = setTimeout(() => {
      if (!userId) {
        console.log("VK Bridge молчит, используем тест-режим");
        setUserId("test_user_999");
      }
    }, 3000);

    bridge.send('VKWebAppGetUserInfo')
      .then((data) => {
        setUserId(data.id.toString());
        setStatus("Авторизован");
      })
      .catch((err) => {
        console.log("Ошибка ВК:", err);
        setUserId("test_user_999");
      });

    return () => clearTimeout(timer);
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
        setStatus("База загружена");
      } catch (e) {
        console.error("Ошибка Firebase:", e);
        setStatus("Ошибка базы");
      }
    };
    initUser();
  }, [userId]);

  return (
    <div style={{ 
      background: '#0d0d13', 
      color: 'white', 
      padding: '20px', 
      minHeight: '100vh',
      fontFamily: 'sans-serif' 
    }}>
      <div style={{ border: '1px solid #333', padding: '15px', borderRadius: '10px' }}>
        <h2>Статус: {status}</h2>
        <h3>ID: {userId}</h3>
        <h1 style={{ color: '#00f0ff' }}>🔑 {userKeys}</h1>
      </div>
      <p style={{ marginTop: '20px', color: '#666' }}>
        Если ты видишь эти цифры, значит React и база данных работают корректно.
      </p>
    </div>
  );
}