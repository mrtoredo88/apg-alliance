import React, { useState, useEffect, useCallback, useRef } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { QRCodeSVG } from 'qrcode.react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, query, orderBy, serverTimestamp, increment } from 'firebase/firestore';

const ADMIN_IDS = [988504];

const CATEGORIES = [
  { id: 'food',    label: 'Еда',          emoji: '🍽️' },
  { id: 'beauty',  label: 'Красота',      emoji: '💄' },
  { id: 'sport',   label: 'Спорт',        emoji: '💪' },
  { id: 'edu',     label: 'Обучение',     emoji: '📚' },
  { id: 'fun',     label: 'Развлечения',  emoji: '🎉' },
  { id: 'health',  label: 'Здоровье',     emoji: '💊' },
  { id: 'shop',    label: 'Магазины',     emoji: '🛍️' },
  { id: 'service', label: 'Сервис',       emoji: '🔧' },
  { id: 'other',   label: 'Другое',       emoji: '🏪' },
];

const EVENT_EMOJIS    = ['🎉','🎓','🍕','💆','🏋️','🎨','🎤','🤝','🎁','🌟','🎭','☕'];
const PARTNER_EMOJIS  = ['🏪','💆','💄','🍽️','☕','🎓','🏋️','💅','🎉','🛍️','🎭','🌿'];
const NOTIF_EMOJIS    = ['🔔','🎉','🎁','🏆','⭐','🌟','🤝','💡','📣','🛍️','🎯','❤️'];

const T = {
  bg: '#f2f3f5', card: '#fff', border: '#e0e0e0',
  blue: '#3F8AE0', red: '#E64646', green: '#4BB34B', gold: '#C9A84C',
  text: '#000', sub: '#99A2AD', input: '#fff',
};

