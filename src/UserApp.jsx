import React, { useState, useEffect, useCallback } from 'react';
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel, Spinner, Div } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import ScannerComponent from './Scanner.jsx';
import { ProfilePanel } from './ProfilePanel.jsx';
import { HomePanel } from './HomePanel.jsx';
import { PartnerPage } from './PartnerPage.jsx';
import { Onboarding } from './Onboarding.jsx';
import { EventsPage } from './EventsPage.jsx';
import { LeaderboardPage } from './LeaderboardPage.jsx';
import { ActivityPage } from './ActivityPage.jsx';

const T = { bg: '#0F0F1A', gold: '#C9A84C', textSec: 'rgba(240,240,240,0.35)', border: 'rgba(255,255,255,0.07)' };

const APP_ID = 54601851;
const CACHE_KEY = 'apg_v1';
const CACHE_TTL = 30 * 60 * 1000;

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

export function UserApp() {
  const [activePanel, setActivePanel] = useState('home');
  const [activePartner, setActivePartner] = useState(null);
  const [user, setUser] = useState(null);
  const [userKeys, setUserKeys] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const initApp = useCallback(async (isMounted) => {
    setError(null);

    // Мгновенно показываем кэшированные данные
    const cached = readCache();
    if (cached) {
      setPartners(cached.partners);
      setEvents(cached.events);
      setLoading(false);
    } else {
      setLoading(true);
    }

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
      const freshEvents = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(freshPartners);
      setEvents(freshEvents);
      writeCache(freshPartners, freshEvents);

      const userRef = doc(db, 'users', String(userData.id));
      const docSnap = await getDoc(userRef);
      if (!isMounted.current) return;
      const profile = {
        firstName: userData.first_name ?? '',
        lastName:  userData.last_name  ?? '',
        photo:     userData.photo_200  ?? null,
      };
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserKeys(data.keys ?? 0);
        setFavorites(data.favorites ?? []);
        if (!data.onboardingDone) setShowOnboarding(true);
        await updateDoc(userRef, profile);
      } else {
        await setDoc(userRef, { keys: 0, favorites: [], onboardingDone: false, ...profile });
        setShowOnboarding(true);
      }
    } catch (e) {
      console.error(e);
      // Если кэш есть — тихо работаем с ним, ошибку не показываем
      if (isMounted.current && !cached) setError('Не удалось загрузить данные.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isMounted = { current: true };
    initApp(isMounted);
    return () => { isMounted.current = false; };
  }, [initApp]);

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
      await logActivity({
        type: 'scan',
        icon: '🗝️',
        text: `Посетил партнёра: ${partner.name}`,
        partnerName: partner.name,
      });
    } catch (e) { console.error(e); }
    finally { setIsScannerOpen(false); }
  };

  const handleLogout = () => {
    setUser(null); setUserKeys(0); setFavorites([]);
    setActivePanel('home');
    const isMounted = { current: true };
    initApp(isMounted);
  };

  const handleShare = () => {
    const refLink = `https://vk.com/app${APP_ID}${user?.id ? `#ref_${user.id}` : ''}`;
    vkBridge.send('VKWebAppShare', { link: refLink }).catch(() => {});
  };

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

              <EventsPage nav="events"
                events={events}
                onBack={() => setActivePanel('home')}
              />

              <LeaderboardPage nav="leaderboard"
                currentUserId={user?.id}
                userKeys={userKeys}
                onBack={() => setActivePanel('home')}
              />

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
                  onLogout={handleLogout}
                />
              </Panel>

              <ActivityPage nav="activity"
                userId={user?.id}
                onBack={() => setActivePanel('profile')}
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
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
