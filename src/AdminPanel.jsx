import React, { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

const CATEGORIES = [
  { id: 'food',   label: 'Еда',         emoji: '🍽️' },
  { id: 'beauty', label: 'Красота',     emoji: '💄' },
  { id: 'sport',  label: 'Спорт',       emoji: '💪' },
  { id: 'edu',    label: 'Обучение',    emoji: '📚' },
  { id: 'fun',    label: 'Развлечения', emoji: '🎉' },
  { id: 'other',  label: 'Другое',      emoji: '🏪' },
];

const EVENT_EMOJIS = ['🎉','🎓','🍕','💆','🏋️','🎨','🎤','🤝','🎁','🌟','🎭','☕'];
const NEWS_EMOJIS  = ['📢','🔥','🌟','🎁','📅','💡','🤝','🏆','🎉','📸','🗞️','✨'];
const PARTNER_EMOJIS = ['🏪','💆','💄','🍽️','☕','🎓','🏋️','💅','🎉','🛍️','🎭','🌿'];

const s = {
  page:    { padding: 16, fontFamily: '-apple-system, sans-serif', background: '#f2f3f5', minHeight: '100vh' },
  card:    { background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  h1:      { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#000' },
  h2:      { fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: '#000' },
  label:   { fontSize: 13, color: '#99A2AD', marginBottom: 4, display: 'block' },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10 },
  textarea:{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, minHeight: 80, resize: 'vertical' },
  btn:     { padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPri:  { background: '#3F8AE0', color: '#fff' },
  btnDanger:{ background: '#E64646', color: '#fff' },
  btnGray: { background: '#f2f3f5', color: '#000' },
  row:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f2f3f5' },
  emojiGrid:{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  emojiBtn: { width: 40, height: 40, borderRadius: 10, border: '2px solid transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f3f5' },
  select:  { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: '#fff' },
  tabs:    { display: 'flex', gap: 8, marginBottom: 16 },
  tab:     { flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'center' },
};

function EmojiPicker({ emojis, value, onChange }) {
  return (
    <div style={s.emojiGrid}>
      {emojis.map(emoji => (
        <button key={emoji} onClick={() => onChange(emoji)} style={{ ...s.emojiBtn, border: value === emoji ? '2px solid #3F8AE0' : '2px solid transparent', background: value === emoji ? '#E8F3FF' : '#f2f3f5' }}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

export const AdminPanel = () => {
  const [partners, setPartners]     = useState([]);
  const [events, setEvents]         = useState([]);
  const [news, setNews]             = useState([]);
  const [notifs, setNotifs]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('partners');
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingEvent, setEditingEvent]     = useState(null);
  const [editingNews, setEditingNews]       = useState(null);

  // Форма партнёра
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState('other');
  const [pEmoji, setPEmoji] = useState('🏪');
  const [pLogo, setPLogo] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pHours, setPHours] = useState('');
  const [pSocial, setPSocial] = useState('');
  const [pOffer, setPOffer] = useState('');

  // Форма новости
  const [nTitle, setNTitle] = useState('');
  const [nText, setNText]   = useState('');
  const [nEmoji, setNEmoji] = useState('📢');
  const [nImage, setNImage] = useState('');

  // Форма уведомления
  const [ntTitle, setNtTitle] = useState('');
  const [ntBody, setNtBody]   = useState('');
  const [ntEmoji, setNtEmoji] = useState('🔔');

  // Форма события
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState('');
  const [ePartner, setEPartner] = useState('');
  const [eEmoji, setEEmoji] = useState('🎉');
  const [eDesc, setEDesc] = useState('');
  const [eSocial, setESocial] = useState('');
  const [eAddress, setEAddress] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([vkBridge.send('VKWebAppInit'), new Promise((_, r) => setTimeout(() => r(new Error()), 1000))]);
      } catch (e) {}
      fetchData();
    };
    init();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pSnap, eSnap, nSnap, ntSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
      ]);
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNotifs(ntSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartnerForm = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪'); setPLogo('');
    setPPhone(''); setPAddress(''); setPHours(''); setPSocial(''); setPOffer('');
    setEditingPartner(null);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? ''); setPDesc(p.description ?? ''); setPCategory(p.category ?? 'other');
    setPEmoji(p.emoji ?? '🏪'); setPLogo(p.logoUrl ?? ''); setPPhone(p.phone ?? '');
    setPAddress(p.address ?? ''); setPHours(p.hours ?? ''); setPSocial(p.socialUrl ?? '');
    setPOffer(p.offer ?? '');
    window.scrollTo(0, 0);
  };

  const savePartner = async () => {
    if (!pName.trim()) return;
    const data = {
      name: pName.trim(), description: pDesc.trim(), category: pCategory,
      emoji: pEmoji, logoUrl: pLogo.trim(),
      categoryLabel: CATEGORIES.find(c => c.id === pCategory)?.label ?? '',
      phone: pPhone.trim(), address: pAddress.trim(),
      hours: pHours.trim(), socialUrl: pSocial.trim(), offer: pOffer.trim(),
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

  // ─── Новости ────────────────────────────────────────────────────────────────

  const resetNewsForm = () => {
    setNTitle(''); setNText(''); setNEmoji('📢'); setNImage('');
    setEditingNews(null);
  };

  const startEditNews = (item) => {
    setEditingNews(item);
    setNTitle(item.title ?? ''); setNText(item.text ?? '');
    setNEmoji(item.emoji ?? '📢'); setNImage(item.imageUrl ?? '');
    window.scrollTo(0, 0);
  };

  const saveNews = async () => {
    if (!nTitle.trim() || !nText.trim()) return;
    const data = {
      title: nTitle.trim(),
      text: nText.trim(),
      emoji: nEmoji,
      imageUrl: nImage.trim(),
      ...(editingNews ? {} : { createdAt: serverTimestamp() }),
    };
    if (editingNews) {
      await updateDoc(doc(db, 'news', editingNews.id), data);
    } else {
      await addDoc(collection(db, 'news'), data);
    }
    resetNewsForm();
    fetchData();
  };

  const deleteNews = async (id) => {
    if (!window.confirm('Удалить новость?')) return;
    await deleteDoc(doc(db, 'news', id));
    fetchData();
  };

  // ─── Уведомления ────────────────────────────────────────────────────────────

  const resetNotifForm = () => { setNtTitle(''); setNtBody(''); setNtEmoji('🔔'); };

  const sendNotif = async () => {
    if (!ntTitle.trim()) return;
    await addDoc(collection(db, 'notifications'), {
      title: ntTitle.trim(),
      body: ntBody.trim(),
      emoji: ntEmoji,
      createdAt: serverTimestamp(),
    });
    resetNotifForm();
    fetchData();
  };

  const deleteNotif = async (id) => {
    if (!window.confirm('Удалить уведомление?')) return;
    await deleteDoc(doc(db, 'notifications', id));
    fetchData();
  };

  // ─── События ────────────────────────────────────────────────────────────────

  const resetEventForm = () => {
    setETitle(''); setEDate(''); setEPartner(''); setEEmoji('🎉');
    setEDesc(''); setESocial(''); setEAddress('');
    setEditingEvent(null);
  };

  const startEditEvent = (e) => {
    setEditingEvent(e);
    setETitle(e.title ?? ''); setEDate(e.date ?? ''); setEPartner(e.partner ?? '');
    setEEmoji(e.emoji ?? '🎉'); setEDesc(e.description ?? '');
    setESocial(e.socialUrl ?? ''); setEAddress(e.address ?? '');
    window.scrollTo(0, 0);
  };

  const saveEvent = async () => {
    if (!eTitle.trim()) return;
    const data = {
      title: eTitle.trim(), date: eDate.trim(), partner: ePartner.trim(),
      emoji: eEmoji, description: eDesc.trim(),
      socialUrl: eSocial.trim(), address: eAddress.trim(),
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

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>⚙️ Админ-панель</h1>
        <p style={{ color: '#99A2AD', fontSize: 13, margin: 0 }}>АПГ — Альянс Партнёров Города</p>
      </div>

      <div style={s.tabs}>
        <button style={{ ...s.tab, background: activeTab === 'partners' ? '#3F8AE0' : '#fff', color: activeTab === 'partners' ? '#fff' : '#000' }} onClick={() => setActiveTab('partners')}>
          🤝 Партнёры ({partners.length})
        </button>
        <button style={{ ...s.tab, background: activeTab === 'events' ? '#3F8AE0' : '#fff', color: activeTab === 'events' ? '#fff' : '#000' }} onClick={() => setActiveTab('events')}>
          🎉 События ({events.length})
        </button>
        <button style={{ ...s.tab, background: activeTab === 'news' ? '#3F8AE0' : '#fff', color: activeTab === 'news' ? '#fff' : '#000' }} onClick={() => setActiveTab('news')}>
          📢 Новости ({news.length})
        </button>
        <button style={{ ...s.tab, background: activeTab === 'notifs' ? '#3F8AE0' : '#fff', color: activeTab === 'notifs' ? '#fff' : '#000' }} onClick={() => setActiveTab('notifs')}>
          🔔 Уведомления ({notifs.length})
        </button>
      </div>

      {/* ── ПАРТНЁРЫ ── */}
      {activeTab === 'partners' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingPartner ? `✏️ ${editingPartner.name}` : '➕ Новый партнёр'}</h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Студия красоты SEIUNA" value={pName} onChange={e => setPName(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Краткое описание..." value={pDesc} onChange={e => setPDesc(e.target.value)} />

            <label style={s.label}>Специальное предложение для участников АПГ 🎁</label>
            <input style={s.input} placeholder="Скидка 10% на первый визит" value={pOffer} onChange={e => setPOffer(e.target.value)} />

            <label style={s.label}>Категория</label>
            <select style={s.select} value={pCategory} onChange={e => setPCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PARTNER_EMOJIS} value={pEmoji} onChange={setPEmoji} />

            <label style={s.label}>Ссылка на логотип (URL)</label>
            <input style={s.input} placeholder="https://..." value={pLogo} onChange={e => setPLogo(e.target.value)} />
            {pLogo && <img src={pLogo} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} onError={e => e.target.style.display = 'none'} />}

            <label style={s.label}>Телефон</label>
            <input style={s.input} placeholder="+7 (499) 123-45-67" value={pPhone} onChange={e => setPPhone(e.target.value)} />

            <label style={s.label}>Адрес</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={pAddress} onChange={e => setPAddress(e.target.value)} />

            <label style={s.label}>Часы работы</label>
            <input style={s.input} placeholder="Пн-Пт 10:00-20:00, Сб-Вс 11:00-18:00" value={pHours} onChange={e => setPHours(e.target.value)} />

            <label style={s.label}>Соцсеть / сайт</label>
            <input style={s.input} placeholder="https://vk.com/..." value={pSocial} onChange={e => setPSocial(e.target.value)} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={savePartner}>
                {editingPartner ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPartner && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartnerForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все партнёры</h2>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : partners.length === 0 ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет партнёров</p>
              : partners.map(p => (
                <div key={p.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {p.logoUrl
                      ? <img src={p.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>
                        {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                        {p.offer && ' · 🎁'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditPartner(p)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deletePartner(p.id)}>🗑️</button>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}

      {/* ── СОБЫТИЯ ── */}
      {activeTab === 'events' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingEvent ? `✏️ ${editingEvent.title}` : '➕ Новое событие'}</h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Мастер-класс по флористике" value={eTitle} onChange={e => setETitle(e.target.value)} />

            <label style={s.label}>Дата</label>
            <input style={s.input} placeholder="15 июня, 19:00" value={eDate} onChange={e => setEDate(e.target.value)} />

            <label style={s.label}>Партнёр / Место</label>
            <input style={s.input} placeholder="Студия AspireMod" value={ePartner} onChange={e => setEPartner(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Подробное описание..." value={eDesc} onChange={e => setEDesc(e.target.value)} />

            <label style={s.label}>Ссылка на соцсеть / регистрацию</label>
            <input style={s.input} placeholder="https://vk.com/event..." value={eSocial} onChange={e => setESocial(e.target.value)} />

            <label style={s.label}>Адрес проведения</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={eAddress} onChange={e => setEAddress(e.target.value)} />

            <label style={s.label}>Эмодзи события</label>
            <EmojiPicker emojis={EVENT_EMOJIS} value={eEmoji} onChange={setEEmoji} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={saveEvent}>
                {editingEvent ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingEvent && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetEventForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все события</h2>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : events.length === 0 ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет событий</p>
              : events.map(e => (
                <div key={e.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{e.emoji ?? '🎉'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>{e.date && `📅 ${e.date}`}{e.partner && ` · ${e.partner}`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditEvent(e)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteEvent(e.id)}>🗑️</button>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}
      {/* ── НОВОСТИ ── */}
      {activeTab === 'news' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingNews ? `✏️ ${editingNews.title}` : '➕ Новая новость'}</h2>

            <label style={s.label}>Заголовок *</label>
            <input style={s.input} placeholder="Новый партнёр АПГ!" value={nTitle} onChange={e => setNTitle(e.target.value)} />

            <label style={s.label}>Текст новости *</label>
            <textarea style={{ ...s.textarea, minHeight: 120 }} placeholder="Подробный текст..." value={nText} onChange={e => setNText(e.target.value)} />

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={NEWS_EMOJIS} value={nEmoji} onChange={setNEmoji} />

            <label style={s.label}>URL картинки (необязательно)</label>
            <input style={s.input} placeholder="https://i.ibb.co/..." value={nImage} onChange={e => setNImage(e.target.value)} />
            {nImage && (
              <img src={nImage} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} onError={e => e.target.style.display = 'none'} />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={saveNews}>
                {editingNews ? '💾 Сохранить' : '➕ Опубликовать'}
              </button>
              {editingNews && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetNewsForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все новости</h2>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : news.length === 0 ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет новостей</p>
              : news.map(item => {
                const dateStr = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
                return (
                  <div key={item.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.emoji ?? '📢'}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: '#99A2AD' }}>
                          {dateStr && `📅 ${dateStr} · `}
                          {item.text.length > 50 ? item.text.slice(0, 50) + '…' : item.text}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditNews(item)}>✏️</button>
                      <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteNews(item.id)}>🗑️</button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      {/* ── УВЕДОМЛЕНИЯ ── */}
      {activeTab === 'notifs' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>🔔 Отправить уведомление</h2>
            <p style={{ color: '#99A2AD', fontSize: 13, margin: '0 0 12px' }}>
              Уведомление появится у всех пользователей в разделе «Уведомления» при следующем открытии приложения.
            </p>

            <label style={s.label}>Заголовок *</label>
            <input style={s.input} placeholder="Новый партнёр АПГ!" value={ntTitle} onChange={e => setNtTitle(e.target.value)} />

            <label style={s.label}>Текст (необязательно)</label>
            <textarea style={s.textarea} placeholder="Подробности..." value={ntBody} onChange={e => setNtBody(e.target.value)} />

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={NEWS_EMOJIS} value={ntEmoji} onChange={setNtEmoji} />

            <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={sendNotif}>
              🔔 Опубликовать
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>История уведомлений</h2>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : notifs.length === 0 ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет уведомлений</p>
              : notifs.map(n => {
                const dateStr = n.createdAt?.toDate
                  ? n.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={n.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.emoji ?? '🔔'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: '#99A2AD' }}>
                          {dateStr && `📅 ${dateStr}`}
                          {n.body && ` · ${n.body.length > 40 ? n.body.slice(0, 40) + '…' : n.body}`}
                        </div>
                      </div>
                    </div>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12, flexShrink: 0, marginLeft: 8 }} onClick={() => deleteNotif(n.id)}>🗑️</button>
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};