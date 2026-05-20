import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Scanner } from './Scanner.jsx';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export function App() {
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(3); // Начальное значение на случай загрузки
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('main');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(1);

  // 1. Получаем ID пользователя из ВК
  useEffect(() => {
    bridge.send('VKWebAppInit');
    bridge.send('VKWebAppGetUserInfo')
      .then((data) => setUserId(data.id.toString()))
      .catch((err) => {
        console.log('Не удалось получить ID из ВК, используем тест:', err);
        setUserId("test_user_999");
      });
  }, []);

  // 2. Загружаем данные из Firestore, как только получили userId
  useEffect(() => {
    if (!userId) return;

    const loadUserData = async () => {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        setUserKeys(docSnap.data().keys);
      } else {
        // Если пользователя еще нет в базе, создаем запись с 3 ключами
        await setDoc(userRef, { keys: 3 });
      }
    };
    loadUserData();
  }, [userId]);

  // 3. Обновленная функция сканирования
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

  const handleResetDatabase = async () => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { keys: 3 });
    setUserKeys(3);
    alert("🔄 База данных сброшена до 3 ключей.");
  };

  const getUserLevel = () => {
    if (userKeys >= 7) return { title: "Амбассадор Альянса 👑", color: "#ffaa00" };
    if (userKeys >= 5) return { title: "Местный житель 🌆", color: "#7f00ff" };
    return { title: "Гость города 🪐", color: "#00f0ff" };
  };

  const currentLevel = getUserLevel();

  // ... (здесь твой остальной код с рендером UI)
  return (
    <div style={{ background: '#0d0d13', color: '#ffffff', minHeight: '100vh', padding: '20px 20px 90px 20px' }}>
        {/* Здесь верни свой привычный JSX, который у тебя уже был */}
    </div>
  );
}