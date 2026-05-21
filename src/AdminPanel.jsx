import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [newPartner, setNewPartner] = useState({ name: '', description: '', imageUrl: '' });

  useEffect(() => {
    bridge.send('VKWebAppGetUserInfo')
      .then(user => {
        if (user.id !== 988504) window.location.hash = '/';
        else fetchPartners();
      })
      .catch(() => fetchPartners());
  }, []);

  const fetchPartners = async () => {
    const snapshot = await getDocs(collection(db, "partners"));
    setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleAdd = async () => {
    if (!newPartner.name) return;
    await addDoc(collection(db, "partners"), newPartner);
    setNewPartner({ name: '', description: '', imageUrl: '' });
    fetchPartners();
  };

  const handleUpdate = async (id) => {
    const p = editValues[id];
    if (!p) return;
    await updateDoc(doc(db, "partners", id), {
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl
    });
    alert("Обновлено!");
    fetchPartners();
  };

  const handleChange = (id, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...(prev[id] || partners.find(p => p.id === id)), [field]: value }
    }));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Админ-панель</h1>
      {partners.map(p => (
        <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10 }}>
          <input value={(editValues[p.id] || p).name} onChange={(e) => handleChange(p.id, 'name', e.target.value)} />
          <button onClick={() => handleUpdate(p.id)}>Сохранить</button>
          <button onClick={() => deleteDoc(doc(db, "partners", p.id)).then(fetchPartners)}>Удалить</button>
        </div>
      ))}
    </div>
  );
};