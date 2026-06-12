import React, { useState, useEffect } from 'react';
import {
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader,
  Group, Header, Card, SimpleCell, Avatar, Button, Progress, Footnote,
  Tabbar, TabbarItem, CellButton, Div, HorizontalScroll, Spinner
} from '@vkontakte/vkui';

import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';

import {
  Icon28QrCodeOutline,
  Icon28HomeOutline,
  Icon28UserCircleOutline,
  Icon28HelpOutline
} from '@vkontakte/icons';

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } from 'firebase/firestore';

import ScannerComponent from './Scanner.jsx';

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

  useEffect(() => {
    async function initApp() {
      try {
        vkBridge.send('VKWebAppInit');

        const userData = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userData);

        const [pSnap, eSnap] = await Promise.all([
          getDocs(collection(db, "partners")),
          getDocs(collection(db, "events"))
        ]);

        setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const userRef = doc(db, "users", String(userData.id));
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserKeys(data.keys || 0);
          setFavorites(data.favorites || []);
        } else {
          await setDoc(userRef, { keys: 0, favorites: [] });
        }

      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, []);

  const toggleFavorite = async (partnerId) => {
    if (!user) return;

    const newFavorites = favorites.includes(partnerId)
      ? favorites.filter(id => id !== partnerId)
      : [...favorites, partnerId];

    setFavorites(newFavorites);

    await updateDoc(doc(db, "users", String(user.id)), {
      favorites: newFavorites
    });
  };

  const handleConfirmScan = async (placeName) => {
    if (!user) return;

    console.log("Сканирован:", placeName);

    await updateDoc(doc(db, "users", String(user.id)), {
      keys: increment(1)
    });

    setUserKeys(prev => prev + 1);
    setIsScannerOpen(false);
  };

  return (
    <ConfigProvider platform="vkcom">
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout style={{ height: '100vh' }}>
            <SplitCol>
              <View activePanel={activePanel}>

                {/* HOME */}
                <Panel id="home">
                  <PanelHeader>АПГ</PanelHeader>

                  {loading ? (
                    <Spinner size="large" />
                  ) : (
                    <>
                      <Header mode="secondary">События</Header>

                      <HorizontalScroll>
                        <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                          {events.map(e => (
                            <Card key={e.id} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}>
                              {e.title}
                            </Card>
                          ))}
                        </div>
                      </HorizontalScroll>

                      <Header mode="secondary">Партнёры</Header>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                        padding: 16
                      }}>
                        {partners.map(p => (
                          <div key={p.id} style={{
                            background: '#fff',
                            padding: 16,
                            borderRadius: 16,
                            textAlign: 'center'
                          }}>
                            {p.logoUrl && <Avatar size={56} src={p.logoUrl} />}

                            <div style={{ margin: '10px 0', fontWeight: 600 }}>
                              {p.name}
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
                            >
                              {favorites.includes(p.id) ? "★" : "☆"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>

                {/* PROFILE */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>

                  {!user ? (
                    <Spinner size="large" />
                  ) : (
                    <>
                      <Group>
                        <SimpleCell before={<Avatar size={64} src={user.photo_200} />}>
                          {user.first_name} {user.last_name}
                        </SimpleCell>

                        <Div>
                          <Progress value={Math.min(userKeys * 10, 100)} />
                          <Footnote>Ключи: {userKeys}</Footnote>
                        </Div>
                      </Group>

                      <Group>
                        <CellButton
                          before={<Icon28HelpOutline />}
                          onClick={() => setActivePanel('home')}
                        >
                          На главную
                        </CellButton>

                        <CellButton
                          mode="danger"
                          onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                          }}
                        >
                          Сброс
                        </CellButton>
                      </Group>
                    </>
                  )}
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          {/* TABBAR */}
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

          {/* SCANNER */}
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