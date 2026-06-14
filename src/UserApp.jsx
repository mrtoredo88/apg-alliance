import React, { useState, useEffect, useCallback } from 'react';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import ScannerComponent from './Scanner.jsx';
import { ProfilePanel }    from './ProfilePanel.jsx';
import { HomePanel }       from './HomePanel.jsx';
import { PartnerPage }     from './PartnerPage.jsx';
import { Onboarding }      from './Onboarding.jsx';
import { EventsPage }      from './EventsPage.jsx';
import { LeaderboardPage } from './LeaderboardPage.jsx';
import { ActivityPage }    from './ActivityPage.jsx';
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
      await setDoc(userRef, { keys: 0, favorites: [], onboardingDone: false, consentGiven: false, notificationsEnabled: false, ...profile });
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
    if (!data.onboardingDone) setShowOnboarding(true);
    await updateDoc(userRef, profile).catch(() => {});
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

  // Экран загрузки (первый вход, данные ещё не в кэше)
  if (screen === 'loading' || (loading && partners.length === 0)) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.12)', borderTopColor: T.gold, animation: 'spin 1.2s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.07)', borderBottomColor: 'rgba(201,168,76,0.35)', animation: 'spin 2s linear infinite reverse' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: T.gold, animation: 'pulse-glow 2s ease-in-out infinite' }}>✦</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: T.textPri, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>АПГ</div>
          <div style={{ color: T.textSec, fontSize: 13 }}>Загружаем данные...</div>
        </div>
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
                onOpenLeaderboard={() => setActivePanel('leaderboard')}
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
                />
              </Panel>

              <ActivityPage nav="activity" userId={user?.id} onBack={() => setActivePanel('profile')} />

            </View>
          </div>

          <TabBar />

          <NewEventsBanner
            count={newEventsCount}
            onView={() => { setNewEventsCount(0); setActivePanel('events'); }}
            onDismiss={() => setNewEventsCount(0)}
          />

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
