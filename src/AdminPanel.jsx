import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [status, setStatus] = useState("Загрузка...");
  
  // Состояние для формы
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // ... (useEffect остается прежним) ...
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([
          vkBridge.send('VKWebAppInit'),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
        ]);
        const user = await vkBridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) return;
        fetchPartners();
      } catch (e) {
        fetchPartners();
      }
    };
    init();
  }, []);

  const fetchPartners = async () => {
    const colRef = collection(db, "partners");
    const snapshot = await getDocs(colRef);
    setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    setStatus("Обновлено");
  };

  // Функция добавления
  const handleAddPartner = async () => {
    if (!newName) return alert("Введите название!");
    try {
      await addDoc(collection(db, "partners"), {
        name: newName,
        description: newDesc
      });
      setNewName("");
      setNewDesc("");
      fetchPartners(); // Обновляем список
    } catch (e) {
      alert("Ошибка при добавлении: " + e.message);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель</h1>
      
      {/* ФОРМА ДОБАВЛЕНИЯ */}
      <div style={{ background: '#f4f4f4', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3>Добавить партнера</h3>
        <input 
          placeholder="Название" 
          value={newName} 
          onChange={(e) => setNewName(e.target.value)} 
          style={{ display: 'block', width: '100%', padding: 8, marginBottom: 5 }} 
        />
        <input 
          placeholder="Описание" 
          value={newDesc} 
          onChange={(e) => setNewDesc(e.target.value)} 
          style={{ display: 'block', width: '100%', padding: 8, marginBottom: 10 }} 
        />
        <button onClick={handleAddPartner} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Добавить в базу
        </button>
      </div>

      <p>Найдено: {partners.length}</p>
      {partners.map(p => (
        <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10, borderRadius: 8 }}>
          <h3>{p.name}</h3>
          <p>{p.description}</p>
          <button onClick={async () => { await deleteDoc(doc(db, "partners", p.id)); fetchPartners(); }}>Удалить</button>
        </div>
      ))}
    </div>
  );
};