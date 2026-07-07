import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PhotoUpload, { GalleryUpload } from './PhotoUpload.jsx';
import { MdEditor } from './components/MdEditor.jsx';
import { PartnerQRSection, ExpertQRSection } from './PartnerQRSection.jsx';
import vkBridge from './vk.js';
import { parseVideoUrl } from './utils/parseVideoUrl.js';
import { geocodeAddress } from './utils/geo.js';
import { EXPERT_CATEGORIES, APP_URL, API_BASE_URL } from './constants.js';
import { db, auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { runServiceChecks } from './diagnostics.js';
import { logError } from './errorLogger.js';

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
  { id: 'shopping',      label: 'Шоппинг',       emoji: '🛍️' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

const EVENT_EMOJIS   = ['🎉','🎓','🍕','💆','🏋️','🎨','🎤','🤝','🎁','🌟','🎭','☕'];
const NEWS_EMOJIS    = ['📢','🔥','🌟','🎁','📅','💡','🤝','🏆','🎉','📸','🗞️','✨'];
const CONTENT_CATEGORIES = [
  { id: 'economy',   label: 'Экономика',   color: '#6AABEC' },
  { id: 'society',   label: 'Общество',    color: '#A78BFA' },
  { id: 'sport',     label: 'Спорт',       color: '#4ade80' },
  { id: 'culture',   label: 'Культура',    color: '#f59e0b' },
  { id: 'education', label: 'Образование', color: '#38bdf8' },
  { id: 'transport', label: 'Транспорт',   color: '#fb923c' },
];
const PARTNER_EMOJIS = ['🏪','💆','💄','🍽️','☕','🎓','🏋️','💅','🎉','🛍️','🎭','🌿'];
const contentImageOf = (item) =>
  item?.coverPhoto || item?.imageUrl || item?.thumbnail || item?.banner || item?.image || '';

const ADMIN_LOAD_TIMEOUT_MS = 12000;
const ADMIN_LOAD_RETRIES = 2;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isTransientFirestoreError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'unavailable'
    || code === 'deadline-exceeded'
    || code === 'resource-exhausted'
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('transport');
}

function formatAdminLoadError(error) {
  const code = error?.code ? `${error.code}: ` : '';
  const message = error?.message || String(error);
  if (error?.code === 'permission-denied') {
    return `${code}нет прав на чтение коллекции. Проверьте Firestore Rules и текущую авторизацию.`;
  }
  if (error?.code === 'failed-precondition') {
    return `${code}для запроса нужен индекс Firestore или коллекция временно недоступна.`;
  }
  if (isTransientFirestoreError(error)) {
    return `${code}временная ошибка сети/Firestore. Можно повторить загрузку.`;
  }
  return `${code}${message}`;
}

function docsToItems(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function waitForAdminAuth() {
  if (auth.currentUser) return auth.currentUser;
  let unsubscribe = null;
  const authReady = new Promise(resolve => {
    unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) return;
      unsubscribe?.();
      resolve(user);
    });
  });
  const signIn = signInAnonymously(auth).catch(error => {
    logError(error, 'AdminPanel.auth.signInAnonymously');
    return null;
  });
  await signIn;
  const user = await withTimeout(authReady, 6500, 'admin auth').catch(() => auth.currentUser);
  unsubscribe?.();
  if (!user && !auth.currentUser) throw new Error('Firebase Auth не готов: анонимная авторизация не завершилась.');
  return user || auth.currentUser;
}

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

function AdminQRMaterialsSection({ entity, type }) {
  const isExpert = type === 'expert';
  const entityName = entity?.name || (isExpert ? 'Эксперт' : 'Партнёр');
  const hasId = !!entity?.id;

  return (
    <div style={{ marginBottom: 14, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.035)', border: `1px solid ${A.border}` }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: A.text }}>QR-коды и материалы для печати</div>
          <div style={{ fontSize: 11, color: A.textSec, marginTop: 3 }}>{entityName}</div>
        </div>
        <div style={{ fontSize: 18, flexShrink: 0 }}>📲</div>
      </div>

      {!hasId ? (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.24)', color: '#f59e0b', fontSize: 12, lineHeight: '18px' }}>
          QR-коды появятся после сохранения записи: нужен Firestore ID.
        </div>
      ) : isExpert ? (
        <ExpertQRSection expert={entity} />
      ) : (
        <PartnerQRSection partner={entity} />
      )}
    </div>
  );
}

function toJsDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(value) {
  const d = toJsDate(value);
  return d ? d.toISOString().slice(0, 10) : '';
}

function withinDays(value, days) {
  const d = toJsDate(value);
  return d ? Date.now() - d.getTime() <= days * 24 * 60 * 60 * 1000 : false;
}

function userDisplayName(user) {
  return [user?.firstName ?? user?.first_name, user?.lastName ?? user?.last_name].filter(Boolean).join(' ')
    || user?.displayName
    || user?.email
    || `#${String(user?.id ?? '').slice(0, 6)}`;
}

function providerLabel(user) {
  const raw = String(user?.authProvider || user?.provider || user?.source || '').toLowerCase();
  if (user?.referredBy) return 'Реферальная ссылка';
  if (raw.includes('telegram') || user?.telegramId || user?.tgId) return 'Telegram';
  if (raw.includes('email') || user?.email) return 'Email';
  if (raw.includes('vk') || user?.vkId) return 'VK';
  if (raw.includes('partner')) return 'QR партнёра';
  if (raw.includes('expert')) return 'QR эксперта';
  if (raw.includes('web') || raw.includes('site')) return 'Сайт';
  return 'Прямая регистрация';
}

function StatTile({ label, value, icon, color = A.gold, sub }) {
  return (
    <div style={{ ...s.card, marginBottom: 0, minHeight: 102, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: `1px solid ${color}26` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 11, color: A.textSec, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: '15px' }}>{label}</div>
        <div style={{ fontSize: 20 }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize: 30, lineHeight: '34px', color, fontWeight: 950 }}>{value}</div>
        {sub && <div style={{ marginTop: 4, fontSize: 11, color: A.textSec, lineHeight: '15px' }}>{sub}</div>}
      </div>
    </div>
  );
}

