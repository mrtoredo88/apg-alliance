import React, { useState, useEffect } from 'react';
import { Scanner } from './Scanner.jsx';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export function App() {
  const [userKeys, setUserKeys] = useState(3); // Начальное состояние
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('main');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(1);

  // Загружаем данные из Firestore при запуске
  useEffect(() => {
    const fetchData = async () => {
      const userRef = doc(db, "users", "user123");
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setUserKeys(docSnap.data().keys);
      }
    };
    fetchData();
  }, []);

  const getUserLevel = () => {
    if (userKeys >= 7) return { title: "Амбассадор Альянса 👑", color: "#ffaa00" };
    if (userKeys >= 5) return { title: "Местный житель 🌆", color: "#7f00ff" };
    return { title: "Гость города 🪐", color: "#00f0ff" };
  };

  const currentLevel = getUserLevel();
  const categories = [
    { id: 'all', name: 'Все', icon: '⚡' },
    { id: 'coffee', name: 'Кофе', icon: '☕' },
    { id: 'food', name: 'Еда', icon: '🍔' },
    { id: 'beauty', name: 'Красота', icon: '💅' },
    { id: 'bars', name: 'Бары', icon: '🍹' },
  ];

  const promotions = [
    { id: 1, category: 'coffee', partner: 'Кофемания', title: 'Секретный пряный раф', text: 'Покажи 1 ключ и получи авторский десерт в подарок при заказе кофе.', color: '#ff007f' },
    { id: 2, category: 'beauty', partner: 'Красота & Вайб', title: 'Вечерний Слот на массаж', text: 'Свободное время на 19:00 со скидкой 20% для своих жителей АПГ.', color: '#7f00ff' },
    { id: 3, category: 'food', partner: 'Бургер Лаб', title: 'Крафтовый комбо-обед', text: 'Скидка 15% на любое меню при наличии статуса "Гость города".', color: '#00f0ff' },
    { id: 4, category: 'bars', partner: 'Неон Бар', title: 'Фирменный коктейль "АПГ"', text: 'Два напитка по цене одного каждый четверг для держателей ключей.', color: '#ffaa00' }
  ];

  const mapPlaces = [
    { id: 1, name: 'Кофемания', type: 'Кофейня', icon: '☕', color: '#ff007f', x: '25%', y: '30%' },
    { id: 2, name: 'Красота & Вайб', type: 'Салон массажа', icon: '💅', color: '#7f00ff', x: '70%', y: '20%' },
    { id: 3, name: 'Бургер Лаб', type: 'Крафт-бургерная', icon: '🍔', color: '#00f0ff', x: '40%', y: '65%' },
    { id: 4, name: 'Неон Бар', type: 'Секретный бар', icon: '🍹', color: '#ffaa00', x: '75%', y: '70%' },
  ];

  const currentPlaceInfo = mapPlaces.find(p => p.id === selectedPlace);
  const filteredPromotions = selectedCategory === 'all' ? promotions : promotions.filter(item => item.category === selectedCategory);

  const handleConfirmScan = async (partnerName) => {
    const userRef = doc(db, "users", "user123");
    try {
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        await updateDoc(userRef, { keys: increment(1) });
        setUserKeys(prev => prev + 1);
      } else {
        await setDoc(userRef, { keys: 4 });
        setUserKeys(4);
      }
      alert(`🎉 Успешно! Ты отсканировал "${partnerName}". +1 Ключ добавлен в облако! 🔑`);
    } catch (e) {
      console.error("Ошибка базы данных: ", e);
    }
    setIsScannerOpen(false);
  };

  const handleResetDatabase = async () => {
    const userRef = doc(db, "users", "user123");
    await setDoc(userRef, { keys: 3 });
    setUserKeys(3);
    alert("🔄 База данных сброшена до 3 ключей.");
  };

  // ... (Остальная часть кода интерфейса остается такой же) ...
  return (
    <div style={{ background: '#0d0d13', color: '#ffffff', minHeight: '100vh', padding: '20px 20px 90px 20px', fontFamily: '-apple-system, sans-serif', boxSizing: 'border-box' }}>
        {/* ... тут твой существующий код рендера интерфейса ... */}
    </div>
  );
}