const s = {
  page:      { padding: 16, fontFamily: '-apple-system, sans-serif', background: T.bg, minHeight: '100vh' },
  card:      { background: T.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  h1:        { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: T.text },
  h2:        { fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: T.text },
  label:     { fontSize: 13, color: T.sub, marginBottom: 4, display: 'block' },
  input:     { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: T.input },
  textarea:  { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, minHeight: 80, resize: 'vertical', background: T.input },
  btn:       { padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPri:    { background: T.blue, color: '#fff' },
  btnDanger: { background: T.red,  color: '#fff' },
  btnGray:   { background: T.bg,   color: T.text },
  row:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.bg}` },
  emojiGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  emojiBtn:  { width: 40, height: 40, borderRadius: 10, border: '2px solid transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg },
  select:    { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 10, background: T.input },
  tabs:      { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' },
  tab:       { flex: '0 0 auto', padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};

// ─── ImgBB upload ─────────────────────────────────────────────────────────────

const IMGBB_KEY_LS = 'apg_imgbb_key';

async function uploadImageToImgBB(file, apiKey) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const form = new FormData();
  form.append('key', apiKey);
  form.append('image', base64);
  const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message ?? 'ImgBB upload failed');
  return data.data.url;
}

// ─── ImageUploader ────────────────────────────────────────────────────────────

function ImageUploader({ currentUrl, onUrlChange, apiKey, label = 'Фото', uploading, setUploading }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(currentUrl || '');

  useEffect(() => { setPreview(currentUrl || ''); }, [currentUrl]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!apiKey) { alert('Сначала введите ImgBB API Key в настройках (вверху страницы).'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const url = await uploadImageToImgBB(file, apiKey);
      onUrlChange(url);
      setPreview(url);
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки. Проверьте API Key ImgBB.');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  return (
    <div style={{ marginBottom: 10 }}>
      {preview && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, display: 'block' }} onError={() => setPreview('')} />
          <button onClick={() => { setPreview(''); onUrlChange(''); }}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}
      <button type="button" onClick={() => fileRef.current?.click()}
        style={{ ...s.btn, ...s.btnGray, width: '100%', opacity: uploading ? 0.7 : 1 }}
        disabled={uploading}>
        {uploading ? '⏳ Загружаем...' : preview ? `📷 Заменить: ${label}` : `📷 Загрузить: ${label}`}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}

// ─── PhotoGalleryUploader — несколько фото ───────────────────────────────────

function PhotoGalleryUploader({ photos = [], onChange, apiKey, uploading, setUploading }) {
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - photos.length);
    if (!files.length) return;
    if (!apiKey) { alert('Сначала введите ImgBB API Key в настройках (вверху страницы).'); return; }
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(f => uploadImageToImgBB(f, apiKey)));
      onChange([...photos, ...urls]);
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки фото. Проверьте API Key ImgBB.');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const remove = (idx) => onChange(photos.filter((_, i) => i !== idx));

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} onError={e => e.target.style.opacity = 0.3} />
            <button onClick={() => remove(i)}
              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
        ))}
        {photos.length < 5 && (
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ width: 80, height: 80, borderRadius: 10, border: `2px dashed ${T.border}`, background: T.bg, cursor: 'pointer', fontSize: 24, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 0.5 : 1 }}
            disabled={uploading}>
            {uploading ? '⏳' : '+'}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.sub }}>{photos.length}/5 фото · JPG, PNG, WebP</div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}

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

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, color = T.blue }) {
  return (
    <div style={{ background: T.card, borderRadius: 14, padding: '14px 12px', textAlign: 'center', border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: 2, lineHeight: '15px' }}>{label}</div>
    </div>
  );
}

// ─── MiniBar — горизонтальный прогресс ───────────────────────────────────────

function MiniBar({ label, value, max, color = T.blue, suffix = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: T.text }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}{suffix}</span>
      </div>
      <div style={{ height: 5, background: T.bg, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// ─── PartnerQRCard ────────────────────────────────────────────────────────────

function PartnerQRCard({ partner }) {
  const svgRef   = useRef(null);
  const qrValue  = `APG_PARTNER_${partner.id}`;

  const handlePrint = () => {
    const svgEl  = svgRef.current?.querySelector('svg');
    const svgHTML = svgEl ? svgEl.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" ') : '';
    const win    = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>QR — ${partner.name}</title>
      <style>* { box-sizing:border-box; margin:0; padding:0; } body { font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#fff; padding:24px; } .brand { font-size:13px; font-weight:700; letter-spacing:2px; color:#999; text-transform:uppercase; margin-bottom:12px; } .name { font-size:24px; font-weight:800; color:#111; margin-top:14px; text-align:center; } .hint { font-size:13px; color:#777; margin-top:10px; text-align:center; max-width:240px; line-height:1.5; } .code { font-size:10px; color:#bbb; margin-top:10px; font-family:monospace; } .btn { margin-top:24px; padding:10px 28px; background:#1976d2; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; } @media print { .btn { display:none; } }</style></head>
      <body><div class="brand">АПГ · Альянс Партнёров Города</div>${svgHTML}<div class="name">${partner.name}</div><div class="hint">Отсканируйте QR-код и получите ключ в программе лояльности АПГ</div><div class="code">${qrValue}</div><button class="btn" onclick="window.print()">🖨️ Печать</button></body></html>`);
    win.document.close();
  };

  return (
    <div style={{ ...s.card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 16px' }}>
      <div ref={svgRef} style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
        <QRCodeSVG value={qrValue} size={160} bgColor="#ffffff" fgColor="#0F0F1A" level="M" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{partner.emoji} {partner.name}</div>
        <div style={{ fontSize: 10, color: T.sub, marginTop: 4, fontFamily: 'monospace' }}>{qrValue}</div>
      </div>
      <button onClick={handlePrint} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: T.blue, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        🖨️ Распечатать
      </button>
    </div>
  );
}

// ─── AccessGuard ─────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = 'APG_Zelenоgrad_2024';

function AccessGuard({ onAllow }) {
  const [status, setStatus]   = useState('checking');
  const [vkId, setVkId]       = useState(null);
  const [pwd, setPwd]         = useState('');
  const [pwdError, setPwdError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Promise.race([vkBridge.send('VKWebAppInit'), new Promise((_, r) => setTimeout(r, 1000))]).catch(() => {});
        const userData = await Promise.race([vkBridge.send('VKWebAppGetUserInfo'), new Promise((_, r) => setTimeout(() => r(null), 3000))]).catch(() => null);
        if (!userData) { if (ADMIN_IDS.length === 0) { onAllow(); return; } setStatus('denied'); return; }
        setVkId(userData.id);
        if (ADMIN_IDS.length === 0) { setStatus('no_config'); return; }
        ADMIN_IDS.includes(userData.id) ? onAllow() : setStatus('denied');
      } catch {
        if (ADMIN_IDS.length === 0) { onAllow(); return; }
        setStatus('denied');
      }
    })();
  }, [onAllow]);

  const handlePassword = () => {
    if (pwd === ADMIN_PASSWORD) { onAllow(); }
    else { setPwdError(true); setTimeout(() => setPwdError(false), 1500); }
  };

  if (status === 'checking') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg }}>
      <p style={{ color: T.sub }}>Проверка доступа...</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg, padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        {status === 'no_config' ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
            <h2 style={{ ...s.h2, marginBottom: 8 }}>Настройте доступ</h2>
            <p style={{ color: T.sub, fontSize: 13, lineHeight: '19px', marginBottom: 12 }}>Добавьте VK ID в массив ADMIN_IDS в AdminPanel.jsx</p>
            <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '10px 14px', border: `1px solid ${T.blue}44`, fontFamily: 'monospace', fontSize: 14, color: T.blue }}>Ваш VK ID: <b>{vkId}</b></div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <h2 style={{ ...s.h2, marginBottom: 4 }}>Вход в админку</h2>
            <p style={{ color: T.sub, fontSize: 13, marginBottom: 20, lineHeight: '18px' }}>
              Открыто вне ВКонтакте — введите пароль администратора
            </p>
            <input
              type="password"
              placeholder="Пароль..."
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePassword()}
              style={{ ...s.input, marginBottom: 10, textAlign: 'center', border: pwdError ? `2px solid ${T.red}` : `1px solid ${T.border}`, transition: 'border 0.2s' }}
            />
            {pwdError && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>Неверный пароль</p>}
            <button onClick={handlePassword} style={{ ...s.btn, ...s.btnPri, width: '100%' }}>
              Войти
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export const AdminPanel = () => {
  const [allowed, setAllowed]         = useState(false);
  const [partners, setPartners]       = useState([]);
  const [events, setEvents]           = useState([]);
  const [users, setUsers]             = useState([]);
  const [notifications, setNotif]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('stats');
  const [saving, setSaving]           = useState(false);
  const [uploadingLogo, setUploadingLogo]       = useState(false);
  const [uploadingPhotos, setUploadingPhotos]   = useState(false);
  const [uploadingEvImg, setUploadingEvImg]     = useState(false);
  const [imgbbKey, setImgbbKey]       = useState(() => localStorage.getItem(IMGBB_KEY_LS) ?? '');
  const [imgbbInput, setImgbbInput]   = useState(() => localStorage.getItem(IMGBB_KEY_LS) ?? '');

  // ─ Форма партнёра
  const [editingPartner, setEditingPartner] = useState(null);
  const [pName, setPName]       = useState('');
  const [pDesc, setPDesc]       = useState('');
  const [pCategory, setPCategory] = useState('other');
  const [pEmoji, setPEmoji]     = useState('🏪');
  const [pLogo, setPLogo]       = useState('');
  const [pPhotos, setPPhotos]   = useState([]);
  const [pPhone, setPPhone]     = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pHours, setPHours]     = useState('');
  const [pSocial, setPSocial]   = useState('');
  const [pOffer, setPOffer]     = useState('');

  // ─ Форма события
  const [editingEvent, setEditingEvent] = useState(null);
  const [eTitle, setETitle]     = useState('');
  const [eDate, setEDate]       = useState('');
  const [ePartner, setEPartner] = useState('');
  const [eEmoji, setEEmoji]     = useState('🎉');
  const [eDesc, setEDesc]       = useState('');
  const [eSocial, setESocial]   = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eImageUrl, setEImageUrl] = useState('');

  // ─ Форма уведомления
  const [nEmoji, setNEmoji]     = useState('🔔');
  const [nTitle, setNTitle]     = useState('');
  const [nBody, setNBody]       = useState('');

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
      setNotif(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) fetchData(); }, [allowed, fetchData]);

  if (!allowed) return <AccessGuard onAllow={() => setAllowed(true)} />;

  // ─── Аналитика ──────────────────────────────────────────────────────────────

  const totalKeys     = users.reduce((s, u) => s + (u.keys ?? 0), 0);
  const totalFavs     = users.reduce((s, u) => s + (u.favorites?.length ?? 0), 0);
  const usersWithKeys = users.filter(u => (u.keys ?? 0) > 0).length;
  const notifEnabled  = users.filter(u => u.notificationsEnabled).length;
  const totalScans    = partners.reduce((s, p) => s + (p.scanCount ?? 0), 0);

  const partnerFavCounts = {};
  users.forEach(u => (u.favorites ?? []).forEach(id => {
    partnerFavCounts[id] = (partnerFavCounts[id] ?? 0) + 1;
  }));

  const topPartnersByScans = [...partners]
    .filter(p => (p.scanCount ?? 0) > 0)
    .sort((a, b) => (b.scanCount ?? 0) - (a.scanCount ?? 0))
    .slice(0, 8);

  const topPartnersByFavs = Object.entries(partnerFavCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, cnt]) => ({ ...partners.find(p => p.id === id), favCount: cnt }))
    .filter(p => p.name);

  const topUsers = [...users]
    .filter(u => (u.keys ?? 0) > 0)
    .sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0))
    .slice(0, 5);

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartner = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪');
    setPLogo(''); setPPhotos([]); setPPhone(''); setPAddress('');
    setPHours(''); setPSocial(''); setPOffer('');
    setEditingPartner(null);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? '');       setPDesc(p.description ?? '');
    setPCategory(p.category ?? 'other'); setPEmoji(p.emoji ?? '🏪');
    setPLogo(p.logoUrl ?? '');    setPPhotos(p.photos ?? []);
    setPPhone(p.phone ?? '');     setPAddress(p.address ?? '');
    setPHours(p.hours ?? '');     setPSocial(p.socialUrl ?? '');
    setPOffer(p.offer ?? '');
    setActiveTab('partners');
    window.scrollTo(0, 0);
  };

  const savePartner = async () => {
    if (!pName.trim()) return;
    setSaving(true);
    const data = {
      name: pName.trim(), description: pDesc.trim(), category: pCategory,
      emoji: pEmoji, logoUrl: pLogo.trim(), photos: pPhotos,
      categoryLabel: CATEGORIES.find(c => c.id === pCategory)?.label ?? '',
      phone: pPhone.trim(), address: pAddress.trim(),
      hours: pHours.trim(), socialUrl: pSocial.trim(), offer: pOffer.trim(),
    };
    try {
      if (editingPartner) {
        await updateDoc(doc(db, 'partners', editingPartner.id), data);
      } else {
        await addDoc(collection(db, 'partners'), { ...data, scanCount: 0 });
      }
      resetPartner();
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Удалить партнёра?')) return;
    await deleteDoc(doc(db, 'partners', id));
    fetchData();
  };

  const toggleFeatured = async (partner) => {
    const newVal = !partner.featured;
    if (newVal) {
      await Promise.all(partners.filter(p => p.featured && p.id !== partner.id)
        .map(p => updateDoc(doc(db, 'partners', p.id), { featured: false })));
    }
    await updateDoc(doc(db, 'partners', partner.id), { featured: newVal });
    fetchData();
  };

  // ─── События ────────────────────────────────────────────────────────────────

  const resetEvent = () => {
    setETitle(''); setEDate(''); setEPartner(''); setEEmoji('🎉');
    setEDesc(''); setESocial(''); setEAddress(''); setEImageUrl('');
    setEditingEvent(null);
  };

  const startEditEvent = (ev) => {
    setEditingEvent(ev);
    setETitle(ev.title ?? '');     setEDate(ev.date ?? '');
    setEPartner(ev.partner ?? ''); setEEmoji(ev.emoji ?? '🎉');
    setEDesc(ev.description ?? ''); setESocial(ev.socialUrl ?? '');
    setEAddress(ev.address ?? ''); setEImageUrl(ev.imageUrl ?? '');
    setActiveTab('events');
    window.scrollTo(0, 0);
  };

  const saveEvent = async () => {
    if (!eTitle.trim()) return;
    setSaving(true);
    const data = {
      title: eTitle.trim(), date: eDate.trim(), partner: ePartner.trim(),
      emoji: eEmoji, description: eDesc.trim(),
      socialUrl: eSocial.trim(), address: eAddress.trim(),
      imageUrl: eImageUrl.trim(),
    };
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), data);
      } else {
        await addDoc(collection(db, 'events'), data);
      }
      resetEvent();
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Удалить событие?')) return;
    await deleteDoc(doc(db, 'events', id));
    fetchData();
  };

  // ─── Уведомления ────────────────────────────────────────────────────────────

  const sendNotification = async () => {
    if (!nTitle.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        emoji: nEmoji, title: nTitle.trim(), body: nBody.trim(), createdAt: serverTimestamp(),
      });
      setNTitle(''); setNBody(''); setNEmoji('🔔');
      await fetchData();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteNotification = async (id) => {
    if (!window.confirm('Удалить?')) return;
    await deleteDoc(doc(db, 'notifications', id));
    fetchData();
  };

  const TABS = [
    { id: 'stats',         label: '📊 Статистика' },
    { id: 'partners',      label: `🤝 Партнёры (${partners.length})` },
    { id: 'qrcodes',       label: '📷 QR-коды' },
    { id: 'events',        label: `🎉 События (${events.length})` },
    { id: 'users',         label: `👥 Пользователи (${users.length})` },
    { id: 'notifications', label: '🔔 Рассылка' },
  ];

  // ─── Рендер ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>⚙️ Админ-панель АПГ</h1>
        <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>Зеленоград · Альянс Партнёров Города</p>
      </div>

      {/* Настройка ImgBB */}
      <div style={{ background: imgbbKey ? '#F0FFF0' : '#FFF3CD', border: `1px solid ${imgbbKey ? '#4BB34B' : '#FFCA2C'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: imgbbKey ? T.green : '#856404', marginBottom: 6 }}>
          {imgbbKey ? '✅ ImgBB подключён — загрузка фото доступна' : '📷 Настройте загрузку фото (ImgBB — бесплатно)'}
        </div>
        {!imgbbKey && (
          <div style={{ fontSize: 12, color: '#664D03', lineHeight: '18px', marginBottom: 8 }}>
            1. Зайди на <b>imgbb.com</b> → зарегистрируйся бесплатно<br/>
            2. Перейди в <b>API</b> (ссылка вверху) → скопируй API Key<br/>
            3. Вставь ключ ниже и нажми Сохранить
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...s.input, margin: 0, flex: 1, fontSize: 13 }}
            placeholder="ImgBB API Key..."
            value={imgbbInput}
            onChange={e => setImgbbInput(e.target.value)}
          />
          <button style={{ ...s.btn, ...(imgbbKey ? s.btnGray : s.btnPri), flexShrink: 0 }}
            onClick={() => {
              const k = imgbbInput.trim();
              localStorage.setItem(IMGBB_KEY_LS, k);
              setImgbbKey(k);
            }}>
            {imgbbKey ? 'Обновить' : 'Сохранить'}
          </button>
          {imgbbKey && (
            <button style={{ ...s.btn, ...s.btnDanger, flexShrink: 0 }}
              onClick={() => { localStorage.removeItem(IMGBB_KEY_LS); setImgbbKey(''); setImgbbInput(''); }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Табы */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, background: activeTab === t.id ? T.blue : T.card, color: activeTab === t.id ? '#fff' : T.text }}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── СТАТИСТИКА ── */}
      {activeTab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <StatCard emoji="👥" label="Пользователей"     value={loading ? '…' : users.length}      color={T.blue} />
            <StatCard emoji="🗝️" label="Ключей выдано"    value={loading ? '…' : totalKeys}           color={T.gold} />
            <StatCard emoji="🔥" label="Активных"          value={loading ? '…' : usersWithKeys}      color={T.green} />
            <StatCard emoji="📷" label="Всего сканирований"value={loading ? '…' : totalScans}          color="#9B59B6" />
            <StatCard emoji="🤝" label="Партнёров"         value={loading ? '…' : partners.length}    color={T.blue} />
            <StatCard emoji="⭐" label="Добавлений в избр." value={loading ? '…' : totalFavs}         color={T.gold} />
          </div>

          {topUsers.length > 0 && (
            <div style={s.card}>
              <h2 style={s.h2}>🏆 Топ пользователей</h2>
              {topUsers.map((u, i) => (
                <div key={u.id} style={{ ...s.row, borderBottom: i < topUsers.length - 1 ? `1px solid ${T.bg}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i < 3 ? '#fff' : T.sub }}>{i + 1}</div>
                    {u.photo ? <img src={u.photo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
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

          {topPartnersByScans.length > 0 && (
            <div style={s.card}>
              <h2 style={s.h2}>📷 Топ по сканированиям</h2>
              {topPartnersByScans.map((p, i) => (
                <MiniBar key={p.id} label={`${p.emoji ?? '🏪'} ${p.name}`} value={p.scanCount ?? 0}
                  max={topPartnersByScans[0].scanCount ?? 1} color={T.blue} suffix=" скан." />
              ))}
            </div>
          )}

          {topPartnersByFavs.length > 0 && (
            <div style={s.card}>
              <h2 style={s.h2}>⭐ Топ по избранному</h2>
              {topPartnersByFavs.map((p) => (
                <MiniBar key={p.id} label={`${p.emoji ?? '🏪'} ${p.name}`} value={p.favCount}
                  max={topPartnersByFavs[0].favCount ?? 1} color={T.gold} suffix=" чел." />
              ))}
            </div>
          )}

          <div style={s.card}>
            <h2 style={s.h2}>📋 Контент</h2>
            <MiniBar label="Партнёры" value={partners.length} max={20} color={T.blue} />
            <MiniBar label="События"  value={events.length}  max={15} color={T.green} />
            <MiniBar label="Уведомления" value={notifications.length} max={20} color="#9B59B6" />
          </div>
        </>
      )}

      {/* ── ПАРТНЁРЫ ── */}
      {activeTab === 'partners' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingPartner ? `✏️ ${editingPartner.name}` : '➕ Новый партнёр'}</h2>

            {/* Статистика партнёра при редактировании */}
            {editingPartner && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '12px 14px', background: '#f8f9ff', borderRadius: 12, border: '1px solid #e0e7ff' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{editingPartner.scanCount ?? 0}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>сканирований</div>
                </div>
                <div style={{ width: 1, background: T.border }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{partnerFavCounts[editingPartner.id] ?? 0}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>в избранном</div>
                </div>
                <div style={{ width: 1, background: T.border }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{editingPartner.featured ? '⭐' : '—'}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>партнёр дня</div>
                </div>
              </div>
            )}

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

            <label style={s.label}>Логотип (аватар партнёра)</label>
            <ImageUploader currentUrl={pLogo} onUrlChange={setPLogo} apiKey={imgbbKey}
              label="Логотип" uploading={uploadingLogo} setUploading={setUploadingLogo} />
            {pLogo && <img src={pLogo} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} onError={e => e.target.style.display='none'} />}

            <label style={s.label}>Фотогалерея (до 5 фото)</label>
            <PhotoGalleryUploader photos={pPhotos} onChange={setPPhotos} apiKey={imgbbKey}
              uploading={uploadingPhotos} setUploading={setUploadingPhotos} />

            <label style={s.label}>Телефон</label>
            <input style={s.input} placeholder="+7 (499) 123-45-67" value={pPhone} onChange={e => setPPhone(e.target.value)} />

            <label style={s.label}>Адрес</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={pAddress} onChange={e => setPAddress(e.target.value)} />

            <label style={s.label}>Часы работы</label>
            <input style={s.input} placeholder="Пн-Пт 10:00–20:00, Сб-Вс 11:00–18:00" value={pHours} onChange={e => setPHours(e.target.value)} />

            <label style={s.label}>Соцсеть / сайт</label>
            <input style={s.input} placeholder="https://vk.com/..." value={pSocial} onChange={e => setPSocial(e.target.value)} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: saving ? 0.7 : 1 }} onClick={savePartner} disabled={saving || uploadingLogo || uploadingPhotos}>
                {saving ? 'Сохранение...' : editingPartner ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPartner && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartner}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все партнёры</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : partners.length === 0 ? <p style={{ color: T.sub, textAlign: 'center' }}>Нет партнёров</p>
              : partners.map((p, i) => {
                const favCnt  = partnerFavCounts[p.id] ?? 0;
                const scanCnt = p.scanCount ?? 0;
                return (
                  <div key={p.id} style={{ ...s.row, borderBottom: i < partners.length - 1 ? `1px solid ${T.bg}` : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {p.logoUrl
                        ? <img src={p.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.featured && <span style={{ color: T.gold }}>⭐ </span>}{p.name}
                        </div>
                        <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                          {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                          <span style={{ fontSize: 11, background: '#E8F3FF', color: T.blue, padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>📷 {scanCnt}</span>
                          <span style={{ fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>⭐ {favCnt}</span>
                          {(p.photos?.length ?? 0) > 0 && <span style={{ fontSize: 11, background: '#E8FFE8', color: T.green, padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>🖼 {p.photos.length}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8, marginTop: 2 }}>
                      <button title="Партнёр дня (+2 🗝️)" style={{ ...s.btn, padding: '6px 10px', fontSize: 12, background: p.featured ? T.gold : T.bg, color: p.featured ? '#0F0F1A' : T.text, border: 'none' }} onClick={() => toggleFeatured(p)}>⭐</button>
                      <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditPartner(p)}>✏️</button>
                      <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deletePartner(p.id)}>🗑️</button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      {/* ── QR-КОДЫ ── */}
      {activeTab === 'qrcodes' && (
        <>
          <div style={{ ...s.card, marginBottom: 16 }}>
            <h2 style={s.h2}>📷 QR-коды партнёров</h2>
            <p style={{ color: T.sub, fontSize: 13, margin: 0 }}>Распечатайте и передайте партнёру. Клиент сканирует — получает ключ.</p>
          </div>
          {partners.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: T.sub }}>Нет партнёров.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {partners.map(p => <PartnerQRCard key={p.id} partner={p} />)}
          </div>
        </>
      )}

      {/* ── СОБЫТИЯ ── */}
      {activeTab === 'events' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingEvent ? `✏️ ${editingEvent.title}` : '➕ Новое событие'}</h2>

            <label style={s.label}>Обложка события</label>
            <ImageUploader currentUrl={eImageUrl} onUrlChange={setEImageUrl} apiKey={imgbbKey}
              label="Обложка" uploading={uploadingEvImg} setUploading={setUploadingEvImg} />

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
              <button style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: saving ? 0.7 : 1 }} onClick={saveEvent} disabled={saving || uploadingEvImg}>
                {saving ? 'Сохранение...' : editingEvent ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingEvent && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetEvent}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все события</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : events.length === 0 ? <p style={{ color: T.sub, textAlign: 'center' }}>Нет событий</p>
              : events.map((ev, i) => (
                <div key={ev.id} style={{ ...s.row, borderBottom: i < events.length - 1 ? `1px solid ${T.bg}` : 'none', alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                    {ev.imageUrl
                      ? <img src={ev.imageUrl} alt="" style={{ width: 52, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: 10, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{ev.emoji ?? '🎉'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{ev.date && `📅 ${ev.date}`}{ev.partner && ` · ${ev.partner}`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditEvent(ev)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteEvent(ev.id)}>🗑️</button>
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
                  {u.photo ? <img src={u.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} /> : <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{u.firstName || ''} {u.lastName || ''}</div>
                    <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>ID: {u.id}{u.notificationsEnabled && ' · 🔔'}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>🗝️ {u.keys ?? 0}</span>
                      {(u.favorites?.length ?? 0) > 0 && <span style={{ fontSize: 11, background: '#FFE0E0', color: '#C82333', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>⭐ {u.favorites.length}</span>}
                      {(u.referralCount ?? 0) > 0 && <span style={{ fontSize: 11, background: '#E8F3FF', color: T.blue, padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>👥 {u.referralCount}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── РАССЫЛКА ── */}
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
            <textarea style={s.textarea} placeholder="Подробное описание..." value={nBody} onChange={e => setNBody(e.target.value)} />
            <button style={{ ...s.btn, ...s.btnPri, width: '100%', opacity: saving ? 0.7 : 1 }} onClick={sendNotification} disabled={saving || !nTitle.trim()}>
              {saving ? 'Отправляем...' : '📣 Отправить всем пользователям'}
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>История рассылок</h2>
            {loading ? <p style={{ color: T.sub, textAlign: 'center' }}>Загрузка...</p>
              : notifications.length === 0 ? <p style={{ color: T.sub, textAlign: 'center', fontSize: 13 }}>Уведомлений ещё не отправлялось</p>
              : notifications.map((n, i) => (
                <div key={n.id} style={{ ...s.row, borderBottom: i < notifications.length - 1 ? `1px solid ${T.bg}` : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{n.emoji ?? '🔔'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12, color: T.sub, marginTop: 2, lineHeight: '17px' }}>{n.body}</div>}
                      {n.createdAt?.seconds && <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>{new Date(n.createdAt.seconds * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
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
