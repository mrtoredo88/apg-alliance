import React, { useState, useEffect, useCallback, lazy, Suspense, useRef, useMemo } from 'react';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from './vk.js';
import { db, auth } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, increment,
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
} from 'firebase/firestore';
import ScannerComponent      from './Scanner.jsx';
import { ProfilePanel }      from './ProfilePanel.jsx';
import { HomePanel }         from './HomePanel.jsx';
import { PartnerPage }       from './PartnerPage.jsx';
import { Onboarding }        from './Onboarding.jsx';
import { NotificationsPage } from './NotificationsPage.jsx';
import { SplashScreen }      from './SplashScreen.jsx';

// Lazy-loaded pages (рендерят <Panel> внутри себя)
const EventsPage      = lazy(() => import('./EventsPage.jsx').then(m => ({ default: m.EventsPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage.jsx').then(m => ({ default: m.LeaderboardPage })));
const ActivityPage    = lazy(() => import('./ActivityPage.jsx').then(m => ({ default: m.ActivityPage })));
const OffersPage      = lazy(() => import('./OffersPage.jsx').then(m => ({ default: m.OffersPage })));
const TasksPage       = lazy(() => import('./TasksPage.jsx').then(m => ({ default: m.TasksPage })));
const ReferralPage    = lazy(() => import('./ReferralPage.jsx').then(m => ({ default: m.ReferralPage })));
const RewardsPage     = lazy(() => import('./RewardsPage.jsx').then(m => ({ default: m.RewardsPage })));
const MapPage         = lazy(() => import('./MapPage.jsx').then(m => ({ default: m.MapPage })));

const T = { bg: '#0F0F1A', gold: '#C9A84C', goldL: '#E8C97A', textSec: 'rgba(240,240,240,0.35)', border: 'rgba(255,255,255,0.07)' };

function LazyFallback() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: T.textSec }}>Загрузка...</div>
    </div>
  );
}

