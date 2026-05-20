import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Scanner } from './Scanner.jsx';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export function App() {
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(3);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('main');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(1);

  // 1. Инициализация VK Bridge и получение ID пользователя
  useEffect(() => {
    bridge.send('VKWebAppInit');
    bridge.send('VKWebAppGetUserInfo')
      .then((data) => setUserId(data.id.toString()))
      .catch((err) => {
        console.log('VK Bridge error, using test_user:', err);
        setUserId("test_user");
      });
  }, []);

  // 2. Загрузка данных из Firebase, когда получен userId
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setUserKeys(docSnap.data().keys);
      }
    };
    fetchData();
  }, [userId]);

  const getUserLevel = () => {
    if (userKeys >= 7) return { title: "Амбассадор Альянса 👑", color: "#ffaa00" };
    if (userKeys >= 5) return { title: "Местный житель 🌆", color: "#7f00ff" };
    return { title: "Гость города 🪐", color: "#00f0ff" };
  };

  const currentLevel = getUserLevel();

  const handleConfirmScan = async (partnerName) => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);

    try {
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        await updateDoc(userRef, { keys: increment(1) });
        setUserKeys(prev => prev + 1);
      } else {
        await setDoc(userRef, { keys: 4 });
        setUserKeys(4);
      }
      alert(`🎉 Успешно! Ты отсканировал "${partnerName}". +1 Ключ в твоем профиле! 🔑`);
    } catch (e) {
      console.error("Ошибка базы данных: ", e);
    }
    setIsScannerOpen(false);
  };

  const handleResetDatabase = async () => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { keys: 3 });
    setUserKeys(3);
    alert("🔄 Баланс сброшен до 3 ключей.");
  };

  const categories = [{ id: 'all', name: 'Все', icon: '⚡' }, { id: 'coffee', name: 'Кофе', icon: '☕' }, { id: 'food', name: 'Еда', icon: '🍔' }, { id: 'beauty', name: 'Красота', icon: '💅' }, { id: 'bars', name: 'Бары', icon: '🍹' }];
  const mapPlaces = [
    { id: 1, name: 'Кофемания', icon: '☕', color: '#ff007f', x: '25%', y: '30%' },
    { id: 2, name: 'Красота & Вайб', icon: '💅', color: '#7f00ff', x: '70%', y: '20%' },
    { id: 3, name: 'Бургер Лаб', icon: '🍔', color: '#00f0ff', x: '40%', y: '65%' },
    { id: 4, name: 'Неон Бар', icon: '🍹', color: '#ffaa00', x: '75%', y: '70%' }
  ];

  return (
    <div style={{ background: '#0d0d13', color: '#ffffff', minHeight: '100vh', padding: '20px 20px 90px 20px', fontFamily: '-apple-system, sans-serif' }}>
      {activeScreen === 'main' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ margin: 0 }}>🌆 АПГ | Альянс</h2>
            <span style={{ fontSize: '12px', color: '#666', cursor: 'pointer' }} onClick={handleResetDatabase}>🔄 Сброс</span>
          </div>
          
          <div style={{ background: '#161625', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontWeight: 'bold' }}>Привет, ID: {userId || '...'}</div>
            <div style={{ color: currentLevel.color }}>{currentLevel.title}</div>
            <div style={{ fontSize: '22px', color: '#00f0ff', marginTop: '10px' }}>🔑 {userKeys}</div>
          </div>

          <button onClick={() => setIsScannerOpen(true)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(90deg, #ff007f, #7f00ff)', color: 'white', fontWeight: 'bold' }}>
            ✨ Сканировать QR
          </button>
        </div>
      )}

      {/* Остальной интерфейс (Карта, Профиль) остается без изменений */}
      
      <Scanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        mapPlaces={mapPlaces} 
        onConfirm={handleConfirmScan} 
      />
    </div>
  );
}