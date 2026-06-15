import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, increment,
  collection, getDocs, query, orderBy,
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
  const [splashDone, setSplashDone]             = useState(false);

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

  const [unreadCount, setUnreadCount]           = useState(0);
  const [notifEnabled, setNotifEnabled]         = useState(
    () => localStorage.getItem('apg_notif_enabled') === '1',
  );

  const [isScannerOpen, setIsScannerOpen]       = useState(false);
  const [partners, setPartners]                 = useState([]);
  const [events, setEvents]                     = useState([]);
  const [news, setNews]                         = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [showOnboarding, setShowOnboarding]     = useState(false);

  // ─── Загрузка данных ────────────────────────────────────────────────────────

  const loadData = useCallback(async (isMounted) => {
    setLoading(true); setError(null);
    try {
      vkBridge.send('VKWebAppInit');
      const userData = await Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]).catch(() => ({ id: 'guest', first_name: 'Участник', last_name: 'АПГ', photo_200: null }));

      if (!isMounted.current) return;
      setUser(userData);

      const [pSnap, eSnap, nSnap, notifSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
        getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
      ]);

      if (!isMounted.current) return;
      setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const lastSeen = localStorage.getItem('apg_notif_seen');
      const lastSeenDate = lastSeen ? new Date(Number(lastSeen)) : null;
      const unread = notifSnap.docs.filter(d => {
        if (!lastSeenDate) return true;
        const ts = d.data().createdAt;
        if (!ts) return false;
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date > lastSeenDate;
      }).length;
      setUnreadCount(unread);

      const userRef = doc(db, 'users', String(userData.id));
      const docSnap = await getDoc(userRef);
      if (!isMounted.current) return;

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserKeys(data.keys ?? 0);
        setFavorites(data.favorites ?? []);
        setScannedPartnerIds(data.scannedPartners ?? {});
        setCompletedTasks(data.completedTasks ?? []);
        setStreak(data.streak ?? 0);
        setLastScanDate(data.lastScanDate ?? null);
        setReferralCount(data.referralCount ?? 0);
        if (!data.onboardingDone) setShowOnboarding(true);
      } else {
        await setDoc(userRef, {
          keys: 0, favorites: [], scannedPartners: {},
          completedTasks: [], streak: 0, onboardingDone: false,
        });
        setShowOnboarding(true);
      }
    } catch (e) {
      console.error(e);
      if (isMounted.current) setError('Не удалось загрузить данные.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

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
    const prev = favorites;
    const next = favorites.includes(partnerId)
      ? favorites.filter(id => id !== partnerId)
      : [...favorites, partnerId];
    setFavorites(next);
    try { await updateDoc(doc(db, 'users', String(user.id)), { favorites: next }); }
    catch { setFavorites(prev); }
  }, [user, favorites]);

  // ─── Скан ───────────────────────────────────────────────────────────────────

  const handleConfirmScan = useCallback(async (placeIdentifier) => {
    if (!user) return;
    const partner = partners.find(p => p.id === placeIdentifier || p.name === placeIdentifier);
    if (!partner) { setIsScannerOpen(false); return; }

    const todayKey = new Date().toISOString().slice(0, 10);
    const alreadyScannedToday = lastScanDate === todayKey;
    const newStreak = alreadyScannedToday ? streak : streak + 1;

    try {
      await updateDoc(doc(db, 'users', String(user.id)), {
        keys: increment(1),
        [`scannedPartners.${partner.id}`]: true,
        lastScanDate: todayKey,
        streak: newStreak,
      });
      setUserKeys(prev => prev + 1);
      setScannedPartnerIds(prev => ({ ...prev, [partner.id]: true }));
      setLastScanDate(todayKey);
      setStreak(newStreak);
    } catch (e) { console.error(e); }
    finally { setIsScannerOpen(false); }
  }, [user, partners, lastScanDate, streak]);

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

  // ─── Профиль ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    setUser(null); setUserKeys(0); setFavorites([]);
    setScannedPartnerIds({}); setCompletedTasks([]); setStreak(0);
    setActivePanel('home');
    const isMounted = { current: true };
    loadData(isMounted);
  }, [loadData]);

  const handleDeleteProfile = useCallback(async () => {
    if (!user || user.id === 'guest') return;
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
      position: 'fixed', bottom: 0,
      left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, height: 62,
      background: 'rgba(8,8,24,0.55)',
      backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      borderTop: '1px solid rgba(255,255,255,0.12)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
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
          <button key="scan" onClick={() => setIsScannerOpen(true)}
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
            onClick={() => goPanel(tab.id)}
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
          <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 62, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
            <View activePanel={activePanel}>

              {/* nav= нужен View для навигации; Panel id внутри компонента — для стилей */}
              <HomePanel
                nav="home"
                user={user} userKeys={userKeys} favorites={favorites}
                partners={partners} events={events} news={news}
                loading={loading} error={error}
                streak={streak} lastScanDate={lastScanDate}
                completedTasks={completedTasks} referralCount={referralCount}
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
                partners={partners}
                user={user}
                scannedPartnerIds={scannedPartnerIds}
                onPartnerUpdate={handlePartnerUpdate}
              />

              {/* ProfilePanel не рендерит Panel — оборачиваем */}
              <Panel id="profile">
                <ProfilePanel
                  user={user} userKeys={userKeys} favorites={favorites}
                  partners={partners} referralCount={referralCount}
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
                  <OffersPage partners={partners} onOpenPartner={openPartner} onBack={() => goPanel('home')} />
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
                    onClaim={handleClaim}
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
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