export function UserApp() {
  const appStartTime                            = useRef(Date.now());
  const isScanningRef                           = useRef(false);
  const [splashDone, setSplashDone]             = useState(false);
  const [toast, setToast]                       = useState(null);
  const [scanDates, setScanDates]               = useState([]);

  const [activePanel, setActivePanel]           = useState('home');
  const [activePartner, setActivePartner]       = useState(null);

  const [user, setUser]                         = useState(null);
  const [userKeys, setUserKeys]                 = useState(0);
  const [favorites, setFavorites]               = useState([]);
  const [scannedPartnerIds, setScannedPartnerIds] = useState({});
  const [completedTasks, setCompletedTasks]     = useState([]);
  const [streak, setStreak]                     = useState(0);
  const [lastScanDate, setLastScanDate]         = useState(null);
  const [referralCount, setReferralCount]       = useState(0);
  const [visitCounts, setVisitCounts]           = useState({});

  const [unreadCount, setUnreadCount]           = useState(0);
  const [notifEnabled, setNotifEnabled]         = useState(
    () => localStorage.getItem('apg_notif_enabled') === '1',
  );

  const [isScannerOpen, setIsScannerOpen]       = useState(false);
  const [partners, setPartners]                 = useState([]);
  const [events, setEvents]                     = useState([]);
  const [news, setNews]                         = useState([]);
  const [notifications, setNotifications]       = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [showOnboarding, setShowOnboarding]     = useState(false);
  const [isOnline, setIsOnline]                 = useState(navigator.onLine);
  const [recentReviews, setRecentReviews]       = useState([]);
  const [keyBurst, setKeyBurst]                 = useState(null); // { amount, id }

  // Реферальный параметр из URL (разовое чтение при монтировании)
  const pendingRefId = useMemo(() => {
    const fromHash   = window.location.hash.match(/^#ref_(\w+)/)?.[1];
    const fromSearch = new URLSearchParams(window.location.search).get('ref');
    return fromHash ?? fromSearch ?? null;
  }, []);

  const haptic = useCallback((style = 'light') => {
    vkBridge.send('VKWebAppTapticImpactOccurred', { style }).catch(() => {});
  }, []);

  // Offline/online detection
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // VK статусбар — обновляем CSS-переменную --safe-top
  useEffect(() => {
    const handler = ({ detail }) => {
      if (detail?.type === 'VKWebAppUpdateConfig') {
        const top = detail.data?.insets?.top ?? 0;
        document.documentElement.style.setProperty('--safe-top', `${top}px`);
      }
    };
    vkBridge.subscribe(handler);
    return () => vkBridge.unsubscribe(handler);
  }, []);

  // Авторотация партнёра дня: admin-set имеет приоритет, иначе — по дню
  const enrichedPartners = useMemo(() => {
    if (!partners.length) return partners;
    const hasAdminFeatured = partners.some(p => p.featured);
    if (hasAdminFeatured) return partners;
    const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const featuredId = partners[dayIdx % partners.length].id;
    return partners.map(p => ({ ...p, featured: p.id === featuredId }));
  }, [partners]);

  // ─── Загрузка данных ────────────────────────────────────────────────────────

  const loadData = useCallback(async (isMounted) => {
    setLoading(true); setError(null);

    // Анонимный вход в Firebase (нужен для Firestore Security Rules)
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch((e) => {
        console.warn('[APG] signInAnonymously failed:', e.code, e.message);
      });
    }

    // Показываем закэшированных партнёров, событий, новостей сразу (без мерцания)
    try {
      const cached = localStorage.getItem('apg_partners_cache');
      if (cached) setPartners(JSON.parse(cached));
    } catch {}
    try {
      const cachedE = localStorage.getItem('apg_events_cache');
      if (cachedE) setEvents(JSON.parse(cachedE));
    } catch {}
    try {
      const cachedN = localStorage.getItem('apg_news_cache');
      if (cachedN) setNews(JSON.parse(cachedN));
    } catch {}

    try {
      vkBridge.send('VKWebAppInit');
      const userData = await Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]).catch(() => {
        let guestId = localStorage.getItem('apg_guest_id');
        if (!guestId) {
          guestId = 'guest_' + Math.random().toString(36).slice(2, 9);
          localStorage.setItem('apg_guest_id', guestId);
        }
        return { id: guestId, first_name: 'Участник', last_name: 'АПГ', photo_200: null };
      });

      if (!isMounted.current) return;
      setUser(userData);

      const isGuest = String(userData.id).startsWith('guest_');
      // auth_map нужно создать ДО getDoc(userRef) — isOwner() проверяет его наличие
      if (!isGuest && auth.currentUser) {
        await setDoc(
          doc(db, 'auth_map', auth.currentUser.uid),
          { vkId: String(userData.id) },
          { merge: true },
        ).catch(() => {});
      }

      const [pSnap, eSnap, nSnap, notifSnap, reviewsSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
      ]);

      if (!isMounted.current) return;
      const freshPartners = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(freshPartners);
      try { localStorage.setItem('apg_partners_cache', JSON.stringify(freshPartners)); } catch {}

      const freshEvents = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(freshEvents);
      try { localStorage.setItem('apg_events_cache', JSON.stringify(freshEvents)); } catch {}

      const freshNews = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNews(freshNews);
      try { localStorage.setItem('apg_news_cache', JSON.stringify(freshNews)); } catch {}

      setRecentReviews(reviewsSnap.docs.slice(0, 20).map(d => ({ id: d.id, ...d.data() })));
      const notifList = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifList);

      const lastSeen = localStorage.getItem('apg_notif_seen');
      const lastSeenDate = lastSeen ? new Date(Number(lastSeen)) : null;
      const unread = notifList.filter(d => {
        if (!lastSeenDate) return true;
        const ts = d.createdAt;
        if (!ts) return false;
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date > lastSeenDate;
      }).length;
      setUnreadCount(unread);

      if (!isGuest) { try {
      const userRef = doc(db, 'users', String(userData.id));
      const docSnap = await getDoc(userRef);
      if (!isMounted.current) return;

      const profilePatch = {
        firstName: userData.first_name ?? null,
        lastName:  userData.last_name  ?? null,
        photo:     userData.photo_200  ?? null,
      };

      const todayKey = new Date().toISOString().slice(0, 10);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const keys = data.keys ?? 0;
        setUserKeys(keys);
        setFavorites(data.favorites ?? []);
        setScannedPartnerIds(data.scannedPartners ?? {});
        setCompletedTasks(data.completedTasks ?? []);
        setStreak(data.streak ?? 0);
        setLastScanDate(data.lastScanDate ?? null);
        setReferralCount(data.referralCount ?? 0);
        setScanDates(data.scanDates ?? []);
        setVisitCounts(data.visitCounts ?? {});
        if (!data.onboardingDone) setShowOnboarding(true);

        // Ежедневный бонус: +1 ключ за первый вход каждый день
        if (data.lastBonusDate !== todayKey) {
          updateDoc(userRef, { keys: increment(1), lastBonusDate: todayKey, ...profilePatch }).catch(() => {});
          setUserKeys(keys + 1);
          if (isMounted.current) setTimeout(() => { setToast({ msg: '🎁 Ежедневный бонус — +1 ключ!', type: 'success' }); setTimeout(() => setToast(null), 3000); }, 1500);
        } else {
          updateDoc(userRef, profilePatch).catch(() => {});
        }
      } else {
        // Новый пользователь
        const isRealUser = !String(userData.id).startsWith('guest_');
        const refId = isRealUser ? pendingRefId : null;

        await setDoc(userRef, {
          keys: refId ? 2 : 0,          // +2 за переход по реферальной ссылке
          favorites: [], scannedPartners: {},
          completedTasks: [], streak: 0, onboardingDone: false,
          scanDates: [], lastBonusDate: todayKey,
          referredBy: refId ?? null,
          ...profilePatch,
        });

        if (refId && refId !== String(userData.id)) {
          // Начисляем рефереру +2 ключа и +1 к счётчику
          updateDoc(doc(db, 'users', refId), {
            keys: increment(2),
            referralCount: increment(1),
          }).catch(() => {});
          if (isMounted.current) {
            setTimeout(() => {
              setToast({ msg: '🎁 +2 ключа — ты пришёл по реферальной ссылке!', type: 'success' });
              setTimeout(() => setToast(null), 4000);
            }, 1800);
          }
        }

        if (refId) setUserKeys(2);
        setShowOnboarding(true);
      }

      } catch (e) {
        console.warn('[APG] User data load failed:', e.code, e.message);
      }} // end if (!isGuest)
    } catch (e) {
      console.error('[APG] loadData fatal error:', e.code, e.message);
      if (isMounted.current) setError('Не удалось загрузить данные.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [pendingRefId]);

  useEffect(() => {
    const isMounted = { current: true };
    loadData(isMounted);
    return () => { isMounted.current = false; };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    const isMounted = { current: true };
    await loadData(isMounted);
  }, [loadData]);

  // ─── Onboarding ─────────────────────────────────────────────────────────────

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user) {
      try { await updateDoc(doc(db, 'users', String(user.id)), { onboardingDone: true }); }
      catch (e) { console.error(e); }
    }
  };

  // ─── Избранное ──────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback(async (partnerId) => {
    if (!user) return;
    haptic('light');
    const prev = favorites;
    const isAdding = !favorites.includes(partnerId);
    const next = isAdding
      ? [...favorites, partnerId]
      : favorites.filter(id => id !== partnerId);
    setFavorites(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { favorites: next });
      const partner = partners.find(p => p.id === partnerId);
      addDoc(collection(db, 'users', String(user.id), 'activity'), {
        type: isAdding ? 'favorite_add' : 'favorite_remove',
        icon: isAdding ? '⭐' : '✕',
        text: isAdding
          ? `Добавлено в избранное: ${partner?.name ?? partnerId}`
          : `Убрано из избранного: ${partner?.name ?? partnerId}`,
        ts: serverTimestamp(),
      }).catch(() => {});
    } catch { setFavorites(prev); }
  }, [user, favorites, partners, haptic]);

  // ─── Скан ───────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleConfirmScan = useCallback(async (placeIdentifier) => {
    if (!user || isScanningRef.current) return;
    isScanningRef.current = true;

    const partner = partners.find(p => p.id === placeIdentifier || p.name === placeIdentifier);
    if (!partner) {
      setIsScannerOpen(false);
      isScanningRef.current = false;
      return;
    }

    const alreadyHasKey   = !!scannedPartnerIds[partner.id];
    const todayKey        = new Date().toISOString().slice(0, 10);
    const alreadyToday    = lastScanDate === todayKey;

    // Ключ за этого партнёра уже получен И сегодня уже отмечались — ничего не делаем
    if (alreadyHasKey && alreadyToday) {
      setIsScannerOpen(false);
      isScanningRef.current = false;
      showToast('Уже отмечено сегодня 👋');
      return;
    }

    const newStreak  = alreadyToday ? streak : streak + 1;
    const keyBonus   = (!alreadyHasKey && partner.featured) ? 2 : 1;
    const newScanDates = scanDates.includes(todayKey)
      ? scanDates
      : [...scanDates.slice(-89), todayKey]; // храним последние 90 дат
    const newVisitCount = (visitCounts[partner.id] ?? 0) + 1;
    const updateData = {
      lastScanDate: todayKey, streak: newStreak, scanDates: newScanDates,
      [`visitCounts.${partner.id}`]: increment(1),
    };

    if (!alreadyHasKey) {
      updateData.keys = increment(keyBonus);
      updateData[`scannedPartners.${partner.id}`] = true;
    }

    try {
      await updateDoc(doc(db, 'users', String(user.id)), updateData);
      setLastScanDate(todayKey);
      setStreak(newStreak);
      setScanDates(newScanDates);
      setVisitCounts(prev => ({ ...prev, [partner.id]: newVisitCount }));
      haptic('medium');
      if (!alreadyHasKey) {
        setKeyBurst({ amount: keyBonus, id: Date.now() });
      }
      // Штамп-карта завершена
      if (partner.stampTarget > 0 && newVisitCount === partner.stampTarget) {
        setTimeout(() => showToast(`🎟️ Штамп-карта заполнена! Покажи это сотруднику ${partner.name}`, 'success'), 800);
      }
      if (!alreadyHasKey) {
        setUserKeys(prev => prev + keyBonus);
        setScannedPartnerIds(prev => ({ ...prev, [partner.id]: true }));
        const bonusText = keyBonus > 1 ? ` x${keyBonus} (партнёр дня!)` : '';
        showToast(`+${keyBonus} ключ${bonusText} — ${partner.name}! 🔑`, 'success');
        addDoc(collection(db, 'users', String(user.id), 'activity'), {
          type: 'scan', icon: keyBonus > 1 ? '⭐' : '🔑',
          text: `Посещён: ${partner.name}${keyBonus > 1 ? ' (партнёр дня × 2)' : ''}`,
          ts: serverTimestamp(),
        }).catch(() => {});
      } else {
        const days = newStreak;
        const label = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
        showToast(`Серия продолжается — ${days} ${label}! 🔥`, 'success');
        addDoc(collection(db, 'users', String(user.id), 'activity'), {
          type: 'scan', icon: '🔥',
          text: `Стрик продолжается (${partner.name}) — ${days} ${label}`,
          ts: serverTimestamp(),
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      showToast('Ошибка при сохранении. Попробуйте ещё раз.');
    } finally {
      setIsScannerOpen(false);
      isScanningRef.current = false;
    }
  }, [user, partners, lastScanDate, streak, scannedPartnerIds, scanDates, haptic, showToast]);

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const handlePartnerUpdate = useCallback((partnerId, updates) => {
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, ...updates } : p));
    setActivePartner(prev => prev?.id === partnerId ? { ...prev, ...updates } : prev);
  }, []);

  const openPartner = useCallback((partner) => {
    setActivePartner(partner);
    setActivePanel('partner');
  }, []);

  // ─── Задания ────────────────────────────────────────────────────────────────

  const handleClaim = useCallback(async (taskId, reward) => {
    if (!user) return;
    const next = [...completedTasks, taskId];
    setCompletedTasks(next);
    setUserKeys(prev => prev + reward);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), {
        completedTasks: next,
        keys: increment(reward),
      });
    } catch (e) { console.error(e); }
  }, [user, completedTasks]);

  const handlePrizeClaim = useCallback(async (prize) => {
    if (!user || !prize) return false;
    if (userKeys < prize.cost) return false;
    try {
      const batch = [];
      batch.push(updateDoc(doc(db, 'users', String(user.id)), { keys: increment(-prize.cost) }));
      batch.push(addDoc(collection(db, 'users', String(user.id), 'claims'), {
        prizeId: prize.id, prizeName: prize.name,
        prizeEmoji: prize.emoji ?? '🎁', cost: prize.cost,
        claimedAt: serverTimestamp(),
      }));
      if (prize.stock !== null && prize.stock !== undefined) {
        batch.push(updateDoc(doc(db, 'prizes', prize.id), { stock: increment(-1) }));
      }
      await Promise.all(batch);
      setUserKeys(prev => prev - prize.cost);
      return true;
    } catch (e) { console.error(e); return false; }
  }, [user, userKeys]);

  // ─── Профиль ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    setUser(null); setUserKeys(0); setFavorites([]);
    setScannedPartnerIds({}); setCompletedTasks([]); setStreak(0);
    setActivePanel('home');
    const isMounted = { current: true };
    loadData(isMounted);
  }, [loadData]);

  const handleDeleteProfile = useCallback(async () => {
    if (!user || String(user.id).startsWith('guest_')) return;
    try {
      await deleteDoc(doc(db, 'users', String(user.id)));
      handleLogout();
    } catch (e) { console.error(e); }
  }, [user, handleLogout]);

  const handleShare = useCallback(() => {
    vkBridge.send('VKWebAppShare', {
      link: 'https://vk.com/app54601851',
      text: 'Присоединяйся к АПГ — Альянсу Партнёров Зеленограда! 🔑',
    }).catch(() => {});
  }, []);

  // ─── Свайп-навигация между основными табами ─────────────────────────────────

  const SWIPE_TABS = ['home', 'offers', 'tasks', 'profile'];
  const swipeTouchX  = useRef(null);
  const swipeTouchY  = useRef(null);

  const handleSwipeStart = useCallback((e) => {
    swipeTouchX.current = e.touches[0].clientX;
    swipeTouchY.current = e.touches[0].clientY;
  }, []);

  const handleSwipeEnd = useCallback((e) => {
    if (swipeTouchX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchY.current;
    swipeTouchX.current = null;
    swipeTouchY.current = null;
    // Только горизонтальные свайпы > 90px при вертикальном сдвиге < 60px
    if (Math.abs(dx) < 90 || Math.abs(dy) > 60) return;
    const idx = SWIPE_TABS.indexOf(activePanel);
    if (idx === -1) return;          // не на основном табе
    if (dx < 0 && idx < SWIPE_TABS.length - 1) { haptic('light'); goPanel(SWIPE_TABS[idx + 1]); }
    if (dx > 0 && idx > 0)                      { haptic('light'); goPanel(SWIPE_TABS[idx - 1]); }
  }, [activePanel, haptic]);

  // ─── Уведомления ────────────────────────────────────────────────────────────

  const openNotifications = useCallback(() => {
    localStorage.setItem('apg_notif_seen', String(Date.now()));
    setUnreadCount(0);
    setActivePanel('notifications');
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    try {
      await vkBridge.send('VKWebAppAllowNotifications');
      localStorage.setItem('apg_notif_enabled', '1');
      setNotifEnabled(true);
    } catch {}
  }, []);

  // ─── Навигация ──────────────────────────────────────────────────────────────

  const goPanel = useCallback((id) => setActivePanel(id), []);

  const lastSeenTs = (() => {
    const v = localStorage.getItem('apg_notif_seen');
    return v ? { toDate: () => new Date(Number(v)) } : null;
  })();

  // ─── TabBar ─────────────────────────────────────────────────────────────────

  const TabHomeIcon    = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z"
        fill={active ? T.gold : 'none'} stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
  const TabOffersIcon  = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="20" height="14" rx="3" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M16 7V5C16 3.9 15.1 3 14 3H10C8.9 3 8 3.9 8 5V7" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M12 12V16M10 14H14" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  const TabTasksIcon   = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M8 12L11 15L16 9" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabProfileIcon = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M4 20C4 17 7.6 14 12 14C16.4 14 20 17 20 20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  const TAB_PANELS = ['home', 'offers', null, 'tasks', 'profile'];
  const pillIdx    = isScannerOpen ? -1 : TAB_PANELS.indexOf(activePanel);

  const TABS = [
    { id: 'home',    label: 'Главная', icon: TabHomeIcon },
    { id: 'offers',  label: 'Акции',   icon: TabOffersIcon },
    { id: null,      label: 'Скан',    icon: null },
    { id: 'tasks',   label: 'Задания', icon: TabTasksIcon },
    { id: 'profile', label: 'Профиль', icon: TabProfileIcon },
  ];

  const TabBar = () => (
    <div style={{
      position: 'fixed', bottom: 16,
      left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448, height: 62,
      background: 'rgba(12,12,30,0.55)',
      backdropFilter: 'blur(28px) saturate(2)', WebkitBackdropFilter: 'blur(28px) saturate(2)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 36,
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 100, overflow: 'visible',
    }}>
      {/* Скользящий pill */}
      {pillIdx >= 0 && pillIdx !== 2 && (
        <div style={{
          position: 'absolute', top: 7, height: 44,
          left: `calc(${pillIdx * 20}% + 6px)`,
          width: 'calc(20% - 12px)',
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 14,
          transition: 'left 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)',
          pointerEvents: 'none',
        }} />
      )}

      {TABS.map((tab, i) => {
        if (i === 2) return (
          <button key="scan" onClick={() => { haptic('medium'); setIsScannerOpen(true); }}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 0, position: 'relative', zIndex: 2 }}>
            <div style={{
              width: 50, height: 50, marginTop: -14, borderRadius: '50%',
              background: isScannerOpen ? 'rgba(201,168,76,0.25)' : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
              boxShadow: isScannerOpen ? 'none' : `0 4px 18px rgba(201,168,76,0.5), 0 0 0 3.5px rgba(8,8,24,0.9), 0 0 0 5px rgba(201,168,76,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#0F0F1A',
              transition: 'transform 0.2s, box-shadow 0.2s',
              transform: isScannerOpen ? 'scale(0.88)' : 'scale(1)',
            }}>◎</div>
            <span style={{ fontSize: 9, fontWeight: 700, color: isScannerOpen ? T.gold : T.textSec, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 3 }}>Скан</span>
          </button>
        );

        const isActive = activePanel === tab.id && !isScannerOpen;
        const Icon     = tab.icon;
        const hasNotif = tab.id === 'profile' && unreadCount > 0;

        return (
          <button key={tab.id}
            onClick={() => { haptic('light'); goPanel(tab.id); }}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 0, position: 'relative', zIndex: 1 }}>
            <div style={{ position: 'relative' }}>
              <Icon active={isActive} />
              {hasNotif && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#E64646', border: '1.5px solid rgba(8,8,24,0.9)' }} />
              )}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: isActive ? T.gold : T.textSec, transition: 'color 0.2s' }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ConfigProvider appearance="dark">
      <AdaptivityProvider>
        <AppRoot>
          <div
            style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 94, minHeight: '100vh', position: 'relative', zIndex: 1 }}
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
          >

            {/* Анимация получения ключа */}
            {keyBurst && (
              <div
                key={keyBurst.id}
                onAnimationEnd={() => setKeyBurst(null)}
                style={{
                  position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 9998, pointerEvents: 'none',
                  fontSize: 28, fontWeight: 900, color: '#C9A84C',
                  textShadow: '0 0 20px rgba(201,168,76,0.8)',
                  animation: 'keyFlyUp 1.1s cubic-bezier(0.2,0.8,0.4,1) forwards',
                  whiteSpace: 'nowrap',
                }}
              >
                +{keyBurst.amount} 🗝️
              </div>
            )}

            {/* Offline-баннер */}
            {!isOnline && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(230,70,70,0.95)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', backdropFilter: 'blur(12px)' }}>
                📵 Нет интернета — данные могут быть устаревшими
              </div>
            )}

            <View activePanel={activePanel}>

              {/* nav= нужен View для навигации; Panel id внутри компонента — для стилей */}
              <HomePanel
                nav="home"
                user={user} userKeys={userKeys} favorites={favorites}
                partners={enrichedPartners} events={events} news={news}
                recentReviews={recentReviews}
                loading={loading} error={error}
                streak={streak} lastScanDate={lastScanDate}
                completedTasks={completedTasks} referralCount={referralCount}
                scannedCount={Object.keys(scannedPartnerIds).length}
                unreadCount={unreadCount}
                onOpenPartner={openPartner}
                onToggleFavorite={toggleFavorite}
                onScan={() => setIsScannerOpen(true)}
                onRetry={() => { const m = { current: true }; loadData(m); }}
                onRefresh={handleRefresh}
                onOpenEvents={() => goPanel('events')}
                onOpenTasks={() => goPanel('tasks')}
                onOpenLeaderboard={() => goPanel('leaderboard')}
                onOpenRewards={() => goPanel('rewards')}
                onOpenNotifications={openNotifications}
              />

              <PartnerPage
                nav="partner"
                partner={activePartner}
                isFavorite={activePartner ? favorites.includes(activePartner.id) : false}
                onBack={() => goPanel('home')}
                onToggleFavorite={toggleFavorite}
                onOpenPartner={openPartner}
                partners={enrichedPartners}
                user={user}
                scannedPartnerIds={scannedPartnerIds}
                visitCounts={visitCounts}
                onPartnerUpdate={handlePartnerUpdate}
              />

              {/* ProfilePanel не рендерит Panel — оборачиваем */}
              <Panel id="profile">
                <ProfilePanel
                  user={user} userKeys={userKeys} favorites={favorites}
                  partners={enrichedPartners} referralCount={referralCount}
                  streak={streak} scannedCount={Object.keys(scannedPartnerIds).length}
                  completedTasks={completedTasks} scanDates={scanDates}
                  notificationsEnabled={notifEnabled}
                  onToggleFavorite={toggleFavorite}
                  onOpenPartner={openPartner}
                  onOpenActivity={() => goPanel('activity')}
                  onEnableNotifications={handleEnableNotifications}
                  onOpenReferral={() => goPanel('referral')}
                  onShare={handleShare}
                  onLogout={handleLogout}
                  onDeleteProfile={handleDeleteProfile}
                />
              </Panel>

              {/* Lazy pages — Suspense обёрнут в Panel чтобы View видел nav/id */}
              <Panel id="events">
                <Suspense fallback={<LazyFallback />}>
                  <EventsPage nav="events" events={events} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="tasks">
                <Suspense fallback={<LazyFallback />}>
                  <TasksPage
                    userKeys={userKeys} favCount={favorites.length}
                    streak={streak} referralCount={referralCount}
                    scannedCount={Object.keys(scannedPartnerIds).length}
                    completedTasks={completedTasks}
                    onBack={() => goPanel('home')}
                    onClaim={handleClaim}
                  />
                </Suspense>
              </Panel>

              <Panel id="leaderboard">
                <Suspense fallback={<LazyFallback />}>
                  <LeaderboardPage
                    nav="leaderboard"
                    userKeys={userKeys}
                    currentUserId={user?.id ? String(user.id) : null}
                    onBack={() => goPanel('home')}
                  />
                </Suspense>
              </Panel>

              <Panel id="offers">
                <Suspense fallback={<LazyFallback />}>
                  <OffersPage partners={enrichedPartners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="activity">
                <Suspense fallback={<LazyFallback />}>
                  <ActivityPage nav="activity" userId={user?.id ? String(user.id) : null} onBack={() => goPanel('profile')} />
                </Suspense>
              </Panel>

              <Panel id="referral">
                <Suspense fallback={<LazyFallback />}>
                  <ReferralPage
                    user={user} referralCount={referralCount}
                    completedTasks={completedTasks}
                    onBack={() => goPanel('profile')}
                    onShare={handleShare}
                  />
                </Suspense>
              </Panel>

              <Panel id="rewards">
                <Suspense fallback={<LazyFallback />}>
                  <RewardsPage
                    nav="rewards"
                    user={user} userKeys={userKeys}
                    onBack={() => goPanel('home')}
                    onClaim={handlePrizeClaim}
                  />
                </Suspense>
              </Panel>

              <Panel id="map">
                <Suspense fallback={<LazyFallback />}>
                  <MapPage partners={partners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <NotificationsPage
                nav="notifications"
                notifications={notifications}
                notificationsEnabled={notifEnabled}
                onEnableNotifications={handleEnableNotifications}
                lastSeenTs={lastSeenTs}
                onBack={() => goPanel('home')}
              />

            </View>
          </div>

          <TabBar />

          <ScannerComponent
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            mapPlaces={partners}
            onConfirm={handleConfirmScan}
          />

          {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

          {!splashDone && (
            <SplashScreen
              isReady={!loading}
              onDone={() => setSplashDone(true)}
              startTime={appStartTime.current}
            />
          )}

          {/* Toast-уведомления */}
          {toast && (
            <div style={{
              position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 10000, pointerEvents: 'none',
              background: toast.type === 'success' ? 'rgba(75,179,75,0.15)' : 'rgba(20,20,50,0.85)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(75,179,75,0.35)' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 14, padding: '12px 20px',
              color: '#F0F0F0', fontSize: 14, fontWeight: 600,
              whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 48px)',
              animation: 'toastIn 0.25s ease',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}>
              {toast.msg}
            </div>
          )}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
