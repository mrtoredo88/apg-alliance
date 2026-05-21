import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const user = await bridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) {
          window.location.hash = '/';
          return;
        }
      } catch (e) {
        console.warn("VK Bridge недоступен, продолжаем...");
      }
      fetchPartners();
    };
    init();
  }, []);

  const fetchPartners = async () => {
    try {
      const colRef = collection(db, "partners");
      const snapshot = await getDocs(colRef);
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(docs);
      
      setDebugInfo(`Успешно. Документов в 'partners': ${docs.length}`);
      console.log("Данные из Firebase:", docs);
    } catch (e) {
      setDebugInfo("Ошибка: " + e.message);
      console.error(e);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель</h1>
      <p style={{ color: '#666', fontSize: '12px' }}>{debugInfo}</p>
      
      {partners.length === 0 && (
        <div style={{ padding: 20, background: '#fff3cd' }}>
          Список пуст. Проверьте, что в Firebase коллекция называется именно <b>partners</b>.
        </div>
      )}
      
{partners.map(p => (
  <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10, borderRadius: 8 }}>
    <h3>{p.name || "Без названия"}</h3>
    {/* Добавляем проверку существования полей */}
    <p>{p.description || "Описание отсутствует"}</p>
    {p.imageUrl && <img src={p.imageUrl} alt="партнер" style={{width: 50}} />}
    
    <button onClick={async () => { 
      await deleteDoc(doc(db, "partners", p.id)); 
      fetchPartners(); 
    }}>Удалить</button>
  </div>
))}