function AdminDashboard({ partners, experts, events, news, banners, customTasks, prizes, metrics, onOpenTab, onOpenPartner, onOpenExpert }) {
  const users = metrics?.users ?? [];
  const scans = metrics?.scans ?? [];
  const expertScans = metrics?.expertScans ?? [];
  const reviews = metrics?.reviews ?? [];
  const expertReviews = metrics?.expertReviews ?? [];
  const raffleEntries = metrics?.raffleEntries ?? [];
  const guestSessions = metrics?.guestSessions ?? [];
  const comments = metrics?.newsComments ?? [];
  const errors = metrics?.errorLogs ?? [];
  const adminActivity = metrics?.adminActivity ?? [];
  const allScans = [...scans, ...expertScans];
  const today = new Date().toISOString().slice(0, 10);
  const newToday = users.filter(u => dateKey(u.registeredAt || u.createdAt) === today).length;
  const newWeek = users.filter(u => withinDays(u.registeredAt || u.createdAt, 7)).length;
  const newMonth = users.filter(u => withinDays(u.registeredAt || u.createdAt, 30)).length;
  const eventRegistrations = users.reduce((sum, u) => sum + (Array.isArray(u.registeredEvents) ? u.registeredEvents.length : 0), 0);
  const keysFromScans = allScans.reduce((sum, scan) => sum + (Number(scan.keysAwarded) || 0), 0);
  const keysFromUsers = users.reduce((sum, u) => sum + (Number(u.keys) || 0), 0);
  const issuedKeys = keysFromScans || keysFromUsers;
  const activeEvents = events.filter(e => e.active !== false).length;
  const activeNews = news.filter(n => n.active !== false).length;
  const activeOffers = partners.filter(p => p.offer).length + experts.filter(e => e.offer).length;
  const reviewTotal = reviews.length + expertReviews.length;
  const newComments = comments.filter(c => !c.hidden && withinDays(c.createdAt || c.updatedAt, 1)).length;
  const moderationComments = comments.filter(c => !c.hidden && (c.status === 'pending' || !c.moderationReviewedAt)).length;
  const openErrors = errors.filter(e => !e.resolved).length;
  const pendingNews = news.filter(n => ['draft', 'pending', 'scheduled'].includes(String(n.status || '').toLowerCase()) || n.active === false).length;
  const sourceRows = Object.entries(users.reduce((acc, u) => {
    const label = providerLabel(u);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const partnerRows = partners.map(p => {
    const ownScans = scans.filter(scan => scan.partnerId === p.id);
    return {
      ...p,
      newUsers: ownScans.filter(scan => scan.isNew).length,
      scans: ownScans.length,
      keys: ownScans.reduce((sum, scan) => sum + (Number(scan.keysAwarded) || 0), 0),
      views: p.viewCount ?? 0,
      favorites: p.favoriteCount ?? 0,
      eventRegs: events.filter(e => e.partnerId === p.id).reduce((sum, e) => sum + (Number(e.registrationsCount) || 0), 0),
    };
  }).sort((a, b) => (b.scans + b.views) - (a.scans + a.views)).slice(0, 8);
  const expertRows = experts.map(e => {
    const ownScans = expertScans.filter(scan => scan.expertId === e.id);
    return {
      ...e,
      newUsers: ownScans.filter(scan => scan.isNew).length,
      scans: ownScans.length,
      keys: ownScans.reduce((sum, scan) => sum + (Number(scan.keysAwarded) || 0), 0),
      views: e.viewCount ?? 0,
      reviews: e.reviewCount ?? 0,
    };
  }).sort((a, b) => (b.scans + b.views) - (a.scans + a.views)).slice(0, 8);
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const regData = last14.map(date => ({ date, count: users.filter(u => dateKey(u.registeredAt || u.createdAt) === date).length }));
  const scanData = last14.map(date => ({ date, count: allScans.filter(scan => dateKey(scan.scannedAt || scan.createdAt) === date).length }));
  const funnel = [
    { label: 'Увидели / открыли ссылку', value: guestSessions.length + users.length, icon: '👀' },
    { label: 'Установили / открыли приложение', value: users.length + guestSessions.filter(s => s.converted).length, icon: '📲' },
    { label: 'Зарегистрировались', value: users.length, icon: '👤' },
    { label: 'Подтвердили почту', value: users.filter(u => u.emailVerified || u.email).length, icon: '📧' },
    { label: 'Привязали Telegram', value: users.filter(u => u.telegramId || u.tgId || u.authProvider === 'telegram').length, icon: '💬' },
    { label: 'Получили первый ключ', value: users.filter(u => (Number(u.keys) || 0) > 0).length, icon: '🗝' },
    { label: 'Посетили партнёра', value: users.filter(u => Object.keys(u.scannedPartners ?? {}).length || Object.keys(u.visitCounts ?? {}).length).length, icon: '🏪' },
    { label: 'Участвовали в розыгрыше', value: new Set(raffleEntries.map(e => e.userId).filter(Boolean)).size, icon: '🎁' },
  ];
  const maxFunnel = Math.max(funnel[0]?.value || 1, 1);
  const activity = [
    ...adminActivity.map(a => ({ ts: toJsDate(a.createdAt), icon: '🛠', text: a.label || `${a.action || 'Действие'}: ${a.targetType || 'объект'}`, sub: a.actorName || a.actorId || 'Админка' })),
    ...users.map(u => ({ ts: toJsDate(u.registeredAt || u.createdAt), icon: '👤', text: `${userDisplayName(u)} зарегистрировался`, sub: providerLabel(u) })),
    ...scans.map(scan => ({ ts: toJsDate(scan.scannedAt || scan.createdAt), icon: '🗝', text: `Пользователь получил ключ у партнёра`, sub: scan.partnerId || scan.userId })),
    ...expertScans.map(scan => ({ ts: toJsDate(scan.scannedAt || scan.createdAt), icon: '🧑‍💼', text: `Посещение эксперта отмечено`, sub: scan.expertId || scan.userId })),
    ...reviews.map(r => ({ ts: toJsDate(r.createdAt), icon: '⭐', text: `Оставлен отзыв`, sub: r.partnerName || r.partnerId || r.userName })),
    ...raffleEntries.map(r => ({ ts: toJsDate(r.createdAt || r.enteredAt), icon: '🎁', text: `Участие в розыгрыше`, sub: r.prizeId || r.userId })),
  ].filter(item => item.ts).sort((a, b) => b.ts - a.ts).slice(0, 12);
  const mostReadNews = [...news]
    .sort((a, b) => Number(b.stats?.views ?? b.views ?? 0) - Number(a.stats?.views ?? a.views ?? 0))[0];
  const latestComment = [...comments].sort((a, b) => Number(toJsDate(b.createdAt) || 0) - Number(toJsDate(a.createdAt) || 0))[0];
  const latestError = [...errors].sort((a, b) => Number(toJsDate(b.timestamp || b.createdAt) || 0) - Number(toJsDate(a.timestamp || a.createdAt) || 0))[0];
  const newestPartner = [...partners].sort((a, b) => Number(toJsDate(b.createdAt) || 0) - Number(toJsDate(a.createdAt) || 0))[0];

  return (
    <div>
      <div style={{ ...s.card, padding: 22, marginBottom: 18, background: 'linear-gradient(135deg, rgba(201,168,76,0.14), rgba(255,255,255,0.045))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: A.gold, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Редакционная админка V4.4</div>
            <h1 style={{ ...s.h1, fontSize: 30, lineHeight: '34px', marginBottom: 8 }}>Добро пожаловать в рабочий центр АПГ</h1>
            <div style={{ fontSize: 14, color: A.textSec, lineHeight: '21px', maxWidth: 620 }}>Главный экран теперь показывает не меню, а состояние проекта: публикации, комментарии, ошибки, рост пользователей, партнёры, эксперты и быстрые действия.</div>
          </div>
          <button onClick={() => onOpenTab('analytics')} style={{ ...s.btn, ...s.btnPri, whiteSpace: 'nowrap' }}>Открыть аналитику</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <button onClick={() => onOpenTab('moderation')} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left' }}><StatTile label="На модерации" value={pendingNews + moderationComments} icon="🚦" color={pendingNews + moderationComments ? '#f59e0b' : '#4BB34B'} sub={`${pendingNews} новостей · ${moderationComments} комментариев`} /></button>
        <button onClick={() => onOpenTab('comments')} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left' }}><StatTile label="Новых комментариев" value={newComments} icon="💬" color="#38bdf8" sub={`${comments.filter(c => !c.hidden).length} всего`} /></button>
        <button onClick={() => onOpenTab('errors')} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left' }}><StatTile label="Ошибок приложения" value={openErrors} icon="🐞" color={openErrors ? A.red : '#4BB34B'} sub={openErrors ? 'требуют внимания' : 'критичных нет'} /></button>
        <StatTile label="Всего пользователей" value={users.length} icon="👥" color={A.blue} sub={`+${newToday} сегодня`} />
        <StatTile label="Новых за неделю" value={newWeek} icon="🆕" color="#4BB34B" sub={`+${newMonth} за месяц`} />
        <StatTile label="Партнёров" value={partners.length} icon="🤝" color={A.gold} />
        <StatTile label="Экспертов" value={experts.length} icon="🧑‍💼" color="#A78BFA" />
        <StatTile label="Мероприятий" value={activeEvents} icon="🎉" color="#f59e0b" />
        <StatTile label="Новостей" value={activeNews} icon="📢" color="#38bdf8" />
        <StatTile label="Акций" value={activeOffers} icon="🏷️" color={A.gold} />
        <StatTile label="Выдано ключей" value={issuedKeys} icon="🗝" color={A.gold} />
        <StatTile label="QR использовано" value={allScans.length} icon="📲" color={A.blue} />
        <StatTile label="Отзывы" value={reviewTotal} icon="⭐" color="#f59e0b" />
        <StatTile label="Регистрации на события" value={eventRegistrations} icon="📝" color="#4BB34B" />
        <StatTile label="Призы" value={prizes.length} icon="🎁" color="#A78BFA" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <QuickInsightCard icon="🔥" title="Самая читаемая новость" text={mostReadNews?.title || 'Пока нет данных'} sub={mostReadNews ? `${Number(mostReadNews.stats?.views ?? mostReadNews.views ?? 0)} просмотров` : 'Появится после первых просмотров'} onClick={() => onOpenTab('news')} />
        <QuickInsightCard icon="💬" title="Последний комментарий" text={latestComment?.text || 'Комментариев пока нет'} sub={latestComment?.userName || 'Модерация чистая'} onClick={() => onOpenTab('comments')} />
        <QuickInsightCard icon="🐞" title="Последняя ошибка" text={latestError?.message || latestError?.error || 'Критичных ошибок нет'} sub={latestError ? (latestError.source || latestError.screen || 'errorLogs') : 'Система спокойна'} onClick={() => onOpenTab('errors')} />
        <QuickInsightCard icon="🤝" title="Новый партнёр" text={newestPartner?.name || 'Новых партнёров нет'} sub={newestPartner?.category || 'CRM готова к добавлению'} onClick={() => onOpenTab('partners')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
        <div style={s.card}>
          <h2 style={s.h2}>📈 Рост пользователей</h2>
          <MiniBarChart data={regData} labelKey="date" valueKey="count" color="#4BB34B" shortDate />
        </div>
        <div style={s.card}>
          <h2 style={s.h2}>🗝 Начисления и QR</h2>
          <MiniBarChart data={scanData} labelKey="date" valueKey="count" color={A.gold} shortDate />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 16, marginBottom: 16 }}>
        <div style={s.card}>
          <h2 style={s.h2}>🚀 Воронка роста АПГ</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {funnel.map((step, i) => {
              const width = Math.max(4, Math.round((step.value / maxFunnel) * 100));
              const prev = funnel[i - 1]?.value || step.value || 1;
              const conversion = i === 0 ? '100%' : `${Math.round((step.value / Math.max(prev, 1)) * 100)}%`;
              return (
                <div key={step.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: A.text, fontWeight: 750 }}>{step.icon} {step.label}</span>
                    <span style={{ color: A.gold, fontWeight: 900 }}>{step.value} <span style={{ color: A.textSec, fontWeight: 600 }}>· {conversion}</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: A.chip, overflow: 'hidden', border: `1px solid ${A.border}` }}>
                    <div style={{ height: '100%', width: `${width}%`, background: i < 3 ? A.gold : i < 6 ? '#4BB34B' : A.blue, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>🧭 Источники пользователей</h2>
          {sourceRows.length === 0 ? <div style={{ color: A.textSec, fontSize: 13 }}>Пока нет данных по источникам.</div> : sourceRows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${A.rowBrd}` }}>
              <span style={{ color: A.text, fontSize: 13 }}>{label}</span>
              <span style={{ color: A.gold, fontWeight: 900 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
        <div style={s.card}>
          <h2 style={s.h2}>🤝 Партнёры: вклад в рост</h2>
          {partnerRows.length === 0 ? <div style={{ color: A.textSec, fontSize: 13 }}>Нет данных по партнёрам.</div> : partnerRows.map(p => (
            <button key={p.id} onClick={() => onOpenPartner(p.id)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '10px 0', borderBottom: `1px solid ${A.rowBrd}`, textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                <span style={{ color: A.text, fontSize: 13, fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ color: A.gold, fontSize: 12, fontWeight: 900 }}>{p.scans} QR</span>
              </div>
              <div style={{ color: A.textSec, fontSize: 11 }}>новых: {p.newUsers} · ключей: {p.keys} · просмотров: {p.views} · избранное: {p.favorites}</div>
            </button>
          ))}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>🧑‍💼 Эксперты: активность</h2>
          {expertRows.length === 0 ? <div style={{ color: A.textSec, fontSize: 13 }}>Нет данных по экспертам.</div> : expertRows.map(e => (
            <button key={e.id} onClick={() => onOpenExpert(e.id)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '10px 0', borderBottom: `1px solid ${A.rowBrd}`, textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                <span style={{ color: A.text, fontSize: 13, fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                <span style={{ color: A.gold, fontSize: 12, fontWeight: 900 }}>{e.scans} QR</span>
              </div>
              <div style={{ color: A.textSec, fontSize: 11 }}>ключей: {e.keys} · просмотров: {e.views} · отзывов: {e.reviews}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>🕒 Журнал событий</h2>
        {activity.length === 0 ? (
          <div style={{ color: A.textSec, fontSize: 13 }}>Пока нет событий для журнала.</div>
        ) : activity.map((item, i) => (
          <div key={`${item.text}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < activity.length - 1 ? `1px solid ${A.rowBrd}` : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 14, background: A.chip, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: A.text, fontSize: 13, fontWeight: 700 }}>{item.text}</div>
              <div style={{ color: A.textSec, fontSize: 11, marginTop: 2 }}>{item.sub}</div>
            </div>
            <div style={{ color: A.textSec, fontSize: 11, flexShrink: 0 }}>{item.ts.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickInsightCard({ icon, title, text, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...s.card, marginBottom: 0, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 8, borderColor: A.goldBrd, minHeight: 118 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: A.gold, fontSize: 12, fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontSize: 22 }}>{icon}</div>
      </div>
      <div style={{ color: A.text, fontSize: 14, fontWeight: 850, lineHeight: '19px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</div>
      <div style={{ color: A.textSec, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
    </button>
  );
}

function AdminQuickActions({ setActiveTab, openNews, openPartner, openEvent, openPrize, openPush, openComments }) {
  const actions = [
    ['📢', 'Новость', openNews],
    ['📸', 'Фото к новости', openNews],
    ['🤝', 'Партнёр', openPartner],
    ['📅', 'Событие', openEvent],
    ['🎁', 'Приз', openPrize],
    ['📣', 'Push', openPush],
    ['💬', 'Комментарии', openComments],
    ['🤖', 'Черновики ИИ', () => setActiveTab('ai-drafts')],
  ];
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', zIndex: 850, display: 'grid', gap: 8, width: 178 }}>
      {actions.map(([icon, label, onClick]) => (
        <button key={label} type="button" onClick={onClick} style={{ ...s.btn, ...s.btnPri, minHeight: 40, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, boxShadow: '0 18px 46px rgba(0,0,0,0.34)', fontSize: 12.5 }}>
          <span>{icon}</span><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

const byPriorityDate = (a, b) => {
  const dp = (b.priority ?? 0) - (a.priority ?? 0);
  if (dp !== 0) return dp;
  const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ?? 0);
  const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ?? 0);
  return tb - ta;
};

function AdminNewsCard({ item, selected, dragging, onEdit, onPublish, onPin, onDelete, onCheck, onSelect, onContextMenu, onPreview, onSwipe, onDragStart, onDragOver, onDrop }) {
  const touchRef = useRef({ x: 0, y: 0, t: 0 });
  const longPressRef = useRef(null);
  const lastTapRef = useRef(0);
  const image = contentImageOf(item);
  const published = item.publishedAt?.toDate ? item.publishedAt.toDate() : item.publishedAt ? new Date(item.publishedAt) : item.createdAt?.toDate ? item.createdAt.toDate() : null;
  const stats = item.stats || {};
  const reactions = Object.values(item.reactions || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const status = item.active === false ? 'Черновик' : String(item.status || '').toLowerCase() === 'scheduled' ? 'Отложено' : 'Опубликовано';
  const statusColor = status === 'Опубликовано' ? '#4BB34B' : status === 'Отложено' ? '#f59e0b' : A.textSec;
  const clearLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };
  return (
    <div
      draggable
      onDragStart={e => onDragStart?.(item, e)}
      onDragOver={e => onDragOver?.(item, e)}
      onDrop={e => onDrop?.(item, e)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(item, e.clientX, e.clientY); }}
      onDoubleClick={onPreview}
      onTouchStart={e => {
        const touch = e.touches?.[0];
        touchRef.current = { x: touch?.clientX || 0, y: touch?.clientY || 0, t: Date.now() };
        clearLongPress();
        longPressRef.current = setTimeout(() => {
          onContextMenu?.(item, touchRef.current.x, touchRef.current.y);
        }, 560);
      }}
      onTouchMove={e => {
        const touch = e.touches?.[0];
        if (Math.abs((touch?.clientX || 0) - touchRef.current.x) > 12 || Math.abs((touch?.clientY || 0) - touchRef.current.y) > 12) clearLongPress();
      }}
      onTouchEnd={e => {
        clearLongPress();
        const touch = e.changedTouches?.[0];
        const dx = (touch?.clientX || 0) - touchRef.current.x;
        const dy = Math.abs((touch?.clientY || 0) - touchRef.current.y);
        const now = Date.now();
        if (Math.abs(dx) > 76 && dy < 44) onSwipe?.(item, dx > 0 ? 'publish' : 'delete');
        else if (now - lastTapRef.current < 310) onPreview?.();
        lastTapRef.current = now;
      }}
      style={{ ...s.card, marginBottom: 0, padding: 0, overflow: 'hidden', minHeight: 320, borderColor: selected ? A.gold : dragging ? '#38bdf8' : s.card.border.split(' ').pop(), boxShadow: selected ? '0 0 0 1px rgba(201,168,76,0.35), 0 18px 50px rgba(201,168,76,0.12)' : dragging ? '0 18px 50px rgba(56,189,248,0.14)' : s.card.boxShadow, transform: selected ? 'translateY(-1px)' : 'none', transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease', cursor: 'grab' }}>
      <div style={{ height: 150, background: A.chip, position: 'relative', overflow: 'hidden' }}>
        {image ? <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => e.currentTarget.style.display = 'none'} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 34 }}>📰</div>}
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.48)', color: A.gold, border: `1px solid ${A.goldBrd}`, fontSize: 10.5, fontWeight: 850 }}>{item.source === 'vk' ? 'VK' : 'АПГ'}</span>
          <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.48)', color: statusColor, border: `1px solid ${statusColor}55`, fontSize: 10.5, fontWeight: 850 }}>{status}</span>
          {(item.pinned || item.isPinned || (item.priority ?? 0) >= 8) && <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.48)', color: A.gold, border: `1px solid ${A.goldBrd}`, fontSize: 10.5, fontWeight: 850 }}>📌</span>}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onSelect?.(); }} style={{ position: 'absolute', right: 12, top: 12, width: 30, height: 30, borderRadius: 999, border: `1px solid ${selected ? A.gold : 'rgba(255,255,255,0.22)'}`, background: selected ? 'rgba(201,168,76,0.86)' : 'rgba(0,0,0,0.42)', color: selected ? '#111' : A.text, fontWeight: 900, cursor: 'pointer' }}>{selected ? '✓' : ''}</button>
      </div>
      <div style={{ padding: 15, display: 'grid', gap: 11 }}>
        <div>
          <div style={{ color: A.text, fontSize: 15, lineHeight: '20px', fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title || 'Без заголовка'}</div>
          <div style={{ color: A.textSec, fontSize: 11.5, lineHeight: '16px', marginTop: 4 }}>{published ? published.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Дата не задана'} · {item.category || 'без категории'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            ['👁', stats.views ?? item.views ?? 0],
            ['💬', stats.comments ?? item.comments ?? 0],
            ['❤️', reactions],
            ['↗', stats.reposts ?? item.shares ?? 0],
          ].map(([icon, value]) => (
            <div key={icon} style={{ padding: '7px 5px', borderRadius: 12, background: A.chip, textAlign: 'center', color: A.text, fontSize: 12, fontWeight: 850 }}>{icon} {value}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <button type="button" onClick={onEdit} style={{ ...s.btn, ...s.btnGray, padding: '8px 6px', fontSize: 11.5 }}>✏️</button>
          <button type="button" onClick={onPublish} style={{ ...s.btn, ...s.btnGray, padding: '8px 6px', fontSize: 11.5 }}>🚀</button>
          <button type="button" onClick={onPin} style={{ ...s.btn, ...s.btnGray, padding: '8px 6px', fontSize: 11.5 }}>📌</button>
          <button type="button" onClick={onCheck} style={{ ...s.btn, ...s.btnGray, padding: '8px 6px', fontSize: 11.5 }}>✓</button>
          <button type="button" onClick={onEdit} style={{ ...s.btn, ...s.btnGray, padding: '8px 6px', fontSize: 11.5 }}>👁</button>
          <button type="button" onClick={onDelete} style={{ ...s.btn, ...s.btnDanger, padding: '8px 6px', fontSize: 11.5 }}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function EditorialNewsBoard({ news, selectedIds, draggingId, onEdit, onPublish, onPin, onDelete, onCheck, onSelect, onBulkPublish, onBulkDelete, onBulkPin, onContextMenu, onPreview, onSwipe, onDragStart, onDragOver, onDrop }) {
  const sorted = [...news].sort(byPriorityDate);
  return (
    <div>
      {selectedIds.length > 0 && (
        <div style={{ ...s.card, position: 'sticky', top: 74, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', marginBottom: 14, borderColor: A.goldBrd }}>
          <div style={{ color: A.text, fontSize: 13, fontWeight: 850 }}>Выбрано: {selectedIds.length}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onBulkPublish} style={{ ...s.btn, ...s.btnPri, padding: '8px 11px', fontSize: 12 }}>🚀 Опубликовать</button>
            <button type="button" onClick={onBulkPin} style={{ ...s.btn, ...s.btnGray, padding: '8px 11px', fontSize: 12 }}>📌 Закрепить</button>
            <button type="button" onClick={onBulkDelete} style={{ ...s.btn, ...s.btnDanger, padding: '8px 11px', fontSize: 12 }}>🗑 Удалить</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
        {sorted.map(item => (
          <AdminNewsCard
            key={item.id}
            item={item}
            selected={selectedIds.includes(item.id)}
            dragging={draggingId === item.id}
            onEdit={() => onEdit(item)}
            onPublish={() => onPublish(item)}
            onPin={() => onPin(item)}
            onDelete={() => onDelete(item.id)}
            onCheck={() => onCheck(item.id)}
            onSelect={() => onSelect(item.id)}
            onContextMenu={onContextMenu}
            onPreview={() => onPreview(item)}
            onSwipe={onSwipe}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
      </div>
    </div>
  );
}

function AdminQuickNewsEditor({ item, draft, saving, dirty, onPatch, onSave, onClose, onPublish, onDelete }) {
  if (!item || !draft) return null;
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 930, width: 'min(100vw, 430px)', background: 'rgba(16,16,32,0.92)', backdropFilter: 'blur(28px) saturate(1.35)', WebkitBackdropFilter: 'blur(28px) saturate(1.35)', borderLeft: `1px solid ${A.goldBrd}`, boxShadow: '-24px 0 70px rgba(0,0,0,0.48)', padding: '18px 18px calc(24px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ color: A.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Быстрый редактор</div>
          <h2 style={{ ...s.h2, margin: '4px 0 3px', fontSize: 19 }}>Новость</h2>
          <div style={{ color: dirty ? A.gold : A.textSec, fontSize: 12 }}>{saving ? 'Сохраняем...' : dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</div>
        </div>
        <button type="button" onClick={onClose} style={{ ...s.btn, ...s.btnGray, width: 38, height: 38, padding: 0 }}>✕</button>
      </div>

      <label style={s.label}>Заголовок</label>
      <input style={s.input} value={draft.title} onChange={e => onPatch({ title: e.target.value })} placeholder="Заголовок новости" />

      <label style={s.label}>Текст</label>
      <textarea style={{ ...s.textarea, minHeight: 220, lineHeight: '20px' }} value={draft.text} onChange={e => onPatch({ text: e.target.value })} placeholder="Текст новости" />

      <label style={s.label}>Категория</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {CONTENT_CATEGORIES.map(cat => (
          <button key={cat.id} type="button" onClick={() => onPatch({ category: draft.category === cat.id ? '' : cat.id })}
            style={{ padding: '7px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: `1px solid ${draft.category === cat.id ? cat.color : A.border}`, background: draft.category === cat.id ? cat.color + '22' : A.chip, color: draft.category === cat.id ? cat.color : A.textSec }}>
            {cat.label}
          </button>
        ))}
      </div>

      <label style={s.label}>Обложка</label>
      <PhotoUpload value={draft.coverPhoto} onChange={value => onPatch({ coverPhoto: value })} folder="news" label="Заменить обложку" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
      {draft.coverPhoto && <img src={draft.coverPhoto} alt="" loading="lazy" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 16, border: `1px solid ${A.border}`, margin: '8px 0 14px' }} onError={e => e.currentTarget.style.display = 'none'} />}

      <label style={s.label}>Приоритет</label>
      <input style={s.input} type="number" value={draft.priority} onChange={e => onPatch({ priority: e.target.value })} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <button type="button" disabled={saving} onClick={() => onSave()} style={{ ...s.btn, ...s.btnPri, minHeight: 42 }}>💾 Сохранить</button>
        <button type="button" onClick={onPublish} style={{ ...s.btn, ...s.btnGray, minHeight: 42 }}>🚀 Опубликовать</button>
        <button type="button" onClick={onDelete} style={{ ...s.btn, ...s.btnDanger, gridColumn: '1 / -1', minHeight: 42 }}>🗑 Удалить с undo</button>
      </div>

      <div style={{ marginTop: 18, padding: 12, borderRadius: 16, background: A.goldDim, border: `1px solid ${A.goldBrd}`, color: A.textSec, fontSize: 12, lineHeight: '18px' }}>
        Автосохранение включено. История изменений пишется в <b style={{ color: A.gold }}>newsChangeHistory</b>, действия администратора — в <b style={{ color: A.gold }}>adminActivity</b>.
      </div>
    </div>
  );
}

function AdminUndoBar({ undo, onRestore, onClose }) {
  if (!undo) return null;
  return (
    <div style={{ position: 'fixed', left: 18, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', zIndex: 940, width: 'min(430px, calc(100vw - 36px))', padding: 14, borderRadius: 18, background: 'rgba(18,18,30,0.92)', border: `1px solid ${A.goldBrd}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: A.text, fontSize: 13, fontWeight: 850 }}>{undo.label}</div>
        <div style={{ color: A.textSec, fontSize: 11, marginTop: 2 }}>Отмена доступна 10 секунд.</div>
      </div>
      <button type="button" onClick={onRestore} style={{ ...s.btn, ...s.btnPri, padding: '8px 11px', fontSize: 12 }}>Отменить</button>
      <button type="button" onClick={onClose} style={{ ...s.btn, ...s.btnGray, padding: '8px 10px', fontSize: 12 }}>✕</button>
    </div>
  );
}

function AdminContextMenu({ menu, onClose, onEdit, onPublish, onPin, onDelete, onCheck }) {
  if (!menu?.item) return null;
  const x = Math.min(menu.x || 18, Math.max(18, window.innerWidth - 220));
  const y = Math.min(menu.y || 18, Math.max(18, window.innerHeight - 260));
  const item = menu.item;
  const action = (fn) => {
    fn();
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 925, background: 'transparent' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: x, top: y, width: 210, padding: 8, borderRadius: 16, background: 'rgba(18,18,30,0.96)', border: `1px solid ${A.border}`, boxShadow: '0 18px 50px rgba(0,0,0,0.42)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        {[
          ['✏️ Быстро редактировать', () => onEdit(item)],
          ['🚀 Опубликовать', () => onPublish(item)],
          ['📌 Закрепить', () => onPin(item)],
          ['✓ Ссылки проверены', () => onCheck(item.id)],
          ['🗑 Удалить', () => onDelete(item.id)],
        ].map(([label, fn], i) => (
          <button key={label} type="button" onClick={() => action(fn)} style={{ width: '100%', border: 'none', borderBottom: i < 4 ? `1px solid ${A.rowBrd}` : 'none', background: 'transparent', color: label.includes('Удалить') ? '#ff8a8a' : A.text, padding: '10px 11px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontWeight: 780 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SystemStatusPanel({ status, loading, onRefresh }) {
  const collections = status?.firestore?.collections || {};
  const rows = [
    ['API', status?.api?.ok, status?.api?.runtime || 'unknown', `${status?.latencyMs ?? 0} ms`],
    ['Firestore', status?.firestore?.ok, 'collections', Object.values(collections).filter(v => v?.ok).length],
    ['VK News', status?.vkNews?.ok, status?.vkNews?.source || 'unknown', `${status?.vkNews?.count || 0} постов`],
    ['Очередь задач', status?.queues?.ok, status?.queues?.note || 'ok', status?.queues?.pending ?? 0],
    ['Backup', status?.backups?.configured, status?.backups?.note || 'нет данных', status?.backups?.lastBackupAt || '—'],
  ];
  return (
    <div>
      <div style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ ...s.h1, marginBottom: 4 }}>🛡 Состояние системы</h1>
          <div style={{ color: A.textSec, fontSize: 12 }}>Проверка API, Firestore, VK News, очередей, ошибок и backup markers.</div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} style={{ ...s.btn, ...s.btnPri, opacity: loading ? 0.55 : 1 }}>{loading ? 'Проверяем...' : '↻ Обновить'}</button>
      </div>
      {status?.error && <div style={{ ...s.card, borderColor: A.redBrd, color: '#ff9a9a' }}>{status.error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {rows.map(([label, ok, text, value]) => (
          <div key={label} style={{ ...s.card, marginBottom: 0, borderColor: ok ? 'rgba(75,179,75,0.3)' : A.redBrd }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ color: A.text, fontSize: 14, fontWeight: 900 }}>{label}</div>
              <div style={{ color: ok ? '#4BB34B' : A.red, fontWeight: 900 }}>{ok ? 'OK' : 'WARN'}</div>
            </div>
            <div style={{ color: A.textSec, fontSize: 12, lineHeight: '17px' }}>{text}</div>
            <div style={{ color: A.gold, fontSize: 13, fontWeight: 850, marginTop: 8, overflowWrap: 'anywhere' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.h2}>Firestore collections</h2>
        {Object.entries(collections).map(([name, info]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${A.rowBrd}`, color: A.textSec, fontSize: 12 }}>
            <span>{name}</span>
            <span style={{ color: info?.ok ? A.gold : A.red }}>{info?.ok ? `${info.count}${info.capped ? '+' : ''}` : info?.error || 'error'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCommentsPanel({ comments, news, onRefresh, onModerate }) {
  const visible = comments.filter(c => !c.hidden);
  const pending = visible.filter(c => c.status === 'pending' || !c.moderationReviewedAt);
  const rows = [...visible].sort((a, b) => Number(toJsDate(b.createdAt) || 0) - Number(toJsDate(a.createdAt) || 0));
  const titleOf = (id) => news.find(n => String(n.id) === String(id))?.title || id || 'Новость';
  return (
    <div>
      <div style={{ ...s.card, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2 style={{ ...s.h2, margin: '0 0 4px' }}>💬 Комментарии</h2>
          <div style={{ color: A.textSec, fontSize: 12 }}>{visible.length} активных · {pending.length} требуют просмотра</div>
        </div>
        <button type="button" onClick={onRefresh} style={{ ...s.btn, ...s.btnGray }}>↻ Обновить</button>
      </div>
      {rows.length === 0 ? (
        <div style={{ ...s.card, color: A.textSec, textAlign: 'center' }}>Комментариев пока нет.</div>
      ) : rows.map(comment => (
        <div key={comment.id} style={{ ...s.card, display: 'grid', gap: 10, borderLeft: `3px solid ${comment.isUseful ? A.gold : comment.isPinned ? '#38bdf8' : A.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: A.text, fontSize: 14, fontWeight: 850 }}>{comment.userName || 'Участник'} {comment.authorRole && <span style={{ color: A.gold, fontSize: 11 }}>· {comment.authorRole}</span>}</div>
              <div style={{ color: A.textSec, fontSize: 11, marginTop: 2 }}>{titleOf(comment.newsId)} · {toJsDate(comment.createdAt)?.toLocaleString('ru-RU') || 'дата не задана'}</div>
            </div>
            <div style={{ color: A.gold, fontSize: 12, fontWeight: 900 }}>❤️ {Number(comment.likes || 0)}</div>
          </div>
          <div style={{ color: A.text, fontSize: 13.5, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{comment.text}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onModerate(comment, 'toggleUseful')} style={{ ...s.btn, ...s.btnGray, padding: '7px 10px', fontSize: 12 }}>{comment.isUseful ? 'Снять полезный' : '⭐ Полезный'}</button>
            <button type="button" onClick={() => onModerate(comment, 'togglePin')} style={{ ...s.btn, ...s.btnGray, padding: '7px 10px', fontSize: 12 }}>{comment.isPinned ? 'Открепить' : '📌 Закрепить'}</button>
            <button type="button" onClick={() => onModerate(comment, 'delete')} style={{ ...s.btn, ...s.btnDanger, padding: '7px 10px', fontSize: 12 }}>Скрыть</button>
            <button type="button" onClick={() => onModerate(comment, 'blockUser')} style={{ ...s.btn, ...s.btnDanger, padding: '7px 10px', fontSize: 12 }}>Блокировать</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModerationPanel({ news, comments, onOpenNews, onOpenComments }) {
  const pendingNews = news.filter(n => ['draft', 'pending', 'scheduled'].includes(String(n.status || '').toLowerCase()) || n.active === false);
  const pendingComments = comments.filter(c => !c.hidden && (c.status === 'pending' || !c.moderationReviewedAt));
  return (
    <div>
      <div style={{ ...s.card, padding: 22, background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(255,255,255,0.04))' }}>
        <div style={{ color: A.gold, fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>Очередь публикации и модерации</div>
        <h1 style={{ ...s.h1, fontSize: 26, marginTop: 6 }}>На модерации</h1>
        <div style={{ color: A.textSec, fontSize: 14, lineHeight: '20px' }}>На телефоне карточки готовы к свайп-механике, на ноутбуке работают кнопки и контекстные действия.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
        <button type="button" onClick={onOpenNews} style={{ ...s.card, textAlign: 'left', cursor: 'pointer', border: `1px solid ${pendingNews.length ? 'rgba(245,158,11,0.34)' : A.border}` }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📰</div>
          <div style={{ color: A.text, fontSize: 18, fontWeight: 900 }}>{pendingNews.length} новостей</div>
          <div style={{ color: A.textSec, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Черновики, отложенные и выключенные публикации.</div>
        </button>
        <button type="button" onClick={onOpenComments} style={{ ...s.card, textAlign: 'left', cursor: 'pointer', border: `1px solid ${pendingComments.length ? 'rgba(245,158,11,0.34)' : A.border}` }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>💬</div>
          <div style={{ color: A.text, fontSize: 18, fontWeight: 900 }}>{pendingComments.length} комментариев</div>
          <div style={{ color: A.textSec, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Новые ответы, полезные комментарии и будущая очередь жалоб.</div>
        </button>
        <div style={{ ...s.card, border: `1px dashed ${A.goldBrd}` }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🤖</div>
          <div style={{ color: A.text, fontSize: 18, fontWeight: 900 }}>Черновики ИИ</div>
          <div style={{ color: A.textSec, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Место для V4.5: автоматические материалы, очередь публикаций и редакторские подсказки.</div>
        </div>
      </div>
    </div>
  );
}

function AdminUsersPanel({ users }) {
  const [queryText, setQueryText] = useState('');
  const filtered = users
    .filter(user => {
      const q = queryText.toLowerCase();
      return !q || userDisplayName(user).toLowerCase().includes(q) || String(user.email || '').toLowerCase().includes(q) || String(user.id || '').toLowerCase().includes(q);
    })
    .sort((a, b) => Number(toJsDate(b.registeredAt || b.createdAt) || 0) - Number(toJsDate(a.registeredAt || a.createdAt) || 0));
  return (
    <div>
      <div style={s.card}>
        <h2 style={s.h2}>👥 Пользователи</h2>
        <input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="Поиск по имени, email или id" style={s.input} />
        <div style={{ color: A.textSec, fontSize: 12 }}>{filtered.length} из {users.length}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
        {filtered.slice(0, 120).map(user => (
          <div key={user.id} style={{ ...s.card, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: A.text, fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userDisplayName(user)}</div>
                <div style={{ color: A.textSec, fontSize: 11.5, marginTop: 3 }}>{providerLabel(user)}</div>
              </div>
              <div style={{ color: A.gold, fontWeight: 950 }}>{Number(user.keys || 0)} 🗝</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {['role', 'email', 'telegramId'].map(key => user[key] ? (
                <span key={key} style={{ padding: '5px 8px', borderRadius: 999, background: A.chip, color: A.textSec, fontSize: 10.5, fontWeight: 750 }}>{key}: {String(user[key]).slice(0, 28)}</span>
              ) : null)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function lokiEditorRequest(action, payload = {}) {
  const user = auth.currentUser || await signInAnonymously(auth).then(r => r.user);
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/loki-editor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-APG-Version': 'v5.0-local',
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Локи-редактор недоступен.');
  return data;
}

function confidenceTone(value) {
  const n = Number(value || 0);
  if (n >= 90) return { label: `🟢 ${n}%`, color: '#4ade80' };
  if (n >= 75) return { label: `🟡 ${n}%`, color: '#facc15' };
  return { label: `🔴 ${n}%`, color: '#fb7185' };
}

function AIDraftsPanel() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState({ sources: [], drafts: [], activity: [], runs: [], stats: {}, settings: {} });
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('rss');
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [maxItemsPerRun, setMaxItemsPerRun] = useState(20);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await lokiEditorRequest('status'));
    } catch (e) {
      setError(e.message || 'Не удалось загрузить черновики Локи.');
      logError(e, 'AdminPanel.AIDraftsPanel.load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setIntervalMinutes(Number(data.settings?.intervalMinutes || 10));
    setConfidenceThreshold(Number(data.settings?.confidenceThreshold || 70));
    setMaxItemsPerRun(Number(data.settings?.maxItemsPerRun || 20));
  }, [data.settings?.intervalMinutes, data.settings?.confidenceThreshold, data.settings?.maxItemsPerRun]);

  const runCycle = async () => {
    setRunning(true);
    setError('');
    try {
      await lokiEditorRequest('run-cycle');
      await load();
    } catch (e) {
      setError(e.message || 'Не удалось проверить источники.');
      logError(e, 'AdminPanel.AIDraftsPanel.runCycle');
    } finally {
      setRunning(false);
    }
  };

  const saveSource = async () => {
    if (!sourceName.trim()) return;
    setError('');
    try {
      await lokiEditorRequest('source:save', { source: { name: sourceName.trim(), url: sourceUrl.trim(), type: sourceType, active: true, intervalMinutes: 10 } });
      setSourceName('');
      setSourceUrl('');
      setSourceType('rss');
      await load();
    } catch (e) {
      setError(e.message || 'Источник не сохранён.');
      logError(e, 'AdminPanel.AIDraftsPanel.saveSource');
    }
  };

  const saveSettings = async () => {
    try {
      await lokiEditorRequest('settings:save', {
        settings: {
          intervalMinutes: Math.max(1, Number(intervalMinutes || 10)),
          confidenceThreshold: Math.max(1, Math.min(99, Number(confidenceThreshold || 70))),
          maxItemsPerRun: Math.max(1, Math.min(100, Number(maxItemsPerRun || 20))),
        },
      });
      await load();
    } catch (e) {
      setError(e.message || 'Настройки не сохранены.');
      logError(e, 'AdminPanel.AIDraftsPanel.saveSettings');
    }
  };

  const updateDraft = async (id, patch, editorAction = 'update') => {
    await lokiEditorRequest('draft:update', { id, patch, editorAction });
    await load();
  };

  const editDraft = async (draft) => {
    const title = window.prompt('Заголовок черновика', draft.title || '');
    if (title == null) return;
    const summary = window.prompt('Краткое описание', draft.summary || '');
    if (summary == null) return;
    await updateDraft(draft.id, { title, summary }, 'edit');
  };

  const publishDraft = async (draft) => {
    if (!window.confirm('Опубликовать черновик как новость? Публикация выполняется только по вашему подтверждению.')) return;
    await lokiEditorRequest('draft:publish', { id: draft.id });
    await load();
  };

  const stats = data.stats || {};
  const readyDrafts = (data.drafts || []).filter(d => d.status !== 'rejected').sort((a, b) => Number(toJsDate(b.createdAt || b.fetchedAt) || 0) - Number(toJsDate(a.createdAt || a.fetchedAt) || 0));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...s.card, padding: 24, border: `1px solid ${A.goldBrd}`, background: 'linear-gradient(135deg, rgba(201,168,76,0.14), rgba(255,255,255,0.035))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 38, marginBottom: 10 }}>🤖</div>
            <h1 style={{ ...s.h1, fontSize: 26, marginBottom: 8 }}>Локи · Редакция</h1>
            <div style={{ color: A.textSec, fontSize: 14, lineHeight: '22px', maxWidth: 720 }}>
              Локи собирает материалы из разрешённых источников, готовит черновики и отдаёт их редактору. Автопубликация отключена: финальное решение всегда принимает человек.
            </div>
          </div>
          <button onClick={runCycle} disabled={running} style={{ ...s.btnGold, minHeight: 44, opacity: running ? 0.65 : 1 }}>
            {running ? 'Проверяем...' : '🔄 Проверить источники'}
          </button>
        </div>
        {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.32)', color: '#fecdd3', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 18 }}>
          {[
            ['Найдено', stats.found ?? 0],
            ['Готово', stats.ready ?? 0],
            ['Дубликатов', stats.duplicates ?? 0],
            ['Ошибок', stats.errors ?? 0],
            ['Опубликовано', stats.published ?? 0],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 14, borderRadius: 16, background: A.chip, border: `1px solid ${A.border}` }}>
              <div style={{ color: A.textSec, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ color: A.text, fontSize: 24, fontWeight: 950, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 14 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <h2 style={s.h2}>Черновики</h2>
            {loading ? <div style={{ color: A.textSec }}>Загружаем очередь...</div> : readyDrafts.length === 0 ? (
              <div style={{ color: A.textSec, lineHeight: '22px' }}>Очередь пуста. Добавьте источник и запустите проверку.</div>
            ) : readyDrafts.map(draft => {
              const tone = confidenceTone(draft.confidence);
              return (
                <div key={draft.id} style={{ marginTop: 12, padding: 14, borderRadius: 18, background: A.chip, border: `1px solid ${A.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: draft.imageUrl ? '96px 1fr' : '1fr', gap: 12 }}>
                    {draft.imageUrl && <img src={draft.imageUrl} alt="" loading="lazy" style={{ width: 96, height: 76, objectFit: 'cover', borderRadius: 14, border: `1px solid ${A.border}` }} onError={e => e.currentTarget.style.display = 'none'} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 7 }}>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: tone.color, fontSize: 11, fontWeight: 900 }}>{tone.label}</span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: A.textSec, fontSize: 11, fontWeight: 800 }}>{draft.category || 'society'}</span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: A.textSec, fontSize: 11, fontWeight: 800 }}>{draft.status || 'ready'}</span>
                      </div>
                      <div style={{ color: A.text, fontSize: 16, fontWeight: 920, lineHeight: '21px' }}>{draft.title}</div>
                      <div style={{ color: A.textSec, fontSize: 12.5, lineHeight: '19px', marginTop: 6 }}>{draft.summary}</div>
                      <div style={{ color: A.muted, fontSize: 11.5, marginTop: 8 }}>{draft.sourceName || 'Источник'} · {draft.readingTime || 1} мин чтения</div>
                    </div>
                  </div>
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ color: A.gold, cursor: 'pointer', fontSize: 12.5, fontWeight: 850 }}>🤖 Почему Локи считает это важным?</summary>
                    <div style={{ color: A.textSec, fontSize: 12.5, lineHeight: '19px', marginTop: 8 }}>{draft.explain || 'Материал требует редакторской проверки.'}</div>
                  </details>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button style={s.btn} onClick={() => window.alert(draft.text || draft.summary || '')}>👁 Просмотреть</button>
                    <button style={s.btn} onClick={() => editDraft(draft)}>✏️ Редактировать</button>
                    <button style={s.btnGold} onClick={() => publishDraft(draft)} disabled={draft.status === 'published'}>✅ Опубликовать</button>
                    <button style={s.btn} onClick={() => updateDraft(draft.id, { status: 'scheduled' }, 'schedule')}>📅 Отложить</button>
                    <button style={{ ...s.btn, color: '#fecdd3', borderColor: 'rgba(251,113,133,0.35)' }} onClick={() => updateDraft(draft.id, { status: 'rejected' }, 'reject')}>🗑 Отклонить</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <h2 style={s.h2}>Источники</h2>
            <input style={s.input} value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Название источника" />
            <input style={s.input} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="URL RSS / JSON" />
            <select style={s.input} value={sourceType} onChange={e => setSourceType(e.target.value)}>
              <option value="rss">RSS / XML</option>
              <option value="json">JSON API</option>
              <option value="manual">Ручной импорт</option>
            </select>
            <button style={{ ...s.btnGold, width: '100%' }} onClick={saveSource}>➕ Добавить источник</button>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {(data.sources || []).slice(0, 12).map(source => (
                <div key={source.id} style={{ padding: 11, borderRadius: 14, background: A.chip, border: `1px solid ${A.border}` }}>
                  <div style={{ color: A.text, fontWeight: 850, fontSize: 13 }}>{source.name}</div>
                  <div style={{ color: A.textSec, fontSize: 11.5, marginTop: 3 }}>{source.type} · {source.status || 'new'}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <h2 style={s.h2}>Журнал Локи</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {(data.activity || []).slice(0, 12).map(item => (
                <div key={item.id} style={{ color: A.textSec, fontSize: 12.5, lineHeight: '18px', paddingBottom: 8, borderBottom: `1px solid ${A.border}` }}>
                  <b style={{ color: A.text }}>{item.type}</b>{item.sourceName ? ` · ${item.sourceName}` : ''}{item.error ? ` · ${item.error}` : ''}
                </div>
              ))}
              {(!data.activity || data.activity.length === 0) && <div style={{ color: A.textSec, fontSize: 13 }}>Пока нет действий.</div>}
            </div>
          </div>
          <div style={{ ...s.card, marginBottom: 0 }}>
            <h2 style={s.h2}>Настройки Локи</h2>
            <label style={{ color: A.textSec, fontSize: 12, fontWeight: 800 }}>Период проверки, мин</label>
            <input style={s.input} type="number" min="1" value={intervalMinutes} onChange={e => setIntervalMinutes(e.target.value)} />
            <label style={{ color: A.textSec, fontSize: 12, fontWeight: 800 }}>Минимум доверия, %</label>
            <input style={s.input} type="number" min="1" max="99" value={confidenceThreshold} onChange={e => setConfidenceThreshold(e.target.value)} />
            <label style={{ color: A.textSec, fontSize: 12, fontWeight: 800 }}>Материалов за цикл</label>
            <input style={s.input} type="number" min="1" max="100" value={maxItemsPerRun} onChange={e => setMaxItemsPerRun(e.target.value)} />
            <button style={{ ...s.btn, width: '100%' }} onClick={saveSettings}>Сохранить настройки</button>
          </div>
        </div>
      </div>
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

function getISOWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function DiagStatusCell({ check, A }) {
  if (!check) return <span style={{ color: A.textSec }}>—</span>;
  return (
    <span style={{ fontWeight: 700, fontSize: 13, color: check.ok ? A.green : A.red }}>
      {check.ok ? '✓' : '✗'}
      {check.ms != null && <span style={{ color: A.textSec, fontWeight: 400, fontSize: 10 }}> {check.ms}мс</span>}
    </span>
  );
}

function DiagTab({ A, s }) {
  const [svcChecks, setSvcChecks]       = useState(null);
  const [svcLoading, setSvcLoading]     = useState(false);
  const [svcTs, setSvcTs]               = useState(null);
  const [reports, setReports]           = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [stats, setStats]               = useState(null);
  const [fDate, setFDate]               = useState('24h');
  const [fStatus, setFStatus]           = useState('all');
  const [fService, setFService]         = useState('all');
  const [fManual, setFManual]           = useState(false);

  useEffect(() => { doRunChecks(); }, []);
  useEffect(() => { loadReports(); }, [fDate, fStatus, fService, fManual]);

  async function doRunChecks() {
    setSvcLoading(true);
    try {
      const results = await runServiceChecks();
      setSvcChecks(results);
    } catch {}
    setSvcTs(new Date());
    setSvcLoading(false);
  }

  async function loadReports() {
    setReportsLoading(true);
    const msAgo = fDate === '24h' ? 86400000 : fDate === '7d' ? 7 * 86400000 : 30 * 86400000;
    const since = new Date(Date.now() - msAgo);
    try {
      const snap = await getDocs(query(
        collection(db, 'diagnostics'),
        where('timestamp', '>=', since),
        orderBy('timestamp', 'desc'),
        limit(500)
      ));
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (fStatus === 'ok')    docs = docs.filter(r => isAllOk(r.checks));
      if (fStatus === 'error') docs = docs.filter(r => !isAllOk(r.checks));
      if (fService !== 'all')  docs = docs.filter(r => r.checks?.[fService]?.ok === false);
      if (fManual)             docs = docs.filter(r => r.manual);
      setReports(docs);
      computeStats(docs);
    } catch {}
    setReportsLoading(false);
  }

  function isAllOk(checks) {
    if (!checks || Object.keys(checks).length === 0) return true;
    return Object.values(checks).every(c => c.ok !== false);
  }

  function computeStats(docs) {
    const total = docs.length;
    const withErrors = docs.filter(r => !isAllOk(r.checks)).length;
    const ok = total - withErrors;
    const successRate = total > 0 ? Math.round(ok / total * 100) : null;
    const manualCount = docs.filter(r => r.manual).length;
    const errCounts = {};
    docs.forEach(r => {
      Object.entries(r.checks ?? {}).forEach(([svc, c]) => {
        if (c.ok === false) {
          const key = svc + (c.error?.includes('timeout') ? ' timeout' : c.error ? ': ' + c.error.slice(0, 24) : ' error');
          errCounts[key] = (errCounts[key] || 0) + 1;
        }
      });
    });
    const topErrors = Object.entries(errCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([key, count]) => ({ key, count, pct: total > 0 ? Math.round(count / total * 100) : 0 }));
    setStats({ total, withErrors, ok, successRate, manualCount, topErrors });
  }

  function fmtTs(r) {
    const ts = r.timestamp?.toDate ? r.timestamp.toDate() : r.timestamp ? new Date(r.timestamp) : null;
    return ts ? ts.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  const fDateLabel = fDate === '24h' ? '24 часа' : fDate === '7d' ? '7 дней' : '30 дней';
  const filterBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? A.goldBrd : A.border}`, background: active ? A.goldDim : 'transparent', color: active ? A.gold : A.textSec, fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400 }}>
      {label}
    </button>
  );

  return (
    <div>
      {/* ── Состояние сервисов ── */}
      <div style={{ ...s.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ ...s.h2, margin: 0, flex: 1 }}>📡 Состояние сервисов</h2>
          <button style={{ ...s.btn, ...s.btnGray, padding: '6px 12px', fontSize: 12 }} onClick={doRunChecks} disabled={svcLoading}>
            {svcLoading ? '⏳ Проверяем...' : '↻ Проверить'}
          </button>
        </div>
        {svcTs && <div style={{ fontSize: 11, color: A.textSec, marginBottom: 12 }}>Проверено: {svcTs.toLocaleTimeString('ru-RU')}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { key: 'frontend',  label: 'Frontend',       check: { ok: true, ms: 0 } },
            { key: 'auth',      label: 'Firebase Auth',  check: svcChecks?.auth },
            { key: 'firestore', label: 'Firestore',      check: svcChecks?.firestore },
            { key: 'backend',   label: 'Backend API',    check: svcChecks?.backend },
          ].map(({ key, label, check }) => (
            <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '13px 14px', border: `1px solid ${check?.ok === false ? A.redBrd : check?.ok ? 'rgba(75,179,75,0.2)' : A.border}` }}>
              <div style={{ fontSize: 11, color: A.textSec, marginBottom: 5 }}>{label}</div>
              {svcLoading && key !== 'frontend' ? (
                <div style={{ fontSize: 13, color: A.textSec }}>⏳</div>
              ) : check ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 800, color: check.ok ? A.green : A.red }}>
                    {check.ok ? '🟢 Работает' : '🔴 Недоступен'}
                  </div>
                  {check.ms > 0 && <div style={{ fontSize: 11, color: A.textSec, marginTop: 3 }}>{check.ms} мс</div>}
                  {!check.ok && check.error && <div style={{ fontSize: 10, color: A.red, marginTop: 4, wordBreak: 'break-word' }}>{check.error}</div>}
                </>
              ) : (
                <div style={{ fontSize: 13, color: A.textSec }}>Нажмите «Проверить»</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Статистика ── */}
      {stats && (
        <div style={{ ...s.card, marginBottom: 12 }}>
          <h2 style={s.h2}>📊 Статистика за {fDateLabel}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: stats.topErrors.length ? 18 : 0 }}>
            {[
              { label: 'Всего отчётов',   value: stats.total,        color: A.gold },
              { label: 'С ошибками',      value: stats.withErrors,   color: stats.withErrors > 0 ? A.red : A.textSec },
              { label: 'Успешных',        value: stats.ok,           color: stats.ok > 0 ? A.green : A.textSec },
              { label: 'Успех %',         value: stats.successRate != null ? stats.successRate + '%' : '—', color: stats.successRate >= 80 ? A.green : stats.successRate != null ? A.red : A.textSec },
              { label: 'Ручных отчётов',  value: stats.manualCount,  color: A.gold },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px', border: `1px solid ${A.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color, lineHeight: 1.1 }}>{item.value}</div>
                <div style={{ fontSize: 10, color: A.textSec, marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
          {stats.topErrors.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: A.textSec, marginBottom: 10 }}>Частые ошибки</div>
              {stats.topErrors.map(e => (
                <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <div style={{ flex: 1, fontSize: 12, color: A.text }}>{e.key}</div>
                  <div style={{ fontSize: 11, color: A.textSec, minWidth: 24, textAlign: 'right' }}>{e.count}×</div>
                  <div style={{ width: 100, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: e.pct + '%', background: A.red, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: A.red, width: 30, textAlign: 'right' }}>{e.pct}%</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Фильтры ── */}
      <div style={{ ...s.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: A.textSec }}>Период:</span>
          {filterBtn(fDate === '24h', '24 часа', () => setFDate('24h'))}
          {filterBtn(fDate === '7d',  '7 дней',  () => setFDate('7d'))}
          {filterBtn(fDate === '30d', '30 дней', () => setFDate('30d'))}
          <div style={{ width: 1, height: 18, background: A.border, margin: '0 2px' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: A.textSec }}>Статус:</span>
          {filterBtn(fStatus === 'all',   'Все',         () => setFStatus('all'))}
          {filterBtn(fStatus === 'ok',    'Успешные',    () => setFStatus('ok'))}
          {filterBtn(fStatus === 'error', 'С ошибками',  () => setFStatus('error'))}
          <div style={{ width: 1, height: 18, background: A.border, margin: '0 2px' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: A.textSec }}>Сервис:</span>
          {filterBtn(fService === 'all',       'Все',       () => setFService('all'))}
          {filterBtn(fService === 'auth',      'Auth',      () => setFService('auth'))}
          {filterBtn(fService === 'firestore', 'Firestore', () => setFService('firestore'))}
          {filterBtn(fService === 'backend',   'Backend',   () => setFService('backend'))}
          <div style={{ width: 1, height: 18, background: A.border, margin: '0 2px' }} />
          {filterBtn(fManual, 'Только ручные', () => setFManual(v => !v))}
          <button onClick={loadReports} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, border: `1px solid ${A.border}`, background: 'transparent', color: A.textSec, fontSize: 12, cursor: 'pointer' }}>
            {reportsLoading ? '⏳' : '↻ Обновить'}
          </button>
        </div>
      </div>

      {/* ── Таблица отчётов ── */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ ...s.h2, margin: 0, flex: 1 }}>📋 Отчёты пользователей</h2>
          <span style={{ fontSize: 12, color: A.textSec }}>{reports.length} записей</span>
        </div>
        {reportsLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: A.textSec }}>⏳ Загружаем...</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: A.textSec }}>
            {stats?.total === 0 ? 'За этот период отчётов нет' : 'Нет записей по выбранным фильтрам'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                  {['Дата', 'Пользователь', 'Версия', 'ОС / Устройство', 'Браузер', 'Auth', 'Firestore', 'Backend', 'Ошибка'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: A.textSec, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const hasError = !isAllOk(r.checks);
                  return (
                    <tr key={r.id}
                      onClick={() => setSelectedReport(r)}
                      style={{ borderBottom: `1px solid ${A.rowBrd}`, cursor: 'pointer', background: hasError ? 'rgba(230,70,70,0.04)' : 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = hasError ? 'rgba(230,70,70,0.04)' : 'transparent'; }}
                    >
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: A.textSec }}>{fmtTs(r)}</td>
                      <td style={{ padding: '7px 10px', color: A.text }}>
                        {r.userId ? String(r.userId).slice(0, 14) : '—'}
                        {r.manual && <span title="Ручной отчёт" style={{ marginLeft: 5, fontSize: 10, color: A.gold }}>✉</span>}
                      </td>
                      <td style={{ padding: '7px 10px', color: A.textSec }}>{r.appVersion ?? '?'}</td>
                      <td style={{ padding: '7px 10px', color: A.textSec, whiteSpace: 'nowrap' }}>{r.os} / {r.device}</td>
                      <td style={{ padding: '7px 10px', color: A.textSec }}>{r.browser}</td>
                      <td style={{ padding: '7px 10px' }}><DiagStatusCell check={r.checks?.auth}      A={A} /></td>
                      <td style={{ padding: '7px 10px' }}><DiagStatusCell check={r.checks?.firestore} A={A} /></td>
                      <td style={{ padding: '7px 10px' }}><DiagStatusCell check={r.checks?.backend}   A={A} /></td>
                      <td style={{ padding: '7px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.errorText ? A.red : A.textSec, fontSize: 11 }}>
                        {r.errorText || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Детальный просмотр ── */}
      {selectedReport && (
        <div
          onClick={() => setSelectedReport(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(18,18,36,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <h3 style={{ margin: 0, flex: 1, color: A.text, fontSize: 16 }}>🔍 Диагностический отчёт</h3>
              <button onClick={() => setSelectedReport(null)} style={{ ...s.btn, ...s.btnGray, padding: '5px 12px', fontSize: 12 }}>✕</button>
            </div>
            {[
              ['Дата',            fmtTs(selectedReport)],
              ['Пользователь',    selectedReport.userId || '—'],
              ['Версия',          selectedReport.appVersion || '?'],
              ['ОС',              selectedReport.os || '—'],
              ['Устройство',      selectedReport.device || '—'],
              ['Браузер',         selectedReport.browser || '—'],
              ['Онлайн',          selectedReport.online != null ? (selectedReport.online ? 'Да' : 'Нет') : '—'],
              ['Ручной отчёт',    selectedReport.manual ? 'Да ✉' : 'Нет (авто)'],
              ['Ошибка',          selectedReport.errorText || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${A.border}`, fontSize: 13 }}>
                <div style={{ color: A.textSec, width: 120, flexShrink: 0 }}>{k}</div>
                <div style={{ color: A.text, wordBreak: 'break-all', flex: 1 }}>{v}</div>
              </div>
            ))}
            <div style={{ marginTop: 18, marginBottom: 10, fontSize: 11, fontWeight: 700, color: A.textSec, letterSpacing: '0.06em' }}>РЕЗУЛЬТАТЫ ПРОВЕРОК</div>
            {Object.keys(selectedReport.checks ?? {}).length === 0 ? (
              <div style={{ fontSize: 13, color: A.textSec }}>Нет данных о проверках</div>
            ) : Object.entries(selectedReport.checks).map(([svc, c]) => (
              <div key={svc} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${A.border}`, fontSize: 13, alignItems: 'flex-start' }}>
                <div style={{ color: A.textSec, width: 120, flexShrink: 0, textTransform: 'capitalize' }}>{svc}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: c.ok ? A.green : A.red, fontWeight: 700 }}>{c.ok ? '✓ OK' : '✗ Ошибка'}</span>
                  {c.ms != null && <span style={{ color: A.textSec, fontSize: 11 }}> · {c.ms} мс</span>}
                  {c.error && <div style={{ color: A.red, fontSize: 11, marginTop: 3 }}>{c.error}</div>}
                </div>
              </div>
            ))}
            {selectedReport.stack && (
              <>
                <div style={{ marginTop: 18, marginBottom: 8, fontSize: 11, fontWeight: 700, color: A.textSec, letterSpacing: '0.06em' }}>СТЕК ОШИБКИ</div>
                <pre style={{ fontSize: 10, color: A.textSec, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '15px', maxHeight: 200, overflow: 'auto', margin: 0 }}>
                  {selectedReport.stack}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RotationTab({ experts, A, s }) {
  const [rotation, setRotation]   = useState({});
  const [running, setRunning]     = useState(false);
  const [msg, setMsg]             = useState('');

  const ambassadors = experts.filter(e => e.tier === 'ambassador' && e.active !== false);
  const byCategory  = {};
  for (const e of ambassadors) {
    const cat = e.category ?? 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e);
  }

  useEffect(() => {
    if (!Object.keys(byCategory).length) return;
    import('firebase/firestore').then(({ collection: c, getDocs: gd }) => {
      gd(c(db, 'expertRotation')).then(snap => {
        const map = {};
        snap.docs.forEach(d => { map[d.id] = d.data(); });
        setRotation(map);
      }).catch(() => {});
    });
  }, [ambassadors.length]);

  const loadRotation = () => {
    import('firebase/firestore').then(({ collection: c, getDocs: gd }) => {
      gd(c(db, 'expertRotation')).then(snap => {
        const map = {};
        snap.docs.forEach(d => { map[d.id] = d.data(); });
        setRotation(map);
      });
    });
  };

  useEffect(() => { loadRotation(); }, []);

  const runRotation = async () => {
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/expert-rotation`, { method: 'POST' });
      const data = await res.json();
      setMsg(`✅ Ротация выполнена: ${data.results?.length ?? 0} категорий обновлено`);
      loadRotation();
    } catch { setMsg('❌ Ошибка запуска ротации'); }
    finally { setRunning(false); }
  };

  const currentWeek = getISOWeekKey();

  return (
    <div>
      <div style={s.card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: A.textPri, marginBottom: 4 }}>Текущая неделя: {currentWeek}</div>
        <div style={{ fontSize: 12, color: A.textSec, marginBottom: 14 }}>
          Амбассадоров в системе: {ambassadors.length} · Категорий с амбассадорами: {Object.keys(byCategory).length}
        </div>
        <button
          onClick={runRotation} disabled={running}
          style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: running ? A.border : `linear-gradient(135deg,${A.gold},${A.goldL})`, color: running ? A.textSec : '#0F0F1A', fontSize: 13, fontWeight: 700, cursor: running ? 'default' : 'pointer' }}
        >
          {running ? '⏳ Запуск...' : '🔄 Запустить ротацию сейчас'}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('✅') ? A.gold : '#E64646' }}>{msg}</div>}
      </div>

      {Object.entries(byCategory).map(([catId, list]) => {
        const catMeta  = EXPERT_CATEGORIES.find(c => c.id === catId);
        const rot      = rotation[catId];
        const topId    = rot?.weekKey === currentWeek ? rot.expertId : null;
        const sorted   = [...list].sort((a, b) => {
          const ta = a.ambassadorSince?.toDate?.()?.getTime() ?? (a.createdAt?.toDate?.()?.getTime() ?? 0);
          const tb = b.ambassadorSince?.toDate?.()?.getTime() ?? (b.createdAt?.toDate?.()?.getTime() ?? 0);
          return ta - tb;
        });
        return (
          <div key={catId} style={{ ...s.card, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: A.textPri, marginBottom: 10 }}>
              {catMeta?.emoji} {catMeta?.label ?? catId} · {list.length} амбассадор{list.length !== 1 ? 'а' : ''}
            </div>
            {sorted.map((e, i) => {
              const isTop = e.id === topId;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${A.border}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isTop ? A.goldDim : A.border, border: `2px solid ${isTop ? A.gold : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: isTop ? A.gold : A.textSec, flexShrink: 0 }}>{i + 1}</div>
                  {e.photo ? <img src={e.photo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: A.border, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: A.textPri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: A.textSec }}>{e.specialization}</div>
                  </div>
                  {isTop && <div style={{ fontSize: 11, fontWeight: 700, color: A.gold, background: A.goldDim, border: `1px solid ${A.goldBrd}`, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>В топе</div>}
                </div>
              );
            })}
            {!topId && <div style={{ fontSize: 12, color: A.textSec, marginTop: 8 }}>Ротация не запускалась — нажмите «Запустить»</div>}
          </div>
        );
      })}

      {ambassadors.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: A.textSec, fontSize: 13 }}>
          Нет экспертов с тарифом Амбассадор. Установите тариф в форме эксперта.
        </div>
      )}
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
  const [newsComments, setNewsComments] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState({
    users: [], scans: [], expertScans: [], reviews: [], expertReviews: [], raffleEntries: [], guestSessions: [], newsComments: [], errorLogs: [], adminActivity: [],
  });
  const [loading, setLoading]       = useState(true);
  const [adminLoadIssues, setAdminLoadIssues] = useState([]);
  const [adminLoadInfo, setAdminLoadInfo] = useState({ lastLoadedAt: null, authUid: null, attempt: 0 });
  const [activeTab, setActiveTab]   = useState('dashboard');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1200);

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
  const [exOwnerEmail, setExOwnerEmail] = useState('');
  const [exActive, setExActive]     = useState(true);
  const [exOnline, setExOnline]     = useState(false);
  const [exOffline, setExOffline]   = useState(false);
  const [exGroup, setExGroup]       = useState(false);
  const [exTelegram, setExTelegram] = useState('');
  const [exWebsite, setExWebsite]   = useState('');
  const [exMax, setExMax]           = useState('');
  const [exSaving, setExSaving]     = useState(false);
  const [exError, setExError]       = useState('');
  const [exCategory, setExCategory]     = useState('other');
  const [exTier, setExTier]             = useState('practice');
  const [exCoverPhoto, setExCoverPhoto] = useState('');
  const [exGallery, setExGallery]       = useState([]);
  const [exVideos, setExVideos]         = useState([]);
  const [exVideoUrl, setExVideoUrl]     = useState('');
  const [exVideoTitle, setExVideoTitle] = useState('');
  const [exVideoError, setExVideoError] = useState('');
  const [exOffer, setExOffer]               = useState('');
  const [exStampTarget, setExStampTarget]   = useState('');
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
  const [demoClearing, setDemoClearing]     = useState(false);
  const [demoClearResult, setDemoClearResult] = useState(null);

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
  const [prExpertId, setPrExpertId]       = useState('');
  const [prDonorType, setPrDonorType]     = useState('none');

  // Форма партнёра
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState('other');
  const [pEmoji, setPEmoji] = useState('🏪');
  const [pLogo, setPLogo] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pHours, setPHours] = useState('');
  const [pTier, setPTier]       = useState('start');
  const [pSocial, setPSocial] = useState('');
  const [pVkGroup, setPVkGroup] = useState('');
  const [pOffer, setPOffer] = useState('');
  const [pStampTarget, setPStampTarget] = useState('');
  const [pOwnerEmail, setPOwnerEmail] = useState('');
  const [pBooking, setPBooking]           = useState('');
  const [pWebsite, setPWebsite]           = useState('');
  const [pTelegramCom, setPTelegramCom]   = useState('');
  const [pMaxCom, setPMaxCom]             = useState('');
  const [pCoverPhoto, setPCoverPhoto]     = useState('');
  const [pGallery, setPGallery]           = useState([]);
  const [pVideos, setPVideos]             = useState([]);
  const [pVideoUrl, setPVideoUrl]         = useState('');
  const [pVideoTitle, setPVideoTitle]     = useState('');
  const [pVideoError, setPVideoError]     = useState('');
  const [pLat, setPLat]                   = useState('');
  const [pLon, setPLon]                   = useState('');
  const [pGeoLoading, setPGeoLoading]     = useState(false);
  const [bulkGeoRunning, setBulkGeoRunning] = useState(false);
  const [bulkGeoResult, setBulkGeoResult]   = useState(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [expandedPartnerId, setExpandedPartnerId] = useState(null);
  const [showExpertModal, setShowExpertModal]   = useState(false);
  const [expandedExpertId, setExpandedExpertId] = useState(null);
  const [showEventModal, setShowEventModal]     = useState(false);
  const [showNewsModal, setShowNewsModal]       = useState(false);
  const [eventLinksFilter, setEventLinksFilter] = useState('all');
  const [newsLinksFilter, setNewsLinksFilter]   = useState('all');

  // Баннеры
  const [banners, setBanners]                   = useState([]);
  const [showBannerModal, setShowBannerModal]   = useState(false);
  const [editingBanner, setEditingBanner]       = useState(null);
  const [bnTitle, setBnTitle]                   = useState('');
  const [bnImageUrl, setBnImageUrl]             = useState('');
  const [bnAdvertiserType, setBnAdvertiserType] = useState('partner');
  const [bnAdvertiserId, setBnAdvertiserId]     = useState('');
  const [bnAdvertiserName, setBnAdvertiserName] = useState('');
  const [bnLinkType, setBnLinkType]             = useState('internal_partner');
  const [bnLinkValue, setBnLinkValue]           = useState('');
  const [bnStartDate, setBnStartDate]           = useState('');
  const [bnEndDate, setBnEndDate]               = useState('');
  const [bnPriority, setBnPriority]             = useState(1);
  const [bnActive, setBnActive]                 = useState(true);
  const [bnSaving, setBnSaving]                 = useState(false);
  const [bnError, setBnError]                   = useState('');
  const [partnerLinksFilter, setPartnerLinksFilter] = useState('unverified');
  const [expertLinksFilter, setExpertLinksFilter]   = useState('unverified');
  const [expertSearch, setExpertSearch]             = useState('');
  const [globalSearch, setGlobalSearch]     = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [showAddDrop, setShowAddDrop]       = useState(false);
  const [showToolsDrop, setShowToolsDrop]   = useState(false);
  const [selectedNewsIds, setSelectedNewsIds] = useState([]);
  const [quickEditNews, setQuickEditNews] = useState(null);
  const [quickNewsDraft, setQuickNewsDraft] = useState(null);
  const [quickEditorDirty, setQuickEditorDirty] = useState(false);
  const [quickEditorSaving, setQuickEditorSaving] = useState(false);
  const [adminUndo, setAdminUndo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [draggingNewsId, setDraggingNewsId] = useState('');
  const autoSaveTimerRef = useRef(null);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth || 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Форма новости
  const [nTitle, setNTitle]               = useState('');
  const [nText, setNText]                 = useState('');
  const [nEmoji, setNEmoji]               = useState('📢');
  const [nImage, setNImage]               = useState('');
  const [nLinkUrl, setNLinkUrl]           = useState('');
  const [nLinkLabel, setNLinkLabel]       = useState('');
  const [nPriority, setNPriority]         = useState(0);
  const [nCategory, setNCategory]         = useState('');
  const [nCoverPhoto, setNCoverPhoto]     = useState('');
  const [nPublishedAt, setNPublishedAt]   = useState(() => new Date().toISOString().slice(0, 10));

  // Форма уведомления
  const [ntTitle, setNtTitle]       = useState('');
  const [ntBody, setNtBody]         = useState('');
  const [ntEmoji, setNtEmoji]       = useState('🔔');
  const [ntTargetType, setNtTargetType] = useState('all');
  const [ntTargetValue, setNtTargetValue] = useState('');
  const [ntSendPush, setNtSendPush] = useState(true);
  const [ntPushResult, setNtPushResult] = useState(null);

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
  const [eCategory, setECategory]   = useState('');
  const [eCoverPhoto, setECoverPhoto] = useState('');
  const [eStartAt, setEStartAt]     = useState('');
  const [eEndAt, setEEndAt]         = useState('');
  const [eLocation, setELocation]   = useState('');

  // Ошибки
  const [errorLogs, setErrorLogs]           = useState([]);
  const [errorsLoading, setErrorsLoading]   = useState(false);
  const [errShowResolved, setErrShowResolved] = useState(false);
  const [errExpanded, setErrExpanded]       = useState({});
  const [systemStatus, setSystemStatus] = useState(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(100)));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setErrorLogs(rows);
      setAdminMetrics(prev => ({ ...prev, errorLogs: rows }));
    } catch (e) {
      logError(e, 'AdminPanel.loadErrors');
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  const resolveError = useCallback(async (id) => {
    await runAdminEntityAction('errorLogs', 'update', { id, patch: { resolved: true } }).catch(() => {});
    setErrorLogs(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
    setAdminMetrics(prev => ({ ...prev, errorLogs: prev.errorLogs.map(e => e.id === id ? { ...e, resolved: true } : e) }));
  }, []);

  const loadSystemStatus = useCallback(async () => {
    setSystemStatusLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/system-status`, {
        headers: await adminRequestHeaders(`system_${Date.now()}`),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Не удалось получить состояние системы.');
      setSystemStatus(data);
    } catch (e) {
      logError(e, 'AdminPanel.loadSystemStatus');
      setSystemStatus({ ok: false, error: e.message || 'Состояние системы недоступно.' });
    } finally {
      setSystemStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.race([vkBridge.send('VKWebAppInit'), new Promise((_, r) => setTimeout(() => r(new Error()), 1000))]);
      } catch (e) {}
      try {
        await waitForAdminAuth();
        await fetchData();
      } catch (e) {
        logError(e, 'AdminPanel.initAuth');
        setAdminLoadIssues(prev => [
          ...prev,
          { name: 'auth', label: 'Firebase Auth', error: formatAdminLoadError(e), optional: false, attempts: 1 },
        ]);
        setLoading(false);
      }
    };
    init();
  }, []);

  const normalizeUrl = (val) => {
    const trimmed = (val ?? '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  const adminRequestHeaders = async (idempotencyKey = '') => {
    const user = await waitForAdminAuth();
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': idempotencyKey || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      'X-APG-Version': 'v4.4.2',
    };
  };

  const runAdminAction = async (action, payload = {}) => {
    const headers = await adminRequestHeaders(payload.idempotencyKey);
    const response = await fetch(`${API_BASE_URL}/api/admin-actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Административное действие не выполнено.');
    return data;
  };

  const fetchAdminNewsComments = async () => {
    const response = await fetch(`${API_BASE_URL}/api/news-comments?admin=1`, {
      headers: await adminRequestHeaders(`comments_list_${Date.now()}`),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Не удалось загрузить комментарии.');
    return Array.isArray(data.comments) ? data.comments : [];
  };

  const runAdminEntityAction = (resource, verb, payload = {}) =>
    runAdminAction(`entity:${verb}`, { resource, ...payload });

  const fetchData = async () => {
    setLoading(true);
    setAdminLoadIssues([]);
    setAdminLoadInfo(prev => ({ ...prev, attempt: (prev.attempt ?? 0) + 1 }));
    const readCollection = async ({ name, label, ref, optional = false }) => {
      let lastError = null;
      for (let attempt = 1; attempt <= ADMIN_LOAD_RETRIES + 1; attempt++) {
        try {
          const snap = await withTimeout(getDocs(ref()), ADMIN_LOAD_TIMEOUT_MS, label);
          return { name, label, optional, ok: true, docs: docsToItems(snap), count: snap.docs.length, attempts: attempt };
        } catch (error) {
          lastError = error;
          logError(error, `AdminPanel.fetchData.${name}.attempt${attempt}`);
          if (!isTransientFirestoreError(error) || attempt > ADMIN_LOAD_RETRIES) break;
          await sleep(450 * attempt);
        }
      }
      return { name, label, optional, ok: false, docs: null, count: 0, attempts: ADMIN_LOAD_RETRIES + 1, error: formatAdminLoadError(lastError), rawError: lastError };
    };
    try {
      const user = await waitForAdminAuth();
      const specs = [
        { name: 'partners', label: 'Партнёры', ref: () => collection(db, 'partners') },
        { name: 'experts', label: 'Эксперты', ref: () => collection(db, 'experts') },
        { name: 'events', label: 'События', ref: () => collection(db, 'events') },
        { name: 'news', label: 'Новости', ref: () => query(collection(db, 'news'), orderBy('createdAt', 'desc')) },
        { name: 'notifications', label: 'Уведомления', ref: () => query(collection(db, 'notifications'), orderBy('createdAt', 'desc')) },
        { name: 'prizes', label: 'Призы', ref: () => query(collection(db, 'prizes'), orderBy('cost', 'asc')) },
        { name: 'customTasks', label: 'Задания', ref: () => query(collection(db, 'customTasks'), orderBy('createdAt', 'asc')) },
        { name: 'prizeClaims', label: 'Выдачи призов', ref: () => query(collection(db, 'prizeClaims'), orderBy('claimedAt', 'desc'), limit(100)), optional: true },
        { name: 'banners', label: 'Баннеры', ref: () => query(collection(db, 'banners'), orderBy('priority', 'asc')) },
        { name: 'errorLogs', label: 'Ошибки приложения', ref: () => query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(100)), optional: true },
        { name: 'adminActivity', label: 'Действия админки', ref: () => query(collection(db, 'adminActivity'), orderBy('createdAt', 'desc'), limit(120)), optional: true },
        { name: 'users', label: 'Пользователи', ref: () => collection(db, 'users'), optional: true },
        { name: 'scans', label: 'Сканы партнёров', ref: () => query(collection(db, 'scans'), orderBy('scannedAt', 'desc'), limit(500)), optional: true },
        { name: 'expertScans', label: 'Сканы экспертов', ref: () => query(collection(db, 'expertScans'), orderBy('scannedAt', 'desc'), limit(500)), optional: true },
        { name: 'reviews', label: 'Отзывы партнёров', ref: () => query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(200)), optional: true },
        { name: 'expertReviews', label: 'Отзывы экспертов', ref: () => query(collection(db, 'expertReviews'), orderBy('createdAt', 'desc'), limit(200)), optional: true },
        { name: 'raffleEntries', label: 'Участники розыгрышей', ref: () => query(collection(db, 'raffleEntries'), orderBy('createdAt', 'desc'), limit(500)), optional: true },
        { name: 'guestSessions', label: 'Гостевые сессии', ref: () => query(collection(db, 'guestSessions'), orderBy('createdAt', 'desc'), limit(500)), optional: true },
      ];
      const results = await Promise.all(specs.map(readCollection));
      const commentsResult = await fetchAdminNewsComments()
        .then(rows => ({ name: 'newsComments', label: 'Комментарии новостей', optional: true, ok: true, docs: rows, count: rows.length, attempts: 1 }))
        .catch(error => {
          logError(error, 'AdminPanel.fetchData.newsComments.api');
          return { name: 'newsComments', label: 'Комментарии новостей', optional: true, ok: false, docs: null, count: 0, attempts: 1, error: formatAdminLoadError(error), rawError: error };
        });
      const allResults = [...results, commentsResult];
      const byName = Object.fromEntries(allResults.map(item => [item.name, item]));
      const apply = (name, setter) => {
        if (byName[name]?.ok) setter(byName[name].docs);
      };
      apply('partners', setPartners);
      apply('experts', setExperts);
      apply('events', setEvents);
      apply('news', setNews);
      apply('notifications', setNotifs);
      apply('prizes', setPrizes);
      apply('customTasks', setCustomTasks);
      apply('prizeClaims', setPrizeClaims);
      apply('banners', setBanners);
      apply('newsComments', setNewsComments);
      apply('errorLogs', setErrorLogs);
      setAdminMetrics(prev => ({
        users: byName.users?.ok ? byName.users.docs : prev.users,
        scans: byName.scans?.ok ? byName.scans.docs : prev.scans,
        expertScans: byName.expertScans?.ok ? byName.expertScans.docs : prev.expertScans,
        reviews: byName.reviews?.ok ? byName.reviews.docs : prev.reviews,
        expertReviews: byName.expertReviews?.ok ? byName.expertReviews.docs : prev.expertReviews,
        raffleEntries: byName.raffleEntries?.ok ? byName.raffleEntries.docs : prev.raffleEntries,
        guestSessions: byName.guestSessions?.ok ? byName.guestSessions.docs : prev.guestSessions,
        newsComments: byName.newsComments?.ok ? byName.newsComments.docs : prev.newsComments,
        errorLogs: byName.errorLogs?.ok ? byName.errorLogs.docs : prev.errorLogs,
        adminActivity: byName.adminActivity?.ok ? byName.adminActivity.docs : prev.adminActivity,
      }));
      setAdminLoadIssues(allResults.filter(item => !item.ok).map(item => ({
        name: item.name,
        label: item.label,
        error: item.error,
        optional: item.optional,
        attempts: item.attempts,
      })));
      setAdminLoadInfo(prev => ({
        ...prev,
        lastLoadedAt: new Date().toISOString(),
        authUid: user?.uid ?? auth.currentUser?.uid ?? null,
        counts: Object.fromEntries(allResults.filter(item => item.ok).map(item => [item.name, item.count])),
      }));
    } catch (e) {
      logError(e, 'AdminPanel.fetchData.outer');
      setAdminLoadIssues(prev => [
        ...prev,
        { name: 'admin-load', label: 'Загрузка админки', error: formatAdminLoadError(e), optional: false, attempts: 1 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetExpertForm = () => {
    setEditingExpert(null); setExName(''); setExSpec(''); setExDesc('');
    setExPhoto(''); setExPhone(''); setExVkUrl(''); setExBooking('');
    setExKeys('1'); setExVerified(false); setExActive(true); setExOwnerEmail('');
    setExOnline(false); setExOffline(false); setExGroup(false);
    setExTelegram(''); setExWebsite(''); setExMax('');
    setExCategory('other'); setExTier('practice');
    setExCoverPhoto(''); setExGallery([]); setExVideos([]);
    setExVideoUrl(''); setExVideoTitle(''); setExVideoError('');
    setExOffer(''); setExStampTarget('');
    setExError(''); setExSaving(false);
    setShowExpertModal(false);
  };

  const startEditExpert = (ex) => {
    setEditingExpert(ex);
    setExName(ex.name ?? ''); setExSpec(ex.specialization ?? ''); setExDesc(ex.description ?? '');
    setExPhoto(ex.photo ?? ''); setExPhone(ex.phone ?? ''); setExVkUrl(ex.vkUrl ?? '');
    setExBooking(ex.bookingUrl ?? ''); setExKeys(String(ex.keys ?? 1));
    setExVerified(ex.verified ?? false); setExActive(ex.active !== false);
    setExOwnerEmail(ex.ownerEmail ?? '');
    setExOnline(ex.formats?.includes('online') ?? false);
    setExOffline(ex.formats?.includes('offline') ?? false);
    setExGroup(ex.formats?.includes('group') ?? false);
    setExTelegram(ex.telegramUrl ?? ''); setExWebsite(ex.websiteUrl ?? ''); setExMax(ex.maxUrl ?? '');
    setExCategory(ex.category ?? 'other'); setExTier(ex.tier ?? 'practice');
    setExCoverPhoto(ex.coverPhoto ?? ''); setExGallery(ex.gallery ?? []);
    setExVideos(ex.videos ?? []);
    setExOffer(ex.offer ?? ''); setExStampTarget(ex.stampTarget ? String(ex.stampTarget) : '');
    setExVideoUrl(''); setExVideoTitle(''); setExVideoError('');
    setShowExpertModal(true);
  };

  const saveExpert = async () => {
    if (!exName.trim()) { setExError('Укажите имя эксперта'); return; }
    if (!exSpec.trim()) { setExError('Укажите специализацию'); return; }
    setExError('');
    setExSaving(true);
    let finalExVideos = exVideos;
    if (exVideoUrl.trim()) {
      const parsed = parseVideoUrl(exVideoUrl);
      if (parsed && finalExVideos.length < 5) {
        finalExVideos = [...finalExVideos, { url: exVideoUrl.trim(), title: exVideoTitle.trim(), platform: parsed.platform, embedUrl: parsed.embedUrl, thumbnailUrl: parsed.thumbnailUrl }];
      }
    }
    const formats = [exOnline && 'online', exOffline && 'offline', exGroup && 'group'].filter(Boolean);
    const prevTier = editingExpert?.tier ?? 'practice';
    const data = {
      name: exName.trim(), specialization: exSpec.trim(), description: exDesc.trim(),
      category: exCategory,
      tier: exTier,
      photo: exPhoto.trim(), phone: exPhone.trim(), vkUrl: exVkUrl.trim(),
      bookingUrl: exBooking.trim(), keys: Number(exKeys) || 1,
      verified: exVerified, active: exActive, formats,
      ownerEmail: exOwnerEmail.trim().toLowerCase() || null,
      telegramUrl: normalizeUrl(exTelegram),
      websiteUrl: normalizeUrl(exWebsite),
      maxUrl: normalizeUrl(exMax),
      coverPhoto: exCoverPhoto.trim(),
      gallery: exGallery,
      videos: finalExVideos,
      offer: exOffer.trim(),
      stampTarget: Number(exStampTarget) || 0,
    };
    try {
      if (editingExpert) {
        await runAdminEntityAction('experts', 'update', {
          id: editingExpert.id,
          patch: data,
          serverTimestampFields: exTier === 'ambassador' && prevTier !== 'ambassador' ? ['ambassadorSince'] : [],
        });
      } else {
        await runAdminEntityAction('experts', 'create', {
          patch: { ...data, avgRating: 0, reviewCount: 0 },
          serverTimestampFields: exTier === 'ambassador' ? ['ambassadorSince'] : [],
        });
      }
      resetExpertForm();
      fetchData();
    } catch (e) {
      setExError(`Ошибка сохранения: ${e.message ?? 'проверьте соединение'}`);
    } finally {
      setExSaving(false);
    }
  };

  const deleteExpert = async (id) => {
    if (!window.confirm('Удалить эксперта?')) return;
    await runAdminEntityAction('experts', 'delete', { id });
    fetchData();
  };

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const resetPartnerForm = () => {
    setPName(''); setPDesc(''); setPCategory('other'); setPEmoji('🏪'); setPLogo('');
    setPTier('start'); setPPhone(''); setPAddress(''); setPHours(''); setPSocial(''); setPVkGroup(''); setPOffer('');
    setPStampTarget(''); setPOwnerEmail('');
    setPBooking(''); setPWebsite(''); setPTelegramCom(''); setPMaxCom('');
    setPCoverPhoto(''); setPGallery([]); setPVideos([]);
    setPVideoUrl(''); setPVideoTitle(''); setPVideoError('');
    setPLat(''); setPLon('');
    setEditingPartner(null);
    setShowPartnerModal(false);
  };

  const startEditPartner = (p) => {
    setEditingPartner(p);
    setPName(p.name ?? ''); setPDesc(p.description ?? ''); setPCategory(p.category ?? 'other');
    setPEmoji(p.emoji ?? '🏪'); setPLogo(p.logoUrl ?? ''); setPPhone(p.phone ?? '');
    setPTier(p.tier ?? 'start'); setPAddress(p.address ?? ''); setPHours(p.hours ?? ''); setPSocial(p.socialUrl ?? ''); setPVkGroup(p.vkGroupUrl ?? '');
    setPOffer(p.offer ?? ''); setPStampTarget(p.stampTarget ? String(p.stampTarget) : '');
    setPOwnerEmail(p.ownerEmail ?? '');
    setPBooking(p.bookingUrl ?? ''); setPWebsite(p.websiteUrl ?? '');
    setPTelegramCom(p.telegramCommunityUrl ?? ''); setPMaxCom(p.maxCommunityUrl ?? '');
    setPCoverPhoto(p.coverPhoto ?? ''); setPGallery(p.gallery ?? []);
    setPVideos(p.videos ?? []);
    setPVideoUrl(''); setPVideoTitle(''); setPVideoError('');
    setPLat(p.latitude != null ? String(p.latitude) : '');
    setPLon(p.longitude != null ? String(p.longitude) : '');
    setShowPartnerModal(true);
  };

  const savePartner = async () => {
    if (!pName.trim()) return;
    let finalVideos = pVideos;
    if (pVideoUrl.trim()) {
      const parsed = parseVideoUrl(pVideoUrl);
      if (parsed && finalVideos.length < 5) {
        finalVideos = [...finalVideos, { url: pVideoUrl.trim(), title: pVideoTitle.trim(), platform: parsed.platform, embedUrl: parsed.embedUrl, thumbnailUrl: parsed.thumbnailUrl }];
      }
    }
    const data = {
      name: pName.trim(), description: pDesc.trim(), category: pCategory,
      emoji: pEmoji, logoUrl: pLogo.trim(),
      categoryLabel: CATEGORIES.find(c => c.id === pCategory)?.label ?? '',
      phone: pPhone.trim(), address: pAddress.trim(),
      tier: pTier, hours: pHours.trim(), socialUrl: pSocial.trim(), vkGroupUrl: normalizeUrl(pVkGroup), offer: pOffer.trim(),
      stampTarget: Number(pStampTarget) || 0,
      ownerEmail: pOwnerEmail.trim().toLowerCase() || null,
      bookingUrl: normalizeUrl(pBooking),
      websiteUrl: normalizeUrl(pWebsite),
      telegramCommunityUrl: normalizeUrl(pTelegramCom),
      maxCommunityUrl: normalizeUrl(pMaxCom),
      coverPhoto: pCoverPhoto.trim(),
      gallery: pGallery,
      videos: finalVideos,
      latitude:  pLat.trim() ? parseFloat(pLat) : null,
      longitude: pLon.trim() ? parseFloat(pLon) : null,
    };
    if (editingPartner) {
      await runAdminEntityAction('partners', 'update', { id: editingPartner.id, patch: data });
    } else {
      const created = await runAdminEntityAction('partners', 'create', { patch: data });
      // Persist QR values on the doc so they're always queryable
      runAdminEntityAction('partners', 'update', {
        id: created.id,
        patch: {
          publicQRUrl:     `${APP_URL}/?partner=${created.id}`,
          serviceQRValue:  created.id,
        },
      }).catch(() => {});
      // Уведомляем webpush-подписчиков о новом партнёре
      fetch(`${API_BASE_URL}/api/send-push`, {
        method: 'POST',
        headers: await adminRequestHeaders(`new_partner_push_${Date.now()}`),
        body: JSON.stringify({
          broadcast: true,
          title: `🏪 Новый партнёр АПГ: ${data.name}`,
          body: data.offer ? `🎁 ${data.offer}` : 'Открой страницу партнёра в приложении',
          url: APP_URL,
          tag: 'new-partner',
        }),
      }).catch(() => {});
    }
    resetPartnerForm();
    fetchData();
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Удалить партнёра?')) return;
    await runAdminEntityAction('partners', 'delete', { id });
    fetchData();
  };

  // ─── Баннеры ────────────────────────────────────────────────────────────────

  const getBannerStatus = b => {
    const now = Date.now();
    const end = b.endDate?.toDate ? b.endDate.toDate().getTime() : (b.endDate ? new Date(b.endDate).getTime() : Infinity);
    if (end < now) return 'expired';
    return b.active ? 'active' : 'inactive';
  };

  const resetBannerForm = () => {
    setBnTitle(''); setBnImageUrl(''); setBnAdvertiserType('partner');
    setBnAdvertiserId(''); setBnAdvertiserName(''); setBnLinkType('internal_partner');
    setBnLinkValue(''); setBnStartDate(''); setBnEndDate('');
    setBnPriority(1); setBnActive(true); setBnSaving(false); setBnError('');
    setEditingBanner(null); setShowBannerModal(false);
  };

  const handleBnAdvertiserType = type => {
    setBnAdvertiserType(type);
    setBnAdvertiserId(''); setBnAdvertiserName(''); setBnLinkValue('');
    setBnLinkType(type === 'partner' ? 'internal_partner' : type === 'expert' ? 'internal_expert' : 'external_url');
  };

  const startEditBanner = b => {
    setEditingBanner(b);
    setBnTitle(b.title ?? '');
    setBnImageUrl(b.imageUrl ?? '');
    setBnAdvertiserType(b.advertiserType ?? 'partner');
    setBnAdvertiserId(b.advertiserId ?? '');
    setBnAdvertiserName(b.advertiserName ?? '');
    setBnLinkType(b.linkType ?? 'internal_partner');
    setBnLinkValue(b.linkValue ?? '');
    setBnStartDate(b.startDate?.toDate ? b.startDate.toDate().toISOString().slice(0, 10) : (b.startDate ?? ''));
    setBnEndDate(b.endDate?.toDate ? b.endDate.toDate().toISOString().slice(0, 10) : (b.endDate ?? ''));
    setBnPriority(b.priority ?? 1);
    setBnActive(b.active ?? true);
    setBnSaving(false); setBnError('');
    setShowBannerModal(true);
  };

  const saveBanner = async () => {
    if (!bnTitle.trim()) { setBnError('Введите внутреннее название баннера'); return; }
    if (!bnImageUrl.trim()) { setBnError('Добавьте изображение баннера'); return; }
    if (bnActive) {
      const now = Date.now();
      const activeCount = banners.filter(b => {
        if (editingBanner && b.id === editingBanner.id) return false;
        if (!b.active) return false;
        const end = b.endDate?.toDate ? b.endDate.toDate().getTime() : (b.endDate ? new Date(b.endDate).getTime() : Infinity);
        return end >= now;
      }).length;
      if (activeCount >= 5) { setBnError('Максимум 5 активных баннеров. Деактивируйте один из текущих.'); return; }
    }
    setBnSaving(true); setBnError('');
    try {
      const data = {
        title: bnTitle.trim(),
        imageUrl: bnImageUrl.trim(),
        advertiserType: bnAdvertiserType,
        advertiserId: bnAdvertiserType !== 'external' ? bnAdvertiserId : '',
        advertiserName: bnAdvertiserType === 'external' ? bnAdvertiserName.trim() : '',
        linkType: bnLinkType,
        linkValue: bnLinkValue.trim(),
        startDate: bnStartDate ? new Date(bnStartDate) : null,
        endDate: bnEndDate ? new Date(bnEndDate) : null,
        priority: Math.max(1, Math.min(5, Number(bnPriority) || 1)),
        active: bnActive,
      };
      if (editingBanner) {
        await runAdminEntityAction('banners', 'update', { id: editingBanner.id, patch: data });
      } else {
        await runAdminEntityAction('banners', 'create', { patch: data });
      }
      resetBannerForm();
      fetchData();
    } catch (e) { setBnError(e.message); setBnSaving(false); }
  };

  const deleteBanner = async id => {
    if (!window.confirm('Удалить баннер?')) return;
    await runAdminEntityAction('banners', 'delete', { id });
    fetchData();
  };

  const isCheckedRecently = ts => {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  };

  const markLinksChecked = async (col, id, setList) => {
    if (col === 'news') {
      await runAdminAction('news:update', { id, patch: { linksCheckedAt: new Date().toISOString() } });
    } else {
      const resource = col === 'customTasks' ? 'customTasks' : col;
      await runAdminEntityAction(resource, 'update', { id, patch: { linksCheckedAt: new Date().toISOString() } });
    }
    const now = { toDate: () => new Date() };
    setList(prev => prev.map(x => x.id === id ? { ...x, linksCheckedAt: now } : x));
  };

  const bulkGeocode = async () => {
    const toGeo = partners.filter(p => !p.latitude && p.address?.trim());
    if (!toGeo.length) { setBulkGeoResult('Все партнёры уже имеют координаты ✓'); return; }
    setBulkGeoRunning(true);
    setBulkGeoResult(`Обрабатываем 0 / ${toGeo.length}...`);
    let ok = 0, fail = 0;
    for (let i = 0; i < toGeo.length; i++) {
      const p = toGeo[i];
      setBulkGeoResult(`Обрабатываем ${i + 1} / ${toGeo.length}: ${p.name}`);
      const r = await geocodeAddress(p.address).catch(() => null);
      if (r) { await runAdminEntityAction('partners', 'update', { id: p.id, patch: { latitude: r.lat, longitude: r.lon } }).catch(() => {}); ok++; }
      else { fail++; }
      if (i < toGeo.length - 1) await new Promise(res => setTimeout(res, 1100));
    }
    setBulkGeoRunning(false);
    setBulkGeoResult(`Готово: ${ok} успешно, ${fail} не найдено`);
    fetchData();
  };

  const deleteDemoQuery = async (resource, q) => {
    const snap = await getDocs(q);
    let count = 0;
    for (const d of snap.docs) {
      if (resource === 'news') {
        await runAdminAction('news:delete', { id: d.id }).catch(() => {});
      } else {
        await runAdminEntityAction(resource, 'delete', { id: d.id }).catch(() => {});
      }
      count++;
    }
    return count;
  };

  const clearDemoContent = async () => {
    if (demoClearing) return;
    if (!window.confirm('Удалить весь Demo Content? Реальные данные без isDemo=true не будут затронуты.')) return;
    setDemoClearing(true);
    setDemoClearResult('Удаляем demo-записи...');
    try {
      const cols = ['partners', 'experts', 'events', 'news', 'banners', 'prizes', 'customTasks', 'notifications', 'users', 'expertReviews', 'raffleEntries', 'prizeClaims', 'scans'];
      const counts = {};
      for (const col of cols) {
        counts[col] = await deleteDemoQuery(col, query(collection(db, col), where('isDemo', '==', true)));
      }
      counts.reviews = 0;
      counts.activity = 0;
      counts.claims = 0;
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      setDemoClearResult(`Удалено demo-документов: ${total}`);
      fetchData();
    } catch (e) {
      setDemoClearResult(`Ошибка очистки: ${e.message}`);
    } finally {
      setDemoClearing(false);
    }
  };

  const navigateToResult = r => {
    setActiveTab(r.tab);
    if (r.tab === 'partners') { setPartnerSearch(r.label); setExpandedPartnerId(r.id); setPartnerLinksFilter('all'); }
    if (r.tab === 'experts') { setExpandedExpertId(r.id); setExpertLinksFilter('all'); }
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
      col === 'news'
        ? runAdminAction('news:update', { id: item.id, patch: { priority: newA } })
        : runAdminEntityAction(col, 'update', { id: item.id, patch: { priority: newA } }),
      newB !== b
        ? (col === 'news'
          ? runAdminAction('news:update', { id: swap.id, patch: { priority: newB } })
          : runAdminEntityAction(col, 'update', { id: swap.id, patch: { priority: newB } }))
        : Promise.resolve(),
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
    setNCategory(''); setNCoverPhoto(''); setNPublishedAt(new Date().toISOString().slice(0, 10));
    setEditingNews(null); setShowNewsModal(false);
  };

  const startEditNews = (item) => {
    setEditingNews(item);
    setNTitle(item.title ?? ''); setNText(item.text ?? '');
    setNEmoji(item.emoji ?? '📢'); setNImage(item.imageUrl ?? '');
    setNLinkUrl(item.linkUrl ?? ''); setNLinkLabel(item.linkLabel ?? '');
    setNPriority(item.priority ?? 0);
    setNCategory(item.category ?? '');
    setNCoverPhoto(item.coverPhoto ?? item.imageUrl ?? '');
    setNPublishedAt(item.publishedAt?.toDate ? item.publishedAt.toDate().toISOString().slice(0, 10) : (item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)));
    setShowNewsModal(true);
  };

  const saveNews = async () => {
    if (!nTitle.trim() || !nText.trim()) return;
    const before = editingNews ? { ...editingNews } : null;
    const data = {
      title: nTitle.trim(),
      text: nText.trim(),
      emoji: nEmoji,
      imageUrl: (nCoverPhoto || nImage).trim(),
      coverPhoto: (nCoverPhoto || nImage).trim(),
      linkUrl: nLinkUrl.trim(),
      linkLabel: nLinkLabel.trim(),
      priority: Number(nPriority) || 0,
      category: nCategory || null,
      publishedAt: nPublishedAt ? new Date(nPublishedAt) : new Date(),
    };
    if (editingNews) {
      await runAdminAction('news:update', { id: editingNews.id, patch: data });
    } else {
      await runAdminAction('news:create', { patch: data });
    }
    resetNewsForm();
    fetchData();
  };

  const showUndo = (payload) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setAdminUndo(payload);
    undoTimerRef.current = setTimeout(() => setAdminUndo(null), 10000);
  };

  const deleteNews = async (id, options = {}) => {
    const item = news.find(n => n.id === id);
    if (!item) return;
    if (!options.silent && !window.confirm('Удалить новость? Можно отменить в течение 10 секунд.')) return;
    await runAdminAction('news:delete', { id });
    setNews(prev => prev.map(n => n.id === id ? { ...n, active: false, status: 'deleted' } : n));
    setSelectedNewsIds(prev => prev.filter(x => x !== id));
    showUndo({ type: 'news-delete', item, label: `Новость удалена: ${item.title || 'без заголовка'}` });
  };

  const restoreDeletedNews = async () => {
    if (!adminUndo?.item) return;
    const item = adminUndo.item;
    const patch = {
      active: item.active !== false,
      status: item.status && item.status !== 'deleted' ? item.status : (item.active === false ? 'draft' : 'published'),
      deletedAt: null,
    };
    await runAdminAction('news:restore', { id: item.id, previous: item });
    setNews(prev => prev.map(n => n.id === item.id ? { ...n, ...patch, deletedAt: null } : n));
    setAdminUndo(null);
  };

  const publishNews = async (item) => {
    await runAdminAction('news:publish', { id: item.id });
    setNews(prev => prev.map(n => n.id === item.id ? { ...n, active: true, status: 'published' } : n));
  };

  const pinNews = async (item) => {
    const next = !(item.pinned || item.isPinned);
    await runAdminAction('news:pin', { id: item.id });
    setNews(prev => prev.map(n => n.id === item.id ? { ...n, pinned: next, isPinned: next, priority: next ? Math.max(Number(n.priority || 0), 9) : Number(n.priority || 0) } : n));
  };

  const openQuickNewsEditor = (item) => {
    setQuickEditNews(item);
    setQuickNewsDraft({
      title: item.title || '',
      text: item.text || '',
      category: item.category || '',
      priority: Number(item.priority || 0),
      coverPhoto: contentImageOf(item),
      linkUrl: item.linkUrl || '',
      linkLabel: item.linkLabel || '',
    });
    setQuickEditorDirty(false);
    setContextMenu(null);
  };

  const patchQuickNewsDraft = (patch) => {
    setQuickNewsDraft(prev => ({ ...(prev || {}), ...patch }));
    setQuickEditorDirty(true);
  };

  const saveQuickNewsEditor = useCallback(async ({ silent = false } = {}) => {
    if (!quickEditNews || !quickNewsDraft?.title?.trim() || !quickNewsDraft?.text?.trim()) return;
    setQuickEditorSaving(true);
    const patch = {
      title: quickNewsDraft.title.trim(),
      text: quickNewsDraft.text.trim(),
      category: quickNewsDraft.category || null,
      priority: Number(quickNewsDraft.priority) || 0,
      coverPhoto: (quickNewsDraft.coverPhoto || '').trim(),
      imageUrl: (quickNewsDraft.coverPhoto || '').trim(),
      linkUrl: (quickNewsDraft.linkUrl || '').trim(),
      linkLabel: (quickNewsDraft.linkLabel || '').trim(),
    };
    try {
      await runAdminAction(silent ? 'news:autosave' : 'news:update', { id: quickEditNews.id, patch });
      setNews(prev => prev.map(n => n.id === quickEditNews.id ? { ...n, ...patch } : n));
      setQuickEditNews(prev => prev ? { ...prev, ...patch } : prev);
      setQuickEditorDirty(false);
    } catch (e) {
      logError(e, 'AdminPanel.saveQuickNewsEditor');
      if (!silent) window.alert(e.message || 'Не удалось сохранить новость.');
    } finally {
      setQuickEditorSaving(false);
    }
  }, [quickEditNews, quickNewsDraft]);

  const toggleNewsSelected = (id) => {
    setSelectedNewsIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bulkPublishNews = async () => {
    const items = news.filter(n => selectedNewsIds.includes(n.id));
    await Promise.all(items.map(item => publishNews(item)));
    setSelectedNewsIds([]);
  };

  const bulkPinNews = async () => {
    const items = news.filter(n => selectedNewsIds.includes(n.id));
    await Promise.all(items.map(item => pinNews(item)));
    setSelectedNewsIds([]);
  };

  const bulkDeleteNews = async () => {
    if (!selectedNewsIds.length) return;
    if (!window.confirm(`Удалить выбранные новости (${selectedNewsIds.length})? Можно отменить последнюю через undo.`)) return;
    const ids = [...selectedNewsIds];
    for (const id of ids) {
      await deleteNews(id, { silent: true });
    }
    setSelectedNewsIds([]);
  };

  const handleNewsSwipe = (item, action) => {
    if (action === 'publish') publishNews(item);
    if (action === 'delete') deleteNews(item.id);
  };

  const handleNewsDrop = async (target) => {
    if (!draggingNewsId || draggingNewsId === target.id) {
      setDraggingNewsId('');
      return;
    }
    const dragged = news.find(n => n.id === draggingNewsId);
    if (!dragged) {
      setDraggingNewsId('');
      return;
    }
    const targetPriority = Number(target.priority || 0);
    const patch = { priority: targetPriority + 1 };
    await runAdminAction('news:reorder', { id: dragged.id, targetId: target.id, priority: targetPriority + 1 });
    setNews(prev => prev.map(n => n.id === dragged.id ? { ...n, priority: patch.priority } : n));
    setDraggingNewsId('');
  };

  const loadNewsComments = useCallback(async () => {
    try {
      const rows = await fetchAdminNewsComments();
      setNewsComments(rows);
      setAdminMetrics(prev => ({ ...prev, newsComments: rows }));
    } catch (e) {
      logError(e, 'AdminPanel.loadNewsComments');
    }
  }, []);

  const moderateNewsComment = async (comment, action) => {
    const adminUser = {
      id: auth.currentUser?.uid || 'admin-panel',
      name: 'Администрация АПГ',
      role: 'owner',
    };
    try {
      const response = await fetch(`${API_BASE_URL}/api/news-comments`, {
        method: 'POST',
        headers: await adminRequestHeaders(`comment_${action}_${comment.id}_${Date.now()}`),
        body: JSON.stringify({ action, commentId: comment.id, user: adminUser }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Не удалось выполнить действие.');
      if (action === 'delete' || action === 'blockUser') {
        setNewsComments(prev => prev.map(c => c.id === comment.id ? { ...c, hidden: true, status: 'hidden' } : c));
      } else if (data.comment) {
        setNewsComments(prev => prev.map(c => c.id === comment.id ? data.comment : c));
      } else {
        await loadNewsComments();
      }
      setAdminMetrics(prev => ({
        ...prev,
        newsComments: (action === 'delete' || action === 'blockUser')
          ? prev.newsComments.map(c => c.id === comment.id ? { ...c, hidden: true, status: 'hidden' } : c)
          : data.comment
            ? prev.newsComments.map(c => c.id === comment.id ? data.comment : c)
            : prev.newsComments,
      }));
    } catch (e) {
      logError(e, `AdminPanel.moderateNewsComment.${action}`);
      window.alert(e.message || 'Не удалось выполнить действие модерации.');
    }
  };

  // ─── Уведомления ────────────────────────────────────────────────────────────

  const resetNotifForm = () => { setNtTitle(''); setNtBody(''); setNtEmoji('🔔'); setNtTargetType('all'); setNtTargetValue(''); setNtPushResult(null); };

  const sendNotif = async () => {
    if (!ntTitle.trim()) return;
    const data = {
      title: ntTitle.trim(),
      body: ntBody.trim(),
      emoji: ntEmoji,
      targetType: ntTargetType,
    };
    if (ntTargetType !== 'all' && ntTargetValue) data.targetValue = Number(ntTargetValue);
    await runAdminEntityAction('notifications', 'create', { patch: data });

    if (ntSendPush) {
      try {
        const r = await fetch(`${API_BASE_URL}/api/send-push`, {
          method: 'POST',
          headers: await adminRequestHeaders(`push_${Date.now()}`),
          body: JSON.stringify({ broadcast: true, title: ntTitle.trim(), body: ntBody.trim() || undefined }),
        });
        const result = await r.json();
        setNtPushResult(result.sent != null ? `Push: ${result.sent} доставлено` : 'Push: нет подписчиков');
      } catch {
        setNtPushResult('Push: ошибка отправки');
      }
    }

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
    };
    if (ctType !== 'manual' && ctTarget) data.target = Number(ctTarget);
    await runAdminEntityAction('customTasks', 'create', { patch: data });
    resetCtForm();
    fetchData();
  };

  const deleteCustomTask = async (id) => {
    if (!window.confirm('Удалить задание?')) return;
    await runAdminEntityAction('customTasks', 'delete', { id });
    fetchData();
  };

  const deleteNotif = async (id) => {
    if (!window.confirm('Удалить уведомление?')) return;
    await runAdminEntityAction('notifications', 'delete', { id });
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
    setECategory(''); setECoverPhoto(''); setEStartAt(''); setEEndAt(''); setELocation('');
    setEditingEvent(null); setShowEventModal(false);
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
    setECategory(e.category ?? '');
    setECoverPhoto(e.coverPhoto ?? '');
    const toDateStr = ts => ts?.toDate ? ts.toDate().toISOString().slice(0, 16) : (ts ? new Date(ts).toISOString().slice(0, 16) : '');
    setEStartAt(toDateStr(e.startAt));
    setEEndAt(toDateStr(e.endAt));
    setELocation(e.location ?? '');
    setShowEventModal(true);
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
      category:  eCategory || null,
      coverPhoto: eCoverPhoto.trim(),
      startAt:   eStartAt ? new Date(eStartAt) : null,
      endAt:     eEndAt ? new Date(eEndAt) : null,
      location:  eLocation.trim(),
    };
    if (editingEvent) {
      await runAdminEntityAction('events', 'update', { id: editingEvent.id, patch: data });
    } else {
      await runAdminEntityAction('events', 'create', { patch: data });
    }
    resetEventForm();
    fetchData();
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Удалить событие?')) return;
    await runAdminEntityAction('events', 'delete', { id });
    fetchData();
  };

  // ─── Партнёр дня ────────────────────────────────────────────────────────────

  const setFeaturedPartner = useCallback(async (partnerId) => {
    await Promise.all(partners.map(p =>
      runAdminEntityAction('partners', 'update', {
        id: p.id,
        patch: { featured: partnerId !== null && p.id === partnerId },
      })
    ));
    fetchData();
  }, [partners]);

  // ─── Призы ──────────────────────────────────────────────────────────────────

  const PRIZE_EMOJIS = ['🎁','☕','🍕','💆','💄','🎓','🏋️','🎟️','🛍️','🎉','🌿','🍰','🎸','📚','🎨','🤝','🏆','🌟','🎭','💅'];

  const resetPrizeForm = () => {
    setPrName(''); setPrDesc(''); setPrCost(''); setPrEmoji('🎁');
    setPrStock(''); setPrActive(true); setEditingPrize(null);
    setPrType('purchase'); setPrTicketCost(''); setPrRaffleDate('');
    setPrPartnerId(''); setPrExpertId(''); setPrDonorType('none');
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
    setPrExpertId(p.expertId ?? '');
    setPrDonorType(p.expertId ? 'expert' : p.partnerId ? 'partner' : 'none');
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
      partnerId: prDonorType === 'partner' ? (prPartnerId || null) : null,
      expertId:  prDonorType === 'expert'  ? (prExpertId  || null) : null,
    };
    if (prType === 'raffle') {
      data.ticketCost = prTicketCost !== '' ? Number(prTicketCost) : 1;
      data.raffleDate = prRaffleDate ? new Date(prRaffleDate).toISOString() : null;
    }
    if (editingPrize) {
      await runAdminEntityAction('prizes', 'update', { id: editingPrize.id, patch: data });
    } else {
      await runAdminEntityAction('prizes', 'create', { patch: data });
    }
    resetPrizeForm();
    fetchData();
  };

  const deletePrize = async (id) => {
    if (!window.confirm('Удалить приз?')) return;
    await runAdminEntityAction('prizes', 'delete', { id });
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
      let count = 0;
      for (const d of snap.docs) {
        const p = d.data();
        const mapping = CATEGORY_MIGRATION[p.category];
        if (mapping) {
          await runAdminEntityAction('partners', 'update', { id: d.id, patch: { category: mapping.id, categoryLabel: mapping.label } });
          count++;
        }
      }
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
      const res = await fetch(`${API_BASE_URL}/api/raffle-draw`, {
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
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcMsg, setRecalcMsg]         = useState('');

  const awardKeys = async () => {
    if (!awardUserId.trim() || !Number(awardAmount)) return;
    setAwardMsg('Начисляем...');
    try {
      await runAdminEntityAction('users', 'update', { id: awardUserId.trim(), increments: { keys: Number(awardAmount) } });
      setAwardMsg(`✅ +${awardAmount} ключей начислено`);
      setAwardUserId(''); setAwardAmount('');
    } catch { setAwardMsg('❌ Ошибка — проверьте ID'); }
    setTimeout(() => setAwardMsg(''), 3000);
  };

  const recalcStats = async () => {
    if (recalcLoading) return;
    setRecalcLoading(true);
    setRecalcMsg('Считаем...');
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const userCount  = users.filter(u => !u.id.startsWith('guest_')).length;
      const totalScans = users.reduce((sum, u) =>
        sum + Object.values(u.visitCounts ?? {}).reduce((s, v) => s + (Number(v) || 0), 0), 0);
      await runAdminEntityAction('stats', 'set', { id: 'global', patch: { userCount, totalScans } });
      setRecalcMsg(`✅ Обновлено: ${userCount} пользователей, ${totalScans} визитов`);
    } catch (e) {
      logError(e, 'AdminPanel.recalcStats');
      setRecalcMsg('❌ Ошибка при пересчёте');
    }
    setRecalcLoading(false);
    setTimeout(() => setRecalcMsg(''), 5000);
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

      // Гостевые сессии (последние 30 дней)
      const guestSnap = await getDocs(
        query(collection(db, 'guestSessions'),
          where('date', '>=', cutoff30.toISOString().slice(0, 10)),
          orderBy('date'),
          limit(2000),
        )
      ).catch(() => ({ docs: [] }));
      const guestDocs      = guestSnap.docs.map(d => d.data());
      const guestTotal     = guestDocs.length;
      const guestConverted = guestDocs.filter(d => d.converted).length;
      const guestRate      = guestTotal > 0 ? ((guestConverted / guestTotal) * 100).toFixed(1) : '0';

      const guestMap = {};
      last30.forEach(date => { guestMap[date] = 0; });
      guestDocs.forEach(d => {
        if (d.date && guestMap[d.date] !== undefined) guestMap[d.date]++;
      });
      const guestGrowthData = last30.map(date => ({ date, count: guestMap[date] }));

      setAnalytics({
        totalUsers, totalKeys, avgKeys, activeUsers, totalScans,
        partnerStats, users,
        dauData, topUsers, keyBuckets,
        referredCount, totalReferrals, referralKeysOut,
        newUsers7d, newUsers30d, regGrowthData, activeUsers7d,
        guestTotal, guestConverted, guestRate, guestGrowthData,
      });
    } catch (e) { logError(e, 'AdminPanel.loadAnalytics'); }
    setAnalyticsLoading(false);
  }, [partners, analyticsLoading]);

  useEffect(() => {
    if (!quickEditNews || !quickEditorDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveQuickNewsEditor({ silent: true });
    }, 1400);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [quickEditNews, quickEditorDirty, quickNewsDraft, saveQuickNewsEditor]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (quickEditNews) {
          e.preventDefault();
          saveQuickNewsEditor();
        }
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        setShowSearchDrop(true);
        document.getElementById('admin-global-search')?.focus();
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        resetNewsForm();
        setActiveTab('news');
        setShowNewsModal(true);
      }
      if (e.key === 'Escape') {
        setShowAddDrop(false);
        setShowToolsDrop(false);
        setShowSearchDrop(false);
        setContextMenu(null);
        setQuickEditNews(null);
        setQuickNewsDraft(null);
        setSelectedNewsIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickEditNews, saveQuickNewsEditor]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    if (activeTab === 'system' && !systemStatus && !systemStatusLoading) loadSystemStatus();
  }, [activeTab, systemStatus, systemStatusLoading, loadSystemStatus]);

  if (!authed) return <PasswordGate onAllow={() => { setAuthed(true); fetchData(); }} />;

  const q = globalSearch.toLowerCase();
  const searchResults = globalSearch.length > 1 ? [
    ...adminMetrics.users.filter(u => userDisplayName(u).toLowerCase().includes(q) || String(u.email ?? '').toLowerCase().includes(q) || String(u.id ?? '').toLowerCase().includes(q)).slice(0, 4).map(u => ({ tab: 'users', id: u.id, label: userDisplayName(u), sub: providerLabel(u), emoji: '👤', typeName: 'Пользователь' })),
    ...partners.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 4).map(p => ({ tab: 'partners', id: p.id, label: p.name, sub: CATEGORIES.find(c => c.id === p.category)?.label, emoji: '🤝', typeName: 'Партнёр' })),
    ...partners.filter(p => p.offer?.toLowerCase().includes(q)).slice(0, 3).map(p => ({ tab: 'partners', id: p.id, label: p.offer, sub: p.name, emoji: '🏷️', typeName: 'Акция' })),
    ...experts.filter(ex => ex.name?.toLowerCase().includes(q)).slice(0, 4).map(ex => ({ tab: 'experts', id: ex.id, label: ex.name, sub: ex.specialization, emoji: '🧑‍💼', typeName: 'Эксперт' })),
    ...events.filter(e => e.title?.toLowerCase().includes(q)).slice(0, 3).map(e => ({ tab: 'events', id: e.id, label: e.title, emoji: '🎉', typeName: 'Событие' })),
    ...news.filter(n => n.title?.toLowerCase().includes(q)).slice(0, 3).map(n => ({ tab: 'news', id: n.id, label: n.title, emoji: '📢', typeName: 'Новость' })),
    ...prizes.filter(p => p.name?.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q)).slice(0, 3).map(p => ({ tab: 'prizes', id: p.id, label: p.name || p.title, emoji: '🎁', typeName: 'Приз' })),
    ...newsComments.filter(c => String(c.text || '').toLowerCase().includes(q) || String(c.userName || '').toLowerCase().includes(q)).slice(0, 4).map(c => ({ tab: 'comments', id: c.id, label: c.text || 'Комментарий', sub: c.userName, emoji: '💬', typeName: 'Комментарий' })),
    ...errorLogs.filter(e => String(e.message || e.error || e.source || e.screen || e.userId || '').toLowerCase().includes(q)).slice(0, 4).map(e => ({ tab: 'errors', id: e.id, label: e.message || e.error || 'Ошибка приложения', sub: e.source || e.screen, emoji: '🐞', typeName: 'Ошибка' })),
    ...((q.includes('ии') || q.includes('ai') || q.includes('чернов')) ? [{ tab: 'ai-drafts', id: 'ai-drafts', label: 'Черновики ИИ', sub: 'Раздел подготовлен к V4.5', emoji: '🤖', typeName: 'Раздел' }] : []),
  ] : [];
  const isCompact = viewportWidth < 860;
  const adminPageStyle = {
    ...s.page,
    display: isCompact ? 'block' : 'flex',
    height: '100svh',
    overflow: 'hidden',
  };
  const sidebarStyle = {
    ...s.sidebar,
    width: isCompact ? '100%' : 220,
    height: isCompact ? 'auto' : '100vh',
    maxHeight: isCompact ? 178 : '100vh',
    flexDirection: isCompact ? 'row' : 'column',
    overflowX: isCompact ? 'auto' : 'hidden',
    overflowY: isCompact ? 'hidden' : 'auto',
    borderRight: isCompact ? 'none' : s.sidebar.borderRight,
    borderBottom: isCompact ? '1px solid rgba(255,255,255,0.07)' : 'none',
    padding: isCompact ? '12px 10px' : s.sidebar.padding,
  };
  const contentStyle = {
    ...s.content,
    height: isCompact ? 'calc(100svh - 86px)' : '100vh',
    maxWidth: isCompact ? 'none' : 1180,
    padding: isCompact ? '14px 14px 112px' : s.content.padding,
  };
  const toolbarStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'linear-gradient(160deg, #0C0C1E 0%, #14142A 100%)',
    borderBottom: `1px solid ${A.border}`,
    margin: isCompact ? '-14px -14px 16px' : '-24px -28px 20px',
    padding: isCompact ? '10px 12px' : '10px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: isCompact ? 'wrap' : 'nowrap',
  };

  return (
    <div style={adminPageStyle}>
      {/* Боковое меню */}
      <aside style={sidebarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isCompact ? '4px 8px' : '4px 8px 18px', borderBottom: isCompact ? 'none' : '1px solid rgba(255,255,255,0.07)', marginBottom: isCompact ? 0 : 14, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #C9A84C, #E8C76D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 12px rgba(201,168,76,0.35)' }}>⚙️</div>
          {!isCompact && <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: A.text, lineHeight: 1.3 }}>Управление</div>
            <div style={{ fontSize: 10, color: A.gold, fontWeight: 700, letterSpacing: 0.5 }}>АПГ Зеленоград</div>
          </div>}
        </div>
        <nav style={{ display: 'flex', flexDirection: isCompact ? 'row' : 'column', gap: 2, minWidth: isCompact ? 'max-content' : 'auto' }}>
          {[
            { id: 'dashboard', emoji: '📊', label: 'Рабочий стол' },
            { id: 'moderation', emoji: '🚦', label: 'Модерация', count: newsComments.filter(c => !c.hidden && (c.status === 'pending' || !c.moderationReviewedAt)).length || undefined },
            { id: 'comments', emoji: '💬', label: 'Комментарии', count: newsComments.filter(c => !c.hidden).length || undefined },
            { id: 'users', emoji: '👥', label: 'Пользователи', count: adminMetrics.users.length || undefined },
            { id: 'partners',  emoji: '🤝', label: 'Партнёры',  count: partners.length },
            { id: 'experts',   emoji: '🧑‍💼', label: 'Эксперты',  count: experts.length },
            { id: 'events',    emoji: '🎉', label: 'События',   count: events.length },
            { id: 'news',      emoji: '📢', label: 'Новости',   count: news.length },
            { id: 'banners',   emoji: '📣', label: 'Реклама',   count: banners.filter(b => b.active && getBannerStatus(b) === 'active').length || undefined },
            { id: 'notifs',    emoji: '🔔', label: 'Рассылка' },
            { id: 'tasks',     emoji: '✅', label: 'Задания',   count: customTasks.length },
            { id: 'prizes',    emoji: '🎁', label: 'Призы',     count: prizes.length },
            { id: 'rotation',  emoji: '🔄', label: 'Ротация' },
            { id: 'activity',  emoji: '🏆', label: 'Активность' },
            { id: 'analytics', emoji: '📊', label: 'Аналитика' },
            { id: 'system',    emoji: '🛡', label: 'Система' },
            { id: 'errors',    emoji: '🐛', label: 'Ошибки', count: errorLogs.filter(e => !e.resolved).length || undefined },
            { id: 'ai-drafts', emoji: '🤖', label: 'Черновики ИИ' },
            { id: 'diag',      emoji: '📡', label: 'Диагностика' },
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id}
                onClick={() => { setActiveTab(t.id); if (t.id === 'analytics' && !analytics) loadAnalytics(); if (t.id === 'errors') loadErrors(); if (t.id === 'comments' || t.id === 'moderation') loadNewsComments(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: isCompact ? '9px 11px' : '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(201,168,76,0.13)' : 'transparent',
                  borderLeft: active ? `3px solid ${A.gold}` : '3px solid transparent',
                  color: active ? A.gold : A.textSec,
                  fontSize: 13, fontWeight: active ? 700 : 400,
                  textAlign: 'left', width: isCompact ? 'auto' : '100%', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{t.emoji}</span>
                <span style={{ flex: 1 }}>{isCompact ? t.label.replace('Рабочий стол', 'Дом') : t.label}</span>
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
      <div style={contentStyle}>

      {/* ── Тулбар ── */}
      <div style={toolbarStyle}>

        {/* Глобальный поиск */}
        <div style={{ position: 'relative', flex: 1 }} tabIndex={-1} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowSearchDrop(false); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: A.inputBg, border: `1px solid ${globalSearch ? A.gold : A.inputBrd}`, borderRadius: 12, padding: '8px 12px', transition: 'border-color 0.15s' }}>
            <span style={{ fontSize: 14, color: A.textSec, flexShrink: 0 }}>🔍</span>
            <input
              id="admin-global-search"
              type="search"
              placeholder="Поиск партнёров, экспертов, событий..."
              value={globalSearch}
              onChange={e => { setGlobalSearch(e.target.value); setShowSearchDrop(true); }}
              onFocus={() => setShowSearchDrop(true)}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, flex: 1, color: A.text, minWidth: 0 }}
            />
            {globalSearch && <button onClick={() => { setGlobalSearch(''); setShowSearchDrop(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: A.textSec, fontSize: 15, padding: 0, flexShrink: 0 }}>✕</button>}
          </div>
          {showSearchDrop && globalSearch.length > 1 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1A1A2E', border: `1px solid ${A.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 300, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
              {searchResults.length === 0
                ? <div style={{ padding: '14px 16px', fontSize: 13, color: A.textSec, textAlign: 'center' }}>Ничего не найдено</div>
                : searchResults.map((r, i) => (
                  <button key={i} onMouseDown={() => { navigateToResult(r); setGlobalSearch(''); setShowSearchDrop(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', border: 'none', borderBottom: i < searchResults.length - 1 ? `1px solid ${A.border}` : 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                      {r.sub && <div style={{ fontSize: 11, color: A.textSec }}>{r.sub}</div>}
                    </div>
                    <span style={{ fontSize: 10, color: A.textSec, flexShrink: 0, padding: '2px 8px', background: A.chip, borderRadius: 6 }}>{r.typeName}</span>
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {/* Тоггл "только непроверенные" */}
        {['partners','experts','events','news'].includes(activeTab) && (() => {
          const filterMap = { partners: [partnerLinksFilter, setPartnerLinksFilter], experts: [expertLinksFilter, setExpertLinksFilter], events: [eventLinksFilter, setEventLinksFilter], news: [newsLinksFilter, setNewsLinksFilter] };
          const [curFilter, setCurFilter] = filterMap[activeTab];
          return (
            <button onClick={() => setCurFilter(v => v === 'unverified' ? 'all' : 'unverified')}
              style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${curFilter === 'unverified' ? '#f59e0b' : A.border}`, background: curFilter === 'unverified' ? 'rgba(245,158,11,0.12)' : 'transparent', color: curFilter === 'unverified' ? '#f59e0b' : A.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
              ⚠ Не проверены
            </button>
          );
        })()}

        {/* Счётчики */}
        {activeTab === 'partners' && (
          <span style={{ fontSize: 12, color: A.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {partners.length} партн. · <span style={{ color: partners.filter(p => !isCheckedRecently(p.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{partners.filter(p => !isCheckedRecently(p.linksCheckedAt)).length} непров.</span>
          </span>
        )}
        {activeTab === 'experts' && (
          <span style={{ fontSize: 12, color: A.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {experts.length} эксп. · <span style={{ color: experts.filter(ex => !isCheckedRecently(ex.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{experts.filter(ex => !isCheckedRecently(ex.linksCheckedAt)).length} непров.</span>
          </span>
        )}
        {activeTab === 'events' && (
          <span style={{ fontSize: 12, color: A.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {events.length} соб. · <span style={{ color: events.filter(e => !isCheckedRecently(e.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{events.filter(e => !isCheckedRecently(e.linksCheckedAt)).length} непров.</span>
          </span>
        )}
        {activeTab === 'news' && (
          <span style={{ fontSize: 12, color: A.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {news.length} нов. · <span style={{ color: news.filter(n => !isCheckedRecently(n.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{news.filter(n => !isCheckedRecently(n.linksCheckedAt)).length} непров.</span>
          </span>
        )}

        {/* ➕ Добавить */}
        <div style={{ position: 'relative', flexShrink: 0 }} tabIndex={-1} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowAddDrop(false); }}>
          <button onClick={() => { setShowAddDrop(v => !v); setShowToolsDrop(false); }}
            style={{ ...s.btn, ...s.btnPri, padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
            ➕ Добавить ▾
          </button>
          {showAddDrop && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#1A1A2E', border: `1px solid ${A.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden', minWidth: 185 }}>
              {[
                ['🤝', 'Партнёра',  () => { resetPartnerForm(); setShowPartnerModal(true); setActiveTab('partners'); setShowAddDrop(false); }],
                ['🧑‍💼', 'Эксперта', () => { resetExpertForm(); setShowExpertModal(true); setActiveTab('experts'); setShowAddDrop(false); }],
                ['🎉', 'Событие',   () => { resetEventForm(); setActiveTab('events'); setShowEventModal(true); setShowAddDrop(false); }],
                ['📢', 'Новость',   () => { resetNewsForm(); setActiveTab('news'); setShowNewsModal(true); setShowAddDrop(false); }],
              ].map(([emoji, label, action], i, arr) => (
                <button key={label} onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', width: '100%', border: 'none', borderBottom: i < arr.length - 1 ? `1px solid ${A.border}` : 'none', background: 'none', cursor: 'pointer', color: A.text, fontSize: 13, textAlign: 'left' }}>
                  <span style={{ fontSize: 15 }}>{emoji}</span>{label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 🔧 Инструменты */}
        <div style={{ position: 'relative', flexShrink: 0 }} tabIndex={-1} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowToolsDrop(false); }}>
          <button onClick={() => { setShowToolsDrop(v => !v); setShowAddDrop(false); }}
            style={{ ...s.btn, ...s.btnGray, padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
            🔧 ▾
          </button>
          {showToolsDrop && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#1A1A2E', border: `1px solid ${A.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden', minWidth: 270 }}>
              <div style={{ padding: '8px 14px 4px', fontSize: 10, color: A.textSec, fontWeight: 800, letterSpacing: 0.8 }}>ПАРТНЁРЫ</div>
              <div style={{ padding: '4px 14px 12px', borderBottom: `1px solid ${A.border}` }}>
                {migrateResult && <div style={{ fontSize: 11, color: A.gold, marginBottom: 6 }}>{migrateResult}</div>}
                <button style={{ ...s.btn, ...s.btnPri, width: '100%', fontSize: 12, padding: '7px 12px', textAlign: 'left' }} onClick={migrateCategories} disabled={migrating}>
                  {migrating ? '⏳ Мигрируем...' : '🔄 Мигрировать категории'}
                </button>
              </div>
              <div style={{ padding: '8px 14px 12px' }}>
                {bulkGeoResult
                  ? <div style={{ fontSize: 11, color: '#6AABEC', marginBottom: 6 }}>{bulkGeoResult}</div>
                  : <div style={{ fontSize: 11, color: A.textSec, marginBottom: 6 }}>{partners.filter(p => !p.latitude && p.address?.trim()).length} адресов без координат</div>}
                <button style={{ ...s.btn, width: '100%', fontSize: 12, padding: '7px 12px', background: 'rgba(74,144,217,0.2)', color: '#6AABEC', border: '1px solid rgba(74,144,217,0.3)', textAlign: 'left' }} onClick={bulkGeocode} disabled={bulkGeoRunning}>
                  {bulkGeoRunning ? '⏳ Геокодируем...' : '🌍 Геокодировать адреса'}
                </button>
              </div>
              <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${A.border}` }}>
                <div style={{ padding: '0 0 6px', fontSize: 10, color: A.textSec, fontWeight: 800, letterSpacing: 0.8 }}>DEMO CONTENT</div>
                {demoClearResult && <div style={{ fontSize: 11, color: demoClearResult.startsWith('Ошибка') ? '#ff6b6b' : A.gold, marginBottom: 6 }}>{demoClearResult}</div>}
                <button style={{ ...s.btn, width: '100%', fontSize: 12, padding: '7px 12px', background: 'rgba(239,68,68,0.15)', color: '#ff8b8b', border: '1px solid rgba(239,68,68,0.32)', textAlign: 'left' }} onClick={clearDemoContent} disabled={demoClearing}>
                  {demoClearing ? '⏳ Удаляем...' : '🧹 Очистить Demo Content'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(loading || adminLoadIssues.length > 0 || adminLoadInfo.lastLoadedAt) && (
        <div style={{
          ...s.card,
          marginBottom: 18,
          border: adminLoadIssues.some(item => !item.optional) ? '1px solid rgba(230,70,70,0.34)' : adminLoadIssues.length ? '1px solid rgba(245,158,11,0.32)' : `1px solid ${A.border}`,
          background: adminLoadIssues.some(item => !item.optional) ? 'rgba(230,70,70,0.08)' : adminLoadIssues.length ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.035)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 850, color: A.text }}>
                {loading ? 'Загружаем данные админки...' : adminLoadIssues.length ? 'Данные загружены частично' : 'Данные админки загружены'}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: '16px', color: A.textSec }}>
                {adminLoadInfo.authUid ? `Auth UID: ${adminLoadInfo.authUid}` : 'Firebase Auth ещё не подтверждён'}
                {adminLoadInfo.lastLoadedAt && ` · ${new Date(adminLoadInfo.lastLoadedAt).toLocaleString('ru-RU')}`}
              </div>
            </div>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              style={{ ...s.btn, ...s.btnGray, flexShrink: 0, opacity: loading ? 0.55 : 1, padding: '8px 12px', fontSize: 12 }}
            >
              {loading ? '⏳ Загрузка' : '↻ Повторить'}
            </button>
          </div>
          {adminLoadIssues.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {adminLoadIssues.slice(0, 8).map(item => (
                <div key={`${item.name}-${item.error}`} style={{ padding: '9px 11px', borderRadius: 12, background: 'rgba(0,0,0,0.16)', border: `1px solid ${item.optional ? 'rgba(245,158,11,0.24)' : 'rgba(230,70,70,0.28)'}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: item.optional ? '#f59e0b' : A.red, fontSize: 12, fontWeight: 850 }}>{item.optional ? '⚠' : '✗'} {item.label}</span>
                    <span style={{ color: A.textSec, fontSize: 10 }}>попыток: {item.attempts}</span>
                  </div>
                  <div style={{ color: A.textSec, fontSize: 11, lineHeight: '16px' }}>{item.error}</div>
                </div>
              ))}
              {adminLoadIssues.length > 8 && (
                <div style={{ color: A.textSec, fontSize: 11 }}>Ещё ошибок: {adminLoadIssues.length - 8}</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <AdminDashboard
          partners={partners}
          experts={experts}
          events={events}
          news={news}
          banners={banners}
          customTasks={customTasks}
          prizes={prizes}
          metrics={adminMetrics}
          onOpenTab={setActiveTab}
          onOpenPartner={(id) => { setActiveTab('partners'); setExpandedPartnerId(id); setPartnerLinksFilter('all'); }}
          onOpenExpert={(id) => { setActiveTab('experts'); setExpandedExpertId(id); setExpertLinksFilter('all'); }}
        />
      )}

      {activeTab === 'moderation' && (
        <ModerationPanel
          news={news}
          comments={newsComments}
          onOpenNews={() => setActiveTab('news')}
          onOpenComments={() => setActiveTab('comments')}
        />
      )}

      {activeTab === 'comments' && (
        <AdminCommentsPanel
          comments={newsComments}
          news={news}
          onRefresh={loadNewsComments}
          onModerate={moderateNewsComment}
        />
      )}

      {activeTab === 'users' && (
        <AdminUsersPanel users={adminMetrics.users} />
      )}

      {activeTab === 'ai-drafts' && (
        <AIDraftsPanel />
      )}

      {/* ── ЭКСПЕРТЫ ── */}
      {activeTab === 'experts' && (
        <>
          {/* ── Модалка добавления / редактирования эксперта ── */}
          {showExpertModal && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 48px' }}
              onClick={e => { if (e.target === e.currentTarget) resetExpertForm(); }}
            >
              <div style={{ ...s.card, width: '100%', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>{editingExpert ? `✏️ ${editingExpert.name}` : '➕ Новый эксперт'}</h2>
                  <button onClick={resetExpertForm} style={{ background: 'none', border: 'none', color: A.textSec, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
                </div>

                <label style={s.label}>Имя *</label>
                <input style={s.input} placeholder="Анна Смирнова" value={exName} onChange={e => setExName(e.target.value)} />

                <label style={s.label}>Специализация *</label>
                <input style={s.input} placeholder="Психолог, коуч, нутрициолог..." value={exSpec} onChange={e => setExSpec(e.target.value)} />

                <label style={s.label}>Тариф</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[{ id: 'practice', label: '📋 Практика' }, { id: 'ambassador', label: '🌟 Амбассадор' }].map(t => (
                    <button key={t.id} onClick={() => setExTier(t.id)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${exTier === t.id ? A.gold : A.border}`, background: exTier === t.id ? A.goldDim : 'transparent', color: exTier === t.id ? A.gold : A.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <label style={s.label}>Категория</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {EXPERT_CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setExCategory(c.id)} style={{ padding: '6px 12px', borderRadius: 12, border: `2px solid ${exCategory === c.id ? A.gold : A.border}`, background: exCategory === c.id ? A.goldDim : 'transparent', color: exCategory === c.id ? A.gold : A.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>

                <label style={s.label}>Описание</label>
                <MdEditor value={exDesc} onChange={setExDesc} placeholder="Расскажите об эксперте..." style={s.textarea} />

                <label style={s.label}>Специальное предложение для участников АПГ 🎁</label>
                <input style={s.input} placeholder="Скидка 15% на первую консультацию" value={exOffer} onChange={e => setExOffer(e.target.value)} />

                <label style={s.label}>Штамп-карта: визитов до награды (0 = выключено) 🎟️</label>
                <input style={s.input} type="number" min="0" max="20" placeholder="Например: 5" value={exStampTarget} onChange={e => setExStampTarget(e.target.value)} />

                <label style={s.label}>Фото</label>
                <PhotoUpload value={exPhoto} onChange={setExPhoto} folder="experts" label="Загрузить фото" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
                {exPhoto && <input style={{ ...s.input, marginTop: 6 }} placeholder="или вставьте URL" value={exPhoto} onChange={e => setExPhoto(e.target.value)} />}

                <label style={s.label}>Фото-шапка (обложка)</label>
                <PhotoUpload value={exCoverPhoto} onChange={setExCoverPhoto} folder="experts/covers" label="Загрузить обложку" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
                {exCoverPhoto && <input style={{ ...s.input, marginTop: 6 }} placeholder="или вставьте URL" value={exCoverPhoto} onChange={e => setExCoverPhoto(e.target.value)} />}

                <label style={s.label}>Галерея (до 6 фото)</label>
                <GalleryUpload value={exGallery} onChange={setExGallery} folder="experts/gallery" max={6} theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />

                <label style={s.label}>Видео (YouTube · VK Видео · Rutube) — {exVideos.length}/5</label>
                {exVideos.length < 5 && (
                  <div style={{ marginBottom: 8 }}>
                    <input style={s.input} placeholder="https://youtube.com/watch?v=... или vk.com/video... или rutube.ru/video/..." value={exVideoUrl} onChange={e => { setExVideoUrl(e.target.value); setExVideoError(''); }} />
                    <input style={{ ...s.input, marginTop: 6 }} placeholder="Название (необязательно)" value={exVideoTitle} onChange={e => setExVideoTitle(e.target.value)} />
                    {exVideoError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 6 }}>{exVideoError}</div>}
                    <button style={{ ...s.btn, ...s.btnGray, marginTop: 4 }} onClick={() => {
                      const parsed = parseVideoUrl(exVideoUrl);
                      if (!parsed) { setExVideoError('Не удалось распознать ссылку, проверь формат'); return; }
                      setExVideos(v => [...v, { url: exVideoUrl.trim(), title: exVideoTitle.trim(), platform: parsed.platform, embedUrl: parsed.embedUrl, thumbnailUrl: parsed.thumbnailUrl }]);
                      setExVideoUrl(''); setExVideoTitle(''); setExVideoError('');
                    }}>+ Добавить видео</button>
                  </div>
                )}
                {exVideos.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: `1px solid ${A.border}` }}>
                    <div style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                      <img src={v.thumbnailUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || v.url}</div>
                      <div style={{ fontSize: 11, color: A.gold }}>{v.platform === 'youtube' ? 'YouTube' : v.platform === 'vk' ? 'VK Видео' : 'Rutube'}</div>
                    </div>
                    <button onClick={() => setExVideos(vs => { const a = [...vs]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; })} disabled={i === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => setExVideos(vs => { const a = [...vs]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; })} disabled={i === exVideos.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 12, opacity: i === exVideos.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button onClick={() => setExVideos(vs => vs.filter((_, j) => j !== i))} style={{ ...s.btn, ...s.btnDanger, padding: '4px 8px', fontSize: 12 }}>✕</button>
                  </div>
                ))}

                <label style={s.label}>Телефон</label>
                <input style={s.input} placeholder="+7 999 000-00-00" value={exPhone} onChange={e => setExPhone(e.target.value)} />

                <label style={s.label}>ВКонтакте (URL)</label>
                <input style={s.input} placeholder="https://vk.com/..." value={exVkUrl} onChange={e => setExVkUrl(e.target.value)} />

                <label style={s.label}>Ссылка для записи</label>
                <input style={s.input} placeholder="https://..." value={exBooking} onChange={e => setExBooking(e.target.value)} />

                <label style={s.label}>Telegram эксперта</label>
                <input style={s.input} placeholder="https://t.me/..." value={exTelegram} onChange={e => setExTelegram(e.target.value)} />

                <label style={s.label}>Личный сайт / портфолио</label>
                <input style={s.input} placeholder="https://..." value={exWebsite} onChange={e => setExWebsite(e.target.value)} />

                <label style={s.label}>Профиль в Max</label>
                <input style={s.input} placeholder="https://..." value={exMax} onChange={e => setExMax(e.target.value)} />

                <label style={s.label}>Ключей за QR-скан</label>
                <input style={s.input} type="number" min="1" max="5" placeholder="1" value={exKeys} onChange={e => setExKeys(e.target.value)} />

                <label style={s.label}>Email владельца (для доступа к кабинету)</label>
                <input style={s.input} type="email" placeholder="expert@example.com" value={exOwnerEmail} onChange={e => setExOwnerEmail(e.target.value)} />

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

                {exError && (
                  <div style={{ background: 'rgba(230,70,70,0.15)', border: '1px solid rgba(230,70,70,0.4)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#f87171' }}>
                    ❌ {exError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveExpert} disabled={exSaving} style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: exSaving ? 0.7 : 1 }}>
                    {exSaving ? 'Сохранение...' : (editingExpert ? 'Сохранить' : 'Добавить')}
                  </button>
                  {editingExpert && (
                    <button onClick={resetExpertForm} disabled={exSaving} style={{ ...s.btn, ...s.btnGray }}>Отмена</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Список экспертов ── */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h2 style={{ ...s.h2, margin: '0 0 2px' }}>Список экспертов</h2>
                <span style={{ fontSize: 12, color: A.textSec }}>
                  {expertSearch
                    ? `${experts.filter(ex => ex.name?.toLowerCase().includes(expertSearch.toLowerCase())).length} / ${experts.length}`
                    : <>{experts.length} · <span style={{ color: experts.filter(ex => !isCheckedRecently(ex.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{experts.filter(ex => !isCheckedRecently(ex.linksCheckedAt)).length} не проверено</span></>}
                </span>
              </div>
              <button
                style={{ ...s.btn, ...s.btnPri, padding: '8px 16px', fontSize: 13 }}
                onClick={() => { resetExpertForm(); setShowExpertModal(true); }}
              >
                ➕ Добавить эксперта
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[['unverified', '⚠ Непроверенные'], ['all', 'Все']].map(([val, label]) => (
                <button key={val} onClick={() => setExpertLinksFilter(val)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${expertLinksFilter === val ? A.gold : A.border}`, background: expertLinksFilter === val ? A.goldDim : 'transparent', color: expertLinksFilter === val ? A.gold : A.textSec }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: A.inputBg, border: `1px solid ${A.inputBrd}`, borderRadius: 12, padding: '9px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: A.textSec, flexShrink: 0 }}>🔍</span>
              <input
                type="search"
                placeholder="Поиск по имени..."
                value={expertSearch}
                onChange={e => setExpertSearch(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, flex: 1, color: A.text }}
              />
              {expertSearch && <button onClick={() => setExpertSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: A.textSec, fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>}
            </div>
            {experts.length === 0 ? (
              <p style={{ color: A.textSec, fontSize: 14, margin: 0 }}>Экспертов пока нет.</p>
            ) : experts
              .filter(ex => expertLinksFilter === 'all' || !isCheckedRecently(ex.linksCheckedAt))
              .filter(ex => !expertSearch || ex.name?.toLowerCase().includes(expertSearch.toLowerCase()))
              .sort((a, b) => {
                const ta = a.linksCheckedAt?.toDate ? a.linksCheckedAt.toDate().getTime() : 0;
                const tb = b.linksCheckedAt?.toDate ? b.linksCheckedAt.toDate().getTime() : 0;
                return ta - tb;
              })
              .map(ex => {
              const isOpen = expandedExpertId === ex.id;
              const toggle = () => setExpandedExpertId(isOpen ? null : ex.id);
              const exLinks = [
                [ex.vkUrl,      '💙', 'VK'],
                [ex.bookingUrl, '📅', 'Запись'],
                [ex.telegramUrl,'✈️', 'Telegram'],
                [ex.websiteUrl, '🌐', 'Сайт'],
                [ex.maxUrl,     '⚡', 'Max'],
              ];
              const cat = EXPERT_CATEGORIES.find(c => c.id === ex.category);
              return (
                <div key={ex.id} style={{ borderBottom: `1px solid ${A.rowBrd}` }}>
                  {/* ── строка ── */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', cursor: 'pointer', userSelect: 'none' }}
                    onClick={toggle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 10, color: A.textSec, flexShrink: 0, display: 'inline-block', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                      {ex.photo
                        ? <img src={ex.photo} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: A.goldDim, border: `1px solid ${A.goldBrd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🧑‍💼</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {ex.name}
                          {ex.verified && <span style={{ fontSize: 10, color: A.blue, fontWeight: 800 }}>✓</span>}
                          {!ex.active && <span style={{ fontSize: 10, color: A.textSec }}>(неактивен)</span>}
                          {isCheckedRecently(ex.linksCheckedAt)
                            ? <span title="Ссылки проверены" style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ок</span>
                            : <span title="Ссылки не проверены" style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>⚠</span>}
                        </div>
                        <div style={{ fontSize: 11, color: A.textSec }}>
                          {cat ? `${cat.emoji} ${cat.label}` : ex.specialization}
                          {ex.tier === 'ambassador' && ' · 🌟'}
                          {(ex.avgRating ?? 0) > 0 && ` · ★ ${ex.avgRating?.toFixed(1)}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── развёрнутая панель ── */}
                  {isOpen && (
                    <div style={{ padding: '12px 0 16px 20px', borderTop: `1px solid ${A.border}` }}>
                      <div style={{ fontSize: 12, color: A.textSec, marginBottom: 8 }}>{ex.specialization}</div>

                      {/* ссылки */}
                      {exLinks.some(([url]) => url) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {exLinks.map(([url, icon, label]) => url ? (
                            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, background: A.chip, border: `1px solid ${A.border}`, color: A.text, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                              {icon} {label}
                            </a>
                          ) : (
                            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${A.border}`, color: A.textSec, fontSize: 12, opacity: 0.45 }}>
                              {icon} {label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* контакты */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, fontSize: 12, color: A.textSec }}>
                        {ex.phone      && <span>📞 {ex.phone}</span>}
                        {ex.ownerEmail && <span>📧 {ex.ownerEmail}</span>}
                        {ex.formats?.length > 0 && <span>🗂 {ex.formats.join(', ')}</span>}
                      </div>

                      <AdminQRMaterialsSection entity={ex} type="expert" />

                      {/* проверка ссылок */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: isCheckedRecently(ex.linksCheckedAt) ? 'rgba(74,222,128,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isCheckedRecently(ex.linksCheckedAt) ? 'rgba(74,222,128,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                        <span style={{ fontSize: 12, color: isCheckedRecently(ex.linksCheckedAt) ? '#4ade80' : '#f59e0b', flex: 1 }}>
                          {isCheckedRecently(ex.linksCheckedAt)
                            ? `✓ Ссылки проверены ${ex.linksCheckedAt?.toDate ? ex.linksCheckedAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}`
                            : '⚠ Ссылки не проверены (>30 дн.)'}
                        </span>
                        <button
                          style={{ ...s.btn, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', flexShrink: 0 }}
                          onClick={e => { e.stopPropagation(); markLinksChecked('experts', ex.id, setExperts); }}
                        >Проверено ✓</button>
                      </div>

                      {/* действия */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...s.btn, ...s.btnGray, fontSize: 13 }} onClick={() => startEditExpert(ex)}>✏️ Редактировать</button>
                        <button style={{ ...s.btn, ...s.btnDanger, fontSize: 13 }} onClick={() => deleteExpert(ex.id)}>🗑️ Удалить</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── ПАРТНЁРЫ ── */}
      {activeTab === 'partners' && (
        <>
          {/* ── Модалка добавления / редактирования партнёра ── */}
          {showPartnerModal && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 48px' }}
              onClick={e => { if (e.target === e.currentTarget) resetPartnerForm(); }}
            >
              <div style={{ ...s.card, width: '100%', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>{editingPartner ? `✏️ ${editingPartner.name}` : '➕ Новый партнёр'}</h2>
                  <button onClick={resetPartnerForm} style={{ background: 'none', border: 'none', color: A.textSec, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
                </div>

                <label style={s.label}>Название *</label>
                <input style={s.input} placeholder="Студия красоты SEIUNA" value={pName} onChange={e => setPName(e.target.value)} />

                <label style={s.label}>Описание</label>
                <MdEditor value={pDesc} onChange={setPDesc} placeholder="Краткое описание..." style={s.textarea} />

                <label style={s.label}>Специальное предложение для участников АПГ 🎁</label>
                <input style={s.input} placeholder="Скидка 10% на первый визит" value={pOffer} onChange={e => setPOffer(e.target.value)} />

                <label style={s.label}>Штамп-карта: посещений до награды (0 = выключено) 🎟️</label>
                <input style={s.input} type="number" min="0" max="20" placeholder="Например: 5" value={pStampTarget} onChange={e => setPStampTarget(e.target.value)} />

                <label style={s.label}>Тариф</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[{ id: 'start', label: '🌱 Старт' }, { id: 'alliance', label: '🤝 Альянс' }, { id: 'premium', label: '⭐ Премиум' }].map(t => (
                    <button key={t.id} onClick={() => setPTier(t.id)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${pTier === t.id ? A.gold : A.border}`, background: pTier === t.id ? A.goldDim : 'transparent', color: pTier === t.id ? A.gold : A.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <label style={s.label}>Категория</label>
                <select style={s.select} value={pCategory} onChange={e => setPCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>

                <label style={s.label}>Иконка</label>
                <EmojiPicker emojis={PARTNER_EMOJIS} value={pEmoji} onChange={setPEmoji} />

                <label style={s.label}>Логотип</label>
                <PhotoUpload value={pLogo} onChange={setPLogo} folder="partners" label="Загрузить логотип" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
                {pLogo && <input style={{ ...s.input, marginTop: 6 }} placeholder="или вставьте URL" value={pLogo} onChange={e => setPLogo(e.target.value)} />}

                <label style={s.label}>Фото-шапка (обложка)</label>
                <PhotoUpload value={pCoverPhoto} onChange={setPCoverPhoto} folder="partners/covers" label="Загрузить обложку" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
                {pCoverPhoto && <input style={{ ...s.input, marginTop: 6 }} placeholder="или вставьте URL" value={pCoverPhoto} onChange={e => setPCoverPhoto(e.target.value)} />}

                <label style={s.label}>Галерея (до 6 фото)</label>
                <GalleryUpload value={pGallery} onChange={setPGallery} folder="partners/gallery" max={6} theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />

                <label style={s.label}>Видео (YouTube · VK Видео · Rutube) — {pVideos.length}/5</label>
                {pVideos.length < 5 && (
                  <div style={{ marginBottom: 8 }}>
                    <input style={s.input} placeholder="https://youtube.com/watch?v=... или vk.com/video... или rutube.ru/video/..." value={pVideoUrl} onChange={e => { setPVideoUrl(e.target.value); setPVideoError(''); }} />
                    <input style={{ ...s.input, marginTop: 6 }} placeholder="Название (необязательно)" value={pVideoTitle} onChange={e => setPVideoTitle(e.target.value)} />
                    {pVideoError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 6 }}>{pVideoError}</div>}
                    <button style={{ ...s.btn, ...s.btnGray, marginTop: 4 }} onClick={() => {
                      const parsed = parseVideoUrl(pVideoUrl);
                      if (!parsed) { setPVideoError('Не удалось распознать ссылку, проверь формат'); return; }
                      setPVideos(v => [...v, { url: pVideoUrl.trim(), title: pVideoTitle.trim(), platform: parsed.platform, embedUrl: parsed.embedUrl, thumbnailUrl: parsed.thumbnailUrl }]);
                      setPVideoUrl(''); setPVideoTitle(''); setPVideoError('');
                    }}>+ Добавить видео</button>
                  </div>
                )}
                {pVideos.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: `1px solid ${A.border}` }}>
                    <div style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                      <img src={v.thumbnailUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || v.url}</div>
                      <div style={{ fontSize: 11, color: A.gold }}>{v.platform === 'youtube' ? 'YouTube' : v.platform === 'vk' ? 'VK Видео' : 'Rutube'}</div>
                    </div>
                    <button onClick={() => setPVideos(vs => { const a = [...vs]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; })} disabled={i === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => setPVideos(vs => { const a = [...vs]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; })} disabled={i === pVideos.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 12, opacity: i === pVideos.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button onClick={() => setPVideos(vs => vs.filter((_, j) => j !== i))} style={{ ...s.btn, ...s.btnDanger, padding: '4px 8px', fontSize: 12 }}>✕</button>
                  </div>
                ))}

                <label style={s.label}>Телефон</label>
                <input style={s.input} placeholder="+7 (499) 123-45-67" value={pPhone} onChange={e => setPPhone(e.target.value)} />

                <label style={s.label}>Адрес</label>
                <input style={s.input} placeholder="Зеленоград, корпус 1234" value={pAddress} onChange={e => setPAddress(e.target.value)} />

                <label style={s.label}>Координаты (для раздела "Рядом")</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...s.input, marginBottom: 0, flex: 1 }} placeholder="Широта (55.983...)" value={pLat} onChange={e => setPLat(e.target.value)} />
                  <input style={{ ...s.input, marginBottom: 0, flex: 1 }} placeholder="Долгота (37.196...)" value={pLon} onChange={e => setPLon(e.target.value)} />
                </div>
                <button
                  style={{ ...s.btn, ...s.btnGray, marginBottom: 14, opacity: pGeoLoading ? 0.6 : 1 }}
                  disabled={pGeoLoading || !pAddress.trim()}
                  onClick={async () => {
                    setPGeoLoading(true);
                    const r = await geocodeAddress(pAddress).catch(() => null);
                    if (r) { setPLat(String(r.lat)); setPLon(String(r.lon)); }
                    else alert('Не удалось определить координаты по адресу. Введите вручную.');
                    setPGeoLoading(false);
                  }}
                >
                  {pGeoLoading ? '⏳ Определяем...' : '🌍 Определить по адресу'}
                </button>

                <label style={s.label}>Часы работы</label>
                <input style={s.input} placeholder="Пн-Пт 10:00-20:00, Сб-Вс 11:00-18:00" value={pHours} onChange={e => setPHours(e.target.value)} />

                <label style={s.label}>ВКонтакте (сообщество)</label>
                <input style={s.input} placeholder="https://vk.com/..." value={pVkGroup} onChange={e => setPVkGroup(e.target.value)} />

                <label style={s.label}>Соцсеть / сайт (другие)</label>
                <input style={s.input} placeholder="https://..." value={pSocial} onChange={e => setPSocial(e.target.value)} />

                <label style={s.label}>Онлайн-запись (Yclients, Dikidi и др.)</label>
                <input style={s.input} placeholder="https://..." value={pBooking} onChange={e => setPBooking(e.target.value)} />

                <label style={s.label}>Сайт партнёра</label>
                <input style={s.input} placeholder="https://..." value={pWebsite} onChange={e => setPWebsite(e.target.value)} />

                <label style={s.label}>Telegram-сообщество (канал или чат)</label>
                <input style={s.input} placeholder="https://t.me/..." value={pTelegramCom} onChange={e => setPTelegramCom(e.target.value)} />

                <label style={s.label}>Max-сообщество</label>
                <input style={s.input} placeholder="https://..." value={pMaxCom} onChange={e => setPMaxCom(e.target.value)} />

                <div style={{ background: A.goldDim, border: `1px solid ${A.goldBrd}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
                  <label style={{ ...s.label, color: A.gold, marginBottom: 6 }}>🔑 Email владельца заведения</label>
                  <input
                    type="email"
                    style={{ ...s.input, marginBottom: 0, background: 'rgba(255,255,255,0.06)' }}
                    placeholder="owner@example.com"
                    value={pOwnerEmail}
                    onChange={e => setPOwnerEmail(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: A.gold, marginTop: 6, opacity: 0.8 }}>
                    Пользователь с этим email получит доступ к статистике своего заведения в приложении
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={savePartner}>
                    {editingPartner ? '💾 Сохранить' : '➕ Добавить'}
                  </button>
                  {editingPartner && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetPartnerForm}>Отмена</button>}
                </div>
              </div>
            </div>
          )}

          {/* ── Список партнёров ── */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h2 style={{ ...s.h2, margin: '0 0 2px' }}>Все партнёры</h2>
                <span style={{ fontSize: 12, color: A.textSec }}>
                  {partners.length} · <span style={{ color: partners.filter(p => !isCheckedRecently(p.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>
                    {partners.filter(p => !isCheckedRecently(p.linksCheckedAt)).length} не проверено
                  </span>
                </span>
              </div>
              <button
                style={{ ...s.btn, ...s.btnPri, padding: '8px 16px', fontSize: 13 }}
                onClick={() => { resetPartnerForm(); setShowPartnerModal(true); }}
              >
                ➕ Добавить партнёра
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['unverified', '⚠ Сначала непроверенные'], ['all', 'Все']].map(([val, label]) => (
                <button key={val} onClick={() => setPartnerLinksFilter(val)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${partnerLinksFilter === val ? A.gold : A.border}`, background: partnerLinksFilter === val ? A.goldDim : 'transparent', color: partnerLinksFilter === val ? A.gold : A.textSec }}>
                  {label}
                </button>
              ))}
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
              : partners
                .filter(p => partnerLinksFilter === 'all' || !isCheckedRecently(p.linksCheckedAt))
                .filter(p => !partnerSearch || p.name?.toLowerCase().includes(partnerSearch.toLowerCase()))
                .sort((a, b) => {
                  const ta = a.linksCheckedAt?.toDate ? a.linksCheckedAt.toDate().getTime() : 0;
                  const tb = b.linksCheckedAt?.toDate ? b.linksCheckedAt.toDate().getTime() : 0;
                  return ta - tb;
                })
                .map(p => {
                const isOpen = expandedPartnerId === p.id;
                const toggle = () => setExpandedPartnerId(isOpen ? null : p.id);
                const pLinks = [
                  [p.websiteUrl,            '🌐', 'Сайт'],
                  [p.bookingUrl,            '📅', 'Запись'],
                  [p.vkGroupUrl,            '💙', 'VK'],
                  [p.socialUrl,             '🔗', 'Соцсеть'],
                  [p.telegramCommunityUrl,  '✈️', 'Telegram'],
                  [p.maxCommunityUrl,       '⚡', 'Max'],
                ];
                return (
                  <div key={p.id} style={{ borderBottom: `1px solid ${A.rowBrd}` }}>
                    {/* ── строка ── */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', cursor: 'pointer', userSelect: 'none' }}
                      onClick={toggle}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: A.textSec, flexShrink: 0, transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                        {p.logoUrl
                          ? <img src={p.logoUrl} alt="" loading="lazy" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                          : <div style={{ width: 38, height: 38, borderRadius: '50%', background: A.chip, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0, border: `1px solid ${A.border}` }}>{p.emoji ?? '🏪'}</div>
                        }
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {p.name}
                            {isCheckedRecently(p.linksCheckedAt)
                              ? <span title="Ссылки проверены" style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓ок</span>
                              : <span title="Ссылки не проверены" style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>⚠</span>}
                          </div>
                          <div style={{ fontSize: 12, color: A.textSec }}>
                            {CATEGORIES.find(c => c.id === p.category)?.emoji} {CATEGORIES.find(c => c.id === p.category)?.label ?? 'Другое'}
                            {p.offer && ' · 🎁'}
                            {p.tier !== 'start' && ` · ${p.tier === 'alliance' ? '🤝' : '⭐'}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                        <button
                          title={p.featured ? 'Партнёр дня (снять)' : 'Сделать партнёром дня'}
                          style={{ ...s.btn, padding: '6px 10px', fontSize: 14, background: p.featured ? A.goldDim : A.chip, border: p.featured ? `1.5px solid ${A.gold}` : `1px solid ${A.border}` }}
                          onClick={() => setFeaturedPartner(p.featured ? null : p.id)}
                        >⭐</button>
                      </div>
                    </div>

                    {/* ── развёрнутая панель ── */}
                    {isOpen && (
                      <div style={{ padding: '12px 0 16px 20px', borderTop: `1px solid ${A.border}` }}>
                        {/* ссылки */}
                        {pLinks.some(([url]) => url) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {pLinks.map(([url, icon, label]) => url ? (
                              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, background: A.chip, border: `1px solid ${A.border}`, color: A.text, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                                {icon} {label}
                              </a>
                            ) : (
                              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${A.border}`, color: A.textSec, fontSize: 12, opacity: 0.45 }}>
                                {icon} {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* контакты */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, fontSize: 12, color: A.textSec }}>
                          {p.phone    && <span>📞 {p.phone}</span>}
                          {p.hours    && <span>🕐 {p.hours}</span>}
                          {p.address  && <span>📍 {p.address}</span>}
                          {p.ownerEmail && <span>📧 {p.ownerEmail}</span>}
                        </div>

                        <AdminQRMaterialsSection entity={p} type="partner" />

                        {/* проверка ссылок */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: isCheckedRecently(p.linksCheckedAt) ? 'rgba(74,222,128,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isCheckedRecently(p.linksCheckedAt) ? 'rgba(74,222,128,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                          <span style={{ fontSize: 12, color: isCheckedRecently(p.linksCheckedAt) ? '#4ade80' : '#f59e0b', flex: 1 }}>
                            {isCheckedRecently(p.linksCheckedAt)
                              ? `✓ Ссылки проверены ${p.linksCheckedAt?.toDate ? p.linksCheckedAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}`
                              : '⚠ Ссылки не проверены (>30 дн.)'}
                          </span>
                          <button
                            style={{ ...s.btn, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); markLinksChecked('partners', p.id, setPartners); }}
                          >Проверено ✓</button>
                        </div>

                        {/* действия */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ ...s.btn, ...s.btnGray, fontSize: 13 }} onClick={() => startEditPartner(p)}>✏️ Редактировать</button>
                          <button style={{ ...s.btn, ...s.btnDanger, fontSize: 13 }} onClick={() => deletePartner(p.id)}>🗑️ Удалить</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        </>
      )}

      {/* ── СОБЫТИЯ ── */}
      {activeTab === 'events' && (
        <>
          {showEventModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 48px' }}
              onClick={e => { if (e.target === e.currentTarget) resetEventForm(); }}>
              <div style={{ ...s.card, width: '100%', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>{editingEvent ? `✏️ ${editingEvent.title}` : '➕ Новое событие'}</h2>
                  <button onClick={resetEventForm} style={{ background: 'none', border: 'none', color: A.textSec, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
                </div>

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

            <label style={s.label}>Категория</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {CONTENT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setECategory(eCategory === cat.id ? '' : cat.id)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${eCategory === cat.id ? cat.color : A.border}`, background: eCategory === cat.id ? cat.color + '22' : 'transparent', color: eCategory === cat.id ? cat.color : A.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {cat.label}
                </button>
              ))}
            </div>

            <label style={s.label}>Обложка события</label>
            <PhotoUpload value={eCoverPhoto} onChange={setECoverPhoto} folder="events" label="Загрузить обложку" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
            {eCoverPhoto && <img src={eCoverPhoto} alt="" loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 12, marginTop: 4 }} onError={e => e.target.style.display = 'none'} />}

            <label style={s.label}>Начало события</label>
            <input style={s.input} type="datetime-local" value={eStartAt} onChange={e => setEStartAt(e.target.value)} />

            <label style={s.label}>Конец события</label>
            <input style={s.input} type="datetime-local" value={eEndAt} onChange={e => setEEndAt(e.target.value)} />

            <label style={s.label}>Место проведения</label>
            <input style={s.input} placeholder="Зеленоград, корп. 1234" value={eLocation} onChange={e => setELocation(e.target.value)} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={saveEvent}>
                    {editingEvent ? '💾 Сохранить' : '➕ Добавить'}
                  </button>
                  {editingEvent && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetEventForm}>Отмена</button>}
                </div>
              </div>
            </div>
          )}

          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h2 style={{ ...s.h2, margin: '0 0 2px' }}>Все события</h2>
                <span style={{ fontSize: 12, color: A.textSec }}>
                  {events.length} · <span style={{ color: events.filter(e => !isCheckedRecently(e.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{events.filter(e => !isCheckedRecently(e.linksCheckedAt)).length} не проверено</span>
                </span>
              </div>
              <button style={{ ...s.btn, ...s.btnPri, padding: '8px 16px', fontSize: 13 }} onClick={() => { resetEventForm(); setShowEventModal(true); }}>➕ Добавить</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['all', 'Все'], ['unverified', '⚠ Непроверенные']].map(([val, label]) => (
                <button key={val} onClick={() => setEventLinksFilter(val)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${eventLinksFilter === val ? A.gold : A.border}`, background: eventLinksFilter === val ? A.goldDim : 'transparent', color: eventLinksFilter === val ? A.gold : A.textSec }}>
                  {label}
                </button>
              ))}
            </div>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : events.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет событий</p>
              : [...events]
                .filter(e => eventLinksFilter === 'all' || !isCheckedRecently(e.linksCheckedAt))
                .sort(byPriorityDate)
                .map((e, idx, arr) => {
                const pri = e.priority ?? 0;
                const previewImage = contentImageOf(e);
                return (
                <div key={e.id} style={s.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {previewImage
                      ? <img src={previewImage} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={err => err.target.style.display = 'none'} />
                      : <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{e.emoji ?? '🎉'}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {pri >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: A.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>📌 {pri}</span>}
                        {pri > 0 && pri < 8 && <span style={{ fontSize: 9, fontWeight: 700, color: A.textSec, background: A.chip, border: `1px solid ${A.border}`, borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>↑ {pri}</span>}
                        <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.isPrivate ? '🔒 ' : ''}{e.title}</div>
                        {isCheckedRecently(e.linksCheckedAt)
                          ? <span title="Проверено" style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓</span>
                          : <span title="Не проверено" style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>⚠</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                        {e.category && (() => { const cat = CONTENT_CATEGORIES.find(c => c.id === e.category); return cat ? <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.color + '22', border: `1px solid ${cat.color}55`, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{cat.label}</span> : null; })()}
                      </div>
                      <div style={{ fontSize: 12, color: A.textSec }}>
                        {e.startAt && (() => { const d = e.startAt?.toDate ? e.startAt.toDate() : new Date(e.startAt); return `📅 ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · `; })()}
                        {!e.startAt && e.date && `📅 ${e.date} · `}
                        {e.partner && `${e.partner}`}{e.location && ` · ${e.location}`}{e.isPrivate && e.minKeys > 0 && ` · мин. ${e.minKeys} 🗝️`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <button disabled={idx === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }} onClick={() => moveItem('events', events, setEvents, e, -1)}>↑</button>
                    <button disabled={idx === arr.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === arr.length - 1 ? 0.3 : 1 }} onClick={() => moveItem('events', events, setEvents, e, 1)}>↓</button>
                    <button title="Отметить ссылки как проверенные" style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12, color: isCheckedRecently(e.linksCheckedAt) ? '#4ade80' : A.textSec }} onClick={() => markLinksChecked('events', e.id, setEvents)}>✓</button>
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
          {showNewsModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 48px' }}
              onClick={e => { if (e.target === e.currentTarget) resetNewsForm(); }}>
              <div style={{ ...s.card, width: '100%', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>{editingNews ? `✏️ ${editingNews.title}` : '➕ Новая новость'}</h2>
                  <button onClick={resetNewsForm} style={{ background: 'none', border: 'none', color: A.textSec, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
                </div>

            <label style={s.label}>Заголовок *</label>
            <input style={s.input} placeholder="Новый партнёр АПГ!" value={nTitle} onChange={e => setNTitle(e.target.value)} />

            <label style={s.label}>Текст новости *</label>
            <textarea style={{ ...s.textarea, minHeight: 120 }} placeholder="Подробный текст..." value={nText} onChange={e => setNText(e.target.value)} />

            <label style={s.label}>Эмодзи</label>
            <EmojiPicker emojis={NEWS_EMOJIS} value={nEmoji} onChange={setNEmoji} />

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

            <label style={s.label}>Категория</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {CONTENT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setNCategory(nCategory === cat.id ? '' : cat.id)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${nCategory === cat.id ? cat.color : A.border}`, background: nCategory === cat.id ? cat.color + '22' : 'transparent', color: nCategory === cat.id ? cat.color : A.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {cat.label}
                </button>
              ))}
            </div>

            <label style={s.label}>Изображение новости</label>
            <PhotoUpload value={nCoverPhoto} onChange={setNCoverPhoto} folder="news" label="Загрузить обложку" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
            {nCoverPhoto && <img src={nCoverPhoto} alt="" loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 12, marginTop: 4 }} onError={e => e.target.style.display = 'none'} />}

            <label style={s.label}>Дата публикации</label>
            <input style={s.input} type="date" value={nPublishedAt} onChange={e => setNPublishedAt(e.target.value)} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...s.btn, ...s.btnPri, flex: 1 }} onClick={saveNews}>
                    {editingNews ? '💾 Сохранить' : '➕ Опубликовать'}
                  </button>
                  {editingNews && <button style={{ ...s.btn, ...s.btnGray }} onClick={resetNewsForm}>Отмена</button>}
                </div>
              </div>
            </div>
          )}

          <EditorialNewsBoard
            news={news}
            selectedIds={selectedNewsIds}
            draggingId={draggingNewsId}
            onEdit={openQuickNewsEditor}
            onPublish={publishNews}
            onPin={pinNews}
            onDelete={deleteNews}
            onCheck={(id) => markLinksChecked('news', id, setNews)}
            onSelect={toggleNewsSelected}
            onBulkPublish={bulkPublishNews}
            onBulkDelete={bulkDeleteNews}
            onBulkPin={bulkPinNews}
            onContextMenu={(item, x, y) => setContextMenu({ item, x, y })}
            onPreview={openQuickNewsEditor}
            onSwipe={handleNewsSwipe}
            onDragStart={(item) => setDraggingNewsId(item.id)}
            onDragOver={(item, e) => e.preventDefault()}
            onDrop={(item, e) => { e.preventDefault(); handleNewsDrop(item); }}
          />

          <div style={{ display: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h2 style={{ ...s.h2, margin: '0 0 2px' }}>Быстрый список новостей</h2>
                <span style={{ fontSize: 12, color: A.textSec }}>
                  {news.length} · <span style={{ color: news.filter(n => !isCheckedRecently(n.linksCheckedAt)).length > 0 ? '#f59e0b' : '#4ade80' }}>{news.filter(n => !isCheckedRecently(n.linksCheckedAt)).length} не проверено</span>
                </span>
              </div>
              <button style={{ ...s.btn, ...s.btnPri, padding: '8px 16px', fontSize: 13 }} onClick={() => { resetNewsForm(); setShowNewsModal(true); }}>➕ Добавить</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['all', 'Все'], ['unverified', '⚠ Непроверенные']].map(([val, label]) => (
                <button key={val} onClick={() => setNewsLinksFilter(val)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${newsLinksFilter === val ? A.gold : A.border}`, background: newsLinksFilter === val ? A.goldDim : 'transparent', color: newsLinksFilter === val ? A.gold : A.textSec }}>
                  {label}
                </button>
              ))}
            </div>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : news.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет новостей</p>
              : [...news]
                .filter(n => newsLinksFilter === 'all' || !isCheckedRecently(n.linksCheckedAt))
                .sort(byPriorityDate)
                .map((item, idx, arr) => {
                const dateStr = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
                const pri = item.priority ?? 0;
                const previewImage = contentImageOf(item);
                return (
                  <div key={item.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {previewImage
                        ? <img src={previewImage} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ width: 40, height: 40, borderRadius: 12, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.emoji ?? '📢'}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {pri >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: A.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>📌 {pri}</span>}
                          {pri > 0 && pri < 8 && <span style={{ fontSize: 9, fontWeight: 700, color: A.textSec, background: A.chip, border: `1px solid ${A.border}`, borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>↑ {pri}</span>}
                            <div style={{ fontWeight: 600, fontSize: 14, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          {isCheckedRecently(item.linksCheckedAt)
                            ? <span title="Проверено" style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓</span>
                            : <span title="Не проверено" style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>⚠</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                          {item.category && (() => { const cat = CONTENT_CATEGORIES.find(c => c.id === item.category); return cat ? <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.color + '22', border: `1px solid ${cat.color}55`, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{cat.label}</span> : null; })()}
                        </div>
                        <div style={{ fontSize: 12, color: A.textSec }}>
                          {(() => { const d = item.publishedAt?.toDate ? item.publishedAt.toDate() : (item.publishedAt ? new Date(item.publishedAt) : null); return d ? `📅 ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} · ` : (dateStr ? `📅 ${dateStr} · ` : ''); })()}
                          {item.text.length > 50 ? item.text.slice(0, 50) + '…' : item.text}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button disabled={idx === 0} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }} onClick={() => moveItem('news', news, setNews, item, -1)}>↑</button>
                      <button disabled={idx === arr.length - 1} style={{ ...s.btn, ...s.btnGray, padding: '4px 8px', fontSize: 13, opacity: idx === arr.length - 1 ? 0.3 : 1 }} onClick={() => moveItem('news', news, setNews, item, 1)}>↓</button>
                      <button title="Отметить ссылки как проверенные" style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12, color: isCheckedRecently(item.linksCheckedAt) ? '#4ade80' : A.textSec }} onClick={() => markLinksChecked('news', item.id, setNews)}>✓</button>
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

      {/* ── РЕКЛАМА (БАННЕРЫ) ── */}
      {activeTab === 'banners' && (
        <>
          {/* Модалка */}
          {showBannerModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 48px' }}
              onClick={e => { if (e.target === e.currentTarget) resetBannerForm(); }}>
              <div style={{ ...s.card, width: '100%', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ ...s.h2, margin: 0 }}>{editingBanner ? '✏️ Редактировать баннер' : '➕ Новый баннер'}</h2>
                  <button onClick={resetBannerForm} style={{ background: 'none', border: 'none', color: A.textSec, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
                </div>

                <label style={s.label}>Внутреннее название *</label>
                <input style={s.input} placeholder="Баннер «Студия AspireMod» — лето 2025" value={bnTitle} onChange={e => setBnTitle(e.target.value)} />

                <label style={s.label}>Изображение баннера *</label>
                <PhotoUpload value={bnImageUrl} onChange={setBnImageUrl} folder="banners" label="Загрузить изображение" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.06)', border: A.border, textSec: A.textSec, gold: A.goldBrd }} />
                {bnImageUrl && (
                  <>
                    <img src={bnImageUrl} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 8, marginTop: 4 }} onError={e => e.target.style.display = 'none'} />
                    <input style={{ ...s.input, marginBottom: 12 }} placeholder="или вставьте URL" value={bnImageUrl} onChange={e => setBnImageUrl(e.target.value)} />
                  </>
                )}

                <label style={s.label}>Рекламодатель</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[['partner', '🤝 Партнёр'], ['expert', '🧑‍💼 Эксперт'], ['external', '🌐 Внешний']].map(([val, label]) => (
                    <button key={val} onClick={() => handleBnAdvertiserType(val)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${bnAdvertiserType === val ? A.gold : A.border}`, background: bnAdvertiserType === val ? A.goldDim : 'transparent', color: bnAdvertiserType === val ? A.gold : A.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {bnAdvertiserType === 'partner' && (
                  <>
                    <label style={s.label}>Партнёр</label>
                    <select style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }} value={bnAdvertiserId} onChange={e => { setBnAdvertiserId(e.target.value); setBnLinkValue(e.target.value); }}>
                      <option value="">— Выбрать партнёра —</option>
                      {[...partners].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </>
                )}
                {bnAdvertiserType === 'expert' && (
                  <>
                    <label style={s.label}>Эксперт</label>
                    <select style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }} value={bnAdvertiserId} onChange={e => { setBnAdvertiserId(e.target.value); setBnLinkValue(e.target.value); }}>
                      <option value="">— Выбрать эксперта —</option>
                      {[...experts].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </>
                )}
                {bnAdvertiserType === 'external' && (
                  <>
                    <label style={s.label}>Имя рекламодателя *</label>
                    <input style={s.input} placeholder="ООО «Ромашка»" value={bnAdvertiserName} onChange={e => setBnAdvertiserName(e.target.value)} />
                    <label style={s.label}>Ссылка при клике</label>
                    <input style={s.input} placeholder="https://..." value={bnLinkValue} onChange={e => setBnLinkValue(e.target.value)} />
                  </>
                )}
                {bnAdvertiserType !== 'external' && bnAdvertiserId && (
                  <div style={{ fontSize: 12, color: A.textSec, marginBottom: 14 }}>
                    🔗 Клик откроет карточку {bnAdvertiserType === 'partner' ? 'партнёра' : 'эксперта'} в приложении
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Начало показа</label>
                    <input type="date" style={{ ...s.input, marginBottom: 0 }} value={bnStartDate} onChange={e => setBnStartDate(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Конец показа</label>
                    <input type="date" style={{ ...s.input, marginBottom: 0 }} value={bnEndDate} onChange={e => setBnEndDate(e.target.value)} />
                  </div>
                </div>

                <label style={s.label}>Порядок в карусели (1–5)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <input type="number" min="1" max="5" style={{ ...s.input, width: 80, marginBottom: 0, textAlign: 'center' }}
                    value={bnPriority} onChange={e => setBnPriority(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setBnPriority(n)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${bnPriority === n ? A.gold : A.border}`, background: bnPriority === n ? A.goldDim : 'transparent', color: bnPriority === n ? A.gold : A.textSec, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: A.text, marginBottom: 16 }}>
                  <input type="checkbox" checked={bnActive} onChange={e => setBnActive(e.target.checked)} />
                  Активен (показывается в карусели)
                </label>

                {bnError && (
                  <div style={{ background: A.redDim, border: `1px solid ${A.redBrd}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#f87171' }}>
                    ❌ {bnError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveBanner} disabled={bnSaving} style={{ ...s.btn, ...s.btnPri, flex: 1, opacity: bnSaving ? 0.7 : 1 }}>
                    {bnSaving ? 'Сохранение...' : editingBanner ? '💾 Сохранить' : '➕ Создать баннер'}
                  </button>
                  {editingBanner && <button onClick={resetBannerForm} disabled={bnSaving} style={{ ...s.btn, ...s.btnGray }}>Отмена</button>}
                </div>
              </div>
            </div>
          )}

          {/* Список баннеров */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h2 style={{ ...s.h2, margin: '0 0 2px' }}>Рекламные баннеры</h2>
                <span style={{ fontSize: 12, color: A.textSec }}>
                  {banners.length} всего · <span style={{ color: '#4ade80' }}>{banners.filter(b => getBannerStatus(b) === 'active').length} активных</span>
                  {banners.filter(b => getBannerStatus(b) === 'expired').length > 0 && <> · <span style={{ color: A.textSec }}>{banners.filter(b => getBannerStatus(b) === 'expired').length} истёкших</span></>}
                </span>
              </div>
              <button style={{ ...s.btn, ...s.btnPri, padding: '8px 16px', fontSize: 13 }} onClick={() => { resetBannerForm(); setShowBannerModal(true); }}>➕ Добавить баннер</button>
            </div>

            {banners.length === 0 ? (
              <p style={{ color: A.textSec, fontSize: 14, margin: 0 }}>Баннеров пока нет.</p>
            ) : [...banners].sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1)).map(b => {
              const status = getBannerStatus(b);
              const startStr = b.startDate?.toDate ? b.startDate.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : (b.startDate ? new Date(b.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '');
              const endStr   = b.endDate?.toDate   ? b.endDate.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })   : (b.endDate ? new Date(b.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '');
              const advertiserLabel = b.advertiserType === 'partner'
                ? (partners.find(p => p.id === b.advertiserId)?.name ?? b.advertiserId)
                : b.advertiserType === 'expert'
                  ? (experts.find(e => e.id === b.advertiserId)?.name ?? b.advertiserId)
                  : (b.advertiserName ?? 'Внешний');
              const statusStyle = {
                active:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: '● Активен' },
                inactive: { color: A.textSec,  bg: A.chip,                 label: '○ Неактивен' },
                expired:  { color: '#f87171',  bg: 'rgba(248,113,113,0.1)',label: '✕ Истёк' },
              }[status];
              return (
                <div key={b.id} style={{ ...s.row, alignItems: 'flex-start', gap: 12 }}>
                  {/* Превью */}
                  {b.imageUrl
                    ? <img src={b.imageUrl} alt="" loading="lazy" style={{ width: 72, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${A.border}` }} onError={e => e.target.style.display = 'none'} />
                    : <div style={{ width: 72, height: 44, borderRadius: 8, background: A.chip, border: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📣</div>
                  }
                  {/* Инфо */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusStyle.color, background: statusStyle.bg, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{statusStyle.label}</span>
                      <span style={{ fontSize: 10, color: A.textSec, background: A.chip, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>#{b.priority ?? 1}</span>
                    </div>
                    <div style={{ fontSize: 12, color: A.textSec }}>
                      {b.advertiserType === 'partner' ? '🤝' : b.advertiserType === 'expert' ? '🧑‍💼' : '🌐'} {advertiserLabel}
                      {(startStr || endStr) && ` · ${startStr}${startStr && endStr ? ' — ' : ''}${endStr}`}
                    </div>
                  </div>
                  {/* Действия */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={{ ...s.btn, ...s.btnGray, padding: '6px 10px', fontSize: 12 }} onClick={() => startEditBanner(b)}>✏️</button>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: '6px 10px', fontSize: 12 }} onClick={() => deleteBanner(b.id)}>🗑️</button>
                  </div>
                </div>
              );
            })}
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

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ntSendPush}
                onChange={e => setNtSendPush(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#4BB34B', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: A.text }}>Отправить Web Push подписчикам</span>
            </label>

            <button style={{ ...s.btn, ...s.btnPri, width: '100%' }} onClick={sendNotif}>
              🔔 Опубликовать
            </button>

            {ntPushResult && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(75,179,75,0.12)', border: '1px solid rgba(75,179,75,0.3)', fontSize: 13, color: '#4BB34B', textAlign: 'center' }}>
                {ntPushResult}
              </div>
            )}
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>История уведомлений</h2>
            {loading ? <p style={{ color: A.textSec, textAlign: 'center' }}>Загрузка...</p>
              : notifs.length === 0 ? <p style={{ color: A.textSec, textAlign: 'center' }}>Нет уведомлений</p>
              : notifs.map(n => {
                const dateStr = n.createdAt?.toDate
                  ? n.createdAt.toDate().toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

            <label style={s.label}>Донор приза</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[{ id: 'none', label: '— Нет' }, { id: 'partner', label: '🏪 Партнёр' }, { id: 'expert', label: '🎓 Эксперт' }].map(t => (
                <button key={t.id} onClick={() => { setPrDonorType(t.id); setPrPartnerId(''); setPrExpertId(''); }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    background: prDonorType === t.id ? A.gold : 'rgba(255,255,255,0.1)',
                    color: prDonorType === t.id ? '#000' : A.text }}>
                  {t.label}
                </button>
              ))}
            </div>
            {prDonorType === 'partner' && (
              <select style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }}
                value={prPartnerId} onChange={e => setPrPartnerId(e.target.value)}>
                <option value="">— Выбрать партнёра —</option>
                {[...partners].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {prDonorType === 'expert' && (
              <select style={{ ...s.input, appearance: 'none', WebkitAppearance: 'none' }}
                value={prExpertId} onChange={e => setPrExpertId(e.target.value)}>
                <option value="">— Выбрать эксперта —</option>
                {[...experts].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru')).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}

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
                          {p.partnerId && (() => { const pt = partners.find(x => x.id === p.partnerId); return pt ? <span style={{ marginLeft: 4 }}>· 🏪 {pt.name}</span> : null; })()}
                          {p.expertId  && (() => { const ex = experts.find(x => x.id === p.expertId);  return ex ? <span style={{ marginLeft: 4 }}>· 🎓 {ex.name}</span> : null; })()}
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
                  ? c.claimedAt.toDate().toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
                            await runAdminEntityAction('prizeClaims', 'update', { id: c.id, patch: { status: 'given' } });
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
            const res = await fetch(`${API_BASE_URL}/api/activity-index`, {
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

      {/* ── РОТАЦИЯ АМБАССАДОРОВ ── */}
      {activeTab === 'rotation' && <RotationTab experts={experts} A={A} s={s} />}

      {/* ── АНАЛИТИКА ── */}
      {activeTab === 'analytics' && (
        <div>
          {/* Пересчёт публичного счётчика — всегда видна */}
          <div style={{ ...s.card, marginBottom: 12 }}>
            <h2 style={s.h2}>🔄 Публичный счётчик</h2>
            <p style={{ color: A.textSec, fontSize: 13, lineHeight: '18px', marginBottom: 12 }}>
              Пересчитывает реальное количество уникальных пользователей и визитов к партнёрам, затем обновляет счётчик на главном экране приложения.
            </p>
            <button
              style={{ ...s.btn, ...s.btnPri, width: '100%', opacity: recalcLoading ? 0.6 : 1 }}
              onClick={recalcStats}
              disabled={recalcLoading}
            >
              {recalcLoading ? '⏳ Считаем...' : '🔄 Пересчитать и синхронизировать'}
            </button>
            {recalcMsg && (
              <p style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: recalcMsg.startsWith('✅') ? '#4BB34B' : A.red }}>
                {recalcMsg}
              </p>
            )}
          </div>

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

              {/* Гостевые сессии */}
              <div style={s.card}>
                <h2 style={s.h2}>👁️ Гостевые сессии (30 дней)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Гостевых открытий', value: analytics.guestTotal,     color: A.blue },
                    { label: 'Конверсий в юзера', value: analytics.guestConverted, color: '#4BB34B' },
                    { label: 'Конверсия',          value: analytics.guestRate + '%', color: A.gold },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: A.chip, borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: `1px solid ${stat.color}25` }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: A.textSec, lineHeight: '13px', marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: A.textSec, marginBottom: 8 }}>👁️ Гостевые открытия по дням</div>
                <MiniBarChart data={analytics.guestGrowthData} labelKey="date" valueKey="count" color={A.blue} shortDate />
                <div style={{ fontSize: 12, fontWeight: 700, color: A.textSec, margin: '12px 0 8px' }}>✅ Регистрации по дням (для сравнения)</div>
                <MiniBarChart data={analytics.regGrowthData} labelKey="date" valueKey="count" color='#4BB34B' shortDate />
                <div style={{ fontSize: 11, color: A.textSec, marginTop: 8 }}>
                  Данные накапливаются с момента обновления. Конверсия — доля гостей, авторизовавшихся в той же сессии.
                </div>
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

      {activeTab === 'system' && (
        <SystemStatusPanel
          status={systemStatus}
          loading={systemStatusLoading}
          onRefresh={loadSystemStatus}
        />
      )}

      {/* ── ОШИБКИ ── */}
      {activeTab === 'errors' && (() => {
        const visible = errorLogs.filter(e => errShowResolved ? true : !e.resolved);
        return (
          <div>
            <div style={{ ...s.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ ...s.h2, margin: 0, flex: 1 }}>🐛 Ошибки клиента</h2>
                <button
                  style={{ ...s.btn, ...s.btnGray, padding: '6px 12px', fontSize: 12 }}
                  onClick={loadErrors}
                  disabled={errorsLoading}
                >
                  {errorsLoading ? '⏳' : '↻ Обновить'}
                </button>
                <button
                  style={{ ...s.btn, padding: '6px 12px', fontSize: 12, background: errShowResolved ? 'rgba(75,179,75,0.15)' : A.chip, border: `1px solid ${errShowResolved ? '#4BB34B' : A.border}`, color: errShowResolved ? '#4BB34B' : A.textSec, borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => setErrShowResolved(v => !v)}
                >
                  {errShowResolved ? '✓ Показываю решённые' : 'Скрыты решённые'}
                </button>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: A.textSec }}>
                {visible.length} из {errorLogs.length} • нерешённых: {errorLogs.filter(e => !e.resolved).length}
              </p>
            </div>

            {errorsLoading && !errorLogs.length ? (
              <div style={{ textAlign: 'center', padding: 48, color: A.textSec }}>⏳ Загружаем...</div>
            ) : visible.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', color: A.textSec }}>
                {errorLogs.length === 0 ? 'Ошибок нет' : 'Все ошибки решены'}
              </div>
            ) : visible.map(e => {
              const ts = e.timestamp?.toDate ? e.timestamp.toDate() : e.timestamp ? new Date(e.timestamp) : null;
              const tsStr = ts ? ts.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
              const isExp = errExpanded[e.id];
              return (
                <div key={e.id} style={{ ...s.card, marginBottom: 10, opacity: e.resolved ? 0.55 : 1, borderLeft: `3px solid ${e.resolved ? '#4BB34B' : A.red}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: e.resolved ? '#4BB34B' : A.red, wordBreak: 'break-word', lineHeight: '17px', marginBottom: 4 }}>
                        {e.message}
                      </div>
                      <div style={{ fontSize: 11, color: A.textSec, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                        <span>🕒 {tsStr}</span>
                        <span>📱 {e.device} / {e.browser}</span>
                        {e.userId && <span>👤 {String(e.userId).slice(0, 30)}</span>}
                        {e.version && e.version !== '?' && <span>v{e.version}</span>}
                        {e.source && <span style={{ color: A.textSec, opacity: 0.7 }}>📄 {String(e.source).slice(0, 60)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {!e.resolved && (
                        <button
                          style={{ ...s.btn, padding: '4px 10px', fontSize: 11, background: 'rgba(75,179,75,0.12)', border: `1px solid #4BB34B40`, color: '#4BB34B', borderRadius: 8, cursor: 'pointer' }}
                          onClick={() => resolveError(e.id)}
                        >
                          ✓ Решено
                        </button>
                      )}
                      {e.stack && (
                        <button
                          style={{ ...s.btn, ...s.btnGray, padding: '4px 10px', fontSize: 11 }}
                          onClick={() => setErrExpanded(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                        >
                          {isExp ? 'Скрыть' : 'Stack'}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExp && e.stack && (
                    <pre style={{ marginTop: 10, fontSize: 10, color: A.textSec, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '15px', maxHeight: 260, overflow: 'auto' }}>
                      {e.stack}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {activeTab === 'diag' && <DiagTab A={A} s={s} />}

      <div style={{ height: 32 }} />
      </div>{/* end content */}

      <AdminQuickActions
        setActiveTab={setActiveTab}
        openNews={() => { resetNewsForm(); setActiveTab('news'); setShowNewsModal(true); }}
        openPartner={() => { resetPartnerForm(); setActiveTab('partners'); setShowPartnerModal(true); }}
        openEvent={() => { resetEventForm(); setActiveTab('events'); setShowEventModal(true); }}
        openPrize={() => { resetPrizeForm(); setActiveTab('prizes'); }}
        openPush={() => setActiveTab('notifs')}
        openComments={() => { setActiveTab('comments'); loadNewsComments(); }}
      />

      <AdminQuickNewsEditor
        item={quickEditNews}
        draft={quickNewsDraft}
        saving={quickEditorSaving}
        dirty={quickEditorDirty}
        onPatch={patchQuickNewsDraft}
        onSave={saveQuickNewsEditor}
        onClose={() => { setQuickEditNews(null); setQuickNewsDraft(null); setQuickEditorDirty(false); }}
        onPublish={() => quickEditNews && publishNews(quickEditNews)}
        onDelete={() => quickEditNews && deleteNews(quickEditNews.id)}
      />

      <AdminContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onEdit={openQuickNewsEditor}
        onPublish={publishNews}
        onPin={pinNews}
        onDelete={deleteNews}
        onCheck={(id) => markLinksChecked('news', id, setNews)}
      />

      <AdminUndoBar
        undo={adminUndo}
        onRestore={restoreDeletedNews}
        onClose={() => setAdminUndo(null)}
      />

      {/* QR-модал для партнёра */}
      {qrPartner && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setQrPartner(null)}
        >
          <div
            style={{
              background: 'rgba(18,18,36,0.97)',
              backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 24, padding: 20, maxWidth: 360, width: '100%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              maxHeight: '92vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 28 }}>{qrPartner.emoji ?? '🏪'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qrPartner.name}</div>
                <div style={{ fontSize: 10, color: A.textSec }}>QR-коды партнёра</div>
              </div>
              <button onClick={() => setQrPartner(null)} style={{ ...s.btn, ...s.btnGray, padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>✕</button>
            </div>

            {/* Stats summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { icon: '📲', label: 'Серв. QR', value: qrPartner.totalVisits ?? 0 },
                { icon: '🌐', label: 'Публ. QR', value: qrPartner.publicQRScans ?? 0 },
                { icon: '👁', label: 'Просмотры', value: qrPartner.viewCount ?? 0 },
              ].map(s2 => (
                <div key={s2.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '9px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 16 }}>{s2.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: A.gold, lineHeight: 1.1 }}>{s2.value}</div>
                  <div style={{ fontSize: 9, color: A.textSec, marginTop: 2 }}>{s2.label}</div>
                </div>
              ))}
            </div>

            <PartnerQRSection partner={qrPartner} />
          </div>
        </div>
      )}
    </div>
  );
};
