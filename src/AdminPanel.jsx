import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [events, setEvents] = useState([]);
  
  // Состояние форм
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([
          vkBridge.send('VKWebAppInit'),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
        ]);
        const user = await vkBridge.send('VKWebAppGetUserInfo');
        if (user.id !== 988504) return;
        fetchData();
      } catch (e) {
        fetchData();
      }
    };
    init();
  }, []);

  const fetchData = async () => {
    // Получаем обе коллекции
    const pSnap = await getDocs(collection(db, "partners"));
    setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    const eSnap = await getDocs(collection(db, "events"));
    setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const addPartner = async () => {
    if (!newName) return;
    await addDoc(collection(db, "partners"), { name: newName, description: newDesc });
    setNewName(""); setNewDesc("");
    fetchData();
  };

  const addEvent = async () => {
    if (!newEventTitle) return;
    await addDoc(collection(db, "events"), { title: newEventTitle });
    setNewEventTitle("");
    fetchData();
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Админ-панель</h1>

      {/* Блок событий */}
      <section style={{ marginBottom: 40, background: '#eef', padding: 15, borderRadius: 8 }}>
        <h2>События в карусели</h2>
        <input placeholder="Название события" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
        <button onClick={addEvent} style={{ marginTop: 5 }}>Добавить событие</button>
        {events.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 5, borderBottom: '1px solid #ccc' }}>
            {e.title}
            <button onClick={async () => { await deleteDoc(doc(db, "events", e.id)); fetchData(); }}>Удалить</button>
          </div>
        ))}
      </section>

      {/* Блок партнеров */}
      <section style={{ background: '#f4f4f4', padding: 15, borderRadius: 8 }}>
        <h2>Партнеры</h2>
        <input placeholder="Название партнера" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 5 }} />
        <input placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10 }} />
        <button onClick={addPartner}>Добавить партнера</button>
        {partners.map(p => (
          <div key={p.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10, borderRadius: 8 }}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <button onClick={async () => { await deleteDoc(doc(db, "partners", p.id)); fetchData(); }}>Удалить</button>
          </div>
        ))}
      </section>
    </div>
  );
};