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
import { MOTION, motionTransition } from './motion.js';
import { LokiProvider } from './loki/LokiProvider.jsx';
import { LokiAssistant } from './loki/LokiAssistant.jsx';
import { LOKI_EVENTS } from './loki/lokiEvents.js';
import { showLokiMessage } from './loki/lokiBus.js';
import { LOKI_APP_ACTIONS } from './loki/lokiActionTypes.js';

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
const ReferencePage        = lazy(() => import('./ReferencePage.jsx').then(m => ({ default: m.ReferencePage })));
const LokiPage             = lazy(() => import('./LokiPage.jsx').then(m => ({ default: m.LokiPage })));
const NewsPage             = lazy(() => import('./NewsPage.jsx').then(m => ({ default: m.NewsPage })));

function safeScrollTop() {
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch {
    try { window.scrollTo(0, 0); } catch {}
  }
}

function getQrErrorMessage(error) {
  const code = String(error?.code ?? '');
  if (code === 'TOKEN_USED') return 'Этот QR уже использован. Попросите сотрудника показать актуальный QR-код.';
  if (code === 'TOKEN_EXPIRED') return 'QR истёк. Попросите сотрудника показать новый QR-код.';
  if (code === 'UNKNOWN_QR' || code === 'BAD_TOKEN' || code === 'BAD_SIGNATURE') return 'QR недействителен. Попросите сотрудника показать QR-код АПГ.';
  if (code === 'NO_SCANNER' || code === 'USER_NOT_FOUND') return 'Не удалось определить ваш аккаунт. Войдите в приложение и попробуйте снова.';
  if (code === 'SCANNER_NOT_ALLOWED') return 'Этот QR должен подтвердить сотрудник партнёра или эксперт.';
  if (code === 'SUBJECT_NOT_FOUND') return 'Партнёр или эксперт не найден. Обратитесь к сотруднику.';
  return 'Не удалось начислить ключ. Обратитесь к сотруднику и попробуйте ещё раз.';
}

function ScanSuccessModal({ result, onClose, onReview }) {
  const startYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  if (!result) return null;
  const keys = Number(result.awardedKeys ?? 1) || 1;
  const keyWord = keys === 1 ? 'ключ' : keys < 5 ? 'ключа' : 'ключей';
  const handleTouchStart = (e) => { startYRef.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(Math.min(dy, 170));
  };
  const handleTouchEnd = () => {
    const shouldClose = dragY > 86;
    setDragY(0);
    if (shouldClose) onClose();
  };
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 13000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(20px + var(--safe-top, 0px)) 18px calc(24px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(7,7,9,0.58)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 260, height: 260, borderRadius: '50%', transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(215,184,106,0.36), rgba(215,184,106,0.10) 42%, transparent 70%)', pointerEvents: 'none', animation: 'apgSuccessFlash 760ms var(--motion-ease-out, cubic-bezier(0.16,1,0.3,1)) both' }} />
      <GlassCard
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setDragY(0)}
        style={{ width: '100%', maxWidth: 390, borderRadius: 34, padding: 24, textAlign: 'center', border: '1px solid rgba(215,184,106,0.30)', transform: `translate3d(0, ${dragY}px, 0) scale(${dragY ? Math.max(0.965, 1 - dragY / 2200) : 1})`, transition: dragY ? 'none' : motionTransition(['transform'], 'base') }}
      >
        <div style={{ width: 42, height: 4, borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.24)', margin: '0 auto 15px' }} />
        <div style={{ width: 76, height: 76, margin: '0 auto 16px', borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 20px 46px rgba(215,184,106,0.20)' }}>🎉</div>
        <GlassBadge tone="gold" style={{ marginBottom: 12 }}>Спасибо за посещение</GlassBadge>
        <div style={{ color: APG2_PROFILE.text, fontSize: 27, lineHeight: '31px', fontWeight: 920, marginBottom: 8 }}>Ключ успешно получен!</div>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 38, lineHeight: '42px', fontWeight: 940, marginBottom: 8 }}>+{keys} {keyWord}</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', marginBottom: 18 }}>
          {result.subjectName ? `Визит в «${result.subjectName}» отмечен в вашем аккаунте.` : 'Визит отмечен в вашем аккаунте.'}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {result.partner && (
            <GlassButton onClick={onReview} tone="gold" style={{ minHeight: 48, borderRadius: 20, color: '#17120a' }}>⭐ Оставить отзыв</GlassButton>
          )}
          <GlassButton onClick={onClose} style={{ minHeight: 46, borderRadius: 20 }}>Готово</GlassButton>
        </div>
      </GlassCard>
    </div>,
    document.body,
  );
}

function formatCacheAge(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1)  return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `${hrs} ч назад`;
  return `${Math.round(hrs / 24)} д назад`;
}

initErrorLogger();

const SWIPE_TABS = ['home', 'offers', 'experts', 'profile'];
const PULL_REFRESH_PANELS = new Set(['home', 'offers', 'experts', 'events', 'news']);

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

const AUTH_TRACE_KEY = 'apg_auth_trace';

