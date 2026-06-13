import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import {
  collection, getDocs, doc, deleteDoc, addDoc, updateDoc
} from 'firebase/firestore';

// ─── Конфигурация ─────────────────────────────────────────────────────────────

const ADMIN_IDS = [988504]; // Добавь сюда свои VK ID

const CATEGORIES = [
  { id: 'food',   label: 'Еда',         emoji: '🍽️' },
  { id: 'beauty', label: 'Красота',     emoji: '💄' },
  { id: 'sport',  label: 'Спорт',       emoji: '💪' },
  { id: 'edu',    label: 'Обучение',    emoji: '📚' },
  { id: 'fun',    label: 'Развлечения', emoji: '🎉' },
  { id: 'other',  label: 'Другое',      emoji: '🏪' },
];

const EVENT_EMOJIS = ['🎉', '🎓', '🍕', '💆', '🏋️', '🎨', '🎤', '🤝', '🎁', '🌟', '🎭', '☕'];

const PARTNER_EMOJIS = ['🏪', '💆', '💄', '🍽️', '☕', '🎓', '🏋️', '💅', '🎉', '🛍️', '🎭', '🌿'];

// ─── Стили ────────────────────────────────────────────────────────────────────

const s = {
  page:       { padding: 16, fontFamily: '-apple-system, sans-serif', background: '#f2f3f5', minHeight: '100vh' },
  card:       { background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  h1:         { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#000' },
  h2:         { fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: '#000' },
  label:      { fontSize: 13, color: '#99A2AD', marginBottom: 4, display: 'block' },
  input:      { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10 },
  textarea:   { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, minHeight: 80, resize: 'vertical' },
  btn:        { padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPrimary: { background: '#3F8AE0', color: '#fff' },
  btnDanger:  { background: '#E64646', color: '#fff' },
  btnGray:    { background: '#f2f3f5', color: '#000' },
  btnSuccess: { background: '#4BB34B', color: '#fff' },
  row:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f2f3f5' },
  tag:        { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  emojiGrid:  { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  emojiBtn:   { width: 40, height: 40, borderRadius: 10, border: '2px solid transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f3f5' },
  select:     { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: '#fff' },
  tabs:       { display: 'flex', gap: 8, marginBottom: 16 },
  tab:        { flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'center' },
};

// ─── Компонент EmojiPicker ────────────────────────────────────────────────────

function EmojiPicker({ emojis, value, onChange }) {
  return (
    <div style={s.emojiGrid}>
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onChange(emoji)}
          style={{
            ...s.emojiBtn,
            border: value === emoji ? '2px solid #3F8AE0' : '2px solid transparent',
            background: value === emoji ? '#E8F3FF' : '#f2f3f5',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export const AdminPanel = () => {
  const [partners, setPartners] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('partners');
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  // Форма партнёра
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState('other');
  const [pEmoji, setPEmoji] = useState('🏪');
  const [pLogo, setPLogo] = useState('');

  // Форма события
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState('');
  const [ePartner, setEPartner] = useState('');
  const [eEmoji, setEEmoji] = useState('🎉');
  const [eDesc, setEDesc] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([
          vkBridge.send('VKWebAppInit'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
        ]);
      } catch (e) {}
      fetchData();
    };
    init();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
      ]);
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartnerForm = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪'); setPLogo('');
    setEditingPartner(null);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? '');
    setPDesc(p.description ?? '');
    setPCategory(p.category ?? 'other');
    setPEmoji(p.emoji ?? '🏪');
    setPLogo(p.logoUrl ?? '');
    window.scrollTo(0, 0);
  };

  const savePartner = async () => {
    if (!pName.trim()) return;
    const data = {
      name: pName.trim(),
      description: pDesc.trim(),
      category: pCategory,
      emoji: pEmoji,
      logoUrl: pLogo.trim(),
      categoryLabel: CATEGORIES.find(c => c.id === pCategory)?.label ?? '',
    };
    if (editingPartner) {
      await updateDoc(doc(db, 'partners', editingPartner.id), data);
    } else {
      await addDoc(collection(db, 'partners'), data);
    }
    resetPartnerForm();
    fetchData();
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Удалить партнёра?')) return;
    await deleteDoc(doc(db, 'partners', id));
    fetchData();
  };

  // ─── События ────────────────────────────────────────────────────────────────

  const resetEventForm = () => {
    setETitle(''); setEDate(''); setEPartner(''); setEEmoji('🎉'); setEDesc('');
    setEditingEvent(null);
  };

  const startEditEvent = (e) => {
    setEditingEvent(e);
    setETitle(e.title ?? '');
    setEDate(e.date ?? '');
    setEPartner(e.partner ?? '');
    setEEmoji(e.emoji ?? '🎉');
    setEDesc(e.description ?? '');
    window.scrollTo(0, 0);
  };

  const saveEvent = async () => {
    if (!eTitle.trim()) return;
    const data = {
      title: eTitle.trim(),
      date: eDate.trim(),
      partner: ePartner.trim(),
      emoji: eEmoji,
      description: eDesc.trim(),
    };
    if (editingEvent) {
      await updateDoc(doc(db, 'events', editingEvent.id), data);
    } else {
      await addDoc(collection(db, 'events'), data);
    }
    resetEventForm();
    fetchData();
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Удалить событие?')) return;
    await deleteDoc(doc(db, 'events', id));
    fetchData();
  };

  // ─── Рендер ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* Шапка */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>⚙️ Админ-панель</h1>
        <p style={{ color: '#99A2AD', fontSize: 13, margin: 0 }}>АПГ — Альянс Партнёров Города</p>
      </div>

      {/* Табы */}
      <div style={s.tabs}>
        <button
          style={{
            ...s.tab,
            background: activeTab === 'partners' ? '#3F8AE0' : '#fff',
            color: activeTab === 'partners' ? '#fff' : '#000',
          }}
          onClick={() => setActiveTab('partners')}
        >
          🤝 Партнёры ({partners.length})
        </button>
        <button
          style={{
            ...s.tab,
            background: activeTab === 'events' ? '#3F8AE0' : '#fff',
            color: activeTab === 'events' ? '#fff' : '#000',
          }}
          onClick={() => setActiveTab('events')}
        >
          🎉 События ({events.length})
        </button>
      </div>

      {/* ── ПАРТНЁРЫ ── */}
      {activeTab === 'partners' && (
        <>
          {/* Форма */}
          <div style={s.card}>
            <h2 style={s.h2}>
              {editingPartner ? `✏️ Редактировать: ${editingPartner.name}` : '➕ Новый партнёр'}
            </h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Студия красоты SEIUNA" value={pName} onChange={e => setPName(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Краткое описание партнёра..." value={pDesc} onChange={e => setPDesc(e.target.value)} />

            <label style={s.label}>Категория</label>
            <select style={s.select} value={pCategory} onChange={e => setPCategory(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
              ))}
            </select>

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PARTNER_EMOJIS} value={pEmoji} onChange={setPEmoji} />

            <label style={s.label}>Ссылка на логотип (URL)</label>
            <input style={s.input} placeholder="https://..." value={pLogo} onChange={e => setPLogo(e.target.value)} />

            {/* Превью */}
            {pLogo && (
              <div style={{ marginBottom: 10 }}>
                <label style={s.label}>Превью логотипа</label>
                <img src={pLogo} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPrimary, flex: 1 }} onClick={savePartner}>
                {editingPartner ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPartner && (
                <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartnerForm}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список партнёров */}
          <div style={s.card}>
            <h2 style={s.h2}>Все партнёры</h2>
            {loading ? (
              <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
            ) : partners.length === 0 ? (
              <p style={{ color: '#99A2AD', textAlign: 'center' }}>Партнёры не добавлены</p>
            ) : (
              partners.map(p => (
                <div key={p.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {p.logoUrl
                      ? <img src={p.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>
                        {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditPartner(p)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deletePartner(p.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── СОБЫТИЯ ── */}
      {activeTab === 'events' && (
        <>
          {/* Форма */}
          <div style={s.card}>
            <h2 style={s.h2}>
              {editingEvent ? `✏️ Редактировать: ${editingEvent.title}` : '➕ Новое событие'}
            </h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Мастер-класс по флористике" value={eTitle} onChange={e => setETitle(e.target.value)} />

            <label style={s.label}>Дата</label>
            <input style={s.input} placeholder="15 июня, 19:00" value={eDate} onChange={e => setEDate(e.target.value)} />

            <label style={s.label}>Партнёр / Место</label>
            <input style={s.input} placeholder="Студия AspireMod" value={ePartner} onChange={e => setEPartner(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Подробное описание события..." value={eDesc} onChange={e => setEDesc(e.target.value)} />

            <label style={s.label}>Эмодзи события</label>
            <EmojiPicker emojis={EVENT_EMOJIS} value={eEmoji} onChange={setEEmoji} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPrimary, flex: 1 }} onClick={saveEvent}>
                {editingEvent ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingEvent && (
                <button style={{ ...s.btn, ...s.btnGray }} onClick={resetEventForm}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список событий */}
          <div style={s.card}>
            <h2 style={s.h2}>Все события</h2>
            {loading ? (
              <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
            ) : events.length === 0 ? (
              <p style={{ color: '#99A2AD', textAlign: 'center' }}>События не добавлены</p>
            ) : (
              events.map(e => (
                <div key={e.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {e.emoji ?? '🎉'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>
                        {e.date && `📅 ${e.date}`}{e.partner && ` · ${e.partner}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditEvent(e)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteEvent(e.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};