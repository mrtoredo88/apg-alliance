import React, { useState, useEffect, useCallback } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

// VK user IDs, которым разрешён доступ к админ-панели
const ADMIN_IDS = [988504];

const CATEGORIES = [
  { id: 'food',   label: 'Еда',         emoji: '🍽️' },
  { id: 'beauty', label: 'Красота',     emoji: '💄' },
  { id: 'sport',  label: 'Спорт',       emoji: '💪' },
  { id: 'edu',    label: 'Обучение',    emoji: '📚' },
  { id: 'fun',    label: 'Развлечения', emoji: '🎉' },
  { id: 'other',  label: 'Другое',      emoji: '🏪' },
];

const EVENT_EMOJIS = ['🎉','🎓','🍕','💆','🏋️','🎨','🎤','🤝','🎁','🌟','🎭','☕'];
const PARTNER_EMOJIS = ['🏪','💆','💄','🍽️','☕','🎓','🏋️','💅','🎉','🛍️','🎭','🌿'];

const T = {
  bg:      '#f2f3f5',
  card:    '#fff',
  border:  '#e0e0e0',
  blue:    '#3F8AE0',
  red:     '#E64646',
  green:   '#4BB34B',
  gold:    '#C9A84C',
  text:    '#000',
  sub:     '#99A2AD',
  input:   '#fff',
};

