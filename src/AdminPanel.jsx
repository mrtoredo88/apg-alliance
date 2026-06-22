import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MdEditor } from './components/MdEditor.jsx';
import { QRCodeSVG } from 'qrcode.react';
import vkBridge from './vk.js';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, writeBatch, increment, limit } from 'firebase/firestore';

const CATEGORIES = [
  { id: 'food',          label: 'Еда',          emoji: '🍕' },
  { id: 'beauty',        label: 'Красота',       emoji: '💄' },
  { id: 'sport',         label: 'Спорт',         emoji: '💪' },
  { id: 'education',     label: 'Обучение',      emoji: '📚' },
  { id: 'entertainment', label: 'Развлечения',   emoji: '🎉' },
  { id: 'health',        label: 'Здоровье',      emoji: '🏥' },
  { id: 'home',          label: 'Дом и ремонт',  emoji: '🏠' },
  { id: 'pets',          label: 'Животные',      emoji: '🐾' },
  { id: 'fashion',       label: 'Одежда',        emoji: '👗' },
  { id: 'auto',          label: 'Авто',          emoji: '🚗' },
  { id: 'services',      label: 'Услуги',        emoji: '💼' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

const EVENT_EMOJIS   = ['🎉','🎓','🍕','💆','🏋️','🎨','🎤','🤝','🎁','🌟','🎭','☕'];
const NEWS_EMOJIS    = ['📢','🔥','🌟','🎁','📅','💡','🤝','🏆','🎉','📸','🗞️','✨'];
const PARTNER_EMOJIS = ['🏪','💆','💄','🍽️','☕','🎓','🏋️','💅','🎉','🛍️','🎭','🌿'];

// Admin panel always uses dark theme
const A = {
  gold:    '#C9A84C',
  goldL:   '#E8C76D',
  goldDim: 'rgba(201,168,76,0.12)',
  goldBrd: 'rgba(201,168,76,0.3)',
  blue:    '#4A90D9',
  blueDim: 'rgba(74,144,217,0.12)',
  green:   '#4BB34B',
  red:     '#E64646',
  redDim:  'rgba(230,70,70,0.12)',
  redBrd:  'rgba(230,70,70,0.3)',
  text:    '#F0F0F0',
  textSec: 'rgba(240,240,240,0.45)',
  border:  'rgba(255,255,255,0.08)',
  rowBrd:  'rgba(255,255,255,0.07)',
  chip:    'rgba(255,255,255,0.07)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBrd:'rgba(255,255,255,0.1)',
};

const s = {
  page: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'linear-gradient(160deg, #0C0C1E 0%, #14142A 100%)',
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowY: 'auto',
    background: 'rgba(255,255,255,0.025)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    padding: '20px 12px',
    boxSizing: 'border-box',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 28px',
    boxSizing: 'border-box',
    maxWidth: 960,
  },
  card:     {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(28px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  h1:       { fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#F0F0F0' },
  h2:       { fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#F0F0F0' },
  label:    {
    fontSize: 11, color: 'rgba(240,240,240,0.45)', marginBottom: 6,
    display: 'block', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  input:    {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
    color: '#F0F0F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  },
  textarea: {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
    color: '#F0F0F0', fontSize: 14, boxSizing: 'border-box', outline: 'none',
    marginBottom: 12, minHeight: 80, resize: 'vertical',
  },
  btn:      { padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPri:   { background: 'linear-gradient(135deg, #C9A84C, #E8C76D)', color: '#0F0F1A', fontWeight: 700 },
  btnDanger:{ background: 'rgba(230,70,70,0.12)', color: '#E64646', border: '1px solid rgba(230,70,70,0.3)' },
  btnGray:  { background: 'rgba(255,255,255,0.07)', color: '#F0F0F0', border: '1px solid rgba(255,255,255,0.1)' },
  row:      {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  emojiGrid:{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  emojiBtn: {
    width: 42, height: 42, borderRadius: 12, border: '2px solid transparent',
    cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'rgba(255,255,255,0.06)',
  },
  select:   {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
    color: '#F0F0F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  },
  tabs:     { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tab:      { padding: '9px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'center' },
};

function MiniBarChart({ data, labelKey, valueKey, color = A.gold, shortDate = false }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, paddingTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.max(Math.round((d[valueKey] / max) * 60), d[valueKey] > 0 ? 4 : 1);
        const label = shortDate ? d[labelKey].slice(5).replace('-', '/') : d[labelKey];
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {d[valueKey] > 0 && <div style={{ fontSize: 9, fontWeight: 700, color }}>{d[valueKey]}</div>}
            <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', height: h, opacity: d[valueKey] > 0 ? 1 : 0.15, transition: 'height 0.4s ease' }} />
            <div style={{ fontSize: 8, color: A.textSec, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmojiPicker({ emojis, value, onChange }) {
  return (
    <div style={s.emojiGrid}>
      {emojis.map(emoji => (
        <button key={emoji} onClick={() => onChange(emoji)} style={{
          ...s.emojiBtn,
          border: value === emoji ? `2px solid ${A.gold}` : '2px solid transparent',
          background: value === emoji ? A.goldDim : 'rgba(255,255,255,0.06)',
        }}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

const ADMIN_PASSWORD = 'RealMadrid2025!';

function PasswordGate({ onAllow }) {
  const [pwd, setPwd]       = useState('');
  const [shake, setShake]   = useState(false);
  const [show, setShow]     = useState(false);

  const check = () => {
    if (pwd === ADMIN_PASSWORD) { onAllow(); }
    else { setShake(true); setTimeout(() => setShake(false), 600); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0C0C1E 0%, #14142A 100%)', padding: 24,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(28px)',
        borderRadius: 24, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: shake ? 'translateX(0)' : 'none',
        animation: shake ? 'shakeX 0.5s ease' : 'none',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <h2 style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Панель управления</h2>
        <p style={{ color: 'rgba(240,240,240,0.45)', fontSize: 13, margin: '0 0 24px' }}>АПГ — Альянс Партнёров Города</p>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={show ? 'text' : 'password'}
            placeholder="Введите пароль"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            style={{
              width: '100%', padding: '13px 44px 13px 16px', borderRadius: 14, boxSizing: 'border-box',
              border: shake ? '1px solid #E64646' : '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)', color: '#F0F0F0', fontSize: 15, outline: 'none',
              transition: 'border 0.2s',
            }}
          />
          <button onClick={() => setShow(v => !v)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0,
          }}>{show ? '🙈' : '👁️'}</button>
        </div>
        {shake && <p style={{ color: '#E64646', fontSize: 12, margin: '0 0 12px' }}>Неверный пароль</p>}
        <button onClick={check} style={{
          width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #C9A84C, #E8C76D)', color: '#0F0F1A',
          fontSize: 15, fontWeight: 700, boxShadow: '0 4px 16px rgba(201,168,76,0.35)',
        }}>Войти</button>
      </div>
      <style>{`@keyframes shakeX {
        0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)}
        60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
      }`}</style>
    </div>
  );
}

function MonthlyWinnersCard({ partners }) {
  const [winners, setWinners]   = useState([]);
  const [loaded, setLoaded]     = useState(false);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'monthlyWinners'), orderBy('awardedAt', 'desc'), limit(12)));
    setWinners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoaded(true);
  };

  if (!loaded) {
    return (
      <div style={{ ...A.card ?? {}, background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, marginTop: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>🗓️ Победители прошлых месяцев</span>
          <button onClick={load} style={{ fontSize: 12, color: A.gold, background: 'transparent', border: `1px solid ${A.goldBrd}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
            Загрузить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, marginTop: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: '#F0F0F0' }}>🗓️ Победители прошлых месяцев</h2>
      {winners.length === 0 ? (
        <p style={{ color: A.textSec, textAlign: 'center', fontSize: 13, margin: 0 }}>Пока никого нет</p>
      ) : winners.map(w => {
        const partner = partners.find(p => p.id === w.partnerId);
        return (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 11, color: A.gold, fontWeight: 700, minWidth: 52 }}>{w.id}</span>
            <span style={{ flex: 1, fontWeight: 600, color: '#F0F0F0', fontSize: 13 }}>
              {partner?.name ?? w.partnerName ?? w.partnerId}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: A.gold }}>{w.activityIndex} / 100</span>
            <span style={{ fontSize: 11, color: A.textSec }}>{w.newClients ?? 0} новых</span>
          </div>
        );
      })}
    </div>
  );
}

export const AdminPanel = () => {
  const [authed, setAuthed]         = useState(false);
  const [partners, setPartners]     = useState([]);
  const [experts, setExperts]       = useState([]);
  const [events, setEvents]         = useState([]);
  const [news, setNews]             = useState([]);
  const [notifs, setNotifs]         = useState([]);
  const [customTasks, setCustomTasks] = useState([]);
  const [prizeClaims, setPrizeClaims] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('partners');

  // Форма эксперта
  const [editingExpert, setEditingExpert] = useState(null);
  const [exName, setExName]         = useState('');
  const [exSpec, setExSpec]         = useState('');
  const [exDesc, setExDesc]         = useState('');
  const [exPhoto, setExPhoto]       = useState('');
  const [exPhone, setExPhone]       = useState('');
  const [exVkUrl, setExVkUrl]       = useState('');
  const [exBooking, setExBooking]   = useState('');
  const [exKeys, setExKeys]         = useState('1');
  const [exVerified, setExVerified] = useState(false);
  const [exVkOwnerId, setExVkOwnerId] = useState('');
  const [exActive, setExActive]     = useState(true);
  const [exOnline, setExOnline]     = useState(false);
  const [exOffline, setExOffline]   = useState(false);
  const [exGroup, setExGroup]       = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingEvent, setEditingEvent]     = useState(null);
  const [editingNews, setEditingNews]       = useState(null);
  const [qrPartner, setQrPartner]           = useState(null);
  const [analytics, setAnalytics]           = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activityLoading, setActivityLoading]   = useState(false);
  const [activityMsg, setActivityMsg]           = useState('');
  const [partnerSearch, setPartnerSearch]   = useState('');
  const [migrating, setMigrating]           = useState(false);
  const [migrateResult, setMigrateResult]   = useState(null);

  // Призы
  const [prizes, setPrizes]               = useState([]);
  const [raffleDrawing, setRaffleDrawing] = useState(null);  // prizeId в процессе
  const [raffleResult, setRaffleResult]   = useState(null);  // { prizeId, winner } или { prizeId, error }
  const [editingPrize, setEditingPrize]   = useState(null);
  const [prName, setPrName]               = useState('');
  const [prDesc, setPrDesc]               = useState('');
  const [prCost, setPrCost]               = useState('');
  const [prEmoji, setPrEmoji]             = useState('🎁');
  const [prStock, setPrStock]             = useState('');
  const [prActive, setPrActive]           = useState(true);
  const [prType, setPrType]               = useState('purchase');
  const [prTicketCost, setPrTicketCost]   = useState('');
  const [prRaffleDate, setPrRaffleDate]   = useState('');
  const [prPartnerId, setPrPartnerId]     = useState('');

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
  const [pStampTarget, setPStampTarget] = useState('');
  const [pVkOwnerId, setPVkOwnerId] = useState('');

  // Форма новости
  const [nTitle, setNTitle]         = useState('');
  const [nText, setNText]           = useState('');
  const [nEmoji, setNEmoji]         = useState('📢');
  const [nImage, setNImage]         = useState('');
  const [nLinkUrl, setNLinkUrl]     = useState('');
  const [nLinkLabel, setNLinkLabel] = useState('');
  const [nPriority, setNPriority]   = useState(0);

  // Форма уведомления
  const [ntTitle, setNtTitle]       = useState('');
  const [ntBody, setNtBody]         = useState('');
  const [ntEmoji, setNtEmoji]       = useState('🔔');
  const [ntTargetType, setNtTargetType] = useState('all');
  const [ntTargetValue, setNtTargetValue] = useState('');

  // Форма кастомного задания
  const [ctEmoji, setCtEmoji]   = useState('🎯');
  const [ctTitle, setCtTitle]   = useState('');
  const [ctDesc, setCtDesc]     = useState('');
  const [ctReward, setCtReward] = useState('');
  const [ctType, setCtType]     = useState('manual');
  const [ctTarget, setCtTarget] = useState('');

  // Форма события
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState('');
  const [ePartner, setEPartner] = useState('');
  const [eEmoji, setEEmoji] = useState('🎉');
  const [eDesc, setEDesc] = useState('');
  const [eSocial, setESocial] = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eDeadline, setEDeadline] = useState('');
  const [eIsPrivate, setEIsPrivate] = useState(false);
  const [eMinKeys, setEMinKeys] = useState('');
  const [eMaxParticipants, setEMaxParticipants] = useState('');
  const [eEventDate, setEEventDate] = useState('');
  const [eIsExpert, setEIsExpert] = useState(false);
  const [ePriceClub, setEPriceClub] = useState('');
  const [ePricePublic, setEPricePublic] = useState('');
  const [ePartnerId, setEPartnerId] = useState('');
  const [eLinkLabel, setELinkLabel] = useState('');
  const [eLinkUrl, setELinkUrl]     = useState('');
  const [ePriority, setEPriority]   = useState(0);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([vkBridge.send('VKWebAppInit'), new Promise((_, r) => setTimeout(() => r(new Error()), 1000))]);
      } catch (e) {}
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => {});
      }
      fetchData();
    };
    init();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pSnap, eSnap, nSnap, ntSnap, prSnap, ctSnap, clSnap, exSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'prizes'), orderBy('cost', 'asc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'customTasks'), orderBy('createdAt', 'asc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'prizeClaims'), orderBy('claimedAt', 'desc'), limit(100))).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'experts')).catch(() => ({ docs: [] })),
      ]);
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setExperts(exSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNotifs(ntSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPrizes(prSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomTasks(ctSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPrizeClaims(clSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const resetExpertForm = () => {
    setEditingExpert(null); setExName(''); setExSpec(''); setExDesc('');
    setExPhoto(''); setExPhone(''); setExVkUrl(''); setExBooking('');
    setExKeys('1'); setExVerified(false); setExActive(true); setExVkOwnerId('');
    setExOnline(false); setExOffline(false); setExGroup(false);
  };

  const startEditExpert = (ex) => {
    setEditingExpert(ex);
    setExName(ex.name ?? ''); setExSpec(ex.specialization ?? ''); setExDesc(ex.description ?? '');
    setExPhoto(ex.photo ?? ''); setExPhone(ex.phone ?? ''); setExVkUrl(ex.vkUrl ?? '');
    setExBooking(ex.bookingUrl ?? ''); setExKeys(String(ex.keys ?? 1));
    setExVerified(ex.verified ?? false); setExActive(ex.active !== false);
    setExVkOwnerId(String(ex.vkOwnerId ?? ''));
    setExOnline(ex.formats?.includes('online') ?? false);
    setExOffline(ex.formats?.includes('offline') ?? false);
    setExGroup(ex.formats?.includes('group') ?? false);
    window.scrollTo(0, 0);
  };

  const saveExpert = async () => {
    if (!exName.trim()) return;
    const formats = [exOnline && 'online', exOffline && 'offline', exGroup && 'group'].filter(Boolean);
    const data = {
      name: exName.trim(), specialization: exSpec.trim(), description: exDesc.trim(),
      photo: exPhoto.trim(), phone: exPhone.trim(), vkUrl: exVkUrl.trim(),
      bookingUrl: exBooking.trim(), keys: Number(exKeys) || 1,
      verified: exVerified, active: exActive, formats,
      vkOwnerId: exVkOwnerId.trim() || null,
    };
    if (editingExpert) {
      await updateDoc(doc(db, 'experts', editingExpert.id), data);
    } else {
      await addDoc(collection(db, 'experts'), { ...data, avgRating: 0, reviewCount: 0, createdAt: serverTimestamp() });
    }
    resetExpertForm();
    fetchData();
  };

  const deleteExpert = async (id) => {
    if (!window.confirm('Удалить эксперта?')) return;
    await deleteDoc(doc(db, 'experts', id));
    fetchData();
  };

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartnerForm = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪'); setPLogo('');
    setPPhone(''); setPAddress(''); setPHours(''); setPSocial(''); setPOffer('');
    setPStampTarget(''); setPVkOwnerId('');
    setEditingPartner(null);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? ''); setPDesc(p.description ?? ''); setPCategory(p.category ?? 'other');
    setPEmoji(p.emoji ?? '🏪'); setPLogo(p.logoUrl ?? ''); setPPhone(p.phone ?? '');
    setPAddress(p.address ?? ''); setPHours(p.hours ?? ''); setPSocial(p.socialUrl ?? '');
    setPOffer(p.offer ?? ''); setPStampTarget(p.stampTarget ? String(p.stampTarget) : '');
    setPVkOwnerId(p.vkOwnerId ?? '');
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
      stampTarget: Number(pStampTarget) || 0,
      vkOwnerId: pVkOwnerId.trim() || null,
    };
    if (editingPartner) {
      await updateDoc(doc(db, 'partners', editingPartner.id), data);
    } else {
      await addDoc(collection(db, 'partners'), { ...data, createdAt: serverTimestamp() });
    }
    resetPartnerForm();
    fetchData();
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Удалить партнёра?')) return;
    await deleteDoc(doc(db, 'partners', id));
    fetchData();
  };

  // ─── Сортировка (shared) ────────────────────────────────────────────────────

  const byPriorityDate = (a, b) => {
    const dp = (b.priority ?? 0) - (a.priority ?? 0);
    if (dp !== 0) return dp;
    const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ?? 0);
    const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ?? 0);
    return tb - ta;
  };

  const moveItem = async (col, items, setItems, item, dir) => {
    const sorted = [...items].sort(byPriorityDate);
    const idx    = sorted.findIndex(x => x.id === item.id);
    const swap   = sorted[idx + dir];
    if (!swap) return;
    const a = item.priority ?? 0;
    const b = swap.priority ?? 0;
    const [newA, newB] = a === b
      ? dir === -1
        ? [Math.min(10, a + 1), b]
        : [a, Math.min(10, b + 1)]
      : [b, a];
    await Promise.all([
      updateDoc(doc(db, col, item.id), { priority: newA }),
      newB !== b ? updateDoc(doc(db, col, swap.id), { priority: newB }) : Promise.resolve(),
    ]);
    setItems(prev => prev.map(x =>
      x.id === item.id ? { ...x, priority: newA } :
      x.id === swap.id ? { ...x, priority: newB } : x
    ));
  };

  // ─── Новости ────────────────────────────────────────────────────────────────

  const resetNewsForm = () => {
    setNTitle(''); setNText(''); setNEmoji('📢'); setNImage('');
    setNLinkUrl(''); setNLinkLabel(''); setNPriority(0);
    setEditingNews(null);
  };

  const startEditNews = (item) => {
    setEditingNews(item);
    setNTitle(item.title ?? ''); setNText(item.text ?? '');
    setNEmoji(item.emoji ?? '📢'); setNImage(item.imageUrl ?? '');
    setNLinkUrl(item.linkUrl ?? ''); setNLinkLabel(item.linkLabel ?? '');
    setNPriority(item.priority ?? 0);
    window.scrollTo(0, 0);
  };

  const saveNews = async () => {
    if (!nTitle.trim() || !nText.trim()) return;
    const data = {
      title: nTitle.trim(),
      text: nText.trim(),
      emoji: nEmoji,
      imageUrl: nImage.trim(),
      linkUrl: nLinkUrl.trim(),
      linkLabel: nLinkLabel.trim(),
      priority: Number(nPriority) || 0,
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

  const resetNotifForm = () => { setNtTitle(''); setNtBody(''); setNtEmoji('🔔'); setNtTargetType('all'); setNtTargetValue(''); };

  const sendNotif = async () => {
    if (!ntTitle.trim()) return;
    const data = {
      title: ntTitle.trim(),
      body: ntBody.trim(),
      emoji: ntEmoji,
      targetType: ntTargetType,
      createdAt: serverTimestamp(),
    };
    if (ntTargetType !== 'all' && ntTargetValue) data.targetValue = Number(ntTargetValue);
    await addDoc(collection(db, 'notifications'), data);
    resetNotifForm();
    fetchData();
  };

  // ─── Кастомные задания ───────────────────────────────────────────────────────

  const resetCtForm = () => { setCtEmoji('🎯'); setCtTitle(''); setCtDesc(''); setCtReward(''); setCtType('manual'); setCtTarget(''); };

  const saveCustomTask = async () => {
    if (!ctTitle.trim() || !ctReward) return;
    const data = {
      emoji: ctEmoji, title: ctTitle.trim(), desc: ctDesc.trim(),
      reward: Number(ctReward), type: ctType,
      createdAt: serverTimestamp(),
    };
    if (ctType !== 'manual' && ctTarget) data.target = Number(ctTarget);
    await addDoc(collection(db, 'customTasks'), data);
    resetCtForm();
    fetchData();
  };

  const deleteCustomTask = async (id) => {
    if (!window.confirm('Удалить задание?')) return;
    await deleteDoc(doc(db, 'customTasks', id));
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
    setEDesc(''); setESocial(''); setEAddress(''); setEDeadline('');
    setEIsPrivate(false); setEMinKeys(''); setEMaxParticipants(''); setEEventDate('');
    setEIsExpert(false); setEPriceClub(''); setEPricePublic('');
    setEPartnerId('');
    setELinkLabel(''); setELinkUrl(''); setEPriority(0);
    setEditingEvent(null);
  };

  const startEditEvent = (e) => {
    setEditingEvent(e);
    setETitle(e.title ?? ''); setEDate(e.date ?? ''); setEPartner(e.partner ?? '');
    setEEmoji(e.emoji ?? '🎉'); setEDesc(e.description ?? '');
    setESocial(e.socialUrl ?? ''); setEAddress(e.address ?? '');
    setEDeadline(e.deadline ?? '');
    setEIsPrivate(e.isPrivate ?? false);
    setEMinKeys(e.minKeys != null ? String(e.minKeys) : '');
    setEMaxParticipants(e.maxParticipants != null ? String(e.maxParticipants) : '');
    setEEventDate(e.eventDate ?? '');
    setEIsExpert(e.isExpertEvent ?? false);
    setEPriceClub(e.priceClub ?? '');
    setEPricePublic(e.pricePublic ?? '');
    setEPartnerId(e.partnerId ?? '');
    setELinkLabel(e.linkLabel ?? ''); setELinkUrl(e.linkUrl ?? '');
    setEPriority(e.priority ?? 0);
    window.scrollTo(0, 0);
  };

  const saveEvent = async () => {
    if (!eTitle.trim()) return;
    const data = {
      title: eTitle.trim(), date: eDate.trim(), partner: ePartner.trim(),
      emoji: eEmoji, description: eDesc.trim(),
      socialUrl: eSocial.trim(), address: eAddress.trim(),
      deadline: eDeadline.trim(),
      isPrivate: eIsPrivate,
      minKeys: eMinKeys !== '' ? Number(eMinKeys) : 0,
      maxParticipants: eMaxParticipants !== '' ? Number(eMaxParticipants) : 0,
      eventDate: eEventDate.trim(),
      isExpertEvent: eIsExpert,
      priceClub: ePriceClub.trim(),
      pricePublic: ePricePublic.trim(),
      partnerId: ePartnerId || null,
      linkLabel: eLinkLabel.trim(),
      linkUrl:   eLinkUrl.trim(),
      priority:  Number(ePriority) || 0,
    };
    if (editingEvent) {
      await updateDoc(doc(db, 'events', editingEvent.id), data);
    } else {
      await addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() });
    }
    resetEventForm();
    fetchData();
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Удалить событие?')) return;
    await deleteDoc(doc(db, 'events', id));
    fetchData();
  };

  // ─── Партнёр дня ────────────────────────────────────────────────────────────

  const setFeaturedPartner = useCallback(async (partnerId) => {
    const batch = writeBatch(db);
    partners.forEach(p => {
      batch.update(doc(db, 'partners', p.id), { featured: partnerId !== null && p.id === partnerId });
    });
    await batch.commit();
    fetchData();
  }, [partners]);

  // ─── Призы ──────────────────────────────────────────────────────────────────

  const PRIZE_EMOJIS = ['🎁','☕','🍕','💆','💄','🎓','🏋️','🎟️','🛍️','🎉','🌿','🍰','🎸','📚','🎨','🤝','🏆','🌟','🎭','💅'];

  const resetPrizeForm = () => {
    setPrName(''); setPrDesc(''); setPrCost(''); setPrEmoji('🎁');
    setPrStock(''); setPrActive(true); setEditingPrize(null);
    setPrType('purchase'); setPrTicketCost(''); setPrRaffleDate('');
    setPrPartnerId('');
  };

  const startEditPrize = (p) => {
    setEditingPrize(p);
    setPrName(p.name ?? ''); setPrDesc(p.description ?? '');
    setPrCost(String(p.cost ?? '')); setPrEmoji(p.emoji ?? '🎁');
    setPrStock(p.stock !== null && p.stock !== undefined ? String(p.stock) : '');
    setPrActive(p.active !== false);
    setPrType(p.type ?? 'purchase');
    setPrTicketCost(p.ticketCost !== undefined ? String(p.ticketCost) : '');
    setPrRaffleDate(p.raffleDate?.toDate ? p.raffleDate.toDate().toISOString().slice(0, 16) : '');
    setPrPartnerId(p.partnerId ?? '');
    window.scrollTo(0, 0);
  };

  const savePrize = async () => {
    if (!prName.trim() || !prCost) return;
    const data = {
      name: prName.trim(), description: prDesc.trim(),
      cost: Number(prCost), emoji: prEmoji,
      stock: prStock !== '' ? Number(prStock) : null,
      active: prActive,
      type: prType,
      partnerId: prPartnerId || null,
    };
    if (prType === 'raffle') {
      data.ticketCost = prTicketCost !== '' ? Number(prTicketCost) : 1;
      data.raffleDate = prRaffleDate ? new Date(prRaffleDate) : null;
    }
    if (editingPrize) {
      await updateDoc(doc(db, 'prizes', editingPrize.id), data);
    } else {
      await addDoc(collection(db, 'prizes'), { ...data, createdAt: serverTimestamp() });
    }
    resetPrizeForm();
    fetchData();
  };

  const deletePrize = async (id) => {
    if (!window.confirm('Удалить приз?')) return;
    await deleteDoc(doc(db, 'prizes', id));
    fetchData();
  };

  const CATEGORY_MIGRATION = {
    edu:     { id: 'education',     label: 'Обучение' },
    fun:     { id: 'entertainment', label: 'Развлечения' },
    shop:    { id: 'other',         label: 'Другое' },
    kids:    { id: 'other',         label: 'Другое' },
    service: { id: 'services',      label: 'Услуги' },
    home:    { id: 'home',          label: 'Дом и ремонт' },
  };

  const migrateCategories = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const snap = await getDocs(collection(db, 'partners'));
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(d => {
        const p = d.data();
        const mapping = CATEGORY_MIGRATION[p.category];
        if (mapping) {
          batch.update(doc(db, 'partners', d.id), { category: mapping.id, categoryLabel: mapping.label });
          count++;
        }
      });
      if (count > 0) await batch.commit();
      setMigrateResult(`Обновлено: ${count} партнёров`);
      fetchData();
    } catch (e) {
      setMigrateResult(`Ошибка: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const drawRaffle = async (prize) => {
    if (!window.confirm(`Провести розыгрыш «${prize.name}»? Победитель будет выбран случайно.`)) return;
    setRaffleDrawing(prize.id);
    setRaffleResult(null);
    try {
      const res = await fetch('/api/raffle-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'apg2026raffle', prizeId: prize.id }),
      });
      const data = await res.json();
      if (data.winner) {
        setRaffleResult({ prizeId: prize.id, winner: data.winner.userName });
        fetchData();
      } else if (data.skipped) {
        setRaffleResult({ prizeId: prize.id, error: data.skipped });
      } else {
        setRaffleResult({ prizeId: prize.id, error: data.error ?? 'Неизвестная ошибка' });
      }
    } catch (e) {
      setRaffleResult({ prizeId: prize.id, error: e.message });
    } finally {
      setRaffleDrawing(null);
    }
  };

  // ─── Начисление ключей ──────────────────────────────────────────────────────

  const [awardUserId, setAwardUserId] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [awardMsg, setAwardMsg]       = useState('');

  const awardKeys = async () => {
    if (!awardUserId.trim() || !Number(awardAmount)) return;
    setAwardMsg('Начисляем...');
    try {
      await updateDoc(doc(db, 'users', awardUserId.trim()), { keys: increment(Number(awardAmount)) });
      setAwardMsg(`✅ +${awardAmount} ключей начислено`);
      setAwardUserId(''); setAwardAmount('');
    } catch { setAwardMsg('❌ Ошибка — проверьте ID'); }
    setTimeout(() => setAwardMsg(''), 3000);
  };

  const exportCSV = () => {
    if (!analytics?.users?.length) return;
    const header = ['ID', 'Имя', 'Ключи', 'Стрик', 'Партнёров посещено', 'Задач выполнено', 'Рефералов'];
    const rows = analytics.users.map(u => [
      u.id,
      u.name ?? '',
      u.keys ?? 0,
      u.streak ?? 0,
      Object.keys(u.scannedPartners ?? {}).length,
      Array.isArray(u.completedTasks) ? u.completedTasks.length : (u.tasksCompleted ?? 0),
      u.referrals ?? 0,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apg_users_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  // ─── Аналитика ──────────────────────────────────────────────────────────────

  const loadAnalytics = useCallback(async () => {
    if (analyticsLoading) return;
    setAnalyticsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const totalUsers  = users.length;
      const totalKeys   = users.reduce((s, u) => s + (u.keys ?? 0), 0);
      const avgKeys     = totalUsers > 0 ? (totalKeys / totalUsers).toFixed(1) : 0;
      const activeUsers = users.filter(u => (u.keys ?? 0) > 0).length;
      const totalScans  = users.reduce((s, u) => s + Object.keys(u.scannedPartners ?? {}).length, 0);

      const visitCounts = {};
      users.forEach(u => {
        Object.keys(u.scannedPartners ?? {}).forEach(pid => {
          visitCounts[pid] = (visitCounts[pid] ?? 0) + 1;
        });
      });
      const partnerStats = partners
        .map(p => ({ ...p, visits: visitCounts[p.id] ?? 0 }))
        .sort((a, b) => b.visits - a.visits);

      const today = new Date();
      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (13 - i));
        return d.toISOString().slice(0, 10);
      });
      const dauMap = {};
      last14.forEach(date => { dauMap[date] = 0; });
      users.forEach(u => {
        (u.scanDates ?? []).forEach(date => {
          if (dauMap[date] !== undefined) dauMap[date]++;
        });
      });
      const dauData = last14.map(date => ({ date, count: dauMap[date] }));

      // Регистрации по дням (последние 30 дней)
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      });
      const regMap = {};
      last30.forEach(date => { regMap[date] = 0; });
      const cutoff7  = new Date(today); cutoff7.setDate(cutoff7.getDate() - 7);
      const cutoff30 = new Date(today); cutoff30.setDate(cutoff30.getDate() - 30);
      let newUsers7d = 0, newUsers30d = 0;
      users.forEach(u => {
        const ts = u.registeredAt?.toDate ? u.registeredAt.toDate() : null;
        if (!ts) return;
        const dateStr = ts.toISOString().slice(0, 10);
        if (regMap[dateStr] !== undefined) regMap[dateStr]++;
        if (ts >= cutoff7)  newUsers7d++;
        if (ts >= cutoff30) newUsers30d++;
      });
      const regGrowthData = last30.map(date => ({ date, count: regMap[date] }));

      // Активные за последние 7 дней — по lastSeen или lastBonusDate
      const cutoff7str = cutoff7.toISOString().slice(0, 10);
      const activeUsers7d = users.filter(u => {
        if (u.lastSeen?.toDate) return u.lastSeen.toDate() >= cutoff7;
        return (u.lastBonusDate ?? '') >= cutoff7str;
      }).length;

      const topUsers = [...users]
        .sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0))
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || `#${u.id.slice(0, 6)}`,
          keys: u.keys ?? 0,
          scans: Object.keys(u.scannedPartners ?? {}).length,
        }));

      const keyBuckets = [
        { label: '0',    min: 0,  max: 0,        count: 0 },
        { label: '1-5',  min: 1,  max: 5,        count: 0 },
        { label: '6-15', min: 6,  max: 15,       count: 0 },
        { label: '16-30',min: 16, max: 30,       count: 0 },
        { label: '31-50',min: 31, max: 50,       count: 0 },
        { label: '51+',  min: 51, max: Infinity, count: 0 },
      ];
      users.forEach(u => {
        const k = u.keys ?? 0;
        const b = keyBuckets.find(b => k >= b.min && k <= b.max);
        if (b) b.count++;
      });

      const referredCount   = users.filter(u => u.referredBy).length;
      const totalReferrals  = users.reduce((s, u) => s + (u.referralCount ?? 0), 0);
      const referralKeysOut = referredCount * 2 + totalReferrals * 2;

      setAnalytics({
        totalUsers, totalKeys, avgKeys, activeUsers, totalScans,
        partnerStats, users,
        dauData, topUsers, keyBuckets,
        referredCount, totalReferrals, referralKeysOut,
        newUsers7d, newUsers30d, regGrowthData, activeUsers7d,
      });
    } catch (e) { console.error(e); }
    setAnalyticsLoading(false);
  }, [partners, analyticsLoading]);

  if (!authed) return <PasswordGate onAllow={() => setAuthed(true)} />;

  return (
    <div style={s.page}>
      {/* Боковое меню */}
      <aside style={s.sidebar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #C9A84C, #E8C76D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 12px rgba(201,168,76,0.35)' }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: A.text, lineHeight: 1.3 }}>Управление</div>
            <div style={{ fontSize: 10, color: A.gold, fontWeight: 700, letterSpacing: 0.5 }}>АПГ Зеленоград</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { id: 'partners',  emoji: '🤝', label: 'Партнёры',  count: partners.length },
            { id: 'experts',   emoji: '🧑‍💼', label: 'Эксперты',  count: experts.length },
            { id: 'events',    emoji: '🎉', label: 'События',   count: events.length },
            { id: 'news',      emoji: '📢', label: 'Новости',   count: news.length },
            { id: 'notifs',    emoji: '🔔', label: 'Рассылка' },
            { id: 'tasks',     emoji: '✅', label: 'Задания',   count: customTasks.length },
            { id: 'prizes',    emoji: '🎁', label: 'Призы',     count: prizes.length },
            { id: 'activity',  emoji: '🏆', label: 'Активность' },
            { id: 'analytics', emoji: '📊', label: 'Аналитика' },
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id}
                onClick={() => { setActiveTab(t.id); if (t.id === 'analytics' && !analytics) loadAnalytics(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(201,168,76,0.13)' : 'transparent',
                  borderLeft: active ? `3px solid ${A.gold}` : '3px solid transparent',
                  color: active ? A.gold : A.textSec,
                  fontSize: 13, fontWeight: active ? 700 : 400,
                  textAlign: 'left', width: '100%', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{t.emoji}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {t.count != null && t.count > 0 && (
                  <span style={{ fontSize: 11, background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.08)', color: active ? A.gold : A.textSec, padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Основной контент */}
      <div style={s.content}>

      {/* ── ЭКСПЕРТЫ ── */}
      {activeTab === 'experts' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>{editingExpert ? `✏️ ${editingExpert.name}` : '➕ Новый эксперт'}</h2>

            <label style={s.label}>Имя *</label>
            <input style={s.input} placeholder="Анна Смирнова" value={exName} onChange={e => setExName(e.target.value)} />

            <label style={s.label}>Специализация *</label>
            <input style={s.input} placeholder="Психолог, коуч, нутрициолог..." value={exSpec} onChange={e => setExSpec(e.target.value)} />

            <label style={s.label}>Описание</label>
            <MdEditor value={exDesc} onChange={setExDesc} placeholder="Расскажите об эксперте..." style={s.textarea} />

            <label style={s.label}>Фото (URL)</label>
            <input style={s.input} placeholder="https://..." value={exPhoto} onChange={e => setExPhoto(e.target.value)} />
            {exPhoto && <img src={exPhoto} alt="" loading="lazy" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} onError={e => e.target.style.display='none'} />}

            <label style={s.label}>Телефон</label>
            <input style={s.input} placeholder="+7 999 000-00-00" value={exPhone} onChange={e => setExPhone(e.target.value)} />

            <label style={s.label}>ВКонтакте (URL)</label>
            <input style={s.input} placeholder="https://vk.com/..." value={exVkUrl} onChange={e => setExVkUrl(e.target.value)} />

            <label style={s.label}>Ссылка для записи</label>
            <input style={s.input} placeholder="https://..." value={exBooking} onChange={e => setExBooking(e.target.value)} />

            <label style={s.label}>Ключей за QR-скан</label>
            <input style={s.input} type="number" min="1" max="5" placeholder="1" value={exKeys} onChange={e => setExKeys(e.target.value)} />

            <label style={s.label}>VK ID владельца (для личной ссылки)</label>
            <input style={s.input} placeholder="123456789" value={exVkOwnerId} onChange={e => setExVkOwnerId(e.target.value)} />

            <label style={s.label}>Форматы работы</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[['online','💻 Онлайн', exOnline, setExOnline], ['offline','📍 Офлайн', exOffline, setExOffline], ['group','👥 Группа', exGroup, setExGroup]].map(([key, lbl, val, setter]) => (
                <button key={key} onClick={() => setter(v => !v)} style={{ padding: '8px 14px', borderRadius: 12, border: `2px solid ${val ? A.gold : A.border}`, background: val ? A.goldDim : 'transparent', color: val ? A.gold : A.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {lbl}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: A.text }}>
                <input type="checkbox" checked={exVerified} onChange={e => setExVerified(e.target.checked)} />
                ✓ Верифицирован АПГ
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: A.text }}>
                <input type="checkbox" checked={exActive} onChange={e => setExActive(e.target.checked)} />
                Активен
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveExpert} style={{ ...s.btn, ...s.btnPri, flex: 1 }}>
                {editingExpert ? 'Сохранить' : 'Добавить'}
              </button>
              {editingExpert && (
                <button onClick={resetExpertForm} style={{ ...s.btn, ...s.btnGray }}>Отмена</button>
              )}
            </div>
          </div>

          {/* Список экспертов */}
          <div style={s.card}>
            <h2 style={s.h2}>Список экспертов ({experts.length})</h2>
            {experts.length === 0 ? (
              <p style={{ color: A.textSec, fontSize: 14, margin: 0 }}>Экспертов пока нет.</p>
            ) : experts.map(ex => (
              <div key={ex.id} style={s.row}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  {ex.photo
                    ? <img src={ex.photo} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: A.goldDim, border: `1px solid ${A.goldBrd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🧑‍💼</div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: A.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {ex.name}
                      {ex.verified && <span style={{ fontSize: 10, color: A.blue, fontWeight: 800 }}>✓</span>}
                      {!ex.active && <span style={{ fontSize: 10, color: A.textSec }}>(неактивен)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: A.textSec }}>{ex.specialization}</div>
                    {(ex.avgRating ?? 0) > 0 && <div style={{ fontSize: 10, color: '#FFD700' }}>{'★'.repeat(Math.round(ex.avgRating ?? 0))} {ex.avgRating?.toFixed(1)} ({ex.reviewCount ?? 0})</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startEditExpert(ex)} style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }}>✏️</button>
                  <button onClick={() => deleteExpert(ex.id)} style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }}>🗑</button>
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
            <MdEditor value={pDesc} onChange={setPDesc} placeholder="Краткое описание..." style={s.textarea} />

            <label style={s.label}>Специальное предложение для участников АПГ 🎁</label>
            <input style={s.input} placeholder="Скидка 10% на первый визит" value={pOffer} onChange={e => setPOffer(e.target.value)} />

            <label style={s.label}>Штамп-карта: посещений до награды (0 = выключено) 🎟️</label>
            <input style={s.input} type="number" min="0" max="20" placeholder="Например: 5" value={pStampTarget} onChange={e => setPStampTarget(e.target.value)} />

            <label style={s.label}>Категория</label>
            <select style={s.select} value={pCategory} onChange={e => setPCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PARTNER_EMOJIS} value={pEmoji} onChange={setPEmoji} />

            <label style={s.label}>Ссылка на логотип (URL)</label>
            <input style={s.input} placeholder="https://..." value={pLogo} onChange={e => setPLogo(e.target.value)} />
            {pLogo && <img src={pLogo} alt="" loading="lazy" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, border: `2px solid ${A.goldBrd}` }} onError={e => e.target.style.display = 'none'} />}

            <label style={s.label}>Телефон</label>
            <input style={s.input} placeholder="+7 (499) 123-45-67" value={pPhone} onChange={e => setPPhone(e.target.value)} />

            <label style={s.label}>Адрес</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={pAddress} onChange={e => setPAddress(e.target.value)} />

            <label style={s.label}>Часы работы</label>
            <input style={s.input} placeholder="Пн-Пт 10:00-20:00, Сб-Вс 11:00-18:00" value={pHours} onChange={e => setPHours(e.target.value)} />

            <label style={s.label}>Соцсеть / сайт</label>
            <input style={s.input} placeholder="https://vk.com/..." value={pSocial} onChange={e => setPSocial(e.target.value)} />

            <div style={{ background: A.goldDim, border: `1px solid ${A.goldBrd}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
              <label style={{ ...s.label, color: A.gold, marginBottom: 6 }}>🔑 VK ID владельца заведения</label>
              <input
                style={{ ...s.input, marginBottom: 0, background: 'rgba(255,255,255,0.06)' }}
                placeholder="Например: 123456789"
                value={pVkOwnerId}
                onChange={e => setPVkOwnerId(e.target.value)}
              />
              <div style={{ fontSize: 11, color: A.gold, marginTop: 6, opacity: 0.8 }}>
                Пользователь с этим VK ID получит доступ к статистике своего заведения в приложении
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={savePartner}>
                {editingPartner ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPartner && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartnerForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ ...s.h2, margin: 0 }}>Все партнёры</h2>
              <span style={{ fontSize: 12, color: A.textSec, background: A.chip, borderRadius: 10, padding: '3px 10px', border: `1px solid ${A.border}` }}>
                {partnerSearch
                  ? `${partners.filter(p => p.name?.toLowerCase().includes(partnerSearch.toLowerCase())).length} / ${partners.length}`
                  : `${partners.length} партнёров`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: 'rgba(201,168,76,0.08)', borderRadius: 12, border: `1px solid ${A.goldBrd}` }}>
              <div style={{ flex: 1, fontSize: 12, color: A.textSec }}>
                {migrateResult ?? 'Обновить старые категории (edu→education, fun→entertainment, service→services и др.)'}
              </div>
              <button
                style={{ ...s.btn, ...s.btnPri, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}
                onClick={migrateCategories}
                disabled={migrating}
              >
                {migrating ? '...' : '🔄 Мигрировать'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: A.inputBg, border: `1px solid ${A.inputBrd}`, borderRadius: 12, padding: '9px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: A.textSec, flexShrink: 0 }}>🔍</span>
              <input
                type="search"
                placeholder="Поиск по названию..."
                value={partnerSearch}
                onChange={e => setPartnerSearch(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, flex: 1, color: A.text }}
              />
              {partnerSearch && (
                <button onClick={() => setPartnerSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: A.textSec, fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
              )}
            </div>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : partners.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет партнёров</p>
              : partners.filter(p => !partnerSearch || p.name?.toLowerCase().includes(partnerSearch.toLowerCase())).map(p => (
                <div key={p.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {p.logoUrl
                      ? <img src={p.logoUrl} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: A.chip, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1px solid ${A.border}` }}>{p.emoji ?? '🏪'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: A.textSec }}>
                        {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                        {p.offer && ' · 🎁'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      title={p.featured ? 'Партнёр дня (снять)' : 'Сделать партнёром дня'}
                      style={{ ...s.btn, padding: '6px 10px', fontSize: 14, background: p.featured ? A.goldDim : A.chip, border: p.featured ? `1.5px solid ${A.gold}` : `1px solid ${A.border}` }}
                      onClick={() => setFeaturedPartner(p.featured ? null : p.id)}
                    >⭐</button>
                    <button style={{ ...s.btn, padding: '6px 10px', fontSize: 11, fontWeight: 700, background: A.blueDim, color: A.blue, border: `1px solid rgba(74,144,217,0.3)` }} onClick={() => setQrPartner(p)}>QR</button>
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

            <label style={s.label}>Партнёр АПГ (для индекса активности)</label>
            <select
              style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }}
              value={ePartnerId}
              onChange={e => setEPartnerId(e.target.value)}
            >
              <option value="">— Не привязывать —</option>
              {[...partners].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <label style={s.label}>Описание</label>
            <MdEditor value={eDesc} onChange={setEDesc} placeholder="Подробное описание..." style={s.textarea} />

            <label style={s.label}>Ссылка на соцсеть / регистрацию</label>
            <input style={s.input} placeholder="https://vk.com/event..." value={eSocial} onChange={e => setESocial(e.target.value)} />

            <label style={s.label}>Название кнопки-ссылки (необязательно)</label>
            <input style={s.input} placeholder="Зарегистрироваться, Купить билет..." value={eLinkLabel} onChange={e => setELinkLabel(e.target.value)} />

            <label style={s.label}>URL кнопки-ссылки</label>
            <input style={s.input} placeholder="https://..." value={eLinkUrl} onChange={e => setELinkUrl(e.target.value)} />

            <label style={s.label}>Приоритет показа</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input
                type="number" min="0" max="10"
                style={{ ...s.input, width: 80, marginBottom: 0, textAlign: 'center' }}
                value={ePriority}
                onChange={e => setEPriority(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
              />
              <div style={{ flex: 1 }}>
                <input type="range" min="0" max="10" value={ePriority}
                  onChange={e => setEPriority(Number(e.target.value))}
                  style={{ width: '100%', accentColor: A.gold }} />
              </div>
              <span style={{ fontSize: 11, color: A.textSec, flexShrink: 0 }}>
                {ePriority >= 8 ? '📌 Важно' : ePriority > 0 ? `↑ ${ePriority}` : '0 (обычный)'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: A.textSec, marginBottom: 14, lineHeight: '16px' }}>
              Чем выше число — тем выше материал в списке. По умолчанию — 0. При 8+ показывается метка 📌.
            </div>

            <label style={s.label}>Адрес проведения</label>
            <input style={s.input} placeholder="Зеленоград, корпус 1234" value={eAddress} onChange={e => setEAddress(e.target.value)} />

            <label style={s.label}>Дедлайн / конец акции ⏱️</label>
            <input style={s.input} type="date" value={eDeadline} onChange={e => setEDeadline(e.target.value)} />

            <div
              onClick={() => setEIsPrivate(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 14, marginBottom: 12, cursor: 'pointer',
                background: eIsPrivate ? A.goldDim : A.chip,
                border: `1px solid ${eIsPrivate ? A.goldBrd : A.border}`,
                transition: 'all 0.2s',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: eIsPrivate ? A.gold : A.text }}>🔒 Закрытое мероприятие</div>
                <div style={{ fontSize: 12, color: eIsPrivate ? A.gold : A.textSec, marginTop: 2, opacity: eIsPrivate ? 0.8 : 1 }}>Доступ по ключам АПГ</div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13, position: 'relative',
                background: eIsPrivate ? A.gold : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: eIsPrivate ? 21 : 3, width: 20, height: 20,
                  borderRadius: 10, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>

            {eIsPrivate && (
              <div style={{ background: A.goldDim, border: `1px solid ${A.goldBrd}`, borderRadius: 14, padding: '14px', marginBottom: 12 }}>
                <label style={{ ...s.label, color: A.gold }}>🗝️ Минимум ключей для входа</label>
                <input style={{ ...s.input, marginBottom: 12 }} type="number" min="0" placeholder="10" value={eMinKeys} onChange={e => setEMinKeys(e.target.value)} />

                <label style={{ ...s.label, color: A.gold }}>👥 Лимит участников (0 = без ограничения)</label>
                <input style={{ ...s.input, marginBottom: 12 }} type="number" min="0" placeholder="50" value={eMaxParticipants} onChange={e => setEMaxParticipants(e.target.value)} />

                <label style={{ ...s.label, color: A.gold }}>📅 Дата и время мероприятия (для таймера)</label>
                <input style={{ ...s.input, marginBottom: 0 }} type="datetime-local" value={eEventDate} onChange={e => setEEventDate(e.target.value)} />
              </div>
            )}

            {/* Эксперт-событие */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setEIsExpert(v => !v)}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: `1px solid ${eIsExpert ? 'rgba(74,144,217,0.4)' : A.border}`, background: eIsExpert ? 'rgba(74,144,217,0.12)' : A.chip, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: eIsExpert ? '#6AABEC' : A.text }}>🧑‍💼 Событие эксперта</div>
                  <div style={{ fontSize: 12, color: A.textSec, marginTop: 2 }}>Показывает метку ЭКСПЕРТ и два ценника</div>
                </div>
                <div style={{ width: 44, height: 26, borderRadius: 13, border: `1px solid ${eIsExpert ? 'rgba(74,144,217,0.5)' : A.border}`, background: eIsExpert ? '#4A90D9' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: eIsExpert ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </div>
              </button>
              {eIsExpert && (
                <div style={{ background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 14, padding: 14, marginTop: 10 }}>
                  <label style={{ ...s.label, color: '#6AABEC' }}>🗝️ Цена для клуба АПГ</label>
                  <input style={s.input} placeholder="500 ₽" value={ePriceClub} onChange={e => setEPriceClub(e.target.value)} />
                  <label style={{ ...s.label, color: '#6AABEC' }}>💰 Цена для всех</label>
                  <input style={{ ...s.input, marginBottom: 0 }} placeholder="1 200 ₽" value={ePricePublic} onChange={e => setEPricePublic(e.target.value)} />
                </div>
              )}
            </div>

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
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : events.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет событий</p>
              : [...events].sort(byPriorityDate).map((e, idx, arr) => {
                const pri = e.priority ?? 0;
                return (
                <div key={e.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{e.emoji ?? '🎉'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {pri >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: A.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>📌 {pri}</span>}
                        {pri > 0 && pri < 8 && <span style={{ fontSize: 9, fontWeight: 700, color: A.textSec, background: A.chip, border: `1px solid ${A.border}`, borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>↑ {pri}</span>}
                        <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.isPrivate ? '🔒 ' : ''}{e.title}</div>
                      </div>
                      <div style={{ fontSize: 12, color: A.textSec }}>{e.date && `📅 ${e.date}`}{e.partner && ` · ${e.partner}`}{e.isPrivate && e.minKeys > 0 && ` · мин. ${e.minKeys} 🗝️`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <button disabled={idx === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }} onClick={() => moveItem('events', events, setEvents, e, -1)}>↑</button>
                    <button disabled={idx === arr.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === arr.length - 1 ? 0.3 : 1 }} onClick={() => moveItem('events', events, setEvents, e, 1)}>↓</button>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditEvent(e)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteEvent(e.id)}>🗑️</button>
                  </div>
                </div>
                );
              })
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
              <img src={nImage} alt="" loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} onError={e => e.target.style.display = 'none'} />
            )}

            <label style={s.label}>Название ссылки (необязательно)</label>
            <input style={s.input} placeholder="Подробнее на сайте" value={nLinkLabel} onChange={e => setNLinkLabel(e.target.value)} />

            <label style={s.label}>URL ссылки</label>
            <input style={s.input} placeholder="https://..." value={nLinkUrl} onChange={e => setNLinkUrl(e.target.value)} />

            <label style={s.label}>Приоритет показа</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input
                type="number" min="0" max="10"
                style={{ ...s.input, width: 80, marginBottom: 0, textAlign: 'center' }}
                value={nPriority}
                onChange={e => setNPriority(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
              />
              <div style={{ flex: 1 }}>
                <input type="range" min="0" max="10" value={nPriority}
                  onChange={e => setNPriority(Number(e.target.value))}
                  style={{ width: '100%', accentColor: A.gold }} />
              </div>
              <span style={{ fontSize: 11, color: A.textSec, flexShrink: 0 }}>
                {nPriority >= 8 ? '📌 Важно' : nPriority > 0 ? `↑ ${nPriority}` : '0 (обычный)'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: A.textSec, marginBottom: 14, lineHeight: '16px' }}>
              Чем выше число — тем выше материал в списке. По умолчанию — 0. При 8+ показывается метка 📌.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={saveNews}>
                {editingNews ? '💾 Сохранить' : '➕ Опубликовать'}
              </button>
              {editingNews && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetNewsForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все новости</h2>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : news.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет новостей</p>
              : [...news].sort(byPriorityDate).map((item, idx, arr) => {
                const dateStr = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
                const pri = item.priority ?? 0;
                return (
                  <div key={item.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.emoji ?? '📢'}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {pri >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: A.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>📌 {pri}</span>}
                          {pri > 0 && pri < 8 && <span style={{ fontSize: 9, fontWeight: 700, color: A.textSec, background: A.chip, border: `1px solid ${A.border}`, borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>↑ {pri}</span>}
                          <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        </div>
                        <div style={{ fontSize: 12, color: A.textSec }}>
                          {dateStr && `📅 ${dateStr} · `}
                          {item.text.length > 50 ? item.text.slice(0, 50) + '…' : item.text}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button disabled={idx === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }} onClick={() => moveItem('news', news, setNews, item, -1)}>↑</button>
                      <button disabled={idx === arr.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === arr.length - 1 ? 0.3 : 1 }} onClick={() => moveItem('news', news, setNews, item, 1)}>↓</button>
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
            <p style={{ color: A.textSec, fontSize: 13, margin: '0 0 14px', lineHeight: '19px' }}>
              Уведомление появится у всех пользователей в разделе «Уведомления» при следующем открытии приложения.
            </p>

            <label style={s.label}>Заголовок *</label>
            <input style={s.input} placeholder="Новый партнёр АПГ!" value={ntTitle} onChange={e => setNtTitle(e.target.value)} />

            <label style={s.label}>Текст (необязательно)</label>
            <textarea style={s.textarea} placeholder="Подробности..." value={ntBody} onChange={e => setNtBody(e.target.value)} />

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={NEWS_EMOJIS} value={ntEmoji} onChange={setNtEmoji} />

            <label style={s.label}>Аудитория</label>
            <select style={s.select} value={ntTargetType} onChange={e => setNtTargetType(e.target.value)}>
              <option value="all">👥 Все пользователи</option>
              <option value="min_keys">🔑 Ключей ≥ N (активные)</option>
              <option value="max_keys">🆕 Ключей &lt; N (новые/неактивные)</option>
              <option value="inactive_days">💤 Не заходили N дней</option>
            </select>
            {ntTargetType !== 'all' && (
              <input
                style={s.input} type="number" min="1"
                placeholder={ntTargetType === 'inactive_days' ? 'Количество дней' : 'Количество ключей'}
                value={ntTargetValue} onChange={e => setNtTargetValue(e.target.value)}
              />
            )}

            <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={sendNotif}>
              🔔 Опубликовать
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>История уведомлений</h2>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : notifs.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет уведомлений</p>
              : notifs.map(n => {
                const dateStr = n.createdAt?.toDate
                  ? n.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={n.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.emoji ?? '🔔'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: A.textSec }}>
                          {dateStr && `📅 ${dateStr}`}
                          {n.targetType && n.targetType !== 'all' && ` · 🎯 ${n.targetType}${n.targetValue ? ` ≥ ${n.targetValue}` : ''}`}
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

      {/* ── ЗАДАНИЯ ── */}
      {activeTab === 'tasks' && (
        <>
          <div style={s.card}>
            <h2 style={s.h2}>➕ Новое задание</h2>
            <p style={{ color: A.textSec, fontSize: 13, margin: '0 0 14px', lineHeight: '19px' }}>
              Дополнительные задания поверх стандартных 17. Пользователи видят их в разделе «Задания».
            </p>

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={['🎯','🏆','🌟','🎁','🔥','💎','🚀','🎪','🏅','⚡','💫','🌈']} value={ctEmoji} onChange={setCtEmoji} />

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Посети 3 новых партнёра" value={ctTitle} onChange={e => setCtTitle(e.target.value)} />

            <label style={s.label}>Описание</label>
            <textarea style={s.textarea} placeholder="Подробности задания..." value={ctDesc} onChange={e => setCtDesc(e.target.value)} />

            <label style={s.label}>Награда (ключей) *</label>
            <input style={s.input} type="number" min="1" placeholder="5" value={ctReward} onChange={e => setCtReward(e.target.value)} />

            <label style={s.label}>Тип условия</label>
            <select style={s.select} value={ctType} onChange={e => setCtType(e.target.value)}>
              <option value="manual">👆 Ручное (пользователь сам забирает)</option>
              <option value="keys">🔑 Собери N ключей</option>
              <option value="scanned">🗺️ Посети N партнёров</option>
              <option value="streak">🔥 Стрик N дней подряд</option>
              <option value="favs">💙 Добавь N в избранное</option>
              <option value="referrals">👥 Пригласи N друзей</option>
            </select>
            {ctType !== 'manual' && (
              <input style={s.input} type="number" min="1" placeholder="Целевое значение" value={ctTarget} onChange={e => setCtTarget(e.target.value)} />
            )}

            <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={saveCustomTask}>
              ✅ Добавить задание
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Активные задания ({customTasks.length})</h2>
            {customTasks.length === 0
              ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет кастомных заданий</p>
              : customTasks.map(t => (
                <div key={t.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.emoji ?? '🎯'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: A.textSec }}>
                        +{t.reward} 🗝️ · {t.type === 'manual' ? 'ручное' : `${t.type} ≥ ${t.target}`}
                      </div>
                    </div>
                  </div>
                  <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12, flexShrink: 0, marginLeft: 8 }} onClick={() => deleteCustomTask(t.id)}>🗑️</button>
                </div>
              ))
            }
          </div>
        </>
      )}

      {/* ── ПРИЗЫ ── */}
      {activeTab === 'prizes' && (
        <div>
          <div style={s.card}>
            <h2 style={s.h2}>{editingPrize ? `✏️ ${editingPrize.name}` : '➕ Новый приз'}</h2>

            <label style={s.label}>Название *</label>
            <input style={s.input} placeholder="Кофе в подарок" value={prName} onChange={e => setPrName(e.target.value)} />

            <label style={s.label}>Описание</label>
            <MdEditor value={prDesc} onChange={setPrDesc} placeholder="Один напиток на выбор в любом заведении-партнёре" style={s.textarea} />

            <label style={s.label}>Стоимость в ключах *</label>
            <input style={s.input} type="number" min="1" placeholder="10" value={prCost} onChange={e => setPrCost(e.target.value)} />

            <label style={s.label}>Количество в наличии (пусто = неограничено)</label>
            <input style={s.input} type="number" min="0" placeholder="50" value={prStock} onChange={e => setPrStock(e.target.value)} />

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PRIZE_EMOJIS} value={prEmoji} onChange={setPrEmoji} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <label style={{ fontSize: 14, color: A.text, fontWeight: 600, flex: 1 }}>Активен (показывать в магазине)</label>
              <button
                onClick={() => setPrActive(v => !v)}
                style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: prActive ? A.gold : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: prActive ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>

            <label style={s.label}>Тип приза</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {['purchase', 'raffle'].map(t => (
                <button key={t} onClick={() => setPrType(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: prType === t ? A.gold : 'rgba(255,255,255,0.1)', color: prType === t ? '#000' : A.text, transition: 'background 0.2s' }}>
                  {t === 'purchase' ? '🛒 Покупка' : '🎟️ Розыгрыш'}
                </button>
              ))}
            </div>

            {prType === 'raffle' && (
              <>
                <label style={s.label}>Стоимость одного билета (ключей)</label>
                <input style={s.input} type="number" min="1" placeholder="5" value={prTicketCost} onChange={e => setPrTicketCost(e.target.value)} />

                <label style={s.label}>Дата и время розыгрыша</label>
                <input style={s.input} type="datetime-local" value={prRaffleDate} onChange={e => setPrRaffleDate(e.target.value)} />
              </>
            )}

            <label style={s.label}>Партнёр АПГ (для индекса активности)</label>
            <select
              style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }}
              value={prPartnerId}
              onChange={e => setPrPartnerId(e.target.value)}
            >
              <option value="">— Не привязывать —</option>
              {[...partners].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={savePrize}>
                {editingPrize ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPrize && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPrizeForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все призы</h2>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : prizes.length === 0
                ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет призов — добавьте первый</p>
                : prizes.map(p => (
                  <div key={p.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: p.active ? A.goldDim : A.chip,
                        border: `1px solid ${p.active ? A.goldBrd : A.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                        filter: p.active ? 'none' : 'grayscale(1) opacity(0.4)',
                      }}>
                        {p.emoji ?? '🎁'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: p.active ? A.text : A.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                            {!p.active && <span style={{ fontSize: 11, color: A.textSec, fontWeight: 400, marginLeft: 6 }}>скрыт</span>}
                          </div>
                          {p.type === 'raffle' && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#9664FF', background: 'rgba(150,100,255,0.15)', border: '1px solid rgba(150,100,255,0.3)', borderRadius: 5, padding: '1px 6px', flexShrink: 0, letterSpacing: 0.5 }}>РОЗЫГРЫШ</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: A.textSec }}>
                          {p.type === 'raffle'
                            ? `🎟️ ${p.ticketCost ?? 0} 🗝️/билет · ${p.raffleDate?.toDate ? p.raffleDate.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}`
                            : `🗝️ ${p.cost} ключей${p.stock !== null && p.stock !== undefined ? ` · ${p.stock} шт.` : ''}`
                          }
                          {p.winner && <span style={{ color: '#4BB34B', marginLeft: 6 }}>✓ Победитель: {p.winner.userName}</span>}
                        </div>
                        {raffleResult?.prizeId === p.id && (
                          <div style={{ fontSize: 12, marginTop: 4, color: raffleResult.winner ? '#4BB34B' : '#E53935', fontWeight: 600 }}>
                            {raffleResult.winner ? `🏆 Победитель: ${raffleResult.winner}` : `⚠️ ${raffleResult.error}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {p.type === 'raffle' && !p.winner && (
                        <button
                          style={{ ...s.btn, padding: '6px 10px', fontSize: 12, background: 'linear-gradient(135deg,#9664FF,#7B4FD4)', color: '#fff', border: 'none', opacity: raffleDrawing === p.id ? 0.6 : 1 }}
                          disabled={raffleDrawing === p.id}
                          onClick={() => drawRaffle(p)}
                        >
                          {raffleDrawing === p.id ? '...' : '🎟️ Розыгрыш'}
                        </button>
                      )}
                      <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditPrize(p)}>✏️</button>
                      <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deletePrize(p.id)}>🗑️</button>
                    </div>
                  </div>
                ))
            }
          </div>

          {/* Заявки на призы */}
          <div style={s.card}>
            <h2 style={s.h2}>📋 Заявки на выдачу ({prizeClaims.filter(c => c.status !== 'given').length})</h2>
            {prizeClaims.length === 0
              ? <p style={{ color: A.textSec, textAlign: 'center' }}>Заявок пока нет</p>
              : prizeClaims.map((c) => {
                const given = c.status === 'given';
                const dateStr = c.claimedAt?.toDate
                  ? c.claimedAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={c.id} style={{ ...s.row, flexWrap: 'wrap', gap: 6, opacity: given ? 0.45 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: given ? A.chip : A.goldDim, border: `1px solid ${given ? A.border : A.goldBrd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {c.prizeEmoji ?? '🎁'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.prizeName} · {c.cost} 🗝️
                        </div>
                        <div style={{ fontSize: 11, color: A.textSec }}>
                          {c.userName || `ID ${c.userId}`} · {dateStr}
                        </div>
                      </div>
                    </div>
                    {given
                      ? <div style={{ fontSize: 11, fontWeight: 700, color: A.textSec, background: A.chip, border: `1px solid ${A.border}`, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>Выдан</div>
                      : <button
                          style={{ ...s.btn, background: 'rgba(75,179,75,0.15)', color: '#4BB34B', border: '1px solid rgba(75,179,75,0.35)', padding: '5px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                          onClick={async () => {
                            await updateDoc(doc(db, 'prizeClaims', c.id), { status: 'given' });
                            setPrizeClaims(prev => prev.map(x => x.id === c.id ? { ...x, status: 'given' } : x));
                          }}
                        >
                          ✓ Выдан
                        </button>
                    }
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ── АКТИВНОСТЬ ПАРТНЁРОВ ── */}
      {activeTab === 'activity' && (() => {
        const sortedByActivity = [...partners].sort(
          (a, b) => (b.activityStats?.activityIndex ?? 0) - (a.activityStats?.activityIndex ?? 0),
        );
        const activityMonth = partners.find(p => p.activityStats?.month)?.activityStats?.month ?? '';

        const recalcActivity = async () => {
          setActivityLoading(true);
          setActivityMsg('');
          try {
            const res = await fetch('/api/activity-index', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ secret: 'apg2026activity' }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setActivityMsg(`✅ Обновлено ${data.updated} партнёров за ${data.month}`);
            const snap = await getDocs(collection(db, 'partners'));
            setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) {
            setActivityMsg(`❌ ${e.message}`);
          } finally {
            setActivityLoading(false);
          }
        };

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
              <div>
                <h1 style={s.h1}>🏆 Индекс активности</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: A.textSec }}>
                  Пересчитывается автоматически каждый день в 03:00 UTC
                  {activityMonth && ` · Месяц: ${activityMonth}`}
                </p>
              </div>
              <button
                style={{ ...s.btn, ...s.btnPri, flexShrink: 0, opacity: activityLoading ? 0.6 : 1 }}
                disabled={activityLoading}
                onClick={recalcActivity}
              >
                {activityLoading ? '...' : '↻ Пересчитать'}
              </button>
            </div>

            {activityMsg && (
              <div style={{
                ...s.card,
                background: activityMsg.startsWith('✅') ? 'rgba(75,179,75,0.08)' : 'rgba(230,70,70,0.08)',
                border: `1px solid ${activityMsg.startsWith('✅') ? 'rgba(75,179,75,0.3)' : 'rgba(230,70,70,0.3)'}`,
                marginBottom: 16,
              }}>
                <p style={{ margin: 0, color: activityMsg.startsWith('✅') ? '#4BB34B' : A.red, fontSize: 14 }}>{activityMsg}</p>
              </div>
            )}

            <div style={s.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: A.textSec, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    <th style={{ textAlign: 'left', padding: '0 6px 10px 0', fontWeight: 700, width: 28 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0 8px 10px 0', fontWeight: 700 }}>Партнёр</th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontWeight: 700 }}>Индекс</th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontWeight: 700 }}>Новых</th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontWeight: 700 }}>Повт.</th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontWeight: 700 }}>★</th>
                    <th style={{ textAlign: 'right', padding: '0 0 10px', fontWeight: 700 }}>Профиль</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByActivity.map((p, i) => {
                    const st = p.activityStats;
                    const isWinner = p.partnerOfMonth === true;
                    return (
                      <tr key={p.id} style={{
                        borderTop: `1px solid ${A.rowBrd}`,
                        background: isWinner ? 'rgba(201,168,76,0.06)' : 'transparent',
                      }}>
                        <td style={{ padding: '9px 6px 9px 0', color: i < 3 ? A.gold : A.textSec, fontWeight: 800, fontSize: 12 }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '9px 8px 9px 0', maxWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </span>
                            {isWinner && (
                              <span style={{ fontSize: 10, color: A.gold, background: A.goldDim, border: `1px solid ${A.goldBrd}`, borderRadius: 6, padding: '1px 5px', flexShrink: 0 }}>
                                🏆
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 800, color: (st?.activityIndex ?? 0) > 0 ? A.gold : A.textSec }}>
                          {st?.activityIndex ?? '—'}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: A.text }}>{st?.newClients ?? '—'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: A.text }}>{st?.returningVisits ?? '—'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: (st?.avgRating ?? 0) >= 4 ? A.green : A.text }}>
                          {st?.avgRating ? st.avgRating.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '9px 0', textAlign: 'right', color: st?.profileUpdated ? A.green : A.textSec }}>
                          {st?.profileUpdated ? '✓' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedByActivity.every(p => !p.activityStats) && (
                <p style={{ color: A.textSec, textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                  Данных пока нет — нажмите «Пересчитать» или дождитесь утреннего cron
                </p>
              )}
            </div>

            {/* Победители прошлых месяцев — отдельная карточка */}
            <MonthlyWinnersCard partners={partners} />
          </div>
        );
      })()}

      {/* ── АНАЛИТИКА ── */}
      {activeTab === 'analytics' && (
        <div>
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: A.textSec }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              Загружаем аналитику...
            </div>
          ) : !analytics ? (
            <div style={s.card}>
              <p style={{ color: A.textSec, textAlign: 'center', marginBottom: 16, lineHeight: '19px' }}>
                Нажмите кнопку, чтобы загрузить статистику по всем пользователям
              </p>
              <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={loadAnalytics}>📊 Загрузить аналитику</button>
            </div>
          ) : (
            <>
              {/* Рост аудитории */}
              <div style={s.card}>
                <h2 style={s.h2}>👥 Аудитория</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Всего пользователей', value: analytics.totalUsers,    icon: '👥', color: A.blue },
                    { label: 'Активных за 7 дней',  value: analytics.activeUsers7d, icon: '✅', color: '#4BB34B' },
                    { label: 'Новых за 7 дней',     value: analytics.newUsers7d,    icon: '🆕', color: A.gold },
                    { label: 'Новых за 30 дней',    value: analytics.newUsers30d,   icon: '📅', color: A.gold },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: A.chip, borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: `1px solid ${stat.color}30` }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: A.textSec, lineHeight: '14px', marginTop: 5 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: A.textSec, marginBottom: 12 }}>
                  📌 «Новых за N дней» считается по полю registeredAt — данные есть только для пользователей, зарегистрировавшихся после обновления.
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: A.textSec, marginBottom: 8 }}>📈 Регистрации по дням (30 дней)</div>
                <MiniBarChart data={analytics.regGrowthData} labelKey="date" valueKey="count" color='#4BB34B' shortDate />
              </div>

              {/* Сводка */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Всего пользователей', value: analytics.totalUsers,  icon: '👥', color: A.blue },
                  { label: 'Активных (ключи>0)',   value: analytics.activeUsers, icon: '✅', color: '#4BB34B' },
                  { label: 'Ключей в обороте',     value: analytics.totalKeys,   icon: '🗝️', color: A.gold },
                  { label: 'Ср. ключей/юзер',      value: analytics.avgKeys,     icon: '📈', color: A.gold },
                  { label: 'Уник. сканов',          value: analytics.totalScans,  icon: '📲', color: A.blue },
                  { label: 'Рефералов',             value: analytics.totalReferrals, icon: '🔗', color: '#9B59B6' },
                ].map(stat => (
                  <div key={stat.label} style={{ ...s.card, marginBottom: 0, textAlign: 'center', border: `1px solid ${stat.color}25` }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: A.textSec, lineHeight: '14px', marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* DAU — активность за 14 дней */}
              <div style={s.card}>
                <h2 style={s.h2}>📅 Активные пользователи (14 дней)</h2>
                <MiniBarChart data={analytics.dauData} labelKey="date" valueKey="count" color={A.blue} shortDate />
                <div style={{ fontSize: 11, color: A.textSec, marginTop: 8 }}>
                  Кол-во юзеров, сделавших скан в этот день
                </div>
              </div>

              {/* Распределение ключей */}
              <div style={s.card}>
                <h2 style={s.h2}>🗝️ Распределение ключей</h2>
                <MiniBarChart data={analytics.keyBuckets} labelKey="label" valueKey="count" color={A.gold} />
                <div style={{ fontSize: 11, color: A.textSec, marginTop: 8 }}>
                  Сколько пользователей имеют данное количество ключей
                </div>
              </div>

              {/* Реферальная статистика */}
              <div style={s.card}>
                <h2 style={s.h2}>🔗 Реферальная программа</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Пришли по реф.', value: analytics.referredCount },
                    { label: 'Активных реф.', value: analytics.totalReferrals > 0 ? analytics.users.filter(u => (u.referralCount ?? 0) > 0).length : 0 },
                    { label: 'Ключей роздано', value: analytics.referralKeysOut },
                  ].map(s2 => (
                    <div key={s2.label} style={{ background: A.chip, borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: `1px solid ${A.border}` }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: A.gold }}>{s2.value}</div>
                      <div style={{ fontSize: 10, color: A.textSec, lineHeight: '13px', marginTop: 4 }}>{s2.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Топ-10 пользователей */}
              <div style={s.card}>
                <h2 style={s.h2}>🏆 Топ-10 пользователей</h2>
                {analytics.topUsers.map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 9 ? `1px solid ${A.rowBrd}` : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? A.gold : i < 3 ? A.textSec : A.textSec, width: 22, flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: i === 0 ? A.goldDim : i === 1 ? 'rgba(192,192,192,0.12)' : i === 2 ? 'rgba(205,127,50,0.12)' : A.chip,
                      border: `1px solid ${i === 0 ? A.goldBrd : A.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: A.text, flexShrink: 0,
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : u.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: A.textSec }}>ID: {u.id} · {u.scans} партнёров</div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: A.gold }}>🗝️ {u.keys}</div>
                  </div>
                ))}
              </div>

              {/* Начисление ключей */}
              <div style={s.card}>
                <h2 style={s.h2}>🔑 Начислить ключи</h2>
                <label style={s.label}>ID пользователя</label>
                <input
                  style={s.input}
                  placeholder="Вставьте UID из Firebase"
                  value={awardUserId}
                  onChange={e => setAwardUserId(e.target.value)}
                />
                <label style={s.label}>Количество ключей</label>
                <input
                  style={s.input}
                  type="number"
                  placeholder="Например: 5"
                  value={awardAmount}
                  onChange={e => setAwardAmount(e.target.value)}
                />
                <button
                  style={{ ...s.btn, ...s.btnPri, width: '100%', opacity: (!awardUserId.trim() || !Number(awardAmount)) ? 0.5 : 1 }}
                  onClick={awardKeys}
                  disabled={!awardUserId.trim() || !Number(awardAmount)}
                >
                  Начислить
                </button>
                {awardMsg && (
                  <p style={{ marginTop: 10, textAlign: 'center', fontSize: 14, color: awardMsg.startsWith('✅') ? '#4BB34B' : A.red }}>
                    {awardMsg}
                  </p>
                )}
              </div>

              {/* Экспорт */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ ...s.h2, margin: '0 0 2px' }}>📥 Экспорт пользователей</h2>
                    <p style={{ margin: 0, fontSize: 13, color: A.textSec }}>{analytics.users.length} записей</p>
                  </div>
                  <button style={{ ...s.btn, ...s.btnPri }} onClick={exportCSV}>Скачать CSV</button>
                </div>
              </div>

              {/* Рейтинг партнёров */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>🏆 Рейтинг партнёров</h2>
                  <button style={{ ...s.btn, ...s.btnGray, padding: '6px 12px', fontSize: 12 }} onClick={loadAnalytics}>↻ Обновить</button>
                </div>
                {analytics.partnerStats.length === 0 ? (
                  <p style={{ color: A.textSec, textAlign: 'center' }}>Нет данных</p>
                ) : (() => {
                  const max = analytics.partnerStats[0]?.visits || 1;
                  return analytics.partnerStats.map((p, i) => (
                    <div key={p.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? A.gold : A.textSec, width: 22, flexShrink: 0 }}>#{i + 1}</span>
                        {p.logoUrl
                          ? <img src={p.logoUrl} alt="" loading="lazy" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: A.gold, flexShrink: 0, marginLeft: 8 }}>{p.visits} чел.</span>
                          </div>
                          <div style={{ height: 5, background: A.chip, borderRadius: 3, overflow: 'hidden', border: `1px solid ${A.border}` }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${Math.round((p.visits / max) * 100)}%`,
                              background: i === 0 ? 'linear-gradient(90deg, #C9A84C, #E8C76D)'
                                : i === 1 ? 'linear-gradient(90deg, #C0C0C0, #E8E8E8)'
                                : i === 2 ? 'linear-gradient(90deg, #CD7F32, #E09B52)'
                                : A.blue,
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ height: 32 }} />
      </div>{/* end content */}

      {/* QR-модал для партнёра */}
      {qrPartner && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setQrPartner(null)}
        >
          <div
            style={{
              background: 'rgba(20,20,40,0.96)',
              backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 24, padding: 28, maxWidth: 320, width: '100%',
              textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{qrPartner.emoji ?? '🏪'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: A.text }}>{qrPartner.name}</div>
            <div style={{ fontSize: 12, color: A.textSec, marginBottom: 20 }}>ID: {qrPartner.id}</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, background: '#fff', borderRadius: 16, padding: 12 }}>
              <QRCodeSVG value={qrPartner.id} size={220} bgColor="#ffffff" fgColor="#0F0F1A" level="M" />
            </div>
            <div style={{ fontSize: 12, color: A.textSec, marginBottom: 20, lineHeight: '18px' }}>
              Распечатайте этот QR-код и разместите у партнёра.<br/>
              Клиент сканирует его через приложение АПГ и получает ключ.
            </div>
            <button onClick={() => setQrPartner(null)} style={{ ...s.btn, ...s.btnGray, width: '100%' }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};
