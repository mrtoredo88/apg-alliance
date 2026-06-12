import React, { useState, useEffect, useCallback } from 'react';
import {
  AdaptivityProvider,
  ConfigProvider,
  AppRoot,
  SplitLayout,
  SplitCol,
  View,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Group,
  Header,
  Card,
  SimpleCell,
  Avatar,
  Button,
  Progress,
  Footnote,
  Tabbar,
  TabbarItem,
  CellButton,
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
  Icon28HelpOutline,
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

// Максимальное количество ключей для прогресс-бара
const MAX_KEYS = 50;

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

  // ─── Инициализация приложения ────────────────────────────────────────────────

  const initApp = useCallback(async (isMounted) => {
    setLoading(true);
    setError(null);

    try {
      vkBridge.send('VKWebAppInit');

      const userData = await vkBridge.send('VKWebAppGetUserInfo');
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
      if (isMounted.current) {
        setError('Не удалось загрузить данные. Проверьте подключение.');
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Используем ref вместо boolean, чтобы избежать stale closure
    const isMounted = { current: true };
    initApp(isMounted);
    return () => {
      isMounted.current = false;
    };
  }, [initApp]);

  // ─── Избранное ───────────────────────────────────────────────────────────────

  const toggleFavorite = async (partnerId) => {
    if (!user) return;

    const previousFavorites = favorites;
    const newFavorites = favorites.includes(partnerId)
      ? favorites.filter((id) => id !== partnerId)
      : [...favorites, partnerId];

    // Оптимистичное обновление
    setFavorites(newFavorites);

    try {
      await updateDoc(doc(db, 'users', String(user.id)), {
        favorites: newFavorites,
      });
    } catch (e) {
      // Откат при ошибке Firebase
      console.error('Ошибка обновления избранного:', e);
      setFavorites(previousFavorites);
    }
  };

  // ─── Подтверждение скана QR ──────────────────────────────────────────────────

  const handleConfirmScan = async (placeIdentifier) => {
    if (!user) return;

    // Валидация: идентификатор должен совпадать с реальным партнёром
    const isValid = partners.some(
      (p) => p.id === placeIdentifier || p.name === placeIdentifier
    );

    if (!isValid) {
      console.warn('Недействительный QR-код:', placeIdentifier);
      setIsScannerOpen(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', String(user.id)), {
        keys: increment(1),
      });
      setUserKeys((prev) => prev + 1);
    } catch (e) {
      console.error('Ошибка начисления ключа:', e);
    } finally {
      setIsScannerOpen(false);
    }
  };

  // ─── Вспомогательный рендер: глобальные состояния ───────────────────────────

  const renderGlobalSpinner = () => (
    <Div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Spinner size="large" />
    </Div>
  );

  const renderError = () => (
    <Placeholder
      icon={<Icon56ErrorTriangleOutline />}
      header="Что-то пошло не так"
      action={
        <Button
          size="m"
          onClick={() => {
            const isMounted = { current: true };
            initApp(isMounted);
          }}
        >
          Попробовать снова
        </Button>
      }
    >
      {error}
    </Placeholder>
  );

  // ─── Рендер ──────────────────────────────────────────────────────────────────

  return (
    <ConfigProvider platform="vkcom">
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout style={{ height: '100vh' }}>
            <SplitCol>
              <View activePanel={activePanel}>

                {/* ── ГЛАВНАЯ ── */}
                <Panel id="home">
                  <PanelHeader>АПГ</PanelHeader>

                  {loading && renderGlobalSpinner()}
                  {!loading && error && renderError()}
                  {!loading && !error && (
                    <>
                      {/* События */}
                      <Header mode="secondary">События</Header>
                      <HorizontalScroll>
                        <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                          {events.length === 0 ? (
                            <Footnote style={{ padding: '0 4px' }}>
                              Пока нет активных событий
                            </Footnote>
                          ) : (
                            events.map((e) => (
                              <Card
                                key={e.id}
                                mode="shadow"
                                style={{ minWidth: 200, padding: 16 }}
                              >
                                <Text weight="medium">{e.title ?? '—'}</Text>
                              </Card>
                            ))
                          )}
                        </div>
                      </HorizontalScroll>

                      {/* Партнёры */}
                      <Header mode="secondary">Партнёры</Header>
                      {partners.length === 0 ? (
                        <Div>
                          <Footnote>Партнёры ещё не добавлены</Footnote>
                        </Div>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 16,
                            padding: 16,
                          }}
                        >
                          {partners.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                background: '#fff',
                                padding: 16,
                                borderRadius: 16,
                                textAlign: 'center',
                              }}
                            >
                              {p.logoUrl && (
                                <Avatar size={56} src={p.logoUrl} />
                              )}

                              <div style={{ margin: '10px 0', fontWeight: 600 }}>
                                {p.name ?? 'Партнёр'}
                              </div>

                              <Button
                                size="m"
                                stretched
                                onClick={() => {
                                  setActivePartner(p);
                                  setActivePanel('partner');
                                }}
                              >
                                Открыть
                              </Button>

                              <Button
                                size="m"
                                mode="tertiary"
                                stretched
                                onClick={() => toggleFavorite(p.id)}
                                style={{ marginTop: 8 }}
                              >
                                {favorites.includes(p.id) ? '★ В избранном' : '☆ Добавить'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Panel>

                {/* ── СТРАНИЦА ПАРТНЁРА ── */}
                <Panel id="partner">
                  <PanelHeader
                    before={
                      <PanelHeaderBack onClick={() => setActivePanel('home')} />
                    }
                  >
                    {activePartner?.name ?? 'Партнёр'}
                  </PanelHeader>

                  {activePartner ? (
                    <Group>
                      <Div style={{ textAlign: 'center' }}>
                        {activePartner.logoUrl && (
                          <Avatar size={80} src={activePartner.logoUrl} />
                        )}
                        <Title
                          level="2"
                          weight="semibold"
                          style={{ marginTop: 12 }}
                        >
                          {activePartner.name}
                        </Title>
                        {activePartner.description && (
                          <Text style={{ marginTop: 8, color: 'var(--vkui--color_text_secondary)' }}>
                            {activePartner.description}
                          </Text>
                        )}
                      </Div>

                      <Div>
                        <Button
                          size="l"
                          stretched
                          onClick={() => toggleFavorite(activePartner.id)}
                        >
                          {favorites.includes(activePartner.id)
                            ? '★ Убрать из избранного'
                            : '☆ В избранное'}
                        </Button>
                      </Div>
                    </Group>
                  ) : (
                    renderGlobalSpinner()
                  )}
                </Panel>

                {/* ── ПРОФИЛЬ ── */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>

                  {loading && renderGlobalSpinner()}
                  {!loading && error && renderError()}
                  {!loading && !error && user && (
                    <>
                      <Group>
                        <SimpleCell
                          before={
                            <Avatar
                              size={64}
                              src={user.photo_200 ?? undefined}
                            />
                          }
                        >
                          {user.first_name} {user.last_name}
                        </SimpleCell>

                        <Div>
                          <Progress
                            value={Math.min(
                              Math.round((userKeys / MAX_KEYS) * 100),
                              100
                            )}
                          />
                          <Footnote style={{ marginTop: 6 }}>
                            Ключей: {userKeys} из {MAX_KEYS}
                          </Footnote>
                        </Div>
                      </Group>

                      <Group>
                        <CellButton
                          before={<Icon28HelpOutline />}
                          onClick={() => setActivePanel('home')}
                        >
                          На главную
                        </CellButton>
                      </Group>
                    </>
                  )}
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          {/* ── ТАББАР ── */}
          <Tabbar>
            <TabbarItem
              selected={activePanel === 'home'}
              onClick={() => setActivePanel('home')}
              text="Главная"
            >
              <Icon28HomeOutline />
            </TabbarItem>

            <TabbarItem
              onClick={() => setIsScannerOpen(true)}
              text="Скан"
            >
              <Icon28QrCodeOutline />
            </TabbarItem>

            <TabbarItem
              selected={activePanel === 'profile'}
              onClick={() => setActivePanel('profile')}
              text="Профиль"
            >
              <Icon28UserCircleOutline />
            </TabbarItem>
          </Tabbar>

          {/* ── СКАНЕР ── */}
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