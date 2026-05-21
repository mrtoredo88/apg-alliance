import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Scanner } from './Scanner.jsx';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

// Переименовали функцию в UserApp для соответствия импорту в App.jsx
export function UserApp() {
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(3);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // ... остальные стейты (activeScreen, selectedCategory и т.д.)

  // 1. Получаем ID пользователя
  useEffect(() => {
    bridge.send('VKWebAppInit');
    bridge.send('VKWebAppGetUserInfo')
      .then((data) => setUserId(data.id.toString()))
      .catch((err) => {
        console.log('Не удалось получить ID из ВК, используем тест:', err);
        setUserId("test_user_999");
      });
  }, []);

  // 2. Загружаем данные из Firestore
  useEffect(() => {
    if (!userId) return;

    const loadUserData = async () => {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        setUserKeys(docSnap.data().keys);
      } else {
        await setDoc(userRef, { keys: 3 });
      }
    };
    loadUserData();
  }, [userId]);

  // 3. Функция сканирования
  const handleConfirmScan = async (partnerName) => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);

    try {
      await updateDoc(userRef, { keys: increment(1) });
      setUserKeys(prev => prev + 1);
      alert(`🎉 Успешно! Ты отсканировал "${partnerName}". +1 Ключ в облаке! 🔑`);
    } catch (e) {
      console.error("Ошибка обновления базы: ", e);
    }
    setIsScannerOpen(false);
  };

  const getUserLevel = () => {
    if (userKeys >= 7) return { title: "Амбассадор Альянса 👑", color: "#ffaa00" };
    if (userKeys >= 5) return { title: "Местный житель 🌆", color: "#7f00ff" };
    return { title: "Гость города 🪐", color: "#00f0ff" };
  };

  const currentLevel = getUserLevel();

  return (
    <div style={{ background: '#0d0d13', color: '#ffffff', minHeight: '100vh', padding: '20px' }}>
      <h1>Тест работы приложения</h1>
      <p>ID пользователя: {userId ? userId : "Загрузка..."}</p>
      <h2 style={{ color: currentLevel.color }}>
        🔑 Ключей: {userKeys} | Уровень: {currentLevel.title}
      </h2>
      
      <button onClick={() => setIsScannerOpen(true)}>
        Открыть сканер
      </button>

      <button onClick={() => handleConfirmScan("Тест")}>
        Добавить ключ (Тест)
      </button>

      {isScannerOpen && (
        <Scanner onScan={(name) => handleConfirmScan(name)} />
      )}
    </div>
  );
}