const s = {
  page:     { padding: 16, fontFamily: '-apple-system, sans-serif', background: T.bg, minHeight: '100vh' },
  card:     { background: T.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  h1:       { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: T.text },
  h2:       { fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: T.text },
  label:    { fontSize: 13, color: T.sub, marginBottom: 4, display: 'block' },
  input:    { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: T.input },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, minHeight: 80, resize: 'vertical', background: T.input },
  btn:      { padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPri:   { background: T.blue,  color: '#fff' },
  btnDanger:{ background: T.red,   color: '#fff' },
  btnGray:  { background: T.bg,    color: T.text },
  row:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.bg}` },
  emojiGrid:{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  emojiBtn: { width: 40, height: 40, borderRadius: 10, border: '2px solid transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg },
  select:   { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: T.input },
  tabs:     { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' },
  tab:      { flex: '0 0 auto', padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};

// ─── EmojiPicker ─────────────────────────────────────────────────────────────

function EmojiPicker({ emojis, value, onChange }) {
  return (
    <div style={s.emojiGrid}>
      {emojis.map(emoji => (
        <button key={emoji} onClick={() => onChange(emoji)}
          style={{ ...s.emojiBtn, border: value === emoji ? `2px solid ${T.blue}` : '2px solid transparent', background: value === emoji ? '#E8F3FF' : T.bg }}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, color = T.blue }) {
  return (
    <div style={{ background: T.card, borderRadius: 14, padding: '14px 12px', textAlign: 'center', border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: 2, lineHeight: '15px' }}>{label}</div>
    </div>
  );
}

// ─── AccessGuard ─────────────────────────────────────────────────────────────

function AccessGuard({ onAllow }) {
  const [status, setStatus] = useState('checking'); // checking | denied | no_config
  const [vkId, setVkId] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        await Promise.race([
          vkBridge.send('VKWebAppInit'),
          new Promise((_, r) => setTimeout(() => r(), 1000)),
        ]).catch(() => {});

        const userData = await Promise.race([
          vkBridge.send('VKWebAppGetUserInfo'),
          new Promise((_, r) => setTimeout(() => r(null), 3000)),
        ]).catch(() => null);

        if (!userData) {
          // Скорее всего dev-среда — пропускаем если список пустой
          if (ADMIN_IDS.length === 0) { onAllow(); return; }
          setStatus('denied');
          return;
        }

        setVkId(userData.id);

        if (ADMIN_IDS.length === 0) {
          // Список не настроен — показываем VK ID чтобы добавить
          setStatus('no_config');
          return;
        }

        if (ADMIN_IDS.includes(userData.id)) {
          onAllow();
        } else {
          setStatus('denied');
        }
      } catch {
        if (ADMIN_IDS.length === 0) { onAllow(); return; }
        setStatus('denied');
      }
    };
    check();
  }, [onAllow]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg }}>
        <p style={{ color: T.sub, fontSize: 15 }}>Проверка доступа...</p>
      </div>
    );
  }

  if (status === 'no_config') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg, padding: 24 }}>
        <div style={{ background: T.card, borderRadius: 20, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <h2 style={{ ...s.h2, marginBottom: 8 }}>Настройте доступ</h2>
          <p style={{ color: T.sub, fontSize: 13, lineHeight: '19px', marginBottom: 16 }}>
            Список ADMIN_IDS пуст. Добавьте ваш VK ID в массив в файле <code>AdminPanel.jsx</code>.
          </p>
          <div style={{ background: '#f0f7ff', borderRadius: 12, padding: '12px 16px', border: `1px solid ${T.blue}44`, fontFamily: 'monospace', fontSize: 14, color: T.blue, marginBottom: 4 }}>
            Ваш VK ID: <b>{vkId}</b>
          </div>
          <p style={{ color: T.sub, fontSize: 11, marginTop: 8 }}>
            Вставьте это число в ADMIN_IDS и задеплойте снова.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg, padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 20, padding: 24, maxWidth: 320, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ ...s.h2, marginBottom: 8 }}>Нет доступа</h2>
        <p style={{ color: T.sub, fontSize: 13, lineHeight: '19px' }}>
          Ваш аккаунт не имеет прав администратора.
          {vkId && <><br /><br />VK ID: <b>{vkId}</b></>}
        </p>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export const AdminPanel = () => {
  const [allowed, setAllowed] = useState(false);
  const [partners, setPartners]         = useState([]);
  const [events, setEvents]             = useState([]);
  const [users, setUsers]               = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('stats');

  // Форма уведомления
  const [nEmoji, setNEmoji]   = useState('🔔');
  const [nTitle, setNTitle]   = useState('');
  const [nBody, setNBody]     = useState('');
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingEvent,   setEditingEvent]   = useState(null);
  const [saving, setSaving] = useState(false);

  // Форма партнёра
  const [pName, setPName]       = useState('');
  const [pDesc, setPDesc]       = useState('');
  const [pCategory, setPCategory] = useState('other');
  const [pEmoji, setPEmoji]     = useState('🏪');
  const [pLogo, setPLogo]       = useState('');
  const [pPhone, setPPhone]     = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pHours, setPHours]     = useState('');
  const [pSocial, setPSocial]   = useState('');
  const [pOffer, setPOffer]     = useState('');

  // Форма события
  const [eTitle, setETitle]     = useState('');
  const [eDate, setEDate]       = useState('');
  const [ePartner, setEPartner] = useState('');
  const [eEmoji, setEEmoji]     = useState('🎉');
  const [eDesc, setEDesc]       = useState('');
  const [eSocial, setESocial]   = useState('');
  const [eAddress, setEAddress] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pSnap, eSnap, uSnap, nSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))),
      ]);
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNotifications(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) fetchData();
  }, [allowed, fetchData]);

  if (!allowed) return <AccessGuard onAllow={() => setAllowed(true)} />;

  // ─── Статистика ─────────────────────────────────────────────────────────────

  const totalKeys     = users.reduce((s, u) => s + (u.keys ?? 0), 0);
  const totalFavs     = users.reduce((s, u) => s + (u.favorites?.length ?? 0), 0);
  const usersWithKeys = users.filter(u => (u.keys ?? 0) > 0).length;
  const notifEnabled  = users.filter(u => u.notificationsEnabled).length;

  const topUsers = [...users]
    .filter(u => (u.keys ?? 0) > 0)
    .sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0))
    .slice(0, 5);

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
    setSaving(true);
    const data = {
      name: pName.trim(), description: pDesc.trim(), category: pCategory,
      emoji: pEmoji, logoUrl: pLogo.trim(),
      categoryLabel: CATEGORIES.find(c => c.id === pCategory)?.label ?? '',
      phone: pPhone.trim(), address: pAddress.trim(),
      hours: pHours.trim(), socialUrl: pSocial.trim(), offer: pOffer.trim(),
    };
    try {
      if (editingPartner) {
        await updateDoc(doc(db, 'partners', editingPartner.id), data);
      } else {
        await addDoc(collection(db, 'partners'), data);
      }
      resetPartnerForm();
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Удалить партнёра?')) return;
    await deleteDoc(doc(db, 'partners', id));
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
    setSaving(true);
    const data = {
      title: eTitle.trim(), date: eDate.trim(), partner: ePartner.trim(),
      emoji: eEmoji, description: eDesc.trim(),
      socialUrl: eSocial.trim(), address: eAddress.trim(),
    };
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), data);
      } else {
        await addDoc(collection(db, 'events'), data);
      }
      resetEventForm();
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Удалить событие?')) return;
    await deleteDoc(doc(db, 'events', id));
    fetchData();
  };

  // ─── Рендер ─────────────────────────────────────────────────────────────────

  const sendNotification = async () => {
    if (!nTitle.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        emoji: nEmoji,
        title: nTitle.trim(),
        body: nBody.trim(),
        createdAt: serverTimestamp(),
      });
      setNTitle(''); setNBody(''); setNEmoji('🔔');
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteNotification = async (id) => {
    if (!window.confirm('Удалить уведомление?')) return;
    await deleteDoc(doc(db, 'notifications', id));
    fetchData();
  };

  const NOTIF_EMOJIS = ['🔔','🎉','🎁','🏆','⭐','🌟','🤝','💡','📣','🛍️','🎯','❤️'];

  const TABS = [
    { id: 'stats',         label: '📊 Статистика' },
    { id: 'partners',      label: `🤝 Партнёры (${partners.length})` },
    { id: 'events',        label: `🎉 События (${events.length})` },
    { id: 'users',         label: `👥 Пользователи (${users.length})` },
    { id: 'notifications', label: `🔔 Рассылка` },
  ];

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>⚙️ Админ-панель</h1>
        <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>АПГ — Альянс Партнёров Города</p>
      </div>

      {/* Табы */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id}
            style={{ ...s.tab, background: activeTab === t.id ? T.blue : T.card, color: activeTab === t.id ? '#fff' : T.text }}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── СТАТИСТИКА ── */}
      {activeTab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <StatCard emoji="👥" label="Пользователей" value={loading ? '…' : users.length} color={T.blue} />
            <StatCard emoji="🗝️" label="Ключей выдано" value={loading ? '…' : totalKeys} color={T.gold} />
            <StatCard emoji="🔥" label="Активных" value={loading ? '…' : usersWithKeys} color={T.green} />
            <StatCard emoji="🔔" label="С уведомлениями" value={loading ? '…' : notifEnabled} color="#9B59B6" />
            <StatCard emoji="🤝" label="Партнёров" value={loading ? '…' : partners.length} color={T.blue} />
            <StatCard emoji="⭐" label="Избранных добавлено" value={loading ? '…' : totalFavs} color={T.gold} />
          </div>

          {topUsers.length > 0 && (
            <div style={s.card}>
              <h2 style={s.h2}>🏆 Топ пользователей</h2>
              {topUsers.map((u, i) => (
                <div key={u.id} style={{ ...s.row, borderBottom: i < topUsers.length - 1 ? `1px solid ${T.bg}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i < 3 ? '#fff' : T.sub }}>
                      {i + 1}
                    </div>
                    {u.photo
                      ? <img src={u.photo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                      : <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                    }
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{u.firstName || ''} {u.lastName || ''}</div>
                      <div style={{ fontSize: 11, color: T.sub }}>VK ID: {u.id}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.gold }}>🗝️ {u.keys ?? 0}</div>
                </div>
              ))}
            </div>
          )}

          <div style={s.card}>
            <h2 style={s.h2}>📋 Контент</h2>
            {[
              { label: 'Партнёры', value: partners.length, max: 20 },
              { label: 'События', value: events.length, max: 10 },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: T.text }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{item.value}</span>
                </div>
                <div style={{ height: 6, background: T.bg, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: T.blue, borderRadius: 3, width: `${Math.min(100, (item.value / item.max) * 100)}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── ПАРТНЁРЫ ── */}
      {activeTab === 'partners' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingPartner ? `✏️ ${editingPartner.name}` : '➕ Новый партнёр'}</h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Студия красоты SEIUNA" value={pName} onChange={e => setPName(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Краткое описание..." value={pDesc} onChange={e => setPDesc(e.target.value)} />

            <label style={s.label}>Спецпредложение для участников АПГ 🎁</label>
            <input style={s.input} placeholder="Скидка 10% на первый визит" value={pOffer} onChange={e => setPOffer(e.target.value)} />

            <label style={s.label}>Категория</label>
            <select style={s.select} value={pCategory} onChange={e => setPCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PARTNER_EMOJIS} value={pEmoji} onChange={setPEmoji} />

            <label style={s.label}>Ссылка на логотип (URL)</label>
            <input style={s.input} placeholder="https://..." value={pLogo} onChange={e => setPLogo(e.target.value)} />
            {pLogo && <img src={pLogo} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} onError={e => e.target.style.display='none'} />}

            <label style={s.label}>Телефон</label>
            <input style={s.input} placeholder="+7 (499) 123-45-67" value={pPhone} onChange={e => setPPhone(e.target.value)} />

            <label style={s.label}>Адрес</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={pAddress} onChange={e => setPAddress(e.target.value)} />

            <label style={s.label}>Часы работы</label>
            <input style={s.input} placeholder="Пн-Пт 10:00–20:00, Сб-Вс 11:00–18:00" value={pHours} onChange={e => setPHours(e.target.value)} />

            <label style={s.label}>Соцсеть / сайт</label>
            <input style={s.input} placeholder="https://vk.com/..." value={pSocial} onChange={e => setPSocial(e.target.value)} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: saving ? 0.7 : 1 }} onClick={savePartner} disabled={saving}>
                {saving ? 'Сохранение...' : editingPartner ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPartner && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartnerForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все партнёры</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : partners.length === 0 ? <p style={{ color: T.sub, textAlign: 'center' }}>Нет партнёров</p>
              : partners.map((p, i) => (
                <div key={p.id} style={{ ...s.row, borderBottom: i < partners.length - 1 ? `1px solid ${T.bg}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {p.logoUrl
                      ? <img src={p.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.sub }}>
                        {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                        {p.offer && <span style={{ color: T.green }}> · 🎁 {p.offer}</span>}
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
            <select style={s.select} value={ePartner} onChange={e => setEPartner(e.target.value)}>
              <option value="">— выберите партнёра —</option>
              {partners.map(p => <option key={p.id} value={p.name}>{p.emoji} {p.name}</option>)}
            </select>

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Подробное описание..." value={eDesc} onChange={e => setEDesc(e.target.value)} />

            <label style={s.label}>Ссылка на соцсеть / регистрацию</label>
            <input style={s.input} placeholder="https://vk.com/event..." value={eSocial} onChange={e => setESocial(e.target.value)} />

            <label style={s.label}>Адрес проведения</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={eAddress} onChange={e => setEAddress(e.target.value)} />

            <label style={s.label}>Эмодзи события</label>
            <EmojiPicker emojis={EVENT_EMOJIS} value={eEmoji} onChange={setEEmoji} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: saving ? 0.7 : 1 }} onClick={saveEvent} disabled={saving}>
                {saving ? 'Сохранение...' : editingEvent ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingEvent && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetEventForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все события</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : events.length === 0 ? <p style={{ color: T.sub, textAlign: 'center' }}>Нет событий</p>
              : events.map((e, i) => (
                <div key={e.id} style={{ ...s.row, borderBottom: i < events.length - 1 ? `1px solid ${T.bg}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{e.emoji ?? '🎉'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: T.sub }}>{e.date && `📅 ${e.date}`}{e.partner && ` · ${e.partner}`}</div>
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

      {/* ── ПОЛЬЗОВАТЕЛИ ── */}
      {activeTab === 'users' && (
        <div style={s.card}>
          <h2 style={s.h2}>👥 Все пользователи</h2>
          {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
            : users.length === 0 ? <p style={{ color: T.sub, textAlign: 'center' }}>Нет пользователей</p>
            : [...users].sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0)).map((u, i, arr) => (
              <div key={u.id} style={{ ...s.row, borderBottom: i < arr.length - 1 ? `1px solid ${T.bg}` : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  {u.photo
                    ? <img src={u.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                    : <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>
                      {u.firstName || ''} {u.lastName || ''}
                    </div>
                    <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                      ID: {u.id}
                      {u.notificationsEnabled && ' · 🔔'}
                      {u.consentGiven && ' · ✅'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                        🗝️ {u.keys ?? 0}
                      </span>
                      {(u.favorites?.length ?? 0) > 0 && (
                        <span style={{ fontSize: 11, background: '#FFE0E0', color: '#C82333', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                          ⭐ {u.favorites.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── УВЕДОМЛЕНИЯ ── */}
      {activeTab === 'notifications' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>📣 Новое уведомление</h2>
            <p style={{ color: T.sub, fontSize: 13, margin: '0 0 14px', lineHeight: '18px' }}>
              Уведомление получат все пользователи при следующем открытии приложения.
            </p>

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={NOTIF_EMOJIS} value={nEmoji} onChange={setNEmoji} />

            <label style={s.label}>Заголовок *</label>
            <input style={s.input} placeholder="Новая акция у партнёров АПГ!" value={nTitle} onChange={e => setNTitle(e.target.value)} />

            <label style={s.label}>Текст</label>
            <textarea style={s.textarea} placeholder="Подробное описание акции или события..." value={nBody} onChange={e => setNBody(e.target.value)} />

            <button style={{ ...s.btn, ...s.btnPri, width: '100%', opacity: saving ? 0.7 : 1 }} onClick={sendNotification} disabled={saving || !nTitle.trim()}>
              {saving ? 'Отправляем...' : '📣 Отправить всем пользователям'}
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>История рассылок</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : notifications.length === 0
                ? <p style={{ color: T.sub, textAlign: 'center', fontSize: 13 }}>Уведомлений ещё не отправлялось</p>
                : notifications.map((n, i) => (
                  <div key={n.id} style={{ ...s.row, borderBottom: i < notifications.length - 1 ? `1px solid ${T.bg}` : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{n.emoji ?? '🔔'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{n.title}</div>
                        {n.body && <div style={{ fontSize: 12, color: T.sub, marginTop: 2, lineHeight: '17px' }}>{n.body}</div>}
                        {n.createdAt?.seconds && (
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                            {new Date(n.createdAt.seconds * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12, flexShrink: 0, marginLeft: 8 }} onClick={() => deleteNotification(n.id)}>🗑️</button>
                  </div>
                ))
            }
          </div>
        </>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};
