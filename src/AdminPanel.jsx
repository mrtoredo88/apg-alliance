import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    // Безопасный вызов
    const checkAccess = async () => {
      try {
        const user = await bridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) {
          window.location.hash = '/';
        } else {
          fetchPartners();
        }
      } catch (err) {
        // Если мы не в ВК, просто загружаем список (для разработки)
        console.warn("Не в среде ВК, загрузка партнеров напрямую...");
        fetchPartners();
      }
    };
    checkAccess();
  }, []);

const fetchPartners = async () => {
    try {
      // Выводим информацию о подключении
      console.log("DB config:", db.app.options); 
      
      const colRef = collection(db, "partners");
      const snapshot = await getDocs(colRef);
      
      console.log("Путь коллекции:", colRef.path);
      setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Ошибка:", e);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Админ-панель</h1>
      <p>Найдено партнеров: {partners.length}</p> 
      
      {partners.map(p => (
        <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10 }}>
          <h3>{p.name || "Без названия"}</h3>
          <button onClick={async () => { 
            await deleteDoc(doc(db, "partners", p.id)); 
            fetchPartners(); 
          }}>Удалить</button>
        </div>
      ))}
    </div>
  );
};