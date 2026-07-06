import React, { useState, useEffect, useCallback, lazy, Suspense, useRef, useMemo } from 'react';
import { APP_URL, API_BASE_URL } from './constants.js';
import { createPortal } from 'react-dom';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge, { isVK } from './vk.js';
import { initErrorLogger, logError, setErrorLoggerUser } from './errorLogger.js';
import { sendDiagReport, runServiceChecks } from './diagnostics.js';
import { confirmQrScan } from './rewardApi.js';
import { db, auth, getMessagingIfSupported } from './firebase';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, increment, arrayUnion,
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  where, getCountFromServer, limit,
} from 'firebase/firestore';
import { HomePanelV2 }       from './HomePanelV2.jsx';
import { SplashScreen }      from './SplashScreen.jsx';
import { ConsentScreen, CONSENT_DOCS, CONSENT_DOCS_VERSION, LEGAL_VERSION } from './ConsentScreen.jsx';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassLoader, GlassToast } from './components/Apg2ProfileGlass.jsx';

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
const ExpertCabinetPage    = lazy(() => import('./ExpertCabinetPage.jsx').then(m => ({ default: m.ExpertCabinetPage })));
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

function isLocalHost() {
  const h = window.location.hostname;
  return h === 'localhost'
    || h === '127.0.0.1'
    || h.startsWith('192.168.')
    || h.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

async function fetchVkNewsPosts() {
  if (API_BASE_URL.includes('containers.yandexcloud.net')) return [];
  const response = await fetch(`${API_BASE_URL}/api/vk-news`);
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.posts) ? data.posts : [];
}

