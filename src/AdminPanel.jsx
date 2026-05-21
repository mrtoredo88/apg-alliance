import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge'; // Используем единообразно vkBridge
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [debug, setDebug] = useState("Инициализация...");

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Обязательная инициализация моста
        await vkBridge.send('VKWebAppInit');
        
        // 2. Получение данных пользователя
        const user = await vkBridge.send('VKWebAppGetUserInfo');
        
        if (user.id !== 988504) {
          window.location.hash = '/';
          return;
        }
        
        setDebug("Авторизация успешна, загрузка...");
        fetchPartners();
      } catch (e) {
        console.error("Ошибка инициализации:", e);
        setDebug("Ошибка доступа: " + e.message);
        // Для отладки в браузере раскомментируйте строку ниже:
        // fetchPartners();
      }
    };
    init();
  }, []);

  const fetchPartners = async () => {
    try {
      const colRef = collection(db, "partners");
      const snapshot = await getDocs(colRef);
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(docs);
      setDebug(`Загружено партнеров: ${docs.length}`);
      
      console.log("Данные из Firebase в админке:", docs);
    } catch (e) {
      console.error("Ошибка Firebase:", e);
      setDebug("Ошибка загрузки данных: " + e.message);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель</h1>
      <p style={{ color: '#666' }}>Статус: {debug}</p>
      
      {partners.map(p => (
        <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10, borderRadius: 8 }}>
          <h3>{p.name || "Без названия"}</h3>
          <p>{p.description || "Нет описания"}</p>
          <button onClick={async () => { 
            await deleteDoc(doc(db, "partners", p.id)); 
            fetchPartners(); 
          }}>Удалить</button>
        </div>
      ))}
    </div>
  );
};