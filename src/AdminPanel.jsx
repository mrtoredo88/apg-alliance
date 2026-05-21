import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await bridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) {
          window.location.hash = '/';
          return;
        }
      } catch (e) {
        console.warn("VK Bridge недоступен");
      }
      fetchPartners();
    };
    init();
  }, []);

  const fetchPartners = async () => {
    try {
      const snapshot = await getDocs(collection(db, "partners"));
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