async function safeLoad(label, promiseFactory, fallback, timeoutMs = 6500) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(promiseFactory),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } catch (e) {
    logError(e, `UserApp.loadData.${label}`);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function hasAcceptedCurrentLegal(data) {
  return !!data?.consents?.termsAccepted
    && !!data?.consents?.privacyAccepted
    && Number(data?.consents?.legalVersion ?? data?.legalVersion ?? data?.consentLegalVersion ?? 0) >= LEGAL_VERSION;
}

function LazyFallback() {
  return (
    <div style={{ minHeight: '100svh', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: APG2_PROFILE.bg }}>
      <GlassLoader title="Загружаем" text="Подготавливаем экран АПГ." style={{ width: '100%', maxWidth: 340 }} />
    </div>
  );
}

export function UserApp() {
  const appStartTime                            = useRef(Date.now());
  const isScanningRef                           = useRef(false);
  const mountedRef                              = useRef(true);
  const claimingPrizeRef                        = useRef(false);
  const tabBarRef                               = useRef(null);
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
  const [networkError, setNetworkError]         = useState(false);
  const [reportSent, setReportSent]             = useState(false);
  const [reportSending, setReportSending]       = useState(false);
  const [loggedOut, setLoggedOut]               = useState(false);
  const [consentRequest, setConsentRequest]         = useState(null);
  const [consentSaving, setConsentSaving]       = useState(false);
  const [pendingNotificationPrompt, setPendingNotificationPrompt] = useState(false);
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
  const [appearance, setAppearance]             = useState(() => localStorage.getItem('apg_theme') ?? 'light');
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

  // Deep link на конкретного эксперта: ?expert=ID
  const pendingExpertId = useMemo(() => {
    return new URLSearchParams(window.location.search).get('expert') ?? null;
  }, []);
  const expertDeepLinkOpened = useRef(false);
  const scanDeepLinkTriggered = useRef(false);

  // Подтверждение email по ссылке из письма: ?verify_email=TOKEN
  const verifyEmailToken = useMemo(() => new URLSearchParams(window.location.search).get('verify_email'), []);

  useEffect(() => {
    if (!verifyEmailToken) return;
    fetch(`${API_BASE_URL}/api/email-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-email', token: verifyEmailToken }),
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        setUser(u => u ? { ...u, emailVerified: true } : u);
        try {
          const stored = localStorage.getItem('apg_email_user');
          if (stored) localStorage.setItem('apg_email_user', JSON.stringify({ ...JSON.parse(stored), emailVerified: true }));
        } catch {}
        showToast('✅ Email подтверждён!', 'success');
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('verify_email');
      window.history.replaceState({}, '', url.toString());
    }).catch(() => {});
  }, [verifyEmailToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLoading(true); setError(null); setNetworkError(false); setLoggedOut(false);

    const _diagT0 = performance.now();

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

    fetch('/manifest.json').then(() => {
      console.log(`[APG-DIAG] static=ok ${Math.round(performance.now() - _diagT0)}ms`);
    }).catch(() => {
      console.warn(`[APG-DIAG] static=fail ${Math.round(performance.now() - _diagT0)}ms`);
    });

    try {
    // Firebase Auth и vkBridge — параллельно
    vkBridge.send('VKWebAppInit');
    const authReady = auth.currentUser
      ? Promise.resolve().then(() => console.log('[APG-DIAG] auth=cached'))
      : Promise.race([
          signInAnonymously(auth),
          new Promise((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 1800)),
        ]).then(() => {
          console.log(`[APG-DIAG] auth=ok ${Math.round(performance.now() - _diagT0)}ms`);
        }).catch((e) => {
          console.warn(`[APG-DIAG] auth=fail ${e.code ?? e.message} ${Math.round(performance.now() - _diagT0)}ms`);
        });

    const [, userData] = await Promise.all([
      authReady,
      Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
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
      }),
    ]);

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
        setDoc(
          doc(db, 'auth_map', auth.currentUser.uid),
          { vkId: String(userData.id) },
          { merge: true },
        ).catch(() => {});
      }

      const emptySnap = { docs: [] };
      const _buildAll = () => Promise.all([
        safeLoad('partners', () => getDocs(query(collection(db, 'partners'), limit(100))), emptySnap),
        safeLoad('events', () => getDocs(query(collection(db, 'events'), limit(100))), emptySnap),
        safeLoad('news', () => getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(30))), emptySnap),
        safeLoad('notifications', () => getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))), emptySnap),
        safeLoad('reviews', () => getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(50))), emptySnap),
        safeLoad('customTasks', () => getDocs(query(collection(db, 'customTasks'), orderBy('createdAt', 'asc'), limit(50))), emptySnap),
        safeLoad('vkNews', fetchVkNewsPosts, []),
        safeLoad('experts', () => getDocs(query(collection(db, 'experts'), limit(100))), emptySnap),
        safeLoad('stats', () => getDoc(doc(db, 'stats', 'global')), null),
      ]);

      let _loadResult = null;
      for (let _attempt = 0; _attempt < 3; _attempt++) {
        try {
          console.time('apg:load-all');
          _loadResult = await Promise.race([
            _buildAll(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('load_timeout')), 9000)),
          ]);
          console.timeEnd('apg:load-all');
          console.log(`[APG-DIAG] firestore=ok attempt=${_attempt + 1} ${Math.round(performance.now() - _diagT0)}ms`);
          break;
        } catch (_e) {
          console.warn(`[APG-DIAG] firestore=fail attempt=${_attempt + 1} err=${_e.message}`);
          if (_attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, _attempt)));
          } else {
            if (isMounted.current) { setNetworkError(true); setLoading(false); }
            runServiceChecks().then(checks =>
              sendDiagReport({ checks, errorText: _e.message, userId: userData?.id })
            );
            return;
          }
        }
      }
      const [pSnap, eSnap, nSnap, notifSnap, reviewsSnap, ctSnap, vkPostsRaw, exSnap, statsSnap] = _loadResult;

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
        const needsLegalConsent = !hasAcceptedCurrentLegal(data);
        if (needsLegalConsent && isMounted.current) {
          setConsentRequest({
            user: userData,
            mode: 'gate',
            title: 'Добро пожаловать в обновлённый АПГ!',
            subtitle: 'Перед продолжением использования приложения подтвердите необходимые согласия.',
            badge: `Документы v${LEGAL_VERSION}`,
            notificationsDefault: data.notificationConsent ?? data.notificationsEnabled ?? true,
            needsOnboarding: !data.onboardingDone,
          });
        }

        // Если в localStorage фото нет, но в Firestore есть — используем Firestore и не перезаписываем его null
        if (data.photo && !userData.photo_200) {
          profilePatch.photo = data.photo;
          setUser(u => ({ ...u, photo_200: data.photo }));
          if (String(userData.id).startsWith('tg_')) {
            try { localStorage.setItem('apg_tg_user', JSON.stringify({ ...userData, photo_200: data.photo })); } catch {}
          }
        }
        const keys = data.keys ?? 0;
        setUser(u => u ? ({
          ...u,
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.emailVerified !== undefined ? { emailVerified: data.emailVerified } : {}),
          ...(data.linkedTelegram ? { linkedTelegram: data.linkedTelegram } : {}),
          ...(data.linkedEmail ? { linkedEmail: data.linkedEmail } : {}),
        }) : u);
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

        // Если email в userData не пришёл (VK/Telegram), проверяем email из Firestore.
        // Это нужно чтобы ownerEmail у партнёра/эксперта матчился даже для VK-пользователей.
        const fsEmail = (data.email || data.linkedEmail)?.trim().toLowerCase();
        if (fsEmail && isMounted.current) {
          const exByEmail = freshExperts.find(e => e.ownerEmail?.toLowerCase() === fsEmail);
          if (exByEmail) setOwnedExpert(exByEmail);
          const ptByEmail = freshPartners.find(p => p.ownerEmail?.toLowerCase() === fsEmail);
          if (ptByEmail) setOwnedPartner(ptByEmail);
        }

        if (data.notificationsEnabled) {
          localStorage.setItem('apg_notif_enabled', '1');
          setNotifEnabled(true);
        }
        if (!data.onboardingDone && !needsLegalConsent) setShowOnboarding(true);

        // Ранг пользователя — количество юзеров с бо́льшим числом ключей + 1
        getCountFromServer(query(collection(db, 'users'), where('keys', '>', keys)))
          .then(snap => { if (isMounted.current) setUserRank(snap.data().count + 1); })
          .catch(() => {});

        // Ежедневный бонус: +1 ключ за первый вход каждый день
        if (data.lastBonusDate !== todayKey) {
          updateDoc(userRef, { keys: increment(1), lastBonusDate: todayKey, ...profilePatch }).catch(() => {});
          setUserKeys(keys + 1);
          if (!needsLegalConsent) setTimeout(() => { if (isMounted.current) showToast('🎁 Ежедневный бонус — +1 ключ!', 'success'); }, 1500);
        } else {
          updateDoc(userRef, profilePatch).catch(() => {});
        }
      } else {
        // Новый пользователь
        const isRealUser = !String(userData.id).startsWith('guest_');
        const refId = isRealUser ? pendingRefId : null;

        const isValidRef = refId && refId !== String(userData.id);
        let pendingConsents = null;
        try {
          const raw = localStorage.getItem('apg_pending_consents');
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.userId === String(userData.id) && parsed?.consents?.termsAccepted && parsed?.consents?.privacyAccepted) {
            pendingConsents = parsed;
          }
        } catch {}
        await setDoc(userRef, {
          keys: isValidRef ? 2 : 0,          // +2 за переход по реферальной ссылке
          favorites: [], scannedPartners: {},
          completedTasks: [], streak: 0, onboardingDone: false,
          scanDates: [], lastBonusDate: todayKey,
          referredBy: refId ?? null,
          registeredAt: serverTimestamp(),
          ...(pendingConsents ? {
            consents: { ...pendingConsents.consents, acceptedAt: serverTimestamp() },
            consentAcceptedAt: serverTimestamp(),
            consentDocsVersion: pendingConsents.consentDocsVersion ?? CONSENT_DOCS_VERSION,
            consentLegalVersion: pendingConsents.consentLegalVersion ?? LEGAL_VERSION,
            legalVersion: pendingConsents.consentLegalVersion ?? LEGAL_VERSION,
            notificationConsent: !!pendingConsents.notificationConsent,
            ...(pendingConsents.notificationConsent ? { notificationsRequestedAt: serverTimestamp() } : {}),
          } : {}),
          ...profilePatch,
        });
        if (pendingConsents) localStorage.removeItem('apg_pending_consents');

        if (isRealUser) {
          setDoc(doc(db, 'stats', 'global'), { userCount: increment(1) }, { merge: true }).catch(() => {});
        }

        if (isValidRef) {
          localStorage.removeItem('apg_pending_ref');
          // Начисляем рефереру через Admin SDK (клиент не может писать в чужой users-doc)
          fetch(`${API_BASE_URL}/api/email-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'grant-referral', referrerId: refId, newUserId: String(userData.id) }),
          }).catch(() => {});
          if (isMounted.current) {
            setTimeout(() => {
              if (isMounted.current) showToast('🎁 +2 ключа — ты пришёл по реферальной ссылке!', 'success');
            }, 1800);
          }
        }

        if (isValidRef) setUserKeys(2);
        if (pendingConsents) {
          setShowOnboarding(true);
        } else if (isRealUser && isMounted.current) {
          setConsentRequest({
            user: userData,
            mode: 'gate',
            title: 'Добро пожаловать в обновлённый АПГ!',
            subtitle: 'Перед продолжением использования приложения подтвердите необходимые согласия.',
            badge: `Документы v${LEGAL_VERSION}`,
            notificationsDefault: true,
            needsOnboarding: true,
          });
        } else {
          setShowOnboarding(true);
        }
      }

      } catch (e) {
        console.warn('[APG] User data load failed:', e.code, e.message);
      }} // end if (!isGuest)
    } catch (e) {
      logError(e, 'UserApp.loadData.fatal');
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
      catch (e) { logError(e, 'UserApp.handleOnboardingComplete'); }
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

    // Public expert QR: value = "https://myapg.ru/?expert=<id>"
    if (typeof placeIdentifier === 'string' && placeIdentifier.includes('?expert=')) {
      try {
        const expertId = new URL(placeIdentifier).searchParams.get('expert');
        const e = experts.find(ep => ep.id === expertId);
        setIsScannerOpen(false); isScanningRef.current = false;
        if (e) {
          updateDoc(doc(db, 'experts', e.id), { publicQRScans: increment(1) }).catch(() => {});
          showToast('📲 Это публичный QR — ключи не начисляются', 'info');
        } else {
          showToast('🔍 Эксперт не найден');
        }
      } catch (e) {
        logError(e, 'UserApp.handleConfirmScan.publicExpert');
        setIsScannerOpen(false); isScanningRef.current = false;
      }
      return;
    }

    // Public partner QR: value = "https://myapg.ru/?partner=<id>"
    if (typeof placeIdentifier === 'string' && placeIdentifier.includes('?partner=')) {
      const partnerId = new URL(placeIdentifier).searchParams.get('partner');
      const p = enrichedPartners.find(ep => ep.id === partnerId);
      setIsScannerOpen(false); isScanningRef.current = false;
      if (p) {
        openPartner(p);
        showToast('📲 Это публичный QR — ключи не начисляются', 'info');
        updateDoc(doc(db, 'partners', p.id), { publicQRScans: increment(1) }).catch(() => {});
      } else {
        showToast('🔍 Партнёр не найден');
      }
      return;
    }

    const rawQrValue = typeof placeIdentifier === 'string' ? placeIdentifier.trim() : String(placeIdentifier ?? '').trim();
    const partnerByName = enrichedPartners.find(p => p.name === rawQrValue);
    const qrValue = partnerByName?.id ?? rawQrValue;

    if (qrValue.startsWith('expert_')) {
      const expertId = qrValue.slice(7);
      const expert = experts.find(e => e.id === expertId);
      if (!expert) {
        setIsScannerOpen(false); isScanningRef.current = false;
        showToast('QR-код эксперта не распознан');
        return;
      }
      const prevCount = Number(scannedExperts[expertId]) || (scannedExperts[expertId] ? 1 : 0);
      const stampTarget = expert.stampTarget ?? 0;
      const isFirstScan = prevCount === 0;
      const keyBonus = isFirstScan ? (expert.keys ?? 1) : 0;
      const newCount = prevCount + 1;
      const updateData = { [`scannedExperts.${expertId}`]: increment(1) };
      if (keyBonus > 0) updateData.keys = increment(keyBonus);
      try {
        await updateDoc(doc(db, 'users', String(user.id)), updateData);
        if (keyBonus > 0) setUserKeys(prev => prev + keyBonus);
        setScannedExperts(prev => ({ ...prev, [expertId]: newCount }));
        haptic('medium');
        if (keyBonus > 0) setKeyBurst({ amount: keyBonus, id: Date.now() });
        const stampMsg = stampTarget > 0 ? ` (${newCount}/${stampTarget})` : '';
        if (keyBonus > 0) {
          showToast(`+${keyBonus} ключ — консультация с ${expert.name}!${stampMsg} 🔑`, 'success');
        } else if (stampTarget > 0 && newCount >= stampTarget) {
          showToast(`🎟️ Штамп-карта заполнена! Попросите награду у ${expert.name}`, 'success');
        } else {
          showToast(`Визит отмечен${stampMsg} 👋`, 'success');
        }
        updateDoc(doc(db, 'experts', expertId), { totalVisits: increment(1) }).catch(() => {});
        addDoc(collection(db, 'users', String(user.id), 'activity'), {
          type: 'expert_scan', icon: '🧑‍💼',
          text: `Посещение эксперта: ${expert.name}`,
          ts: serverTimestamp(),
        }).catch(() => {});
      } catch (e) {
        logError(e, 'UserApp.handleConfirmScan.legacyExpert');
        showToast('Ошибка при сохранении. Попробуйте ещё раз.');
      } finally {
        setIsScannerOpen(false); isScanningRef.current = false;
      }
      return;
    }

    const legacyPartner = enrichedPartners.find(p => p.id === qrValue || p.name === qrValue);
    if (legacyPartner) {
      const alreadyHasKey = !!scannedPartnerIds[legacyPartner.id];
      const todayKey = new Date().toLocaleDateString('sv');
      const alreadyToday = lastScanDate === todayKey;

      if (alreadyHasKey && alreadyToday) {
        setIsScannerOpen(false);
        isScanningRef.current = false;
        showToast('Уже отмечено сегодня 👋');
        return;
      }

      const yesterdayKey = new Date(Date.now() - 86400000).toLocaleDateString('sv');
      const newStreak = alreadyToday ? streak : (lastScanDate === yesterdayKey ? streak + 1 : 1);
      const keyBonus = (!alreadyHasKey && legacyPartner.featured) ? 2 : 1;
      const newScanDates = scanDates.includes(todayKey) ? scanDates : [...scanDates.slice(-89), todayKey];
      const newVisitCount = (visitCounts[legacyPartner.id] ?? 0) + 1;
      const updateData = {
        lastScanDate: todayKey,
        streak: newStreak,
        scanDates: newScanDates,
        [`visitCounts.${legacyPartner.id}`]: increment(1),
      };
      if (!alreadyHasKey) {
        updateData.keys = increment(keyBonus);
        updateData[`scannedPartners.${legacyPartner.id}`] = true;
      }

      try {
        await updateDoc(doc(db, 'users', String(user.id)), updateData);
        updateDoc(doc(db, 'partners', legacyPartner.id), { totalVisits: increment(1) }).catch(() => {});
        setDoc(doc(db, 'stats', 'global'), { totalScans: increment(1) }, { merge: true }).catch(() => {});
        addDoc(collection(db, 'scans'), {
          partnerId: legacyPartner.id,
          userId: String(user.id),
          isNew: !alreadyHasKey,
          monthKey: todayKey.slice(0, 7),
          scannedAt: serverTimestamp(),
        }).catch(() => {});
        setLastScanDate(todayKey);
        setStreak(newStreak);
        setScanDates(newScanDates);
        setVisitCounts(prev => ({ ...prev, [legacyPartner.id]: newVisitCount }));
        haptic('medium');
        if (!alreadyHasKey) {
          setKeyBurst({ amount: keyBonus, id: Date.now() });
          setUserKeys(prev => prev + keyBonus);
          setScannedPartnerIds(prev => ({ ...prev, [legacyPartner.id]: true }));
          const bonusText = keyBonus > 1 ? ' x2 (партнёр дня!)' : '';
          setToast({ msg: `+${keyBonus} ключ${bonusText} — ${legacyPartner.name}! 🔑`, type: 'success', sharePartner: legacyPartner });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 4500);
          addDoc(collection(db, 'users', String(user.id), 'activity'), {
            type: 'scan', icon: keyBonus > 1 ? '⭐' : '🔑',
            text: `Посещён: ${legacyPartner.name}${keyBonus > 1 ? ' (партнёр дня × 2)' : ''}`,
            ts: serverTimestamp(),
          }).catch(() => {});
        } else {
          const label = newStreak === 1 ? 'день' : newStreak < 5 ? 'дня' : 'дней';
          showToast(`Серия продолжается — ${newStreak} ${label}! 🔥`, 'success');
        }
      } catch (e) {
        logError(e, 'UserApp.handleConfirmScan.legacyPartner');
        showToast('Ошибка при сохранении. Попробуйте ещё раз.');
      } finally {
        setIsScannerOpen(false);
        isScanningRef.current = false;
      }
      return;
    }

    try {
      const result = await confirmQrScan({ qrValue, scannerUserId: String(user.id) });
      const awardedKeys = Number(result.awardedKeys ?? 0);
      const todayKey = new Date().toLocaleDateString('sv');

      setLastScanDate(todayKey);
      if (Number.isFinite(result.streak)) setStreak(result.streak);
      if (Array.isArray(result.scanDates)) setScanDates(result.scanDates);
      if (result.subjectId && Number.isFinite(result.visitCount)) {
        setVisitCounts(prev => ({ ...prev, [result.subjectId]: result.visitCount }));
      }
      if (result.subjectType === 'partner' && result.subjectId && awardedKeys > 0) {
        setScannedPartnerIds(prev => ({ ...prev, [result.subjectId]: true }));
      }
      if (result.subjectType === 'expert' && result.subjectId) {
        setScannedExperts(prev => ({ ...prev, [result.subjectId]: result.visitCount ?? ((Number(prev[result.subjectId]) || 0) + 1) }));
      }
      haptic('medium');
      if (awardedKeys > 0) {
        setUserKeys(prev => prev + awardedKeys);
        setKeyBurst({ amount: awardedKeys, id: Date.now() });
        const partner = result.subjectType === 'partner'
          ? enrichedPartners.find(p => p.id === result.subjectId)
          : null;
        setToast({ msg: `${result.message} 🔑`, type: 'success', sharePartner: partner });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4500);
      } else {
        const days = Number(result.streak ?? streak) || 1;
        const label = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
        showToast(result.alreadyAwarded ? `Визит отмечен. Серия — ${days} ${label}!` : result.message, 'success');
      }
    } catch (e) {
      logError(e, 'UserApp.handleConfirmScan.reward');
      showToast(e.code === 'TOKEN_EXPIRED' ? 'QR истёк. Попросите создать новый.' : (e.message || 'Ошибка при сохранении. Попробуйте ещё раз.'));
    } finally {
      setIsScannerOpen(false);
      isScanningRef.current = false;
    }
  }, [user, enrichedPartners, experts, lastScanDate, streak, scannedPartnerIds, scannedExperts, scanDates, visitCounts, haptic, showToast]);

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
      updateDoc(doc(db, 'partners', p.id), { publicQRScans: increment(1) }).catch(() => {});
    } else {
      showToast('🔍 Партнёр не найден');
    }
  }, [pendingPartnerId, partners, openPartner, showToast]);

  // Авто-скан служебного QR из deep link ?scan=...
  useEffect(() => {
    if (!pendingScanId || !user || scanDeepLinkTriggered.current) return;
    scanDeepLinkTriggered.current = true;
    handleConfirmScan(pendingScanId);
  }, [pendingScanId, user, handleConfirmScan]);

  // Открываем эксперта из публичного deep link ?expert=ID
  useEffect(() => {
    if (!pendingExpertId || !experts.length || expertDeepLinkOpened.current) return;
    expertDeepLinkOpened.current = true;
    const e = experts.find(e => e.id === pendingExpertId);
    if (e) {
      setActivePanel('experts');
      updateDoc(doc(db, 'experts', e.id), { publicQRScans: increment(1) }).catch(() => {});
    }
  }, [pendingExpertId, experts]);

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
      logError(e, 'UserApp.handleClaim');
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
      logError(e, 'UserApp.handlePrizeClaim');
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
      logError(e, 'UserApp.handleRaffleEnter');
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
        logError(e, 'UserApp.handleEventUnregister');
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
        logError(e, 'UserApp.handleEventRegister');
        setRegisteredEventIds(prev => prev.filter(id => id !== eventId));
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: Math.max(0, (e.registeredCount ?? 1) - 1) } : e));
      }
    }
  }, [user, userKeys, registeredEventIds, setEvents, showToast]);

  // ─── Профиль ────────────────────────────────────────────────────────────────

  const completeEmailLogin = useCallback((emailUser) => {
    localStorage.removeItem('manualLogout');
    localStorage.setItem('apg_email_user', JSON.stringify(emailUser));
    window.location.reload();
  }, []);

  const handleEmailAuthSuccess = useCallback(async (emailUser) => {
    if (!emailUser?.id) return;
    try {
      const snap = await getDoc(doc(db, 'users', String(emailUser.id)));
      const data = snap.exists() ? snap.data() : null;
      if (hasAcceptedCurrentLegal(data)) {
        completeEmailLogin({
          ...emailUser,
          consents: data.consents,
          consentDocsVersion: data.consentDocsVersion ?? data.consents.docsVersion,
          legalVersion: data.legalVersion ?? data.consents.legalVersion,
        });
        return;
      }
    } catch (e) {
      logError(e, 'UserApp.handleEmailAuthSuccess.checkConsents');
    }
    setConsentRequest({
      user: emailUser,
      mode: 'email',
      title: 'Добро пожаловать в обновлённый АПГ!',
      subtitle: 'Перед продолжением использования приложения подтвердите необходимые согласия.',
      badge: 'Первый вход',
      notificationsDefault: true,
    });
  }, [completeEmailLogin]);

  const handleConsentAccept = useCallback(async ({ termsAccepted, privacyAccepted, notificationsAccepted }) => {
    const targetUser = consentRequest?.user;
    if (!targetUser?.id || !termsAccepted || !privacyAccepted || consentSaving) return;
    setConsentSaving(true);
    try {
      const userRef = doc(db, 'users', String(targetUser.id));
      const existingSnap = await getDoc(userRef);
      const consentPayload = {
        userId: String(targetUser.id),
        termsAccepted: true,
        privacyAccepted: true,
        notificationsAccepted: !!notificationsAccepted,
        legalVersion: LEGAL_VERSION,
        docsVersion: CONSENT_DOCS_VERSION,
        userAgreementUrl: CONSENT_DOCS.userAgreementUrl,
        privacyPolicyUrl: CONSENT_DOCS.privacyPolicyUrl,
      };
      if (existingSnap.exists()) {
        await setDoc(userRef, {
          consents: { ...consentPayload, acceptedAt: serverTimestamp() },
          consentAcceptedAt: serverTimestamp(),
          consentDocsVersion: CONSENT_DOCS_VERSION,
          consentLegalVersion: LEGAL_VERSION,
          legalVersion: LEGAL_VERSION,
          notificationConsent: !!notificationsAccepted,
          ...(notificationsAccepted ? { notificationsRequestedAt: serverTimestamp() } : {}),
        }, { merge: true });
      } else {
        localStorage.setItem('apg_pending_consents', JSON.stringify({
          userId: String(targetUser.id),
          consents: { ...consentPayload, acceptedAt: new Date().toISOString() },
          consentDocsVersion: CONSENT_DOCS_VERSION,
          consentLegalVersion: LEGAL_VERSION,
          notificationConsent: !!notificationsAccepted,
        }));
      }
      if (notificationsAccepted) localStorage.setItem('apg_notif_consent', '1');
      if (consentRequest.mode === 'email') {
        if (notificationsAccepted) localStorage.setItem('apg_request_notification_after_login', '1');
        completeEmailLogin({
          ...targetUser,
          consents: { ...consentPayload, acceptedAt: new Date().toISOString() },
          consentDocsVersion: CONSENT_DOCS_VERSION,
          legalVersion: LEGAL_VERSION,
        });
        return;
      }
      setUser(u => u ? ({
        ...u,
        consents: { ...consentPayload, acceptedAt: new Date().toISOString() },
        consentDocsVersion: CONSENT_DOCS_VERSION,
        legalVersion: LEGAL_VERSION,
      }) : u);
      setConsentRequest(null);
      if (consentRequest.needsOnboarding) setShowOnboarding(true);
      if (notificationsAccepted) setPendingNotificationPrompt(true);
    } catch (e) {
      logError(e, 'UserApp.handleConsentAccept');
      showToast('Не удалось сохранить согласия. Проверьте интернет и попробуйте снова.', 'error');
    } finally {
      if (mountedRef.current) setConsentSaving(false);
    }
  }, [consentRequest, consentSaving, completeEmailLogin, showToast]);

  const handleLogout = useCallback(async () => {
    localStorage.setItem('manualLogout', 'true');
    localStorage.removeItem('apg_tg_user');
    localStorage.removeItem('apg_email_user');
    localStorage.removeItem('apg_guest_id');
    localStorage.removeItem('apg_web_user');
    localStorage.removeItem('apg_notif_enabled');
    localStorage.removeItem('apg_request_notification_after_login');
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
    } catch (e) { logError(e, 'UserApp.handleDeleteProfile'); }
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
      logError(e, 'UserApp.requestWebPushPermission');
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

  useEffect(() => {
    if (!pendingNotificationPrompt || !user) return;
    setPendingNotificationPrompt(false);
    handleEnableNotifications();
  }, [pendingNotificationPrompt, user, handleEnableNotifications]);

  useEffect(() => {
    if (!user || localStorage.getItem('apg_request_notification_after_login') !== '1') return;
    localStorage.removeItem('apg_request_notification_after_login');
    handleEnableNotifications();
  }, [user, handleEnableNotifications]);

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

  const goPanel = useCallback((id) => {
    setIsScannerOpen(false);
    setShowScannerHint(false);
    setActivePanel(id);
  }, []);

  const lastSeenTs = (() => {
    const v = localStorage.getItem('apg_notif_seen');
    return v ? { toDate: () => new Date(Number(v)) } : null;
  })();

  // ─── TabBar ─────────────────────────────────────────────────────────────────

  const tabIconStyle = (active) => ({
    opacity: active ? 1 : 0.58,
    filter: active ? 'drop-shadow(0 0 10px rgba(214,183,102,0.28))' : 'none',
    transition: 'opacity 0.3s ease, filter 0.3s ease',
  });

  const TabHomeIcon    = ({ active }) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={tabIconStyle(active)}>
      <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z"
        fill={active ? T.gold : 'none'} stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
  const TabExpertsIcon = ({ active }) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={tabIconStyle(active)}>
      <circle cx="12" cy="7" r="3.5" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 10L17.5 11.5L20 9" stroke={active ? T.gold : T.textSec} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabPartnersIcon = ({ active }) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={tabIconStyle(active)}>
      <path d="M4 10.5L5.2 5.5C5.4 4.6 6.2 4 7.1 4H17C18 4 18.8 4.6 19 5.5L20 10.5" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 10.5V20H19V10.5" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M9 20V15H15V20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M4 10.5C5 12.2 7.1 12.2 8 10.5C9 12.2 11.1 12.2 12 10.5C13 12.2 15.1 12.2 16 10.5C17 12.2 19 12.2 20 10.5" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabTasksIcon   = ({ active }) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={tabIconStyle(active)}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M8 12L11 15L16 9" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TabProfileIcon = ({ active }) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={tabIconStyle(active)}>
      <circle cx="12" cy="8" r="4" stroke={active ? T.gold : T.textSec} strokeWidth="1.8"/>
      <path d="M4 20C4 17 7.6 14 12 14C16.4 14 20 17 20 20" stroke={active ? T.gold : T.textSec} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  // 5 tabs + center scan button (index 2). Tasks stay available inside V2 screens.
  const TAB_PANELS = ['home', 'offers', null, 'experts', 'profile'];
  const showTabBar = !isScannerOpen && TAB_PANELS.includes(activePanel);
  const V2GoldMetal = 'linear-gradient(135deg, #FFF0B8 0%, #D9B965 34%, #9F7932 68%, #F4D98C 100%)';

  const TABS = [
    { id: 'home',    label: 'Главная',  icon: TabHomeIcon },
    { id: 'offers',  label: 'Партнёры', icon: TabPartnersIcon },
    { id: null,      label: 'Скан',     icon: null },
    { id: 'experts', label: 'Эксперты', icon: TabExpertsIcon },
    { id: 'profile', label: 'Профиль',  icon: TabProfileIcon },
  ];

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;

    let rafId = 0;
    let lastY = window.scrollY;
    let settleTimer = 0;
    const vars = {};

    const setVar = (name, value) => {
      if (vars[name] === value) return;
      vars[name] = value;
      el.style.setProperty(name, value);
    };
    const apply = (forceVisible = false) => {
      rafId = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      const p = Math.min(Math.max(y / 260, 0), 1);

      lastY = y;

      setVar('--apg-island-y', '0px');
      setVar('--apg-island-height', `${Math.round(64 - p * 3)}px`);
      setVar('--apg-island-pad', '6px');
      setVar('--apg-island-blur', `${Math.round(58 + p * 10)}px`);
      setVar('--apg-island-bg-alpha', String(0.34 - p * 0.02));
      setVar('--apg-island-shadow-y', `${Math.round(22 + p * 3)}px`);
      setVar('--apg-island-shadow-alpha', String(0.34 + p * 0.03));
    };

    const onScroll = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!rafId) rafId = requestAnimationFrame(() => apply(true));
      }, 190);
      if (!rafId) rafId = requestAnimationFrame(() => apply(false));
    };

    apply(true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(settleTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const applyVisualViewport = () => {
      const viewport = window.visualViewport;
      const bottomInset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      document.documentElement.style.setProperty('--apg-vv-bottom', `${Math.round(bottomInset)}px`);
    };
    applyVisualViewport();
    window.visualViewport?.addEventListener('resize', applyVisualViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', applyVisualViewport, { passive: true });
    window.addEventListener('orientationchange', applyVisualViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', applyVisualViewport);
      window.visualViewport?.removeEventListener('scroll', applyVisualViewport);
      window.removeEventListener('orientationchange', applyVisualViewport);
      document.documentElement.style.removeProperty('--apg-vv-bottom');
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activePanel]);

  const tabBarShellStyle = {
    position: 'fixed',
    bottom: 'calc(6px + max(env(safe-area-inset-bottom, 0px), var(--apg-vv-bottom, 0px)))',
    left: 0, right: 0, margin: '0 auto',
    transform: 'translate3d(0, var(--apg-island-y, 0px), 0)',
    width: 'calc(100% - 32px)', maxWidth: 360, height: 'var(--apg-island-height, 64px)', minHeight: 'var(--apg-island-height, 64px)',
    padding: 'var(--apg-island-pad, 8px)',
    background: 'radial-gradient(circle at 50% 0%, rgba(244,217,140,0.10), transparent 50%), linear-gradient(145deg, var(--apg2-island-bg1, rgba(42,42,38,var(--apg-island-bg-alpha, 0.34))), var(--apg2-island-bg2, rgba(15,15,16,0.46)))',
    backdropFilter: 'blur(var(--apg-island-blur, 58px)) saturate(1.55)', WebkitBackdropFilter: 'blur(var(--apg-island-blur, 58px)) saturate(1.55)',
    border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.17))',
    borderRadius: 30,
    boxShadow: '0 var(--apg-island-shadow-y, 22px) 52px var(--apg2-elev-shadow, rgba(0,0,0,0.34)), 0 0 34px rgba(216,184,103,0.08), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -18px 34px rgba(255,255,255,0.035)',
    display: 'flex', alignItems: 'stretch', gap: 4,
    zIndex: 10000, overflow: 'visible',
    transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), min-height 220ms ease, padding 220ms ease, box-shadow 220ms ease, backdrop-filter 220ms ease, -webkit-backdrop-filter 220ms ease',
    willChange: 'transform, min-height, padding, backdrop-filter',
    contain: 'layout paint style',
    isolation: 'isolate',
  };

  const tabBarEl = (
    <div ref={tabBarRef} style={tabBarShellStyle}>
      {TABS.map((tab, i) => {
        if (i === 2) return (
          <button key="scan" aria-label="Открыть сканер" onClick={() => { haptic('medium'); setIsScannerOpen(true); }}
            style={{ flex: 1, background: isScannerOpen ? 'linear-gradient(145deg, rgba(244,217,140,0.18), rgba(255,255,255,0.08))' : 'none', border: isScannerOpen ? '1px solid rgba(244,217,140,0.23)' : '1px solid transparent', borderRadius: 23, boxShadow: isScannerOpen ? 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 26px var(--apg2-elev-shadow, rgba(0,0,0,0.18))' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0, position: 'relative', zIndex: 2, transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease' }}>
            <div style={{
              width: 42, height: 42, marginTop: 0, borderRadius: 18,
              background: isScannerOpen ? 'rgba(201,168,76,0.25)' : V2GoldMetal,
              boxShadow: isScannerOpen ? 'none' : '0 12px 26px rgba(216,184,103,0.18), inset 0 1px 0 rgba(255,255,255,0.36), inset 0 -8px 18px rgba(83,58,18,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#0F0F1A',
              transition: 'transform 0.35s ease, box-shadow 0.35s ease',
              transform: isScannerOpen ? 'scale(0.88)' : 'scale(1)',
            }}>◎</div>
            <span style={{ fontSize: 8.5, fontWeight: 780, color: isScannerOpen ? T.gold : T.textSec, opacity: isScannerOpen ? 1 : 0.62, letterSpacing: 0, textTransform: 'none', marginTop: 2 }}>Скан</span>
          </button>
        );

        const isActive = activePanel === tab.id && !isScannerOpen;
        const Icon     = tab.icon;
        const hasNotif = tab.id === 'profile' && unreadCount > 0;

        return (
          <button key={tab.id}
            aria-label={`Открыть раздел ${tab.label}`}
            onClick={() => { haptic('light'); goPanel(tab.id); }}
            style={{ flex: 1, background: isActive ? 'linear-gradient(145deg, rgba(244,217,140,0.18), rgba(255,255,255,0.08))' : 'none', border: isActive ? '1px solid rgba(244,217,140,0.23)' : '1px solid transparent', borderRadius: 23, boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 26px var(--apg2-elev-shadow, rgba(0,0,0,0.18))' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0, position: 'relative', zIndex: 1, minWidth: 0, transform: isActive ? 'translateY(-0.5px)' : 'translateY(0)', transition: 'transform 0.22s ease, background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease' }}>
            <div style={{ position: 'relative' }}>
              <Icon active={isActive} />
              {hasNotif && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#E64646', border: '1.5px solid rgba(8,8,24,0.9)' }} />
              )}
            </div>
            <span style={{ fontSize: 8.5, fontWeight: 780, letterSpacing: 0, textTransform: 'none', color: isActive ? T.gold : T.textSec, opacity: isActive ? 1 : 0.58, transition: 'color 0.25s ease, opacity 0.25s ease', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (networkError) {
    return (
      <ConfigProvider appearance={appearance}>
        <AdaptivityProvider>
          <AppRoot>
            <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: APG2_PROFILE.bg, color: APG2_PROFILE.text }}>
              <GlassCard style={{ width: '100%', maxWidth: 380, borderRadius: 38, padding: 24, textAlign: 'center' }}>
                <div style={{ width: 86, height: 86, borderRadius: 32, margin: '0 auto 18px', background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>📡</div>
                <GlassBadge tone="gold" style={{ marginBottom: 14 }}>Нет соединения</GlassBadge>
                <div style={{ fontSize: 25, lineHeight: '30px', fontWeight: 900, color: APG2_PROFILE.text, marginBottom: 10 }}>Не удаётся загрузить данные</div>
                <div style={{ fontSize: 14, color: APG2_PROFILE.textSoft, textAlign: 'center', lineHeight: '21px', marginBottom: 20 }}>
                  Попробуйте переключить Wi-Fi/мобильный интернет или повторить попытку позже.
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <GlassButton
                    tone="gold"
                    onClick={() => {
                      setReportSent(false); setReportSending(false);
                      const im = { current: true };
                      loadData(im);
                    }}
                    style={{ width: '100%', color: '#17120a' }}
                  >
                    Попробовать снова
                  </GlassButton>
                  <GlassButton
                    disabled={reportSent || reportSending}
                    onClick={async () => {
                      if (reportSent || reportSending) return;
                      setReportSending(true);
                      const checks = await runServiceChecks();
                      await sendDiagReport({ checks, errorText: 'Ручной отчёт', manual: true, userId: user?.id });
                      setReportSending(false);
                      setReportSent(true);
                    }}
                    style={{ width: '100%', color: reportSent ? '#4BB34B' : APG2_PROFILE.textSoft }}
                  >
                    {reportSent ? 'Отчёт отправлен' : reportSending ? 'Отправляем...' : 'Отправить отчёт'}
                  </GlassButton>
                </div>
              </GlassCard>
            </div>
          </AppRoot>
        </AdaptivityProvider>
      </ConfigProvider>
    );
  }

  if (loggedOut) {
    return (
      <ConfigProvider appearance={appearance}>
        <AdaptivityProvider>
          <AppRoot>
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: APG2_PROFILE.bg, color: APG2_PROFILE.text }}>
              <GlassCard style={{ width: '100%', maxWidth: 360, borderRadius: 38, padding: 24, textAlign: 'center' }}>
                <div style={{ width: 86, height: 86, borderRadius: 32, margin: '0 auto 18px', background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>👋</div>
                <GlassBadge tone="gold" style={{ marginBottom: 14 }}>Сессия завершена</GlassBadge>
                <div style={{ fontSize: 27, lineHeight: '31px', fontWeight: 900, color: APG2_PROFILE.text, marginBottom: 10 }}>Вы вышли из аккаунта</div>
                <div style={{ fontSize: 14, color: APG2_PROFILE.textSoft, lineHeight: '21px', marginBottom: 20 }}>Нажмите кнопку ниже, чтобы вернуться в АПГ.</div>
                <GlassButton onClick={handleLoginAfterLogout} tone="gold" style={{ width: '100%', color: '#17120a' }}>Войти</GlassButton>
              </GlassCard>
            </div>
          </AppRoot>
        </AdaptivityProvider>
      </ConfigProvider>
    );
  }

  const homePanelProps = {
    nav: 'home',
    counterPulse,
    user,
    userKeys,
    favorites,
    partners: enrichedPartners,
    events,
    news,
    recentReviews,
    loading,
    error,
    streak,
    lastScanDate,
    completedTasks,
    referralCount,
    scannedCount: Object.keys(scannedPartnerIds).length,
    unreadCount,
    registeredEventIds,
    userRank,
    customTasks,
    experts,
    appearance,
    onEventRegister: handleEventRegister,
    onOpenPartner: openPartner,
    onToggleFavorite: toggleFavorite,
    onScan: () => setIsScannerOpen(true),
    onRetry: () => loadData(mountedRef),
    onRefresh: handleRefresh,
    onOpenEvents: () => goPanel('events'),
    onOpenExperts: () => goPanel('experts'),
    onOpenTasks: () => goPanel('tasks'),
    onOpenLeaderboard: () => goPanel('leaderboard'),
    onOpenRewards: () => goPanel('rewards'),
    onOpenNotifications: openNotifications,
    joinedGroup,
    onJoinGroup: handleJoinGroup,
    userCount: platformStats.userCount,
    onOpenForPartners: () => goPanel('for-partners'),
    onOpenMap: () => goPanel('map'),
    onOpenNearby: () => goPanel('nearby'),
  };

  return (
    <ConfigProvider appearance={appearance}>
      <AdaptivityProvider>
        <AppRoot>
          <div
            style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', minHeight: '100svh', position: 'relative', zIndex: 1, overflowX: 'clip' }}
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

            <div key={activePanel} style={{ minHeight: '100%', animation: 'fadeInUp 0.26s cubic-bezier(0.22,1,0.36,1) both' }}>
            <View activePanel={activePanel}>

              {/* nav= нужен View для навигации; Panel id внутри компонента — для стилей */}
              <HomePanelV2 {...homePanelProps} />

              <Panel id="partner">
                <Suspense fallback={<LazyFallback />}>
                  <PartnerPage
                    partner={activePartner ? (enrichedPartners.find(p => p.id === activePartner.id) ?? activePartner) : null}
                    variant="v2"
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
	                    variant="v2"
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
                    ownedExpert={ownedExpert}
                    onOpenExpertCabinet={() => goPanel('expert-cabinet')}
                    onUserUpdate={(patch) => setUser(u => ({ ...u, ...patch }))}
                    onEmailAuthSuccess={handleEmailAuthSuccess}
                  />
                </Suspense>
              </Panel>

              {/* Lazy pages — Suspense обёрнут в Panel чтобы View видел nav/id */}
              <Panel id="events">
                <Suspense fallback={<LazyFallback />}>
                  <EventsPage nav="events" variant="v2" events={events} onBack={() => goPanel('home')} appearance={appearance} />
                </Suspense>
              </Panel>

              <Panel id="tasks">
                <Suspense fallback={<LazyFallback />}>
                  <TasksPage
                    variant="v2"
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
                    variant="v2"
                    userKeys={userKeys}
                    currentUserId={user?.id ? String(user.id) : null}
                    onBack={() => goPanel('home')}
                  />
                </Suspense>
              </Panel>

              <Panel id="offers">
                <Suspense fallback={<LazyFallback />}>
                  <OffersPage variant="v2" partners={enrichedPartners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="activity">
                <Suspense fallback={<LazyFallback />}>
                  <ActivityPage nav="activity" variant="v2" userId={user?.id ? String(user.id) : null} onBack={() => goPanel('profile')} />
                </Suspense>
              </Panel>

              <Panel id="referral">
                <Suspense fallback={<LazyFallback />}>
                  <ReferralPage
                    variant="v2"
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
                    variant="v2"
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

              <Panel id="expert-cabinet">
                <Suspense fallback={<LazyFallback />}>
                  <ExpertCabinetPage
                    variant="v2"
                    expert={ownedExpert}
                    onBack={() => goPanel('profile')}
                    onExpertUpdate={(updated) => {
                      setExperts(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
                      setOwnedExpert(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
                    }}
                  />
                </Suspense>
              </Panel>

              <Panel id="rewards">
                <Suspense fallback={<LazyFallback />}>
                  <RewardsPage
                    nav="rewards"
                    variant="v2"
                    user={user} userKeys={userKeys}
                    onBack={() => goPanel('home')}
                    onClaim={handlePrizeClaim}
                    onRaffleEnter={handleRaffleEnter}
                    partners={partners}
                    experts={experts}
                  />
                </Suspense>
              </Panel>

              <Panel id="experts">
                <Suspense fallback={<LazyFallback />}>
                  <ExpertsPage
                    nav="experts"
                    variant="v2"
                    experts={experts}
                    user={user}
                    scannedExperts={scannedExperts}
                    onBack={() => goPanel('home')}
                    isActive={activePanel === 'experts'}
                    initialExpertId={pendingExpertId}
                  />
                </Suspense>
              </Panel>

              <Panel id="map">
                <Suspense fallback={<LazyFallback />}>
                  <MapPage variant="v2" partners={partners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="nearby">
                <Suspense fallback={<LazyFallback />}>
                  <NearbyPage variant="v2" partners={enrichedPartners} onOpenPartner={openPartner} onOpenMap={() => goPanel('map')} onBack={() => goPanel('home')} />
                </Suspense>
              </Panel>

              <Panel id="notifications">
                <Suspense fallback={<LazyFallback />}>
                  <NotificationsPage
                    variant="v2"
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
          </div>

          {showTabBar && createPortal(tabBarEl, document.body)}

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

          {consentRequest && (
            <ConsentScreen
              user={consentRequest.user}
              loading={consentSaving}
              title={consentRequest.title}
              subtitle={consentRequest.subtitle}
              badge={consentRequest.badge}
              notificationsDefault={consentRequest.notificationsDefault}
              onAccept={handleConsentAccept}
              onCancel={consentRequest.mode === 'email' ? () => !consentSaving && setConsentRequest(null) : undefined}
            />
          )}

          <GlassToast
            toast={toast}
            onClose={() => setToast(null)}
            onShare={() => {
              if (!toast?.sharePartner) return;
              const msg = `Только что посетил ${toast.sharePartner.name} — участника Альянса Партнёров Зеленограда! Получил ${toast.sharePartner.featured ? '2' : '1'} 🗝️\n\nПрисоединяйся: vk.com/app54601851\n#АПГ #Зеленоград`;
              vkBridge.send('VKWebAppShowWallPostBox', {
                message: msg,
                attachments: 'https://vk.com/app54601851',
              }).catch(() => {});
              setToast(null);
            }}
          />
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
