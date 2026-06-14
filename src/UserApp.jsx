import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, addDoc, serverTimestamp, deleteDoc, query, orderBy, where, arrayUnion } from 'firebase/firestore';
import ScannerComponent from './Scanner.jsx';
import { ProfilePanel }    from './ProfilePanel.jsx';
import { HomePanel }       from './HomePanel.jsx';
import { PartnerPage }     from './PartnerPage.jsx';
import { Onboarding }      from './Onboarding.jsx';
import { EventsPage }      from './EventsPage.jsx';
import { LeaderboardPage } from './LeaderboardPage.jsx';
import { ActivityPage }    from './ActivityPage.jsx';
import { OffersPage }     from './OffersPage.jsx';
import { TasksPage }     from './TasksPage.jsx';
import { ConsentScreen }   from './ConsentScreen.jsx';
import { LoginScreen }     from './LoginScreen.jsx';

const T = { bg: '#0F0F1A', gold: '#C9A84C', goldL: '#E8C97A', textPri: '#F0F0F0', textSec: 'rgba(240,240,240,0.35)', border: 'rgba(255,255,255,0.07)' };

const APP_ID          = 54601851;
const CACHE_KEY       = 'apg_v1';
const CACHE_TTL       = 30 * 60 * 1000;
const EVENTS_CNT_KEY  = 'apg_events_count';
const LOGGED_OUT_KEY  = 'apg_logged_out';

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.ts > CACHE_TTL) return null;
    return c;
  } catch { return null; }
};

const writeCache = (partners, events) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ partners, events, ts: Date.now() })); }
  catch {}
};

// ─── Баннер новых событий ─────────────────────────────────────────────────────

