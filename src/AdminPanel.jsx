import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  // Состояние для редактирования (храним временные значения полей)
  const [editValues, setEditValues] = useState({});

useEffect(() => {
  bridge.send('VKWebAppGetUserInfo').then(user => {
    if (user.id !== 988504) { // Ваш ID
       window.location.hash = '/'; // Редирект для всех остальных
    } else {
       fetchPartners();
    }
  });
}, []);

  const fetchPartners = async () => {
    const snapshot = await getDocs(collection(db, "partners"));
    setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleUpdate = async (id) => {
    const p = editValues[id];
    if (!p) return;
    await updateDoc(doc(db, "partners", id), {
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl
    });
    alert("Данные обновлены!");
    fetchPartners();
  };

  const handleChange = (id, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...(prev[id] || partners.find(p => p.id === id)), [field]: value }
    }));
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель (Редактор)</h1>
      {partners.map(p => {
        const data = editValues[p.id] || p;
        return (
          <div key={p.id} style={{ border: '1px solid #ddd', margin: '10px 0', padding: 15, borderRadius: 8 }}>
            <input 
              value={data.name} 
              onChange={(e) => handleChange(p.id, 'name', e.target.value)}
              placeholder="Название"
              style={{ width: '100%', marginBottom: 5 }}
            />
            <textarea 
              value={data.description || ''} 
              onChange={(e) => handleChange(p.id, 'description', e.target.value)}
              placeholder="Описание"
              style={{ width: '100%', height: 60, marginBottom: 5 }}
            />
            <input 
              value={data.imageUrl || ''} 
              onChange={(e) => handleChange(p.id, 'imageUrl', e.target.value)}
              placeholder="Ссылка на картинку"
              style={{ width: '100%', marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleUpdate(p.id)}>Сохранить</button>
              <button onClick={async () => { 
                if(confirm("Удалить партнера?")) { await deleteDoc(doc(db, "partners", p.id)); fetchPartners(); }
              }}>Удалить</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};