function traceAuthStage(stage, details = {}) {
  try {
    const entry = {
      at: new Date().toISOString(),
      stage,
      ...Object.fromEntries(
        Object.entries(details).map(([key, value]) => [
          key,
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null
            ? value
            : JSON.stringify(value).slice(0, 240),
        ]),
      ),
    };
    const current = JSON.parse(localStorage.getItem(AUTH_TRACE_KEY) || '[]');
    localStorage.setItem(AUTH_TRACE_KEY, JSON.stringify([...current.slice(-29), entry]));
  } catch {}
}

function getAuthErrorMessage(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    return 'Не удалось сохранить данные аккаунта из-за ограничений доступа. Мы уже записали ошибку, попробуйте ещё раз.';
  }
  if (!navigator.onLine) return 'Нет подключения к интернету. Проверьте сеть и попробуйте снова.';
  return 'Не удалось завершить вход. Попробуйте ещё раз или выберите другой способ авторизации.';
}

async function ensureOwnerAuthSession(userId, source = 'auth') {
  const targetUserId = String(userId || '');
  if (!targetUserId || targetUserId.startsWith('guest_')) return null;

  const ensureAnonymous = async (reason) => {
    if (auth.currentUser) return auth.currentUser;
    traceAuthStage('firebase_auth_start', { source, reason });
    await signInAnonymously(auth);
    traceAuthStage('firebase_auth_ready', { source, uid: auth.currentUser?.uid ?? null });
    return auth.currentUser;
  };

  const checkOrCreateMap = async () => {
    const current = await ensureAnonymous('owner_map');
    const mapRef = doc(db, 'auth_map', current.uid);
    const mapSnap = await getDoc(mapRef);
    if (mapSnap.exists()) {
      const mappedId = String(mapSnap.data()?.vkId ?? '');
      traceAuthStage('auth_map_found', { source, uid: current.uid, userId: targetUserId, mappedId });
      return mappedId === targetUserId;
    }
    await setDoc(mapRef, {
      vkId: targetUserId,
      source,
      createdAt: serverTimestamp(),
    });
    traceAuthStage('auth_map_created', { source, uid: current.uid, userId: targetUserId });
    return true;
  };

  traceAuthStage('owner_session_check', { source, userId: targetUserId, uid: auth.currentUser?.uid ?? null });
  if (await checkOrCreateMap()) return auth.currentUser;

  traceAuthStage('auth_map_mismatch', { source, userId: targetUserId, uid: auth.currentUser?.uid ?? null });
  await signOut(auth).catch(() => {});
  await signInAnonymously(auth);
  const current = auth.currentUser;
  if (!current) throw new Error('firebase_auth_unavailable');
  await setDoc(doc(db, 'auth_map', current.uid), {
    vkId: targetUserId,
    source,
    createdAt: serverTimestamp(),
  });
  traceAuthStage('owner_session_recreated', { source, uid: current.uid, userId: targetUserId });
  return current;
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
  const lastHapticAtRef                         = useRef(0);
  const isScanningRef                           = useRef(false);
  const mountedRef                              = useRef(true);
  const claimingPrizeRef                        = useRef(false);
  const tabBarRef                               = useRef(null);
  const tabSlotRefs                             = useRef([]);
  const [splashDone, setSplashDone]             = useState(false);
  const [toast, setToast]                       = useState(null);
  const [scanSuccess, setScanSuccess]           = useState(null);
  const [reviewPromptPartnerId, setReviewPromptPartnerId] = useState(null);
  const [scanDates, setScanDates]               = useState([]);

  const [activePanel, setActivePanel]           = useState('home');
  const panelHistoryRef                         = useRef(['home']);
  const [panelTransition, setPanelTransition]   = useState('forward');
  const [tabIndicator, setTabIndicator]         = useState({ center: 0, width: 0, ready: false });
  const [pullDistance, setPullDistance]         = useState(0);
  const [pullRefreshing, setPullRefreshing]     = useState(false);
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
  const [savedNews, setSavedNews]               = useState([]);
  const [readLaterNews, setReadLaterNews]       = useState([]);
  const [newsReactions, setNewsReactions]       = useState({});
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
  const [consentError, setConsentError]         = useState('');
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
    const now = Date.now();
    if (now - lastHapticAtRef.current < 70) return;
    lastHapticAtRef.current = now;

    if (isVK()) {
      vkBridge.send('VKWebAppTapticImpactOccurred', { style }).catch(() => {});
      return;
    }

    const patterns = {
      light: 8,
      medium: [12, 18, 10],
      heavy: [18, 22, 16],
      success: [10, 20, 24],
    };
    try {
      navigator.vibrate?.(patterns[style] ?? patterns.light);
    } catch {}
  }, []);

  const navigatePanel = useCallback((id, { replace = false, direction = 'forward' } = {}) => {
    if (!id) return;
    setIsScannerOpen(false);
    setShowScannerHint(false);
    setPanelTransition(direction);
    const history = panelHistoryRef.current;
    if (replace) {
      history[history.length - 1] = id;
    } else if (history[history.length - 1] !== id) {
      history.push(id);
      if (history.length > 24) history.shift();
    }
    setActivePanel(id);
  }, []);

  const getFallbackBackPanel = useCallback((panel) => {
    if (panel === 'activity' || panel === 'referral' || panel === 'partner-cabinet' || panel === 'expert-cabinet') return 'profile';
    return 'home';
  }, []);

  const goBackPanel = useCallback(() => {
    if (isScannerOpen) {
      setIsScannerOpen(false);
      return true;
    }
    const history = panelHistoryRef.current;
    let target = null;
    if (history.length > 1) {
      history.pop();
      target = history[history.length - 1];
    } else if (activePanel !== 'home') {
      target = getFallbackBackPanel(activePanel);
      history[0] = target;
    }
    if (!target || target === activePanel) return false;
    setPanelTransition('back');
    setShowScannerHint(false);
    setActivePanel(target);
    return true;
  }, [activePanel, getFallbackBackPanel, isScannerOpen]);

  const goPanel = useCallback((id) => {
    navigatePanel(id);
    if (id === 'offers') showLokiMessage(LOKI_EVENTS.PARTNER_OPENED, { source: 'bottom_nav' });
    if (id === 'events') showLokiMessage(LOKI_EVENTS.EVENT_OPENED, { source: 'bottom_nav' });
    if (id === 'rewards') showLokiMessage(LOKI_EVENTS.PRIZE_OPENED, { source: 'home' });
    if (id === 'profile') showLokiMessage(LOKI_EVENTS.PROFILE_OPENED, { source: 'bottom_nav' });
    if (id === 'reference') showLokiMessage(LOKI_EVENTS.REFERENCE_OPENED, { source: 'navigation' });
    if (id === 'loki') showLokiMessage(LOKI_EVENTS.VK_ENTRY, { source: isVK() ? 'vk_miniapp' : 'web_app' });
    if (id === 'map' || id === 'nearby') showLokiMessage(LOKI_EVENTS.MAP_OPENED, { source: id });
  }, [navigatePanel]);

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

  useEffect(() => {
    if (!isVK() || !user || loading) return;
    const key = `apg_loki_vk_entry_${user.id ?? 'guest'}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    const t = setTimeout(() => showLokiMessage(LOKI_EVENTS.VK_ENTRY, { source: 'vk_miniapp' }), 1800);
    return () => clearTimeout(t);
  }, [loading, user]);

  useEffect(() => {
    const handler = (event) => {
      showLokiMessage(LOKI_EVENTS.VK_EXTERNAL_LINK, { source: 'vk_safe_link', host: event.detail?.host });
    };
    window.addEventListener('apg:vk-external-link', handler);
    return () => window.removeEventListener('apg:vk-external-link', handler);
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

      if (!isGuest) {
        await ensureOwnerAuthSession(userData.id, userData.authProvider || (userData.email ? 'email_restore' : String(userData.id).startsWith('tg_') ? 'telegram_restore' : 'vk'));
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
        setSavedNews(Array.isArray(data.savedNews) ? data.savedNews.map(String) : []);
        setReadLaterNews(Array.isArray(data.readLaterNews) ? data.readLaterNews.map(String) : []);
        setNewsReactions(data.newsReactions && typeof data.newsReactions === 'object' ? data.newsReactions : {});
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
          savedNews: [], readLaterNews: [], newsReactions: {},
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

  const triggerPullRefresh = useCallback(async () => {
    if (pullRefreshing || !PULL_REFRESH_PANELS.has(activePanel)) return;
    setPullRefreshing(true);
    try {
      await handleRefresh();
    } finally {
      if (mountedRef.current) {
        setPullRefreshing(false);
        setPullDistance(0);
      }
    }
  }, [activePanel, handleRefresh, pullRefreshing]);

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

  const canWriteUserNewsState = useCallback(() => {
    if (!user || String(user.id).startsWith('guest_')) {
      showToast('Войдите в аккаунт, чтобы сохранять новости.', 'info');
      return false;
    }
    return true;
  }, [showToast, user]);

  const toggleSavedNews = useCallback(async (item) => {
    const id = item?.id ? String(item.id) : '';
    if (!id || !canWriteUserNewsState()) return;
    const prev = savedNews;
    const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id];
    setSavedNews(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { savedNews: next });
      showToast(next.includes(id) ? 'Новость сохранена.' : 'Новость убрана из сохранённых.', 'success');
    } catch (e) {
      setSavedNews(prev);
      logError(e, 'UserApp.toggleSavedNews');
      showToast('Не удалось сохранить новость. Попробуйте ещё раз.', 'error');
    }
  }, [canWriteUserNewsState, savedNews, showToast, user]);

  const toggleReadLaterNews = useCallback(async (item) => {
    const id = item?.id ? String(item.id) : '';
    if (!id || !canWriteUserNewsState()) return;
    const prev = readLaterNews;
    const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id];
    setReadLaterNews(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { readLaterNews: next });
      showToast(next.includes(id) ? 'Добавлено в список на потом.' : 'Убрано из списка на потом.', 'success');
    } catch (e) {
      setReadLaterNews(prev);
      logError(e, 'UserApp.toggleReadLaterNews');
      showToast('Не удалось обновить список. Попробуйте ещё раз.', 'error');
    }
  }, [canWriteUserNewsState, readLaterNews, showToast, user]);

  const reactToNews = useCallback(async (item, reaction) => {
    const id = item?.id ? String(item.id) : '';
    if (!id || !reaction || !canWriteUserNewsState()) return;
    const prev = newsReactions;
    const next = { ...prev, [id]: reaction };
    setNewsReactions(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { newsReactions: next });
      updateDoc(doc(db, 'news', id), { [`reactions.${reaction}`]: increment(1) }).catch(() => {});
      showToast('Реакция сохранена.', 'success');
    } catch (e) {
      setNewsReactions(prev);
      logError(e, 'UserApp.reactToNews');
      showToast('Не удалось сохранить реакцию. Попробуйте ещё раз.', 'error');
    }
  }, [canWriteUserNewsState, newsReactions, showToast, user]);

  // ─── Скан ───────────────────────────────────────────────────────────────────

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

    let rawQrValue = typeof placeIdentifier === 'string' ? placeIdentifier.trim() : String(placeIdentifier ?? '').trim();
    try {
      const parsed = new URL(rawQrValue, APP_URL);
      const scanValue = parsed.searchParams.get('scan');
      const partnerId = parsed.searchParams.get('partner');
      const expertId = parsed.searchParams.get('expert');
      if (scanValue) {
        rawQrValue = scanValue;
      } else if (partnerId) {
        const partner = enrichedPartners.find(p => p.id === partnerId);
        if (partner) {
          openPartner(partner);
          updateDoc(doc(db, 'partners', partner.id), { publicQRScans: increment(1) }).catch(() => {});
          showToast('Это информационный QR. Для ключа попросите служебный QR у сотрудника.', 'info');
        } else {
          showToast('Партнёр не найден');
        }
        setIsScannerOpen(false);
        isScanningRef.current = false;
        return;
      } else if (expertId) {
        const expert = experts.find(e => e.id === expertId);
        if (expert) {
          updateDoc(doc(db, 'experts', expert.id), { publicQRScans: increment(1) }).catch(() => {});
          showToast('Это информационный QR. Для ключа попросите служебный QR у эксперта.', 'info');
        } else {
          showToast('Эксперт не найден');
        }
        setIsScannerOpen(false);
        isScanningRef.current = false;
        return;
      }
    } catch (e) {
      if (rawQrValue.includes('?partner=') || rawQrValue.includes('?expert=')) {
        logError(e, 'UserApp.handleConfirmScan.parsePublicQr');
      }
    }

    const partnerByName = enrichedPartners.find(p => p.name === rawQrValue);
    const qrValue = partnerByName?.id ?? rawQrValue;

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
      haptic(awardedKeys > 0 ? 'success' : 'medium');
      if (awardedKeys > 0) {
        setUserKeys(prev => prev + awardedKeys);
        setKeyBurst({ amount: awardedKeys, id: Date.now() });
        showLokiMessage(LOKI_EVENTS.KEY_RECEIVED, { keysCount: awardedKeys, source: result.subjectType, id: result.subjectId });
        const partner = result.subjectType === 'partner'
          ? enrichedPartners.find(p => p.id === result.subjectId)
          : null;
        setScanSuccess({ ...result, partner });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast(null);
      } else {
        const days = Number(result.streak ?? streak) || 1;
        const label = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
        showToast(result.alreadyAwarded ? `Ключ уже был начислен. Визит отмечен, серия — ${days} ${label}.` : result.message, 'success');
      }
    } catch (e) {
      logError(e, 'UserApp.handleConfirmScan.reward');
      showLokiMessage(LOKI_EVENTS.APP_ERROR, { source: 'qr_scan' });
      showToast(getQrErrorMessage(e), 'error');
    } finally {
      setIsScannerOpen(false);
      isScanningRef.current = false;
    }
  }, [user, enrichedPartners, experts, streak, haptic, showToast]);

  // ─── Партнёры ───────────────────────────────────────────────────────────────

  const handlePartnerUpdate = useCallback((partnerId, updates) => {
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, ...updates } : p));
    setActivePartner(prev => prev?.id === partnerId ? { ...prev, ...updates } : prev);
  }, []);

  const openPartner = useCallback((partner) => {
    setActivePartner(partner);
    showLokiMessage(LOKI_EVENTS.PARTNER_OPENED, { id: partner?.id, partnerName: partner?.name });
    navigatePanel('partner');
  }, [navigatePanel]);

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
      navigatePanel('experts');
      updateDoc(doc(db, 'experts', e.id), { publicQRScans: increment(1) }).catch(() => {});
    }
  }, [pendingExpertId, experts, navigatePanel]);

  // ─── Задания ────────────────────────────────────────────────────────────────

  const handleClaim = useCallback(async (taskId, reward) => {
    if (!user) return;
    let captured;
    setCompletedTasks(prev => { captured = [...prev, taskId]; return captured; });
    setUserKeys(prev => prev + reward);
    try {
      const uid = String(user.id);
      await updateDoc(doc(db, 'users', uid), { completedTasks: captured, keys: increment(reward) });
      showLokiMessage(LOKI_EVENTS.ACHIEVEMENT_UNLOCKED, { taskId, reward });
      addDoc(collection(db, 'users', uid, 'activity'), {
        type: 'task', icon: '✅',
        text: `Задание выполнено: +${reward} ключей`,
        ts: serverTimestamp(),
      }).catch(() => {});
    } catch (e) {
      logError(e, 'UserApp.handleClaim');
      showLokiMessage(LOKI_EVENTS.APP_ERROR, { source: 'task_claim' });
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
    traceAuthStage('email_login_complete', { userId: emailUser?.id ?? null });
    localStorage.removeItem('manualLogout');
    localStorage.setItem('apg_email_user', JSON.stringify(emailUser));
    window.location.reload();
  }, []);

  const handleEmailAuthSuccess = useCallback(async (emailUser, authPayload = {}) => {
    if (!emailUser?.id) return;
    setConsentError('');
    traceAuthStage('email_user_received', { userId: emailUser.id, hasToken: !!authPayload?.token });
    try {
      await ensureOwnerAuthSession(emailUser.id, 'email');
      traceAuthStage('email_owner_session_ready', { userId: emailUser.id, uid: auth.currentUser?.uid ?? null });
      const snap = await getDoc(doc(db, 'users', String(emailUser.id)));
      const data = snap.exists() ? snap.data() : null;
      traceAuthStage('email_user_doc_loaded', { userId: emailUser.id, exists: snap.exists(), acceptedLegal: hasAcceptedCurrentLegal(data) });
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
      traceAuthStage('email_auth_error', { userId: emailUser.id, error: e?.message ?? String(e) });
      setConsentError(getAuthErrorMessage(e));
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
    setConsentError('');
    traceAuthStage('consent_accept_start', { userId: targetUser.id, mode: consentRequest?.mode ?? 'unknown' });
    try {
      await ensureOwnerAuthSession(targetUser.id, consentRequest?.mode === 'email' ? 'email_consent' : 'legal_consent');
      traceAuthStage('consent_owner_session_ready', { userId: targetUser.id, uid: auth.currentUser?.uid ?? null });
      const userRef = doc(db, 'users', String(targetUser.id));
      const existingSnap = await getDoc(userRef);
      traceAuthStage('consent_user_doc_loaded', { userId: targetUser.id, exists: existingSnap.exists() });
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
        traceAuthStage('consent_saved_firestore', { userId: targetUser.id, mode: consentRequest?.mode ?? 'unknown' });
      } else {
        localStorage.setItem('apg_pending_consents', JSON.stringify({
          userId: String(targetUser.id),
          consents: { ...consentPayload, acceptedAt: new Date().toISOString() },
          consentDocsVersion: CONSENT_DOCS_VERSION,
          consentLegalVersion: LEGAL_VERSION,
          notificationConsent: !!notificationsAccepted,
        }));
        traceAuthStage('consent_saved_pending', { userId: targetUser.id, mode: consentRequest?.mode ?? 'unknown' });
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
      traceAuthStage('consent_flow_complete', { userId: targetUser.id, mode: consentRequest?.mode ?? 'unknown' });
    } catch (e) {
      logError(e, 'UserApp.handleConsentAccept');
      traceAuthStage('consent_error', { userId: targetUser.id, mode: consentRequest?.mode ?? 'unknown', error: e?.message ?? String(e) });
      setConsentError(getAuthErrorMessage(e));
      showToast('Не удалось сохранить согласия. Ошибка записана, попробуйте ещё раз.', 'error');
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
  const edgeSwipeRef = useRef(false);
  const pullTouchRef = useRef({ active: false, startY: 0, startX: 0 });

  const handleSwipeStart = useCallback((e) => {
    const touch = e.touches[0];
    swipeTouchX.current = touch.clientX;
    swipeTouchY.current = touch.clientY;
    edgeSwipeRef.current = touch.clientX <= 24 && (activePanel !== 'home' || panelHistoryRef.current.length > 1);
    pullTouchRef.current = {
      active: window.scrollY <= 2 && PULL_REFRESH_PANELS.has(activePanel) && !pullRefreshing,
      startY: touch.clientY,
      startX: touch.clientX,
    };
  }, [activePanel, pullRefreshing]);

  const handleSwipeMove = useCallback((e) => {
    const pull = pullTouchRef.current;
    if (!pull.active || pullRefreshing) return;
    const touch = e.touches[0];
    const dy = touch.clientY - pull.startY;
    const dx = touch.clientX - pull.startX;
    if (Math.abs(dx) > 46 || dy < 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(86, Math.round(dy * 0.42)));
  }, [pullRefreshing]);

  const handleSwipeEnd = useCallback((e) => {
    if (swipeTouchX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchY.current;
    const wasEdgeSwipe = edgeSwipeRef.current;
    const pull = pullTouchRef.current;
    swipeTouchX.current = null;
    swipeTouchY.current = null;
    edgeSwipeRef.current = false;
    pullTouchRef.current = { active: false, startY: 0, startX: 0 };

    if (wasEdgeSwipe && dx > 72 && Math.abs(dy) < 76) {
      haptic('light');
      goBackPanel();
      setPullDistance(0);
      return;
    }

    if (pull.active && dy > 118 && Math.abs(dx) < 54) {
      triggerPullRefresh();
      return;
    }
    setPullDistance(0);

    // Только горизонтальные свайпы > 90px при вертикальном сдвиге < 60px
    if (wasEdgeSwipe || Math.abs(dx) < 90 || Math.abs(dy) > 60) return;
    const idx = SWIPE_TABS.indexOf(activePanel);
    if (idx === -1) return;          // не на основном табе
    if (dx < 0 && idx < SWIPE_TABS.length - 1) { haptic('light'); goPanel(SWIPE_TABS[idx + 1]); }
    if (dx > 0 && idx > 0)                      { haptic('light'); goPanel(SWIPE_TABS[idx - 1]); }
  }, [activePanel, goBackPanel, goPanel, haptic, triggerPullRefresh]);

  // ─── Уведомления ────────────────────────────────────────────────────────────

  const openNotifications = useCallback(() => {
    localStorage.setItem('apg_notif_seen', String(Date.now()));
    setUnreadCount(0);
    navigatePanel('notifications');
  }, [navigatePanel]);

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
  const activeTabIndex = TABS.findIndex(tab => tab.id === activePanel);

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
    const updateIndicator = () => {
      const shell = tabBarRef.current;
      const slot = tabSlotRefs.current[activeTabIndex];
      if (!shell || !slot || activeTabIndex < 0 || isScannerOpen) {
        setTabIndicator(prev => prev.ready ? { ...prev, ready: false } : prev);
        return;
      }
      const next = {
        center: Math.round(slot.offsetLeft + slot.offsetWidth / 2 - 2),
        width: Math.max(0, Math.round(slot.offsetWidth)),
        ready: true,
      };
      setTabIndicator(prev => (
        prev.center === next.center && prev.width === next.width && prev.ready === next.ready ? prev : next
      ));
    };

    updateIndicator();
    const raf = requestAnimationFrame(updateIndicator);
    window.addEventListener('resize', updateIndicator, { passive: true });
    window.visualViewport?.addEventListener('resize', updateIndicator, { passive: true });
    window.addEventListener('orientationchange', updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateIndicator);
      window.visualViewport?.removeEventListener('resize', updateIndicator);
      window.removeEventListener('orientationchange', updateIndicator);
    };
  }, [activeTabIndex, isScannerOpen]);

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
    safeScrollTop();
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
    transition: `transform ${MOTION.duration.base}ms ${MOTION.ease.standard}, min-height ${MOTION.duration.base}ms ${MOTION.ease.standard}, padding ${MOTION.duration.base}ms ${MOTION.ease.standard}, box-shadow ${MOTION.duration.base}ms ${MOTION.ease.standard}, backdrop-filter ${MOTION.duration.base}ms ${MOTION.ease.standard}, -webkit-backdrop-filter ${MOTION.duration.base}ms ${MOTION.ease.standard}`,
    willChange: 'transform, min-height, padding, backdrop-filter',
    contain: 'layout paint style',
    isolation: 'isolate',
  };

  const tabBarEl = (
    <div ref={tabBarRef} style={tabBarShellStyle}>
      {activeTabIndex >= 0 && !isScannerOpen && (
        <div
          aria-hidden="true"
          data-apg-tab-indicator="true"
          style={{
            position: 'absolute',
            top: 'var(--apg-island-pad, 8px)',
            bottom: 'var(--apg-island-pad, 8px)',
            left: tabIndicator.ready ? tabIndicator.center : '10%',
            width: tabIndicator.ready ? tabIndicator.width : 'calc(20% - 8px)',
            boxSizing: 'border-box',
            borderRadius: 23,
            background: 'radial-gradient(circle at 50% 0%, rgba(255,245,203,0.26), transparent 56%), linear-gradient(145deg, rgba(244,217,140,0.19), rgba(255,255,255,0.07))',
            border: '1px solid rgba(244,217,140,0.24)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), 0 10px 26px var(--apg2-elev-shadow, rgba(0,0,0,0.16))',
            transform: 'translate3d(-50%,0,0)',
            transition: `left ${MOTION.duration.base}ms ${MOTION.ease.standard}, width ${MOTION.duration.base}ms ${MOTION.ease.standard}, opacity ${MOTION.duration.fast}ms ${MOTION.ease.standard}`,
            opacity: tabIndicator.ready ? 1 : 0,
            zIndex: 0,
          }}
        />
      )}
      {TABS.map((tab, i) => {
        if (i === 2) return (
          <button key="scan" ref={node => { tabSlotRefs.current[i] = node; }} data-apg-tab-slot="scan" aria-label="Открыть сканер" onClick={() => { haptic('medium'); setIsScannerOpen(true); }}
            style={{ flex: 1, background: isScannerOpen ? 'linear-gradient(145deg, rgba(244,217,140,0.18), rgba(255,255,255,0.08))' : 'none', border: isScannerOpen ? '1px solid rgba(244,217,140,0.23)' : '1px solid transparent', borderRadius: 23, boxShadow: isScannerOpen ? 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 26px var(--apg2-elev-shadow, rgba(0,0,0,0.18))' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0, position: 'relative', zIndex: 2, transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease' }}>
            <div style={{
              width: 42, height: 42, marginTop: 0, borderRadius: 18,
              background: isScannerOpen ? 'rgba(201,168,76,0.25)' : V2GoldMetal,
              boxShadow: isScannerOpen ? 'none' : '0 12px 26px rgba(216,184,103,0.18), inset 0 1px 0 rgba(255,255,255,0.36), inset 0 -8px 18px rgba(83,58,18,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#0F0F1A',
              transition: `transform ${MOTION.duration.modal}ms ${MOTION.ease.standard}, box-shadow ${MOTION.duration.modal}ms ${MOTION.ease.standard}`,
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
            ref={node => { tabSlotRefs.current[i] = node; }}
            data-apg-tab-slot={tab.id}
            aria-label={`Открыть раздел ${tab.label}`}
            onClick={() => { haptic('light'); goPanel(tab.id); }}
            style={{ flex: 1, background: 'none', border: '1px solid transparent', borderRadius: 23, boxShadow: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0, position: 'relative', zIndex: 1, minWidth: 0, transform: isActive ? 'translateY(-0.5px)' : 'translateY(0)', transition: motionTransition(['transform', 'background', 'border-color', 'box-shadow'], 'base') }}>
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

  const lokiAppState = useMemo(() => ({
    activePanel,
    user,
    partners: enrichedPartners,
    events,
    news,
    notifications,
    customTasks,
    experts,
    userKeys,
    favorites,
    lastScanDate,
    unreadCount,
    registeredEventIds,
    completedTasks,
    platform: isVK() ? 'vk-miniapp' : 'web-app',
  }), [activePanel, completedTasks, customTasks, enrichedPartners, events, experts, favorites, lastScanDate, news, notifications, registeredEventIds, unreadCount, user, userKeys]);

  const lokiAppActions = useMemo(() => ({
    [LOKI_APP_ACTIONS.OPEN_PARTNER]: ({ partnerId, id } = {}) => {
      const targetId = partnerId ?? id;
      const partner = targetId ? enrichedPartners.find(p => p.id === targetId) : enrichedPartners[0];
      if (partner) openPartner(partner);
      else goPanel('offers');
    },
    [LOKI_APP_ACTIONS.OPEN_EVENT]: () => goPanel('events'),
    [LOKI_APP_ACTIONS.OPEN_NEWS]: () => goPanel('news'),
    [LOKI_APP_ACTIONS.OPEN_PRIZE]: () => goPanel('rewards'),
    [LOKI_APP_ACTIONS.OPEN_MAP]: () => goPanel('map'),
    [LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS]: () => goPanel('nearby'),
    [LOKI_APP_ACTIONS.SHOW_PROFILE]: () => goPanel('profile'),
    [LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS]: () => goPanel('tasks'),
    [LOKI_APP_ACTIONS.SHOW_FAVORITES]: () => goPanel('profile'),
    [LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS]: () => openNotifications(),
    [LOKI_APP_ACTIONS.START_QR_SCANNER]: () => setIsScannerOpen(true),
    [LOKI_APP_ACTIONS.OPEN_SETTINGS]: () => goPanel('profile'),
    [LOKI_APP_ACTIONS.OPEN_REFERENCE]: () => goPanel('reference'),
    [LOKI_APP_ACTIONS.OPEN_LOKI]: () => goPanel('loki'),
  }), [enrichedPartners, goPanel, openNotifications, openPartner]);

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
    onOpenNews: () => goPanel('news'),
    joinedGroup,
    onJoinGroup: handleJoinGroup,
    userCount: platformStats.userCount,
    onOpenForPartners: () => goPanel('for-partners'),
    onOpenMap: () => goPanel('map'),
    onOpenNearby: () => goPanel('nearby'),
    onOpenReference: () => goPanel('reference'),
    onOpenLoki: () => goPanel('loki'),
  };

  return (
    <ConfigProvider appearance={appearance}>
      <AdaptivityProvider>
        <AppRoot>
          <LokiProvider user={user} activePanel={activePanel} appActions={lokiAppActions} appState={lokiAppState}>
          <div
            style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', minHeight: '100svh', position: 'relative', zIndex: 1, overflowX: 'clip' }}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
          >

            {(pullDistance > 0 || pullRefreshing) && (
              <div style={{
                position: 'fixed',
                top: 'calc(var(--safe-top, 0px) + 10px)',
                left: '50%',
                zIndex: 11000,
                transform: `translate3d(-50%, ${pullRefreshing ? 18 : Math.min(34, pullDistance * 0.36)}px, 0) scale(${pullRefreshing ? 1 : Math.min(1, 0.82 + pullDistance / 260)})`,
                opacity: pullRefreshing ? 1 : Math.min(1, pullDistance / 56),
                pointerEvents: 'none',
                transition: pullRefreshing ? 'transform 180ms ease, opacity 180ms ease' : 'none',
              }}>
                <div style={{ ...APG2_PROFILE.glass, height: 44, minWidth: 128, borderRadius: 999, padding: '0 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: APG2_PROFILE.text, boxShadow: '0 16px 42px var(--apg2-elev-shadow, rgba(0,0,0,0.24)), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.30)' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(215,184,106,0.22)', borderTopColor: APG2_PROFILE.gold, animation: pullRefreshing ? 'spin 0.82s linear infinite' : 'none', transform: pullRefreshing ? 'none' : `rotate(${pullDistance * 4}deg)` }} />
                  <span style={{ fontSize: 12, fontWeight: 780, color: APG2_PROFILE.textSoft }}>{pullRefreshing ? 'Обновляем' : 'Потяните ещё'}</span>
                </div>
              </div>
            )}

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

            <div key={activePanel} style={{ minHeight: '100%', animation: `${panelTransition === 'back' ? 'pageSlideBackIn' : 'pageSlideForwardIn'} var(--motion-panel, 280ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both` }}>
            <View activePanel={activePanel}>

              {/* nav= нужен View для навигации; Panel id внутри компонента — для стилей */}
              <HomePanelV2 {...homePanelProps} />

              <Panel id="news">
                <Suspense fallback={<LazyFallback />}>
                  <NewsPage
                    news={news}
                    user={user}
                    savedNews={savedNews}
                    readLaterNews={readLaterNews}
                    newsReactions={newsReactions}
                    onBack={goBackPanel}
                    onReact={reactToNews}
                    onSave={toggleSavedNews}
                    onReadLater={toggleReadLaterNews}
                    onRefresh={handleRefresh}
                  />
                </Suspense>
              </Panel>

              <Panel id="partner">
                <Suspense fallback={<LazyFallback />}>
                  <PartnerPage
                    partner={activePartner ? (enrichedPartners.find(p => p.id === activePartner.id) ?? activePartner) : null}
                    variant="v2"
                    isFavorite={activePartner ? favorites.includes(activePartner.id) : false}
                    onBack={goBackPanel}
                    onToggleFavorite={toggleFavorite}
                    onOpenPartner={openPartner}
                    partners={enrichedPartners}
                    user={user}
                    scannedPartnerIds={scannedPartnerIds}
                    visitCounts={visitCounts}
                    onPartnerUpdate={handlePartnerUpdate}
                    onScan={() => setIsScannerOpen(true)}
                    reviewPrompt={activePartner ? reviewPromptPartnerId === activePartner.id : false}
                    onReviewPromptHandled={() => setReviewPromptPartnerId(null)}
                  />
                </Suspense>
              </Panel>

              <Panel id="loki">
                <Suspense fallback={<LazyFallback />}>
                  <LokiPage
                    onBack={goBackPanel}
                    onOpenReference={() => goPanel('reference')}
                    onOpenPanel={goPanel}
                  />
                </Suspense>
              </Panel>

              <Panel id="reference">
                <Suspense fallback={<LazyFallback />}>
                  <ReferencePage
                    onBack={goBackPanel}
                    onOpenLoki={() => goPanel('loki')}
                    onOpenPanel={goPanel}
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
                    news={news}
                    savedNews={savedNews}
                    readLaterNews={readLaterNews}
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
                    onOpenReference={() => goPanel('reference')}
                    onOpenLoki={() => goPanel('loki')}
                    onOpenNews={() => goPanel('news')}
	                  />
                </Suspense>
              </Panel>

              {/* Lazy pages — Suspense обёрнут в Panel чтобы View видел nav/id */}
              <Panel id="events">
                <Suspense fallback={<LazyFallback />}>
                  <EventsPage nav="events" variant="v2" events={events} onBack={goBackPanel} appearance={appearance} />
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
                    onBack={goBackPanel}
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
                    onBack={goBackPanel}
                  />
                </Suspense>
              </Panel>

              <Panel id="offers">
                <Suspense fallback={<LazyFallback />}>
                  <OffersPage variant="v2" partners={enrichedPartners} onOpenPartner={openPartner} onBack={goBackPanel} />
                </Suspense>
              </Panel>

              <Panel id="activity">
                <Suspense fallback={<LazyFallback />}>
                  <ActivityPage nav="activity" variant="v2" userId={user?.id ? String(user.id) : null} onBack={goBackPanel} />
                </Suspense>
              </Panel>

              <Panel id="referral">
                <Suspense fallback={<LazyFallback />}>
                  <ReferralPage
                    variant="v2"
                    user={user} referralCount={referralCount}
                    completedTasks={completedTasks}
                    onBack={goBackPanel}
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
                    onBack={goBackPanel}
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
                    onBack={goBackPanel}
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
                    onBack={goBackPanel}
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
                    onBack={goBackPanel}
                    isActive={activePanel === 'experts'}
                    initialExpertId={pendingExpertId}
                    onScan={() => setIsScannerOpen(true)}
                  />
                </Suspense>
              </Panel>

              <Panel id="map">
                <Suspense fallback={<LazyFallback />}>
                  <MapPage variant="v2" partners={partners} onOpenPartner={openPartner} onBack={goBackPanel} />
                </Suspense>
              </Panel>

              <Panel id="nearby">
                <Suspense fallback={<LazyFallback />}>
                  <NearbyPage variant="v2" partners={enrichedPartners} onOpenPartner={openPartner} onOpenMap={() => goPanel('map')} onBack={goBackPanel} />
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
                    onBack={goBackPanel}
                  />
                </Suspense>
              </Panel>

              <Panel id="for-partners">
                <Suspense fallback={<LazyFallback />}>
                  <ForPartnersPage
                    userCount={platformStats.userCount}
                    partnerCount={partners.length}
                    totalScans={platformStats.totalScans}
                    onBack={goBackPanel}
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

          <ScanSuccessModal
            result={scanSuccess}
            onClose={() => setScanSuccess(null)}
            onReview={() => {
              const partner = scanSuccess?.partner;
              setScanSuccess(null);
              if (!partner) return;
              setReviewPromptPartnerId(partner.id);
              openPartner(partner);
            }}
          />

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
              error={consentError}
              onAccept={handleConsentAccept}
              onCancel={consentRequest.mode === 'email' ? () => {
                if (consentSaving) return;
                setConsentError('');
                setConsentRequest(null);
              } : undefined}
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
          {splashDone && !isScannerOpen && !consentRequest && <LokiAssistant />}
          </LokiProvider>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
