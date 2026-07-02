import React, { useState, useEffect, useCallback, lazy, Suspense, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge, { isVK } from './vk.js';
import { initErrorLogger, setErrorLoggerUser } from './errorLogger.js';
import { db, auth } from './firebase';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, increment, arrayUnion,
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  where, getCountFromServer, limit,
} from 'firebase/firestore';
import { HomePanel }         from './HomePanel.jsx';
import { SplashScreen }      from './SplashScreen.jsx';

const ProfilePanel      = lazy(() => import('./ProfilePanel.jsx').then(m => ({ default: m.ProfilePanel })));
const ScannerComponent  = lazy(() => import('./Scanner.jsx'));
const PartnerPage       = lazy(() => import('./PartnerPage.jsx').then(m => ({ default: m.PartnerPage })));
const Onboarding        = lazy(() => import('./Onboarding.jsx').then(m => ({ default: m.Onboarding })));
const NotificationsPage = lazy(() => import('./NotificationsPage.jsx').then(m => ({ default: m.NotificationsPage })));

// Lazy-loaded pages (рендерят <Panel> внутри себя)
const EventsPage      = lazy(() => import('./EventsPage.jsx').then(m => ({ default: m.EventsPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage.jsx').then(m => ({ default: m.LeaderboardPage })));
const ActivityPage    = lazy(() => import('./ActivityPage.jsx').then(m => ({ default: m.ActivityPage })));
const OffersPage      = lazy(() => import('./OffersPage.jsx').then(m => ({ default: m.OffersPage })));
const TasksPage       = lazy(() => import('./TasksPage.jsx').then(m => ({ default: m.TasksPage })));
const ReferralPage    = lazy(() => import('./ReferralPage.jsx').then(m => ({ default: m.ReferralPage })));
const RewardsPage     = lazy(() => import('./RewardsPage.jsx').then(m => ({ default: m.RewardsPage })));
const MapPage              = lazy(() => import('./MapPage.jsx').then(m => ({ default: m.MapPage })));
const NearbyPage           = lazy(() => import('./NearbyPage.jsx').then(m => ({ default: m.NearbyPage })));
const PartnerCabinetPage   = lazy(() => import('./PartnerCabinetPage.jsx').then(m => ({ default: m.PartnerCabinetPage })));
const ExpertsPage          = lazy(() => import('./ExpertsPage.jsx').then(m => ({ default: m.ExpertsPage })));
const ForPartnersPage      = lazy(() => import('./ForPartnersPage.jsx').then(m => ({ default: m.ForPartnersPage })));

function formatCacheAge(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1)  return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `${hrs} ч назад`;
  return `${Math.round(hrs / 24)} д назад`;
}

initErrorLogger();

const SWIPE_TABS = ['home', 'experts', 'tasks', 'profile'];

function LazyFallback() {
  return (
    <div style={{ background: 'var(--c-bg, #0F0F1A)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--c-text-sec, rgba(240,240,240,0.35))' }}>Загрузка...</div>
    </div>
  );
}

export function UserApp() {
  const appStartTime                            = useRef(Date.now());
  const isScanningRef                           = useRef(false);
  const mountedRef                              = useRef(true);
  const claimingPrizeRef                        = useRef(false);
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
  const [experts, setExperts]                   = useState([]);
  const [platformStats, setPlatformStats]       = useState({ userCount: 0, totalScans: 0 });
  const [scannedExperts, setScannedExperts]     = useState({});
  const [events, setEvents]                     = useState([]);
  const [news, setNews]                         = useState([]);
  const [notifications, setNotifications]       = useState([]);
  const [customTasks, setCustomTasks]           = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [loggedOut, setLoggedOut]               = useState(false);
  const [showOnboarding, setShowOnboarding]     = useState(false);
  const [showScannerHint, setShowScannerHint]   = useState(false);
  const [isOnline, setIsOnline]                 = useState(navigator.onLine);
  const [recentReviews, setRecentReviews]       = useState([]);
  const [keyBurst, setKeyBurst]                 = useState(null); // { amount, id }
  const [counterPulse, setCounterPulse]         = useState(false);
  const keyBurstTimersRef                        = useRef([]);
  const [registeredEventIds, setRegisteredEventIds] = useState([]);
  const [userRank, setUserRank]                   = useState(null);
  const [ownedPartner, setOwnedPartner]           = useState(null);
  const [ownedExpert, setOwnedExpert]             = useState(null);
  const [joinedGroup, setJoinedGroup]             = useState(false);
  const [lastBonusDate, setLastBonusDate]         = useState(null);
  const [appearance, setAppearance]             = useState(() => localStorage.getItem('apg_theme') ?? 'dark');
  const [cacheTs, setCacheTs]                   = useState(() => {
    const v = localStorage.getItem('apg_cache_ts');
    return v ? Number(v) : null;
  });

  // Реферальный параметр из URL (разовое чтение при монтировании)
  const pendingRefId = useMemo(() => {
    const fromHash   = window.location.hash.match(/[#&]ref[=_](\w+)/)?.[1];
    const fromSearch = new URLSearchParams(window.location.search).get('ref');
    const fromUrl = fromHash ?? fromSearch ?? null;
    if (fromUrl) {
      localStorage.setItem('apg_pending_ref', fromUrl);
      return fromUrl;
    }
    return localStorage.getItem('apg_pending_ref') ?? null;
  }, []);

  // Deep link на конкретного партнёра: #partner_ID или ?partner=ID
  const pendingPartnerId = useMemo(() => {
    const fromHash   = window.location.hash.match(/[#&]partner[=_](\w+)/)?.[1];
    const fromSearch = new URLSearchParams(window.location.search).get('partner');
    return fromHash ?? fromSearch ?? null;
  }, []);
  const deepLinkOpened = useRef(false);

  // Deep link для скана эксперта: ?scan=expert_ID
  const pendingScanId = useMemo(() => {
    return new URLSearchParams(window.location.search).get('scan') ?? null;
  }, []);
  const scanDeepLinkTriggered = useRef(false);

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

  // Sync data-theme attribute and meta theme-color with appearance state
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appearance);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', appearance === 'light' ? '#F0F2F5' : '#0F0F1A');
  }, [appearance]);

  // VK статусбар — обновляем safe-area инсеты
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

  const handleToggleTheme = useCallback(() => {
    setAppearance(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('apg_theme', next);
      return next;
    });
  }, []);

  const T = useMemo(() => ({
    bg:           appearance === 'light' ? '#F0F2F5'               : '#0F0F1A',
    gold:         '#C9A84C',
    goldL:        '#E8C97A',
    textSec:      appearance === 'light' ? 'rgba(28,27,30,0.45)'   : 'rgba(240,240,240,0.35)',
    border:       appearance === 'light' ? 'rgba(0,0,0,0.09)'      : 'rgba(255,255,255,0.07)',
    tabbarBg:     appearance === 'light' ? 'rgba(232,234,240,0.85)' : 'rgba(12,12,30,0.55)',
    tabbarBorder: appearance === 'light' ? 'rgba(0,0,0,0.1)'       : 'rgba(255,255,255,0.14)',
  }), [appearance]);

  // Авторотация партнёра дня: admin-set имеет приоритет, иначе — по дню
  const enrichedPartners = useMemo(() => {
    if (!partners.length) return partners;
    const hasAdminFeatured = partners.some(p => p.featured);
    const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const featuredId = hasAdminFeatured ? null : partners[dayIdx % partners.length].id;
    return partners.map(p => ({
      ...p,
      featured: hasAdminFeatured ? !!p.featured : p.id === featuredId,
      visitCount: visitCounts[p.id] ?? 0,
    }));
  }, [partners, visitCounts]);

  // ─── Загрузка данных ────────────────────────────────────────────────────────

  const loadData = useCallback(async (isMounted) => {
    if (localStorage.getItem('manualLogout') === 'true') {
      if (isMounted.current) { setLoading(false); setLoggedOut(true); }
      return;
    }
    setLoading(true); setError(null); setLoggedOut(false);

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
      const cachedNt = localStorage.getItem('apg_notif_cache');
      if (cachedNt) setNotifications(JSON.parse(cachedNt));
    } catch {}

    try {
      vkBridge.send('VKWebAppInit');
      const userData = await Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]).catch(() => {
        // Email-пользователь (авторизован ранее)
        try {
          const emailRaw = localStorage.getItem('apg_email_user');
          if (emailRaw) return JSON.parse(emailRaw);
        } catch {}
        // Telegram-пользователь (авторизован через виджет ранее)
        try {
          const tgRaw = localStorage.getItem('apg_tg_user');
          if (tgRaw) return JSON.parse(tgRaw);
        } catch {}
        // Гость
        let guestId = localStorage.getItem('apg_guest_id');
        if (!guestId) {
          guestId = 'guest_' + Math.random().toString(36).slice(2, 9);
          localStorage.setItem('apg_guest_id', guestId);
        }
        return { id: guestId, first_name: 'Участник', last_name: 'АПГ', photo_200: null };
      });

      if (!isMounted.current) return;
      setUser(userData);
      setErrorLoggerUser(String(userData.id));

      const isGuest = String(userData.id).startsWith('guest_');

      // ── Гостевые сессии ────────────────────────────────────────────────────
      const GS_KEY = 'apg_gsid';
      if (isGuest) {
        let sid = sessionStorage.getItem(GS_KEY);
        if (!sid) {
          sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
          sessionStorage.setItem(GS_KEY, sid);
          setDoc(doc(db, 'guestSessions', sid), {
            timestamp: serverTimestamp(),
            date: new Date().toISOString().slice(0, 10),
            converted: false,
          }).catch(() => {});
        }
      } else {
        const sid = sessionStorage.getItem(GS_KEY);
        if (sid) {
          updateDoc(doc(db, 'guestSessions', sid), {
            converted: true,
            userId: String(userData.id),
          }).catch(() => {});
          sessionStorage.removeItem(GS_KEY);
        }
      }

      // auth_map нужно создать ДО getDoc(userRef) — isOwner() проверяет его наличие
      if (!isGuest && auth.currentUser) {
        await setDoc(
          doc(db, 'auth_map', auth.currentUser.uid),
          { vkId: String(userData.id) },
          { merge: true },
        ).catch(() => {});
      }

      console.time('apg:load-all');
      const [pSnap, eSnap, nSnap, notifSnap, reviewsSnap, ctSnap, vkPostsRaw, exSnap, statsSnap] = await Promise.all([
        (console.time('apg:partners'), getDocs(collection(db, 'partners')).then(s => (console.timeEnd('apg:partners'), s))),
        (console.time('apg:events'),   getDocs(collection(db, 'events')).then(s => (console.timeEnd('apg:events'), s))),
        getDocs(query(collection(db, 'news'),        orderBy('createdAt', 'desc'), limit(30))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'reviews'),     orderBy('createdAt', 'desc'), limit(50))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'customTasks'), orderBy('createdAt', 'asc'))).catch(() => ({ docs: [] })),
        fetch('/api/vk-news').then(r => r.json()).then(d => d.posts ?? []).catch(() => []),
        getDocs(collection(db, 'experts')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'stats', 'global')).catch(() => null),
      ]);
      console.timeEnd('apg:load-all');

      if (!isMounted.current) return;
      const freshPartners = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(freshPartners);
      try { localStorage.setItem('apg_partners_cache', JSON.stringify(freshPartners)); } catch {}
      if (userData && isMounted.current) {
        const owned = freshPartners.find(p =>
          (p.ownerEmail && userData.email && p.ownerEmail.toLowerCase() === userData.email.toLowerCase()) ||
          (p.vkOwnerId && String(p.vkOwnerId) === String(userData.id))
        );
        setOwnedPartner(owned ?? null);
      }

      const freshEvents = eSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dp = (b.priority ?? 0) - (a.priority ?? 0);
          if (dp !== 0) return dp;
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ?? 0);
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ?? 0);
          return tb - ta;
        });
      setEvents(freshEvents);
      try { localStorage.setItem('apg_events_cache', JSON.stringify(freshEvents)); } catch {}

      const firestoreNews = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const getMs = n => n.createdAt?.toDate ? n.createdAt.toDate().getTime() : (n.createdAt ?? 0);
      const freshNews = [...firestoreNews, ...vkPostsRaw]
        .sort((a, b) => {
          const dp = (b.priority ?? 0) - (a.priority ?? 0);
          return dp !== 0 ? dp : getMs(b) - getMs(a);
        })
        .slice(0, 20);
      setNews(freshNews);
      try { localStorage.setItem('apg_news_cache', JSON.stringify(freshNews)); } catch {}

      setRecentReviews(reviewsSnap.docs.slice(0, 20).map(d => ({ id: d.id, ...d.data() })));
      const freshExperts = exSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (isMounted.current) {
        setExperts(freshExperts);
        if (userData) {
          const ownedEx = freshExperts.find(e =>
            (e.ownerEmail && userData.email && e.ownerEmail.toLowerCase() === userData.email.toLowerCase()) ||
            (e.vkOwnerId && String(e.vkOwnerId) === String(userData.id))
          );
          setOwnedExpert(ownedEx ?? null);
        }
      }
      if (isMounted.current) setCustomTasks(ctSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (isMounted.current && statsSnap?.exists?.()) {
        const sd = statsSnap.data();
        setPlatformStats({ userCount: sd.userCount ?? 0, totalScans: sd.totalScans ?? 0 });
      }
      const notifList = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifList);
      try { localStorage.setItem('apg_notif_cache', JSON.stringify(notifList)); } catch {}

      const nowTs = Date.now();
      try { localStorage.setItem('apg_cache_ts', String(nowTs)); } catch {}
      if (isMounted.current) setCacheTs(nowTs);

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

      const todayKey = new Date().toLocaleDateString('sv');

      const profilePatch = {
        displayName: [userData.first_name, userData.last_name].filter(Boolean).join(' ') || null,
        firstName: userData.first_name ?? null,
        lastName:  userData.last_name  ?? null,
        photo:     userData.photo_200  ?? null,
        lastSeen:  serverTimestamp(),
      };

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Если в localStorage фото нет, но в Firestore есть — используем Firestore и не перезаписываем его null
        if (data.photo && !userData.photo_200) {
          profilePatch.photo = data.photo;
          setUser(u => ({ ...u, photo_200: data.photo }));
          if (String(userData.id).startsWith('tg_')) {
            try { localStorage.setItem('apg_tg_user', JSON.stringify({ ...userData, photo_200: data.photo })); } catch {}
          }
        }
        const keys = data.keys ?? 0;
        if (data.displayName) setUser(u => ({ ...u, displayName: data.displayName }));
        setUserKeys(keys);
        setFavorites(data.favorites ?? []);
        setScannedPartnerIds(data.scannedPartners ?? {});
        setCompletedTasks(data.completedTasks ?? []);
        setStreak(data.streak ?? 0);
        setLastScanDate(data.lastScanDate ?? null);
        setReferralCount(data.referralCount ?? 0);
        setScanDates(data.scanDates ?? []);
        setVisitCounts(data.visitCounts ?? {});
        setRegisteredEventIds(data.registeredEvents ?? []);
        setJoinedGroup(data.joinedGroup ?? false);
        setLastBonusDate(data.lastBonusDate ?? null);
        setScannedExperts(data.scannedExperts ?? {});
        if (data.notificationsEnabled) {
          localStorage.setItem('apg_notif_enabled', '1');
          setNotifEnabled(true);
        }
        if (!data.onboardingDone) setShowOnboarding(true);

        // Ранг пользователя — количество юзеров с бо́льшим числом ключей + 1
        getCountFromServer(query(collection(db, 'users'), where('keys', '>', keys)))
          .then(snap => { if (isMounted.current) setUserRank(snap.data().count + 1); })
          .catch(() => {});

        // Ежедневный бонус: +1 ключ за первый вход каждый день
        if (data.lastBonusDate !== todayKey) {
          updateDoc(userRef, { keys: increment(1), lastBonusDate: todayKey, ...profilePatch }).catch(() => {});
          setUserKeys(keys + 1);
          setTimeout(() => { if (isMounted.current) showToast('🎁 Ежедневный бонус — +1 ключ!', 'success'); }, 1500);
        } else {
          updateDoc(userRef, profilePatch).catch(() => {});
        }
      } else {
        // Новый пользователь
        const isRealUser = !String(userData.id).startsWith('guest_');
        const refId = isRealUser ? pendingRefId : null;

        const isValidRef = refId && refId !== String(userData.id);
        await setDoc(userRef, {
          keys: isValidRef ? 2 : 0,          // +2 за переход по реферальной ссылке
          favorites: [], scannedPartners: {},
          completedTasks: [], streak: 0, onboardingDone: false,
          scanDates: [], lastBonusDate: todayKey,
          referredBy: refId ?? null,
          registeredAt: serverTimestamp(),
          ...profilePatch,
        });

        if (isRealUser) {
          setDoc(doc(db, 'stats', 'global'), { userCount: increment(1) }, { merge: true }).catch(() => {});
        }

        if (isValidRef) {
          localStorage.removeItem('apg_pending_ref');
          // Начисляем рефереру +2 ключа и +1 к счётчику
          updateDoc(doc(db, 'users', refId), {
            keys: increment(2),
            referralCount: increment(1),
          }).catch(() => {});
          if (isMounted.current) {
            setTimeout(() => {
              if (isMounted.current) showToast('🎁 +2 ключа — ты пришёл по реферальной ссылке!', 'success');
            }, 1800);
          }
        }

        if (isValidRef) setUserKeys(2);
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
    await loadData(mountedRef);
  }, [loadData]);

  // ─── Onboarding ─────────────────────────────────────────────────────────────

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    setShowScannerHint(true);
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
      updateDoc(doc(db, 'partners', partnerId), { favoritesCount: increment(isAdding ? 1 : -1) }).catch(() => {});
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

  const toastTimerRef = useRef(null);
  useEffect(() => () => {
    mountedRef.current = false;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    keyBurstTimersRef.current.forEach(clearTimeout);
    keyBurstTimersRef.current = [];
    if (!keyBurst) return;
    const t1 = setTimeout(() => { if (mountedRef.current) setCounterPulse(true); }, 1200);
    const t2 = setTimeout(() => {
      if (mountedRef.current) { setCounterPulse(false); setKeyBurst(null); }
    }, 1650);
    keyBurstTimersRef.current = [t1, t2];
  }, [keyBurst?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmScan = useCallback(async (placeIdentifier) => {
    if (!user || isScanningRef.current) return;
    if (!navigator.onLine) {
      showToast('Нет интернета. Проверьте соединение и попробуйте ещё раз.');
      return;
    }
    isScanningRef.current = true;

    // Expert QR: value = "expert_<id>"
    if (typeof placeIdentifier === 'string' && placeIdentifier.startsWith('expert_')) {
      const expertId = placeIdentifier.slice(7);
      const expert = experts.find(e => e.id === expertId);
      if (!expert) {
        setIsScannerOpen(false); isScanningRef.current = false;
        showToast('QR-код эксперта не распознан');
        return;
      }
      if (scannedExperts[expertId]) {
        setIsScannerOpen(false); isScanningRef.current = false;
        showToast('Посещение уже отмечено 👋');
        return;
      }
      const keyBonus = expert.keys ?? 1;
      try {
        await updateDoc(doc(db, 'users', String(user.id)), {
          keys: increment(keyBonus),
          [`scannedExperts.${expertId}`]: true,
        });
        setUserKeys(prev => prev + keyBonus);
        setScannedExperts(prev => ({ ...prev, [expertId]: true }));
        haptic('medium');
        setKeyBurst({ amount: keyBonus, id: Date.now() });
        showToast(`+${keyBonus} ключ — консультация с ${expert.name}! 🔑`, 'success');
        addDoc(collection(db, 'users', String(user.id), 'activity'), {
          type: 'expert_scan', icon: '🧑‍💼',
          text: `Посещение эксперта: ${expert.name}`,
          ts: serverTimestamp(),
        }).catch(() => {});
      } catch (e) {
        console.error(e);
        showToast('Ошибка при сохранении. Попробуйте ещё раз.');
      } finally {
        setIsScannerOpen(false); isScanningRef.current = false;
      }
      return;
    }

    const partner = enrichedPartners.find(p => p.id === placeIdentifier || p.name === placeIdentifier);
    if (!partner) {
      setIsScannerOpen(false);
      isScanningRef.current = false;
      showToast('QR-код не распознан. Попробуйте ещё раз.');
      return;
    }

    const alreadyHasKey   = !!scannedPartnerIds[partner.id];
    const todayKey        = new Date().toLocaleDateString('sv');
    const alreadyToday    = lastScanDate === todayKey;

    // Ключ за этого партнёра уже получен И сегодня уже отмечались — ничего не делаем
    if (alreadyHasKey && alreadyToday) {
      setIsScannerOpen(false);
      isScanningRef.current = false;
      showToast('Уже отмечено сегодня 👋');
      return;
    }

    const yesterdayKey = new Date(Date.now() - 86400000).toLocaleDateString('sv');
    const newStreak  = alreadyToday ? streak : (lastScanDate === yesterdayKey ? streak + 1 : 1);
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
      updateDoc(doc(db, 'partners', partner.id), { totalVisits: increment(1) }).catch(() => {});
      setDoc(doc(db, 'stats', 'global'), { totalScans: increment(1) }, { merge: true }).catch(() => {});
      // Пишем событие скана для расчёта activityIndex
      addDoc(collection(db, 'scans'), {
        partnerId: partner.id,
        userId:    String(user.id),
        isNew:     !alreadyHasKey,
        monthKey:  todayKey.slice(0, 7),
        scannedAt: serverTimestamp(),
      }).catch(() => {});
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
        setToast({ msg: `+${keyBonus} ключ${bonusText} — ${partner.name}! 🔑`, type: 'success', sharePartner: partner });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4500);
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
  }, [user, enrichedPartners, experts, lastScanDate, streak, scannedPartnerIds, scannedExperts, scanDates, haptic, showToast]);

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const handlePartnerUpdate = useCallback((partnerId, updates) => {
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, ...updates } : p));
    setActivePartner(prev => prev?.id === partnerId ? { ...prev, ...updates } : prev);
  }, []);

  const openPartner = useCallback((partner) => {
    setActivePartner(partner);
    setActivePanel('partner');
  }, []);

  // Открываем партнёра из deep link — после того как openPartner объявлен
  useEffect(() => {
    if (!pendingPartnerId || !partners.length || deepLinkOpened.current) return;
    deepLinkOpened.current = true;
    const p = partners.find(p => p.id === pendingPartnerId);
    if (p) {
      openPartner(p);
    } else {
      showToast('🔍 Партнёр не найден');
    }
  }, [pendingPartnerId, partners, openPartner, showToast]);

  // Авто-скан эксперта из deep link ?scan=expert_ID
  useEffect(() => {
    if (!pendingScanId || !user || !experts.length || scanDeepLinkTriggered.current) return;
    if (!pendingScanId.startsWith('expert_')) return;
    scanDeepLinkTriggered.current = true;
    handleConfirmScan(pendingScanId);
  }, [pendingScanId, user, experts, handleConfirmScan]);

  // ─── Задания ────────────────────────────────────────────────────────────────

  const handleClaim = useCallback(async (taskId, reward) => {
    if (!user) return;
    let captured;
    setCompletedTasks(prev => { captured = [...prev, taskId]; return captured; });
    setUserKeys(prev => prev + reward);
    try {
      const uid = String(user.id);
      await updateDoc(doc(db, 'users', uid), { completedTasks: captured, keys: increment(reward) });
      addDoc(collection(db, 'users', uid, 'activity'), {
        type: 'task', icon: '✅',
        text: `Задание выполнено: +${reward} ключей`,
        ts: serverTimestamp(),
      }).catch(() => {});
    } catch (e) {
      console.error(e);
      setCompletedTasks(prev => prev.filter(id => id !== taskId));
      setUserKeys(prev => prev - reward);
      showToast('Ошибка при сохранении. Попробуйте ещё раз.');
    }
  }, [user, showToast]);

  const handlePrizeClaim = useCallback(async (prize) => {
    if (!user || !prize) return false;
    if (userKeys < prize.cost) return false;
    if (claimingPrizeRef.current) return false;
    claimingPrizeRef.current = true;
    try {
      if (prize.stock !== null && prize.stock !== undefined) {
        const fresh = await getDoc(doc(db, 'prizes', prize.id));
        if ((fresh.data()?.stock ?? 0) <= 0) {
          showToast('Приз уже разобрали 😔');
          claimingPrizeRef.current = false;
          return false;
        }
      }
    } catch {}
    setUserKeys(prev => prev - prize.cost); // оптимистичное списание
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
      const uid = String(user.id);
      addDoc(collection(db, 'users', uid, 'activity'), {
        type: 'prize', icon: prize.emoji ?? '🎁',
        text: `Приз получен: ${prize.name} (−${prize.cost} 🗝️)`,
        ts: serverTimestamp(),
      }).catch(() => {});
      addDoc(collection(db, 'prizeClaims'), {
        userId: uid, userName: user.first_name ?? '',
        prizeId: prize.id, prizeName: prize.name,
        prizeEmoji: prize.emoji ?? '🎁', cost: prize.cost,
        status: 'pending', claimedAt: serverTimestamp(),
      }).catch(() => {});
      return true;
    } catch (e) {
      console.error(e);
      setUserKeys(prev => prev + prize.cost); // откат при ошибке
      return false;
    } finally {
      claimingPrizeRef.current = false;
    }
  }, [user, userKeys]);

  const handleRaffleEnter = useCallback(async (prize, ticketCount) => {
    if (!user || !prize) return false;
    const cost = ticketCount * (prize.ticketCost ?? 0);
    if (userKeys < cost) return false;
    if (claimingPrizeRef.current) return false;
    claimingPrizeRef.current = true;
    setUserKeys(prev => prev - cost);
    try {
      const uid = String(user.id);
      const userName = user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Участник АПГ';
      await Promise.all([
        updateDoc(doc(db, 'users', uid), { keys: increment(-cost) }),
        setDoc(doc(db, 'raffleEntries', `${prize.id}_${uid}`), {
          prizeId: prize.id, userId: uid, userName,
          userPhoto: user.photo_200 ?? null,
          ticketsCount: increment(ticketCount),
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ]);
      addDoc(collection(db, 'users', uid, 'activity'), {
        type: 'raffle_enter', icon: prize.emoji ?? '🎟️',
        text: `Участие в розыгрыше: ${prize.name} (−${cost} 🗝️)`,
        ts: serverTimestamp(),
      }).catch(() => {});
      return true;
    } catch (e) {
      console.error(e);
      setUserKeys(prev => prev + cost);
      return false;
    } finally {
      claimingPrizeRef.current = false;
    }
  }, [user, userKeys]);

  // ─── Мероприятия ────────────────────────────────────────────────────────────

  const handleEventRegister = useCallback(async (event) => {
    if (!user || String(user.id).startsWith('guest_')) return;
    const userId = String(user.id);
    const eventId = event.id;
    const isRegistered = registeredEventIds.includes(eventId);

    if (isRegistered) {
      const next = registeredEventIds.filter(id => id !== eventId);
      setRegisteredEventIds(next);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: Math.max(0, (e.registeredCount ?? 1) - 1) } : e));
      try {
        await Promise.all([
          deleteDoc(doc(db, 'events', eventId, 'registrations', userId)),
          updateDoc(doc(db, 'users', userId), { registeredEvents: next }),
          updateDoc(doc(db, 'events', eventId), { registeredCount: increment(-1) }),
        ]);
      } catch (e) {
        console.error(e);
        setRegisteredEventIds(prev => [...prev, eventId]);
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: (e.registeredCount ?? 0) + 1 } : e));
      }
    } else {
      if (event.isPrivate && userKeys < (event.minKeys ?? 0)) {
        showToast(`Нужно ещё ${(event.minKeys ?? 0) - userKeys} ключей для этого мероприятия`);
        return;
      }
      if (event.maxParticipants > 0 && (event.registeredCount ?? 0) >= event.maxParticipants) {
        showToast('Все места уже заняты');
        return;
      }
      const next = [...registeredEventIds, eventId];
      setRegisteredEventIds(next);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: (e.registeredCount ?? 0) + 1 } : e));
      try {
        await Promise.all([
          setDoc(doc(db, 'events', eventId, 'registrations', userId), {
            userId,
            userName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
            userPhoto: user.photo_200 ?? null,
            registeredAt: serverTimestamp(),
          }),
          updateDoc(doc(db, 'users', userId), { registeredEvents: next }),
          updateDoc(doc(db, 'events', eventId), { registeredCount: increment(1) }),
        ]);
        showToast(`✓ Вы записаны: ${event.title}!`, 'success');
      } catch (e) {
        console.error(e);
        setRegisteredEventIds(prev => prev.filter(id => id !== eventId));
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: Math.max(0, (e.registeredCount ?? 1) - 1) } : e));
      }
    }
  }, [user, userKeys, registeredEventIds, setEvents, showToast]);

  // ─── Профиль ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    localStorage.setItem('manualLogout', 'true');
    localStorage.removeItem('apg_tg_user');
    localStorage.removeItem('apg_email_user');
    localStorage.removeItem('apg_guest_id');
    localStorage.removeItem('apg_web_user');
    localStorage.removeItem('apg_notif_enabled');
    try { await signOut(auth); } catch {}
    window.location.reload();
  }, []);

  const handleLoginAfterLogout = useCallback(() => {
    localStorage.removeItem('manualLogout');
    window.location.reload();
  }, []);

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

  const VAPID_KEY = 'BAWMFhQ-O6D25-j9s7I_y4kcNDfUMcnqHAdvDoFn-wY4GrMGrgB0I0tU_aPz_7jcr6X0vbkSs0Q1T6UsuyHR8r0';

  const requestWebPushPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      showToast('❌ Push не поддерживается в этом браузере', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('❌ Разрешение не получено', 'error');
        return;
      }
      const { getToken }              = await import('firebase/messaging');
      const { getMessagingIfSupported } = await import('./firebase');
      const msg = await getMessagingIfSupported();
      if (!msg) { showToast('❌ Push не поддерживается', 'error'); return; }

      const swReg = await (window.__swRegPromise ?? navigator.serviceWorker.ready);
      const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

      if (token && user?.id) {
        await updateDoc(doc(db, 'users', String(user.id)), {
          fcmTokens: arrayUnion(token),
          notificationProvider: 'webpush',
          notificationsEnabled: true,
        });
      }
      localStorage.setItem('apg_notif_enabled', '1');
      setNotifEnabled(true);
      showToast('🔔 Уведомления включены!', 'success');
    } catch (e) {
      console.error('WebPush error:', e);
      showToast('❌ Не удалось включить уведомления', 'error');
    }
  }, [user, showToast]);

  // Уведомления в foreground (приложение открыто)
  useEffect(() => {
    if (isVK()) return;
    let unsub = () => {};
    (async () => {
      try {
        const { onMessage }             = await import('firebase/messaging');
        const { getMessagingIfSupported } = await import('./firebase');
        const msg = await getMessagingIfSupported();
        if (!msg) return;
        unsub = onMessage(msg, payload => {
          const title = payload.notification?.title ?? 'АПГ';
          const body  = payload.notification?.body  ?? '';
          showToast(`🔔 ${title}${body ? ': ' + body : ''}`);
        });
      } catch {}
    })();
    return () => unsub();
  }, [showToast]);

  const handleEnableNotifications = useCallback(() => {
    const uid = user ? String(user.id) : null;

    if (isVK()) {
      localStorage.setItem('apg_notif_enabled', '1');
      setNotifEnabled(true);
      if (uid) updateDoc(doc(db, 'users', uid), {
        notificationsEnabled: true, notificationProvider: 'vk',
      }).catch(() => {});
      showToast('🔔 Уведомления включены!', 'success');
      vkBridge.send('VKWebAppAllowNotifications').catch(() => {});
      return;
    }

    // Web / PWA — FCM Web Push (включая Telegram-пользователей)
    requestWebPushPermission();
  }, [user, showToast, requestWebPushPermission]);

  const VK_GROUP_ID = 229980067;
  const handleJoinGroup = useCallback(async () => {
    try {
      await vkBridge.send('VKWebAppJoinGroup', { group_id: VK_GROUP_ID });
      // Успешно вступил (или уже был членом) — начисляем бонус только если ещё не получал
      if (user && !joinedGroup) {
        updateDoc(doc(db, 'users', String(user.id)), { joinedGroup: true, keys: increment(1) }).catch(() => {});
        setUserKeys(prev => prev + 1);
        showToast('🎉 +1 ключ за подписку на сообщество!', 'success');
      }
      setJoinedGroup(true);
    } catch (e) {
      if (isVK()) {
        // Пользователь отменил — не даём бонус
      } else {
        // Веб-режим: открыли группу, считаем выполненным (без бонуса)
        setJoinedGroup(true);
        if (user) updateDoc(doc(db, 'users', String(user.id)), { joinedGroup: true }).catch(() => {});
      }
    }
  }, [user, joinedGroup, showToast]);

  // ─── Навигация ──────────────────────────────────────────────────────────────

  const goPanel = useCallback((id) => setActivePanel(id), []);

  const lastSeenTs = (() => {
    const v = localStorage.getItem('apg_notif_seen');
    return v ? { toDate: () => new Date(Number(v)) } : null;
  })();

  // ─── TabBar ─────────────────────────────────────────────────────────────────

  const TabHomeIcon    = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z"
        fill={active ? T.gold : 'none'} stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
  const TabExpertsIcon = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7" r="3.5" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 10L17.5 11.5L20 9" stroke={active ? T.gold : T.textSec} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabTasksIcon   = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M8 12L11 15L16 9" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabProfileIcon = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M4 20C4 17 7.6 14 12 14C16.4 14 20 17 20 20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  // 5 regular tabs + center scan button (index 2)
  const TAB_PANELS = ['home', 'experts', null, 'tasks', 'profile'];
  const pillIdx    = isScannerOpen ? -1 : TAB_PANELS.indexOf(activePanel);

  const TABS = [
    { id: 'home',    label: 'Главная',  icon: TabHomeIcon },
    { id: 'experts', label: 'Эксперты', icon: TabExpertsIcon },
    { id: null,      label: 'Скан',     icon: null },
    { id: 'tasks',   label: 'Задания',  icon: TabTasksIcon },
    { id: 'profile', label: 'Профиль',  icon: TabProfileIcon },
  ];

  const tabBarEl = (
    <div style={{
      position: 'fixed', bottom: 16,
      left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448, height: 62,
      background: T.tabbarBg,
      backdropFilter: 'blur(28px) saturate(2)', WebkitBackdropFilter: 'blur(28px) saturate(2)',
      border: `1px solid ${T.tabbarBorder}`,
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
              boxShadow: isScannerOpen ? 'none' : `0 4px 18px rgba(201,168,76,0.5), 0 0 0 3.5px ${T.tabbarBg}, 0 0 0 5px rgba(201,168,76,0.25)`,
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

  if (loggedOut) {
    return (
      <ConfigProvider appearance={appearance}>
        <AdaptivityProvider>
          <AppRoot>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24, background: T.bg }}>
              <div style={{ fontSize: 56 }}>👋</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.textPri, textAlign: 'center' }}>Вы вышли из аккаунта</div>
              <div style={{ fontSize: 14, color: T.textSec, textAlign: 'center', lineHeight: 1.5 }}>Нажмите кнопку ниже, чтобы войти снова</div>
              <button
                onClick={handleLoginAfterLogout}
                style={{ width: '100%', maxWidth: 320, padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
              >
                Войти
              </button>
            </div>
          </AppRoot>
        </AdaptivityProvider>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider appearance={appearance}>
      <AdaptivityProvider>
        <AppRoot>
          <div
            style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 94, minHeight: '100vh', position: 'relative', zIndex: 1, overflowX: 'hidden' }}
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
          >

            {/* Анимация получения ключа */}
            {keyBurst && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
                <div
                  key={keyBurst.id}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    fontSize: 76, lineHeight: 1,
                    animation: 'keyBounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards, keyFlyToCounter 0.42s 0.83s ease-in forwards',
                  }}
                >
                  🔑
                </div>
                <div
                  key={`plus-${keyBurst.id}`}
                  style={{
                    position: 'absolute', top: 'calc(50% - 46px)', left: '50%',
                    fontSize: 34, fontWeight: 900, color: '#C9A84C',
                    textShadow: '0 0 28px rgba(201,168,76,0.95), 0 2px 8px rgba(0,0,0,0.5)',
                    animation: 'keyPlusFloat 0.92s 0.18s ease-out forwards',
                    opacity: 0, whiteSpace: 'nowrap',
                  }}
                >
                  +{keyBurst.amount}
                </div>
              </div>
            )}

            {/* Offline-баннер */}
            {!isOnline && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(230,70,70,0.95)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', backdropFilter: 'blur(12px)' }}>
                📵 Нет интернета{cacheTs ? ` — данные от ${formatCacheAge(cacheTs)}` : ' — данные могут быть устаревшими'}
              </div>
            )}

            <View activePanel={activePanel}>

              {/* nav= нужен View для навигации; Panel id внутри компонента — для стилей */}
              <HomePanel
                nav="home"
                counterPulse={counterPulse}
                user={user} userKeys={userKeys} favorites={favorites}
                partners={enrichedPartners} events={events} news={news}
                recentReviews={recentReviews}
                loading={loading} error={error}
                streak={streak} lastScanDate={lastScanDate}
                completedTasks={completedTasks} referralCount={referralCount}
                scannedCount={Object.keys(scannedPartnerIds).length}
                unreadCount={unreadCount}
                registeredEventIds={registeredEventIds}
                userRank={userRank}
                customTasks={customTasks}
                appearance={appearance}
                onEventRegister={handleEventRegister}
                onOpenPartner={openPartner}
                onToggleFavorite={toggleFavorite}
                onScan={() => setIsScannerOpen(true)}
                onRetry={() => loadData(mountedRef)}
                onRefresh={handleRefresh}
                onOpenEvents={() => goPanel('events')}
                onOpenTasks={() => goPanel('tasks')}
                onOpenLeaderboard={() => goPanel('leaderboard')}
                onOpenRewards={() => goPanel('rewards')}
                onOpenNotifications={openNotifications}
                joinedGroup={joinedGroup}
                onJoinGroup={handleJoinGroup}
                userCount={platformStats.userCount}
                onOpenForPartners={() => goPanel('for-partners')}
                onOpenMap={() => goPanel('map')}
                onOpenNearby={() => goPanel('nearby')}
              />

              <Panel id="partner">
                <Suspense fallback={<LazyFallback />}>
                  <PartnerPage
                    partner={activePartner ? (enrichedPartners.find(p => p.id === activePartner.id) ?? activePartner) : null}
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
                </Suspense>
              </Panel>

              {/* ProfilePanel не рендерит Panel — оборачиваем */}
              <Panel id="profile">
                <Suspense fallback={<LazyFallback />}>
                  <ProfilePanel
                    user={user} userKeys={userKeys} favorites={favorites}
                    partners={enrichedPartners} events={events}
                    registeredEventIds={registeredEventIds}
                    referralCount={referralCount}
                    streak={streak} scannedCount={Object.keys(scannedPartnerIds).length}
                    completedTasks={completedTasks} scanDates={scanDates}
                    notificationsEnabled={notifEnabled}
                    appearance={appearance}
                    onToggleTheme={handleToggleTheme}
                    onToggleFavorite={toggleFavorite}
                    onOpenPartner={openPartner}
                    onOpenActivity={() => goPanel('activity')}
                    onEnableNotifications={handleEnableNotifications}
                    onOpenReferral={() => goPanel('referral')}
                    onShare={handleShare}
                    onLogout={handleLogout}
                    onDeleteProfile={handleDeleteProfile}
                    onRaffleEnter={handleRaffleEnter}
                    lastBonusDate={lastBonusDate}
                    ownedPartner={ownedPartner}
                    onOpenPartnerCabinet={() => goPanel('partner-cabinet')}
                    onUserUpdate={(patch) => setUser(u => ({ ...u, ...patch }))}
                  />
                </Suspense>
              </Panel>

              {/* Lazy pages — Suspense обёрнут в Panel чтобы View видел nav/id */}
              <Panel id="events">
                <Suspense fallback={<LazyFallback />}>
                  <EventsPage nav="events" events={events} onBack={() => goPanel('home')} appearance={appearance} />
                </Suspense>
              </Panel>

              <Panel id="tasks">
                <Suspense fallback={<LazyFallback />}>
                  <TasksPage
                    userKeys={userKeys} favCount={favorites.length}
                    streak={streak} referralCount={referralCount}
                    scannedCount={Object.keys(scannedPartnerIds).length}
                    completedTasks={completedTasks}
                    customTasks={customTasks}
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

              <Panel id="partner-cabinet">
                <Suspense fallback={<LazyFallback />}>
                  <PartnerCabinetPage
                    partner={ownedPartner}
                    expert={ownedExpert}
                    onBack={() => goPanel('profile')}
                    onPartnerUpdate={(updated) => {
                      setPartners(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
                      setOwnedPartner(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
                    }}
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
                    onRaffleEnter={handleRaffleEnter}
                  />
                </Suspense>
              </Panel>

              <Panel id="experts">
                <Suspense fallback={<LazyFallback />}>
                  <ExpertsPage
                    nav="experts"
                    experts={experts}
                    user={user}
                    scannedExperts={scannedExperts}
                    onBack={() => goPanel('home')}
                    isActive={activePanel === 'experts'}
                  />
                </Suspense>
              </Panel>

              <Panel id="map">
                <Suspense fallback={<LazyFallback />}>
                  <MapPage partners={partners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="nearby">
                <Suspense fallback={<LazyFallback />}>
                  <NearbyPage partners={enrichedPartners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="notifications">
                <Suspense fallback={<LazyFallback />}>
                  <NotificationsPage
                    notifications={notifications}
                    notificationsEnabled={notifEnabled}
                    onEnableNotifications={handleEnableNotifications}
                    lastSeenTs={lastSeenTs}
                    userKeys={userKeys}
                    lastScanDate={lastScanDate}
                    onBack={() => goPanel('home')}
                  />
                </Suspense>
              </Panel>

              <Panel id="for-partners">
                <Suspense fallback={<LazyFallback />}>
                  <ForPartnersPage
                    userCount={platformStats.userCount}
                    partnerCount={partners.length}
                    totalScans={platformStats.totalScans}
                    onBack={() => goPanel('home')}
                  />
                </Suspense>
              </Panel>

            </View>
          </div>

          {createPortal(tabBarEl, document.body)}

          <Suspense fallback={null}>
            <ScannerComponent
              isOpen={isScannerOpen}
              onClose={() => setIsScannerOpen(false)}
              mapPlaces={partners}
              onConfirm={handleConfirmScan}
            />
          </Suspense>

          {showOnboarding && (
            <Suspense fallback={null}>
              <Onboarding onComplete={handleOnboardingComplete} />
            </Suspense>
          )}

          {showScannerHint && (
            <div
              onClick={() => setShowScannerHint(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 1500,
                background: 'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end',
                paddingBottom: 100,
              }}
            >
              {/* Текст-подсказка */}
              <div style={{
                textAlign: 'center', marginBottom: 16, padding: '0 32px',
                animation: 'fadeInUp 0.4s ease both',
              }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                  Нажми ◎, чтобы начать
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: '20px' }}>
                  Наведи камеру на QR-код у партнёра и получи первый ключ
                </div>
              </div>

              {/* Стрелка вниз */}
              <div style={{
                width: 0, height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '14px solid rgba(201,168,76,0.9)',
                marginBottom: 10,
                animation: 'bounce 1s ease-in-out infinite',
              }} />

              {/* Пульсирующее кольцо вокруг кнопки */}
              <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute', inset: -10,
                  borderRadius: '50%',
                  border: '2px solid rgba(201,168,76,0.6)',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: -22,
                  borderRadius: '50%',
                  border: '2px solid rgba(201,168,76,0.25)',
                  animation: 'pulse 1.4s ease-in-out 0.4s infinite',
                }} />
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(201,168,76,0.15)',
                  border: '2px solid rgba(201,168,76,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: '#C9A84C',
                }}>◎</div>
              </div>

              <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Нажми в любом месте, чтобы закрыть
              </div>
            </div>
          )}

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
              position: 'fixed', top: 'calc(var(--safe-top, 0px) + 12px)', left: '50%', transform: 'translateX(-50%)',
              zIndex: 10000, pointerEvents: toast.sharePartner ? 'auto' : 'none',
              background: toast.type === 'success' ? 'rgba(75,179,75,0.88)' : 'rgba(20,20,50,0.85)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(75,179,75,0.35)' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 14, padding: '10px 16px',
              color: '#F0F0F0', fontSize: 14, fontWeight: 600,
              maxWidth: 'calc(100vw - 48px)',
              animation: 'toastIn 0.25s ease',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>{toast.msg}</span>
              {toast.sharePartner && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const msg = `Только что посетил ${toast.sharePartner.name} — участника Альянса Партнёров Зеленограда! Получил ${toast.sharePartner.featured ? '2' : '1'} 🗝️\n\nПрисоединяйся: vk.com/app54601851\n#АПГ #Зеленоград`;
                      vkBridge.send('VKWebAppShowWallPostBox', {
                        message: msg,
                        attachments: 'https://vk.com/app54601851',
                      }).catch(() => {});
                      setToast(null);
                    }}
                    style={{
                      background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.4)',
                      borderRadius: 10, padding: '6px 12px', color: '#6AABEC',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 1,
                    }}
                  >
                    📝 Поделиться
                  </button>
                  <button
                    onClick={() => setToast(null)}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: '6px 10px', color: 'rgba(240,240,240,0.6)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Позже
                  </button>
                </div>
              )}
            </div>
          )}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
