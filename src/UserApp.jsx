import React, { useState, useEffect } from 'react';
import {
  AdaptivityProvider,
  ConfigProvider,
  AppRoot,
  SplitLayout,
  SplitCol,
  View,
  Panel,
  PanelHeader,
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
  PanelHeaderBack,
  HorizontalScroll,
  Spinner
} from '@vkontakte/vkui';

import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';

import {
  Icon28QrCodeOutline,
  Icon28HomeOutline,
  Icon28UserCircleOutline,
  Icon28UserAddOutline,
  Icon28DoorArrowRightOutline,
  Icon28StorefrontOutline,
  Icon28HelpOutline
} from '@vkontakte/icons';

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  getDocs
} from 'firebase/firestore';

import { Scanner } from './Scanner.jsx';

export function UserApp() {
  const [activePanel, setActivePanel] = useState('home');
  const [activePartner, setActivePartner] = useState(null);
  const [user, setUser] = useState(null);
  const [userKeys, setUserKeys] = useState(3);
  const [favorites, setFavorites] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [events, setEvents] = useState([]);
  const [faq, setFaq] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vkBridge.send('VKWebAppInit');

    vkBridge.send('VKWebAppGetUserInfo')
      .then((u) => {
        setUser(u);
        if (u?.id) loadUserData(String(u.id));
      })
      .catch(console.error);

    fetchPartners();
    fetchEvents();
    fetchFaq();
  }, []);

  const loadUserData = async (id) => {
    const userRef = doc(db, "users", id);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setUserKeys(data.keys || 0);
      setFavorites(data.favorites || []);
    } else {
      await setDoc(userRef, { keys: 3, favorites: [] });
    }
  };

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "partners"));

      const partnersList = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      setPartners(partnersList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    const snapshot = await getDocs(collection(db, "events"));
    setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchFaq = async () => {
    const snapshot = await getDocs(collection(db, "faq"));
    setFaq(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;

    const userRef = doc(db, "users", String(user.id));

    const newFavorites = favorites.includes(partnerId)
      ? favorites.filter((id) => id !== partnerId)
      : [...favorites, partnerId];

    await updateDoc(userRef, { favorites: newFavorites });
    setFavorites(newFavorites);
  };

  const handleConfirmScan = async () => {
    if (!user?.id) return;

    const userRef = doc(db, "users", String(user.id));

    await updateDoc(userRef, {
      keys: increment(1)
    });

    setUserKeys((p) => (p || 0) + 1);
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
                  <PanelHeader>АПГ: Зеленоград</PanelHeader>

                  <Header mode="secondary">События</Header>

                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                      {events.map((e) => (
                        <Card
                          key={e.id}
                          mode="shadow"
                          style={{ width: 200, height: 100, padding: 16 }}
                        >
                          <h3 style={{ margin: 0 }}>{e.title}</h3>
                        </Card>
                      ))}
                    </div>
                  </HorizontalScroll>

                  <Header mode="secondary">Наши партнеры</Header>

                  {loading ? (
                    <Spinner />
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 16,
                      padding: 16
                    }}>
                      {partners.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            background: '#fff',
                            padding: 20,
                            borderRadius: 20,
                            textAlign: 'center',
                            border: '1px solid #eee'
                          }}
                        >
                          <Avatar size={56} src={p.logoUrl || ''} />
                          <div style={{ margin: '12px 0', fontWeight: 600 }}>
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
                            {favorites.includes(p.id)
                              ? '★ В избранном'
                              : '☆ В избранное'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {/* PROFILE */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>

                  {!user ? (
                    <Group>
                      <Div style={{ textAlign: 'center', padding: 20 }}>
                        <Spinner size="large" />
                      </Div>
                    </Group>
                  ) : (
                    <>
                      <Group>
                        <SimpleCell
                          before={<Avatar size={64} src={user.photo_200 || ''} />}
                        >
                          {user.first_name} {user.last_name}
                        </SimpleCell>

                        <Div>
                          <Progress value={Math.min((userKeys || 0) * 10, 100)} />
                          <Footnote>Ключи: {userKeys}/10</Footnote>
                        </Div>
                      </Group>

                      <Group header={<Header mode="secondary">Избранные</Header>}>
                        {favorites.length === 0 ? (
                          <Div>Нет избранных</Div>
                        ) : (
                          partners
                            .filter(p => favorites.includes(p.id))
                            .map(p => (
                              <SimpleCell
                                key={p.id}
                                before={<Avatar size={40} src={p.logoUrl || ''} />}
                                onClick={() => {
                                  setActivePartner(p);
                                  setActivePanel('partner');
                                }}
                              >
                                {p.name}
                              </SimpleCell>
                            ))
                        )}
                      </Group>

                      <Group header={<Header mode="secondary">Действия</Header>}>
                        <CellButton
                          before={<Icon28UserAddOutline />}
                          onClick={() => vkBridge.send('VKWebAppShowInviteBox')}
                        >
                          Пригласить друзей
                        </CellButton>

                        <CellButton
                          before={<Icon28HelpOutline />}
                          onClick={() => setActivePanel('faq')}
                        >
                          Помощь
                        </CellButton>

                        <CellButton
                          mode="danger"
                          before={<Icon28DoorArrowRightOutline />}
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

                {/* PARTNER */}
                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
                    {activePartner?.name}
                  </PanelHeader>

                  {activePartner && (
                    <Div style={{ textAlign: 'center' }}>
                      <Avatar size={96} src={activePartner.logoUrl || ''} />

                      <h2>{