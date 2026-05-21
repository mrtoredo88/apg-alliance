import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [debug, setDebug] = useState("Инициализация...");

  const fetchPartners = async () => {
    try {
      setDebug("Загрузка данных из Firebase...");
      const colRef = collection(db, "partners");
      const snapshot = await getDocs(colRef);
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(docs);
      setDebug(`Успешно! Загружено партнеров: ${docs.length}`);
      console.log("Данные из Firebase в админке:", docs);
    } catch (e) {
      console.error("Ошибка Firebase:", e);
      setDebug("Ошибка загрузки данных: " + e.message);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        // Создаем "гонку": либо инициализация моста, либо таймаут в 1 секунду
        await Promise.race([
          vkBridge.send('VKWebAppInit'),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
        ]);
        
        const user = await vkBridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) {
          window.location.hash = '/';
          return;
        }
        
        fetchPartners();
      } catch (e) {
        console.warn("VK Bridge недоступен или таймаут, пробуем загрузку напрямую:", e.message);
        // Если мы не в ВК, просто вызываем загрузку данных напрямую
        fetchPartners();
      }
    };
    init();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель</h1>
      <p style={{ color: '#666' }}>Статус: {debug}</p>
      
      {partners.length === 0 && debug.includes("Успешно") && (
        <p style={{ color: 'red' }}>Коллекция partners найдена, но она пуста.</p>
      )}

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