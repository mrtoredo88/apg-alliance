import React, { useState, useEffect, useCallback } from 'react';
import {
  AdaptivityProvider,
  ConfigProvider,
  AppRoot,
  View,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Group,
  Header,
  Card,
  Avatar,
  Button,
  Footnote,
  Div,
  HorizontalScroll,
  Spinner,
  Placeholder,
  Text,
  Title,
} from '@vkontakte/vkui';

import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';

import {
  Icon28QrCodeOutline,
  Icon28HomeOutline,
  Icon28UserCircleOutline,
  Icon56ErrorTriangleOutline,
} from '@vkontakte/icons';

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  getDocs,
} from 'firebase/firestore';

import ScannerComponent from './Scanner.jsx';
import { ProfilePanel } from './ProfilePanel.jsx';

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

  const initApp = useCallback(async (isMounted) => {
    setLoading(true);
    setError(null);
    try {
      vkBridge.send('VKWebAppInit');
      const userData = await Promise.race([
        vkBridge.send('VKWebAppGetUserInfo'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]).catch(() => ({ id: 'guest', first_name: 'Участник', last_name: 'АПК', photo_200: null }));
      if (!isMounted.current) return;
      setUser(userData);
      const [pSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'partners')),
        getDocs(collection(db, 'events')),
      ]);
      if (!isMounted.current) return;
      setPartners(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEvents(eSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const userRef = doc(db, 'users', String(userData.id));
      const docSnap = await getDoc(userRef);
      if (!isMounted.current) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserKeys(data.keys ?? 0);
        setFavorites(data.favorites ?? []);
      } else {
        await setDoc(userRef, { keys: 0, favorites: [] });
      }
    } catch (e) {
      console.error('Ошибка загрузки:', e);
      if (isMounted.current) setError('Не удалось загрузить данные.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isMounted = { current: true };
    initApp(isMounted);
    return () => { isMounted.current = false; };
  }, [initApp]);

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const prev = favorites;
    const next = favorites.includes(partnerId)
      ? favorites.filter((id) => id !== partnerId)
      : [...favorites, partnerId];
    setFavorites(next);
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { favorites: next });
    } catch (e) {
      setFavorites(prev);
    }
  };

  const handleConfirmScan = async (placeIdentifier) => {
    if (!user) return;
    const isValid = partners.some((p) => p.id === placeIdentifier || p.name === placeIdentifier);
    if (!isValid) { setIsScannerOpen(false); return; }
    try {
      await updateDoc(doc(db, 'users', String(user.id)), { keys: increment(1) });
      setUserKeys((prev) => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScannerOpen(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserKeys(0);
    setFavorites([]);
    setActivePanel('home');
    const isMounted = { current: true };
    initApp(isMounted);
  };

  // Простой кастомный таббар — без VKUI Tabbar компонента
  const TabBar = () => (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 56,
      background: '#fff',
      borderTop: '1px solid #e0e0e0',
      display: 'flex',
      zIndex: 100,
    }}>
      {[
        { id: 'home', icon: '🏠', label: 'Главная' },
        { id: 'scan', icon: '📷', label: 'Скан' },
        { id: 'profile', icon: '👤', label: 'Профиль' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => item.id === 'scan' ? setIsScannerOpen(true) : setActivePanel(item.id)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            color: activePanel === item.id ? '#3F8AE0' : '#99A2AD',
            fontSize: 10,
            fontWeight: activePanel === item.id ? 600 : 400,
            padding: 0,
          }}
        >
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <ConfigProvider appearance="light">
      <AdaptivityProvider>
        <AppRoot>
          <div style={{ paddingBottom: 56, minHeight: '100vh', background: '#f2f3f5' }}>
            <View activePanel={activePanel}>

              {/* ── ГЛАВНАЯ ── */}
              <Panel id="home">
                <PanelHeader>АПГ</PanelHeader>
                {loading && (
                  <Div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                    <Spinner size="l" />
                  </Div>
                )}
                {!loading && error && (
                  <Placeholder header="Ошибка" action={<Button onClick={() => { const m = { current: true }; initApp(m); }}>Повторить</Button>}>
                    {error}
                  </Placeholder>
                )}
                {!loading && !error && (
                  <>
                    <Header mode="secondary">События</Header>
                    <HorizontalScroll>
                      <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                        {events.length === 0
                          ? <Footnote style={{ padding: '0 4px' }}>Пока нет активных событий</Footnote>
                          : events.map((e) => (
                            <Card key={e.id} mode="shadow" style={{ minWidth: 200, padding: 16 }}>
                              <Text weight="medium">{e.title ?? '—'}</Text>
                            </Card>
                          ))
                        }
                      </div>
                    </HorizontalScroll>
                    <Header mode="secondary">Партнёры</Header>
                    {partners.length === 0
                      ? <Div><Footnote>Партнёры ещё не добавлены</Footnote></Div>
                      : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
                          {partners.map((p) => (
                            <div key={p.id} style={{ background: '#fff', padding: 16, borderRadius: 16, textAlign: 'center' }}>
                              {p.logoUrl && <Avatar size={56} src={p.logoUrl} />}
                              <div style={{ margin: '10px 0', fontWeight: 600 }}>{p.name ?? 'Партнёр'}</div>
                              <Button size="m" stretched onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>
                                Открыть
                              </Button>
                              <Button size="m" mode="tertiary" stretched onClick={() => toggleFavorite(p.id)} style={{ marginTop: 8 }}>
                                {favorites.includes(p.id) ? '★ В избранном' : '☆ Добавить'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </>
                )}
              </Panel>

              {/* ── ПАРТНЁР ── */}
              <Panel id="partner">
                <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
                  {activePartner?.name ?? 'Партнёр'}
                </PanelHeader>
                {activePartner ? (
                  <Group>
                    <Div style={{ textAlign: 'center' }}>
                      {activePartner.logoUrl && <Avatar size={80} src={activePartner.logoUrl} />}
                      <Title level="2" weight="semibold" style={{ marginTop: 12 }}>{activePartner.name}</Title>
                      {activePartner.description && (
                        <Text style={{ marginTop: 8, color: 'var(--vkui--color_text_secondary)' }}>
                          {activePartner.description}
                        </Text>
                      )}
                    </Div>
                    <Div>
                      <Button size="l" stretched onClick={() => toggleFavorite(activePartner.id)}>
                        {favorites.includes(activePartner.id) ? '★ Убрать из избранного' : '☆ В избранное'}
                      </Button>
                    </Div>
                  </Group>
                ) : (
                  <Div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                    <Spinner size="l" />
                  </Div>
                )}
              </Panel>

              {/* ── ПРОФИЛЬ ── */}
              <Panel id="profile">
  <ProfilePanel
    user={user}
    userKeys={userKeys}
    favorites={favorites}
    partners={partners}
    onToggleFavorite={toggleFavorite}
    onOpenPartner={(partner) => { setActivePartner(partner); setActivePanel('partner'); }}
    onLogout={handleLogout}
  />
</Panel>

            </View>
          </div>

          <TabBar />

          <ScannerComponent
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            mapPlaces={partners}
            onConfirm={handleConfirmScan}
          />
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