function NewEventsBanner({ count, onView, onDismiss }) {
  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [count, onDismiss]);

  if (count <= 0) return null;
  const label = count === 1 ? 'Новое событие!' : `${count} новых события!`;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300, padding: '12px 16px', animation: 'slideDown 0.4s ease' }}>
      <div style={{ background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, borderRadius: 18, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🎉</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: '#0F0F1A', fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'rgba(15,15,26,0.65)', marginTop: 1 }}>Партнёры АПГ что-то готовят</div>
        </div>
        <button onClick={onView} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#0F0F1A', color: T.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Смотреть</button>
        <button onClick={onDismiss} style={{ background: 'rgba(15,15,26,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: '#0F0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

// ─── Модалка уведомлений ──────────────────────────────────────────────────────

function NotificationModal({ notifications, onDismiss }) {
  const [idx, setIdx] = useState(0);
  const notif = notifications[idx];
  const isLast = idx === notifications.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,10,20,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#1A1A2E', borderRadius: 28, border: '1px solid rgba(255,255,255,0.07)', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease' }}>
        {notifications.length > 1 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(240,240,240,0.3)', marginBottom: 16 }}>
            {idx + 1} из {notifications.length}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 14 }}>{notif.emoji ?? '🔔'}</div>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#F0F0F0', marginBottom: 8, lineHeight: '24px' }}>{notif.title}</div>
        {notif.body && (
          <div style={{ textAlign: 'center', fontSize: 14, color: 'rgba(240,240,240,0.55)', lineHeight: '21px', marginBottom: 22 }}>{notif.body}</div>
        )}
        <button
          onClick={() => isLast ? onDismiss() : setIdx(i => i + 1)}
          style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
        >
          {isLast ? 'Понятно' : 'Следующее →'}
        </button>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export function UserApp() {
  // Экраны: 'loading' | 'login' | 'consent' | 'app'
  const [screen, setScreen]         = useState('loading');
  const [activePanel, setActivePanel] = useState('home');
  const [activePartner, setActivePartner] = useState(null);

  const [user, setUser]               = useState(null);
  const [userKeys, setUserKeys]       = useState(0);
  const [favorites, setFavorites]     = useState([]);
  const [partners, setPartners]       = useState([]);
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // userData сохраняем для использования в handleConsentAccept
  const [pendingUserData, setPendingUserData] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  // Реферальный ID из хэша URL (e.g. #ref_988504)
  const pendingRefId = useRef((() => {
    const m = window.location.hash.match(/ref_(\d+)/);
    return m ? m[1] : null;
  })());

  const loadUserData = useCallback(async (userData) => {
    const userRef = doc(db, 'users', String(userData.id));
    const docSnap = await getDoc(userRef);
    const profile = {
      firstName: userData.first_name ?? '',
      lastName:  userData.last_name  ?? '',
      photo:     userData.photo_200  ?? null,
    };

    if (!docSnap.exists()) {
      // Новый пользователь — создаём минимальный документ, показываем согласие
      const refId = pendingRefId.current;
      const referredBy = refId && refId !== String(userData.id) ? { referredBy: refId } : {};
      await setDoc(userRef, { keys: 0, favorites: [], onboardingDone: false, consentGiven: false, notificationsEnabled: false, ...profile, ...referredBy });
      setPendingUserData(userData);
      setScreen('consent');
      return;
    }

    const data = docSnap.data();

    if (!data.consentGiven) {
      // Старый пользователь без флага согласия
      setPendingUserData(userData);
      setScreen('consent');
      return;
    }

    // Согласие дано — загружаем данные
    setUserKeys(data.keys ?? 0);
    setFavorites(data.favorites ?? []);
    setNotificationsEnabled(data.notificationsEnabled ?? false);
    setReferralCount(data.referralCount ?? 0);
    setCompletedTasks(data.completedTasks ?? []);
    if (!data.onboardingDone) setShowOnboarding(true);
    await updateDoc(userRef, profile).catch(() => {});

    // Проверяем уведомления
    try {
      const lastSeen = data.notificationsLastSeen ?? null;
      let notifQ;
      if (lastSeen) {
        notifQ = query(collection(db, 'notifications'), where('createdAt', '>', lastSeen), orderBy('createdAt', 'desc'));
      } else {
        notifQ = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
        await updateDoc(userRef, { notificationsLastSeen: serverTimestamp() }).catch(() => {});
      }
      if (lastSeen) {
        const notifSnap = await getDocs(notifQ);
        const notifs = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (notifs.length > 0) setUnreadNotifications(notifs);
      }
    } catch {}

    setScreen('app');
  }, []);

  const initApp = useCallback(async (isMounted) => {
    setError(null);

    // Если пользователь явно вышел — показываем экран входа
    if (localStorage.getItem(LOGGED_OUT_KEY) === 'true') {
      setScreen('login');
      setLoading(false);
      return;
    }

    const cached = readCache();
    if (cached) {
      setPartners(cached.partners);
      setEvents(cached.events);
    }
    setLoading(true);

    try {
      vkBridge.send('VKWebAppInit');
      const userData = await Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]).catch(() => ({ id: 'guest', first_name: 'Участник', last_name: 'АПГ', photo_200: null }));
      if (!isMounted.current) return;
      setUser(userData);

      const [pSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
      ]);
      if (!isMounted.current) return;
      const freshPartners = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const freshEvents   = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(freshPartners);
      setEvents(freshEvents);
      writeCache(freshPartners, freshEvents);

      // Детектируем новые события
      const lastCount = parseInt(localStorage.getItem(EVENTS_CNT_KEY) ?? '-1');
      if (lastCount >= 0 && freshEvents.length > lastCount) {
        setNewEventsCount(freshEvents.length - lastCount);
      }
      localStorage.setItem(EVENTS_CNT_KEY, String(freshEvents.length));

      await loadUserData(userData);
    } catch (e) {
      console.error(e);
      if (isMounted.current) {
        if (!cached) setError('Не удалось загрузить данные.');
        setScreen('app');
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [loadUserData]);

  useEffect(() => {
    const isMounted = { current: true };
    initApp(isMounted);
    return () => { isMounted.current = false; };
  }, [initApp]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleLogin = () => {
    localStorage.removeItem(LOGGED_OUT_KEY);
    setScreen('loading');
    setLoading(true);
    const isMounted = { current: true };
    initApp(isMounted);
  };

  const handleConsentAccept = async () => {
    const userData = pendingUserData;
    if (!userData) return;
    try {
      const userRef = doc(db, 'users', String(userData.id));
      await updateDoc(userRef, { consentGiven: true });
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserKeys(data.keys ?? 0);
        setFavorites(data.favorites ?? []);
        if (!data.onboardingDone) setShowOnboarding(true);

        // Кредитуем рефера при первом согласии
        if (data.referredBy && !data.referralCredited) {
          try {
            const referrerId = data.referredBy;
            await updateDoc(doc(db, 'users', referrerId), {
              keys: increment(2),
              referralCount: increment(1),
            });
            await addDoc(collection(db, 'users', referrerId, 'activity'), {
              type: 'referral', icon: '👥',
              text: 'Новый участник по вашей реферальной ссылке +2 🗝️',
              ts: serverTimestamp(),
            });
            await updateDoc(userRef, { referralCredited: true });
          } catch {}
        }
      }
    } catch (e) { console.error(e); }
    setPendingUserData(null);
    setScreen('app');
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user) {
      try { await updateDoc(doc(db, 'users', String(user.id)), { onboardingDone: true }); }
      catch (e) { console.error(e); }
    }
  };

  const logActivity = async (entry) => {
    if (!user || user.id === 'guest') return;
    try {
      await addDoc(collection(db, 'users', String(user.id), 'activity'), {
        ...entry, ts: serverTimestamp(),
      });
    } catch {}
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const prev = favorites;
    const isAdding = !favorites.includes(partnerId);
    const next = isAdding ? [...favorites, partnerId] : favorites.filter(id => id !== partnerId);
    setFavorites(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { favorites: next });
      const partner = partners.find(p => p.id === partnerId);
      await logActivity({
        type: isAdding ? 'favorite_add' : 'favorite_remove',
        icon: isAdding ? '⭐' : '💔',
        text: isAdding
          ? `Добавил в избранное: ${partner?.name ?? partnerId}`
          : `Убрал из избранного: ${partner?.name ?? partnerId}`,
      });
    } catch (e) { setFavorites(prev); }
  };

  const handleConfirmScan = async (placeIdentifier) => {
    if (!user) return;
    const partner = partners.find(p => p.id === placeIdentifier || p.name === placeIdentifier);
    if (!partner) { setIsScannerOpen(false); return; }
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { keys: increment(1) });
      setUserKeys(prev => prev + 1);
      await logActivity({ type: 'scan', icon: '🗝️', text: `Посетил партнёра: ${partner.name}`, partnerName: partner.name });
    } catch (e) { console.error(e); }
    finally { setIsScannerOpen(false); }
  };

  const handleLogout = () => {
    // Данные в Firestore остаются — просто запоминаем что вышли
    localStorage.setItem(LOGGED_OUT_KEY, 'true');
    setUser(null); setUserKeys(0); setFavorites([]);
    setActivePanel('home');
    setScreen('login');
  };

  const handleDeleteProfile = async () => {
    if (!user || user.id === 'guest') return;
    try {
      const activitySnap = await getDocs(collection(db, 'users', String(user.id), 'activity'));
      await Promise.all(activitySnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'users', String(user.id)));
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(EVENTS_CNT_KEY);
      localStorage.removeItem(LOGGED_OUT_KEY);
      setUser(null); setUserKeys(0); setFavorites([]);
      setActivePanel('home');
      setScreen('login');
    } catch (e) {
      console.error(e);
    }
  };

  const handleClaimTask = async (taskId, reward) => {
    if (!user || user.id === 'guest') return;
    try {
      await updateDoc(doc(db, 'users', String(user.id)), {
        completedTasks: arrayUnion(taskId),
        keys: increment(reward),
      });
      await addDoc(collection(db, 'users', String(user.id), 'activity'), {
        type: 'task_complete', icon: '📋',
        text: `Выполнено задание — получено +${reward} 🗝️`,
        ts: serverTimestamp(),
      });
      setCompletedTasks(prev => [...prev, taskId]);
      setUserKeys(prev => prev + reward);
    } catch (e) { console.error(e); }
  };

  const handleDismissNotifications = async () => {
    setUnreadNotifications([]);
    if (user && user.id !== 'guest') {
      try { await updateDoc(doc(db, 'users', String(user.id)), { notificationsLastSeen: serverTimestamp() }); }
      catch {}
    }
  };

  const handleShare = () => {
    const refLink = `https://vk.com/app${APP_ID}${user?.id ? `#ref_${user.id}` : ''}`;
    vkBridge.send('VKWebAppShare', { link: refLink }).catch(() => {});
  };

  const handleEnableNotifications = async () => {
    try {
      await vkBridge.send('VKWebAppAllowNotifications');
      setNotificationsEnabled(true);
      if (user && user.id !== 'guest') {
        await updateDoc(doc(db, 'users', String(user.id)), { notificationsEnabled: true });
      }
    } catch {}
  };

  // ─── Экраны ─────────────────────────────────────────────────────────────────

  if (screen === 'login') return <LoginScreen onLogin={handleLogin} />;
  if (screen === 'consent') return <ConsentScreen onAccept={handleConsentAccept} />;

  // Экран загрузки (первый вход, данные ещё не в кэше) — скелетон
  if (screen === 'loading' || (loading && partners.length === 0)) {
    const SK = { background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite', borderRadius: 10 };
    return (
      <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 60 }}>
        {/* Header */}
        <div style={{ height: 52, background: T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
          <div style={{ ...SK, width: 30, height: 30, borderRadius: 8 }} />
          <div style={{ ...SK, width: 50, height: 16 }} />
        </div>
        {/* Hero */}
        <div style={{ margin: '12px 16px', borderRadius: 24, background: '#1A1A2E', padding: '22px 20px', border: `1px solid ${T.border}` }}>
          <div style={{ ...SK, width: 140, height: 11, marginBottom: 10 }} />
          <div style={{ ...SK, width: 190, height: 26, marginBottom: 4 }} />
          <div style={{ ...SK, width: 110, height: 18, marginBottom: 18 }} />
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ ...SK, width: 160, height: 14, marginBottom: 10 }} />
            <div style={{ ...SK, height: 5 }} />
          </div>
        </div>
        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 16px 12px' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ background: '#1A1A2E', borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `1px solid ${T.border}` }}><div style={{ ...SK, width: 38, height: 38, borderRadius: 12 }} /><div style={{ ...SK, width: 32, height: 10 }} /></div>)}
        </div>
        {/* Partner cards */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ ...SK, width: 140, height: 18, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ background: '#1A1A2E', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: `1px solid ${T.border}` }}><div style={{ ...SK, width: 56, height: 56, borderRadius: 28 }} /><div style={{ ...SK, width: 80, height: 13 }} /><div style={{ ...SK, width: 56, height: 10 }} /><div style={{ ...SK, height: 34, borderRadius: 12 }} /></div>)}
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#0F0F1A', borderTop: `1px solid ${T.border}` }} />
      </div>
    );
  }

  // ─── Основное приложение ─────────────────────────────────────────────────────

  const TabBar = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#0F0F1A', borderTop: `1px solid ${T.border}`, display: 'flex', zIndex: 100 }}>
      {[
        { id: 'home',    icon: '⌂', label: 'Главная' },
        { id: 'scan',    icon: '◎', label: 'Скан' },
        { id: 'profile', icon: '○', label: 'Профиль' },
      ].map(item => (
        <button key={item.id}
          onClick={() => item.id === 'scan' ? setIsScannerOpen(true) : setActivePanel(item.id)}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: activePanel === item.id ? T.gold : T.textSec, fontSize: 9, fontWeight: 700, padding: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <span style={{ fontSize: 20, filter: activePanel === item.id ? `drop-shadow(0 0 6px ${T.gold}88)` : 'none' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <ConfigProvider appearance="dark">
      <AdaptivityProvider>
        <AppRoot>
          <div style={{ paddingBottom: 60, minHeight: '100vh', background: T.bg }}>
            <View activePanel={activePanel}>

              <HomePanel nav="home"
                user={user} userKeys={userKeys} favorites={favorites}
                partners={partners} events={events} loading={loading} error={error}
                onOpenPartner={partner => { setActivePartner(partner); setActivePanel('partner'); }}
                onToggleFavorite={toggleFavorite}
                onScan={() => setIsScannerOpen(true)}
                onShare={handleShare}
                onOpenEvents={() => setActivePanel('events')}
                onOpenOffers={() => setActivePanel('offers')}
                onOpenTasks={() => setActivePanel('tasks')}
                onOpenLeaderboard={() => setActivePanel('leaderboard')}
                completedTasks={completedTasks}
                referralCount={referralCount}
                onRetry={() => { const m = { current: true }; initApp(m); }}
              />

              <EventsPage nav="events" events={events} onBack={() => setActivePanel('home')} />

              <LeaderboardPage nav="leaderboard" currentUserId={user?.id} userKeys={userKeys} onBack={() => setActivePanel('home')} />

              <PartnerPage nav="partner"
                partner={activePartner}
                isFavorite={activePartner ? favorites.includes(activePartner.id) : false}
                onBack={() => setActivePanel('home')}
                onToggleFavorite={toggleFavorite}
              />

              <Panel id="profile">
                <ProfilePanel
                  user={user} userKeys={userKeys} favorites={favorites} partners={partners}
                  onToggleFavorite={toggleFavorite}
                  onOpenPartner={partner => { setActivePartner(partner); setActivePanel('partner'); }}
                  onOpenActivity={() => setActivePanel('activity')}
                  onEnableNotifications={handleEnableNotifications}
                  notificationsEnabled={notificationsEnabled}
                  onLogout={handleLogout}
                  onDeleteProfile={handleDeleteProfile}
                  referralCount={referralCount}
                  onShare={handleShare}
                />
              </Panel>

              <ActivityPage nav="activity" userId={user?.id} onBack={() => setActivePanel('profile')} />

              <OffersPage nav="offers" partners={partners}
                onBack={() => setActivePanel('home')}
                onOpenPartner={partner => { setActivePartner(partner); setActivePanel('partner'); }}
              />

              <TasksPage nav="tasks"
                userKeys={userKeys}
                favCount={favorites.length}
                referralCount={referralCount}
                completedTasks={completedTasks}
                onClaim={handleClaimTask}
                onBack={() => setActivePanel('home')}
              />

            </View>
          </div>

          <TabBar />

          <NewEventsBanner
            count={newEventsCount}
            onView={() => { setNewEventsCount(0); setActivePanel('events'); }}
            onDismiss={() => setNewEventsCount(0)}
          />

          {unreadNotifications.length > 0 && (
            <NotificationModal notifications={unreadNotifications} onDismiss={handleDismissNotifications} />
          )}

          <ScannerComponent
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            mapPlaces={partners}
            onConfirm={handleConfirmScan}
          />

          {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
