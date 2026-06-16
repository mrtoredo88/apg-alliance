import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import vkBridge from './vk.js';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, writeBatch, increment } from 'firebase/firestore';

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

function MiniBarChart({ data, labelKey, valueKey, color = '#3F8AE0', shortDate = false }) {
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
            <div style={{ fontSize: 8, color: '#99A2AD', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>{label}</div>
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
  const [customTasks, setCustomTasks] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('partners');
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingEvent, setEditingEvent]     = useState(null);
  const [editingNews, setEditingNews]       = useState(null);
  const [qrPartner, setQrPartner]           = useState(null);
  const [analytics, setAnalytics]           = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [partnerSearch, setPartnerSearch]   = useState('');

  // Призы
  const [prizes, setPrizes]               = useState([]);
  const [editingPrize, setEditingPrize]   = useState(null);
  const [prName, setPrName]               = useState('');
  const [prDesc, setPrDesc]               = useState('');
  const [prCost, setPrCost]               = useState('');
  const [prEmoji, setPrEmoji]             = useState('🎁');
  const [prStock, setPrStock]             = useState('');
  const [prActive, setPrActive]           = useState(true);

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

  // Форма новости
  const [nTitle, setNTitle]         = useState('');
  const [nText, setNText]           = useState('');
  const [nEmoji, setNEmoji]         = useState('📢');
  const [nImage, setNImage]         = useState('');
  const [nLinkUrl, setNLinkUrl]     = useState('');
  const [nLinkLabel, setNLinkLabel] = useState('');

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
      const [pSnap, eSnap, nSnap, ntSnap, prSnap, ctSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'prizes'), orderBy('cost', 'asc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'customTasks'), orderBy('createdAt', 'asc'))).catch(() => ({ docs: [] })),
      ]);
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNotifs(ntSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPrizes(prSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomTasks(ctSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartnerForm = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪'); setPLogo('');
    setPPhone(''); setPAddress(''); setPHours(''); setPSocial(''); setPOffer('');
    setPStampTarget('');
    setEditingPartner(null);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? ''); setPDesc(p.description ?? ''); setPCategory(p.category ?? 'other');
    setPEmoji(p.emoji ?? '🏪'); setPLogo(p.logoUrl ?? ''); setPPhone(p.phone ?? '');
    setPAddress(p.address ?? ''); setPHours(p.hours ?? ''); setPSocial(p.socialUrl ?? '');
    setPOffer(p.offer ?? ''); setPStampTarget(p.stampTarget ? String(p.stampTarget) : '');
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

  // ─── Новости ────────────────────────────────────────────────────────────────

  const resetNewsForm = () => {
    setNTitle(''); setNText(''); setNEmoji('📢'); setNImage('');
    setNLinkUrl(''); setNLinkLabel('');
    setEditingNews(null);
  };

  const startEditNews = (item) => {
    setEditingNews(item);
    setNTitle(item.title ?? ''); setNText(item.text ?? '');
    setNEmoji(item.emoji ?? '📢'); setNImage(item.imageUrl ?? '');
    setNLinkUrl(item.linkUrl ?? ''); setNLinkLabel(item.linkLabel ?? '');
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
  };

  const startEditPrize = (p) => {
    setEditingPrize(p);
    setPrName(p.name ?? ''); setPrDesc(p.description ?? '');
    setPrCost(String(p.cost ?? '')); setPrEmoji(p.emoji ?? '🎁');
    setPrStock(p.stock !== null && p.stock !== undefined ? String(p.stock) : '');
    setPrActive(p.active !== false);
    window.scrollTo(0, 0);
  };

  const savePrize = async () => {
    if (!prName.trim() || !prCost) return;
    const data = {
      name: prName.trim(), description: prDesc.trim(),
      cost: Number(prCost), emoji: prEmoji,
      stock: prStock !== '' ? Number(prStock) : null,
      active: prActive,
    };
    if (editingPrize) {
      await updateDoc(doc(db, 'prizes', editingPrize.id), data);
    } else {
      await addDoc(collection(db, 'prizes'), data);
    }
    resetPrizeForm();
    fetchData();
  };

  const deletePrize = async (id) => {
    if (!window.confirm('Удалить приз?')) return;
    await deleteDoc(doc(db, 'prizes', id));
    fetchData();
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

      // Рейтинг партнёров по уникальным посетителям
      const visitCounts = {};
      users.forEach(u => {
        Object.keys(u.scannedPartners ?? {}).forEach(pid => {
          visitCounts[pid] = (visitCounts[pid] ?? 0) + 1;
        });
      });
      const partnerStats = partners
        .map(p => ({ ...p, visits: visitCounts[p.id] ?? 0 }))
        .sort((a, b) => b.visits - a.visits);

      // DAU: активные пользователи за последние 14 дней (по scanDates)
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

      // Топ-10 по ключам
      const topUsers = [...users]
        .sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0))
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || `#${u.id.slice(0, 6)}`,
          keys: u.keys ?? 0,
          scans: Object.keys(u.scannedPartners ?? {}).length,
        }));

      // Распределение ключей
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

      // Реферальная воронка
      const referredCount   = users.filter(u => u.referredBy).length;
      const totalReferrals  = users.reduce((s, u) => s + (u.referralCount ?? 0), 0);
      const referralKeysOut = referredCount * 2 + totalReferrals * 2;

      setAnalytics({
        totalUsers, totalKeys, avgKeys, activeUsers, totalScans,
        partnerStats, users,
        dauData, topUsers, keyBuckets,
        referredCount, totalReferrals, referralKeysOut,
      });
    } catch (e) { console.error(e); }
    setAnalyticsLoading(false);
  }, [partners, analyticsLoading]);

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={s.h1}>⚙️ Админ-панель</h1>
        <p style={{ color: '#99A2AD', fontSize: 13, margin: 0 }}>АПГ — Альянс Партнёров Города</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'partners', label: `🤝 Партнёры (${partners.length})` },
          { id: 'events',   label: `🎉 События (${events.length})` },
          { id: 'news',     label: `📢 Новости (${news.length})` },
          { id: 'notifs',   label: `🔔 Уведомления` },
          { id: 'tasks',    label: `✅ Задания (${customTasks.length})` },
          { id: 'prizes',   label: `🎁 Призы (${prizes.length})` },
          { id: 'analytics',label: '📊 Аналитика' },
        ].map(t => (
          <button key={t.id}
            style={{ ...s.tab, flex: 'none', padding: '10px 14px', background: activeTab === t.id ? '#3F8AE0' : '#fff', color: activeTab === t.id ? '#fff' : '#000' }}
            onClick={() => { setActiveTab(t.id); if (t.id === 'analytics' && !analytics) loadAnalytics(); }}
          >
            {t.label}
          </button>
        ))}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ ...s.h2, margin: 0 }}>Все партнёры</h2>
              <span style={{ fontSize: 12, color: '#99A2AD' }}>
                {partnerSearch
                  ? `${partners.filter(p => p.name?.toLowerCase().includes(partnerSearch.toLowerCase())).length} из ${partners.length}`
                  : partners.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f2f3f5', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#99A2AD', flexShrink: 0 }}>🔍</span>
              <input
                type="search"
                placeholder="Поиск по названию..."
                value={partnerSearch}
                onChange={e => setPartnerSearch(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, flex: 1, color: '#000' }}
              />
              {partnerSearch && (
                <button onClick={() => setPartnerSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#99A2AD', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
              )}
            </div>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : partners.length === 0 ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет партнёров</p>
              : partners.filter(p => !partnerSearch || p.name?.toLowerCase().includes(partnerSearch.toLowerCase())).map(p => (
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
                    <button
                      title={p.featured ? 'Партнёр дня (снять)' : 'Сделать партнёром дня'}
                      style={{ ...s.btn, padding: '6px 10px', fontSize: 14, background: p.featured ? '#FFF3CD' : '#f2f3f5', border: p.featured ? '1.5px solid #FFD700' : 'none' }}
                      onClick={() => setFeaturedPartner(p.featured ? null : p.id)}
                    >⭐</button>
                    <button style={{ ...s.btn, background: '#E8F3FF', color: '#3F8AE0', padding: '6px 10px', fontSize: 11, fontWeight: 700 }} onClick={() => setQrPartner(p)}>QR</button>
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

            <label style={s.label}>Дедлайн / конец акции (необязательно) ⏱️</label>
            <input style={s.input} type="date" value={eDeadline} onChange={e => setEDeadline(e.target.value)} />

            <div
              onClick={() => setEIsPrivate(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 12, marginBottom: 12, cursor: 'pointer',
                background: eIsPrivate ? '#FFF3CD' : '#f2f3f5',
                border: `2px solid ${eIsPrivate ? '#FFC107' : '#e0e0e0'}`,
                transition: 'all 0.2s',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: eIsPrivate ? '#856404' : '#000' }}>🔒 Закрытое мероприятие</div>
                <div style={{ fontSize: 12, color: eIsPrivate ? '#856404' : '#99A2AD', marginTop: 2 }}>Доступ по ключам АПГ</div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13, position: 'relative',
                background: eIsPrivate ? '#FFC107' : '#C8C8C8', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: eIsPrivate ? 21 : 3, width: 20, height: 20,
                  borderRadius: 10, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>

            {eIsPrivate && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FFC107', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                <label style={{ ...s.label, color: '#856404' }}>🗝️ Минимум ключей для входа</label>
                <input style={{ ...s.input, marginBottom: 10 }} type="number" min="0" placeholder="10" value={eMinKeys} onChange={e => setEMinKeys(e.target.value)} />

                <label style={{ ...s.label, color: '#856404' }}>👥 Лимит участников (0 = без ограничения)</label>
                <input style={{ ...s.input, marginBottom: 10 }} type="number" min="0" placeholder="50" value={eMaxParticipants} onChange={e => setEMaxParticipants(e.target.value)} />

                <label style={{ ...s.label, color: '#856404' }}>📅 Дата и время мероприятия (для таймера)</label>
                <input style={{ ...s.input, marginBottom: 0 }} type="datetime-local" value={eEventDate} onChange={e => setEEventDate(e.target.value)} />
              </div>
            )}

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
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.isPrivate ? '🔒 ' : ''}{e.title}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>{e.date && `📅 ${e.date}`}{e.partner && ` · ${e.partner}`}{e.isPrivate && e.minKeys > 0 && ` · мин. ${e.minKeys} 🗝️`}</div>
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

            <label style={s.label}>Название ссылки (необязательно)</label>
            <input style={s.input} placeholder="Подробнее на сайте" value={nLinkLabel} onChange={e => setNLinkLabel(e.target.value)} />

            <label style={s.label}>URL ссылки</label>
            <input style={s.input} placeholder="https://..." value={nLinkUrl} onChange={e => setNLinkUrl(e.target.value)} />

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
            <p style={{ color: '#99A2AD', fontSize: 13, margin: '0 0 12px' }}>
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
              ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет кастомных заданий</p>
              : customTasks.map(t => (
                <div key={t.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.emoji ?? '🎯'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: '#99A2AD' }}>
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
            <textarea style={s.textarea} placeholder="Один напиток на выбор в любом заведении-партнёре" value={prDesc} onChange={e => setPrDesc(e.target.value)} />

            <label style={s.label}>Стоимость в ключах *</label>
            <input style={s.input} type="number" min="1" placeholder="10" value={prCost} onChange={e => setPrCost(e.target.value)} />

            <label style={s.label}>Количество в наличии (пусто = неограничено)</label>
            <input style={s.input} type="number" min="0" placeholder="50" value={prStock} onChange={e => setPrStock(e.target.value)} />

            <label style={s.label}>Иконка</label>
            <EmojiPicker emojis={PRIZE_EMOJIS} value={prEmoji} onChange={setPrEmoji} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <label style={{ fontSize: 14, color: '#000', fontWeight: 600, flex: 1 }}>Активен (показывать в магазине)</label>
              <button
                onClick={() => setPrActive(v => !v)}
                style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: prActive ? '#3F8AE0' : '#ccc', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: prActive ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={savePrize}>
                {editingPrize ? '💾 Сохранить' : '➕ Добавить'}
              </button>
              {editingPrize && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPrizeForm}>Отмена</button>}
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Все призы</h2>
            {loading ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Загрузка...</p>
              : prizes.length === 0
                ? <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет призов — добавьте первый</p>
                : prizes.map(p => (
                  <div key={p.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: p.active ? '#FFF3CD' : '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, filter: p.active ? 'none' : 'grayscale(1) opacity(0.5)' }}>
                        {p.emoji ?? '🎁'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: p.active ? '#000' : '#99A2AD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                          {!p.active && <span style={{ fontSize: 11, color: '#99A2AD', fontWeight: 400, marginLeft: 6 }}>скрыт</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#99A2AD' }}>
                          🗝️ {p.cost} ключей
                          {p.stock !== null && p.stock !== undefined && ` · ${p.stock} шт.`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditPrize(p)}>✏️</button>
                      <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deletePrize(p.id)}>🗑️</button>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ── АНАЛИТИКА ── */}
      {activeTab === 'analytics' && (
        <div>
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#99A2AD' }}>Загружаем данные...</div>
          ) : !analytics ? (
            <div style={s.card}>
              <p style={{ color: '#99A2AD', textAlign: 'center', marginBottom: 16 }}>Нажмите кнопку, чтобы загрузить статистику</p>
              <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={loadAnalytics}>📊 Загрузить аналитику</button>
            </div>
          ) : (
            <>
              {/* Сводка */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Всего пользователей', value: analytics.totalUsers, icon: '👥' },
                  { label: 'Активных (с ключами)', value: analytics.activeUsers, icon: '✅' },
                  { label: 'Ключей в обороте', value: analytics.totalKeys, icon: '🗝️' },
                  { label: 'Ср. ключей на юзера', value: analytics.avgKeys, icon: '📈' },
                  { label: 'Уникальных сканов', value: analytics.totalScans, icon: '📲' },
                  { label: 'Рефералов всего', value: analytics.totalReferrals, icon: '👥' },
                ].map(stat => (
                  <div key={stat.label} style={{ ...s.card, marginBottom: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#3F8AE0' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: '#99A2AD', lineHeight: '14px', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* DAU — активность за 14 дней */}
              <div style={s.card}>
                <h2 style={s.h2}>📅 Активные пользователи (14 дней)</h2>
                <MiniBarChart data={analytics.dauData} labelKey="date" valueKey="count" color="#3F8AE0" shortDate />
                <div style={{ fontSize: 11, color: '#99A2AD', marginTop: 6 }}>
                  Кол-во юзеров, сделавших скан в этот день
                </div>
              </div>

              {/* Распределение ключей */}
              <div style={s.card}>
                <h2 style={s.h2}>🗝️ Распределение ключей</h2>
                <MiniBarChart data={analytics.keyBuckets} labelKey="label" valueKey="count" color="#F4A261" />
                <div style={{ fontSize: 11, color: '#99A2AD', marginTop: 6 }}>
                  Сколько пользователей имеют данное количество ключей
                </div>
              </div>

              {/* Реферальная статистика */}
              <div style={s.card}>
                <h2 style={s.h2}>🔗 Реферальная программа</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Пришли по реферальной', value: analytics.referredCount },
                    { label: 'Активных рефереров', value: analytics.totalReferrals > 0 ? analytics.users.filter(u => (u.referralCount ?? 0) > 0).length : 0 },
                    { label: 'Ключей роздано', value: analytics.referralKeysOut },
                  ].map(s2 => (
                    <div key={s2.label} style={{ background: '#f2f3f5', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#3F8AE0' }}>{s2.value}</div>
                      <div style={{ fontSize: 10, color: '#99A2AD', lineHeight: '13px', marginTop: 3 }}>{s2.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Топ-10 пользователей */}
              <div style={s.card}>
                <h2 style={s.h2}>🏆 Топ-10 пользователей</h2>
                {analytics.topUsers.map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 9 ? '1px solid #f2f3f5' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? '#3F8AE0' : '#99A2AD', width: 22, flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? '#FFF3CD' : i === 1 ? '#F5F5F5' : i === 2 ? '#FBE9D0' : '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : u.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#99A2AD' }}>ID: {u.id} · {u.scans} партнёров</div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#3F8AE0' }}>🗝️ {u.keys}</div>
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
                  style={{ ...s.btn, ...s.btnPri, width: '100%' }}
                  onClick={awardKeys}
                  disabled={!awardUserId.trim() || !Number(awardAmount)}
                >
                  Начислить
                </button>
                {awardMsg && (
                  <p style={{ marginTop: 8, textAlign: 'center', fontSize: 14, color: awardMsg.startsWith('✅') ? '#4CAF50' : '#E64646' }}>
                    {awardMsg}
                  </p>
                )}
              </div>

              {/* Экспорт */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ ...s.h2, margin: '0 0 2px' }}>📥 Экспорт пользователей</h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#99A2AD' }}>{analytics.users.length} записей</p>
                  </div>
                  <button style={{ ...s.btn, ...s.btnPri }} onClick={exportCSV}>Скачать CSV</button>
                </div>
              </div>

              {/* Рейтинг партнёров */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>🏆 Рейтинг партнёров</h2>
                  <button style={{ ...s.btn, ...s.btnGray, padding: '6px 12px', fontSize: 12 }} onClick={loadAnalytics}>↻ Обновить</button>
                </div>
                {analytics.partnerStats.length === 0 ? (
                  <p style={{ color: '#99A2AD', textAlign: 'center' }}>Нет данных</p>
                ) : (() => {
                  const max = analytics.partnerStats[0]?.visits || 1;
                  return analytics.partnerStats.map((p, i) => (
                    <div key={p.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? '#3F8AE0' : '#99A2AD', width: 22, flexShrink: 0 }}>#{i + 1}</span>
                        {p.logoUrl
                          ? <img src={p.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{p.emoji ?? '🏪'}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#3F8AE0', flexShrink: 0, marginLeft: 8 }}>{p.visits} чел.</span>
                          </div>
                          <div style={{ height: 6, background: '#f2f3f5', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${Math.round((p.visits / max) * 100)}%`, background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#3F8AE0', transition: 'width 0.6s ease' }} />
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

      {/* QR-модал для партнёра */}
      {qrPartner && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setQrPartner(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#000' }}>{qrPartner.name}</div>
            <div style={{ fontSize: 12, color: '#99A2AD', marginBottom: 20 }}>ID: {qrPartner.id}</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <QRCodeSVG value={qrPartner.id} size={220} bgColor="#ffffff" fgColor="#0F0F1A" level="M" />
            </div>
            <div style={{ fontSize: 12, color: '#99A2AD', marginBottom: 20, lineHeight: '17px' }}>
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