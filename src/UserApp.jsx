import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, 
  Icon28UserAddOutline, Icon28DoorArrowRightOutline, Icon28StorefrontOutline, Icon28HelpOutline 
} from '@vkontakte/icons';

import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } from "firebase/firestore";
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
    async function initApp() {
      setLoading(true);
      try {
        vkBridge.send('VKWebAppInit');
        // 1. Получаем данные пользователя ВК
        const userInfo = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userInfo);
        
        // 2. Параллельно грузим всё остальное
        await Promise.all([
          loadUserData(userInfo.id.toString()),
          fetchPartners(),
          fetchEvents(),
          fetchFaq()
        ]);
      } catch (e) {
        console.error("Ошибка инициализации:", e);
      } finally {
        setLoading(false);
      }
    }
    initApp();
  }, []);

  const loadUserData = async (id) => {
    const userRef = doc(db, "users", id);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setUserKeys(data.keys);
      setFavorites(data.favorites || []);
    } else {
      await setDoc(userRef, { keys: 3, favorites: [] });
    }
  };

  const fetchPartners = async () => {
    const snapshot = await getDocs(collection(db, "partners"));
    setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchEvents = async () => {
    const snapshot = await getDocs(collection(db, "events"));
    setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchFaq = async () => {
    const snapshot = await getDocs(collection(db, "faq"));
    setFaq(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const userRef = doc(db, "users", user.id.toString());
    const newFavorites = favorites.includes(partnerId) 
      ? favorites.filter(id => id !== partnerId) 
      : [...favorites, partnerId];
    await updateDoc(userRef, { favorites: newFavorites });
    setFavorites(newFavorites);
  };

  const handleConfirmScan = async () => {
    const userRef = doc(db, "users", user.id.toString());
    await updateDoc(userRef, { keys: increment(1) });
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
                
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  {loading ? <Spinner size="large" style={{ marginTop: 20 }} /> : (
                    <>
                      <Group>
                        <SimpleCell before={<Avatar size={64} src={user?.photo_200} />}>
                          <Title level="2">{user ? `${user.first_name} ${user.last_name}` : "Гость"}</Title>
                        </SimpleCell>
                        <Div><Progress value={userKeys * 10} /><Footnote>Ключи: {userKeys}/10</Footnote></Div>
                      </Group>

                      <Group header={<Header mode="secondary">Избранные</Header>}>
                        {favorites.length === 0 ? <Div>Список пуст</Div> : 
                          partners.filter(p => favorites.includes(p.id)).map(p => (
                            <SimpleCell key={p.id} onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>{p.name}</SimpleCell>
                          ))
                        }
                      </Group>

                      <Group header={<Header mode="secondary">Действия</Header>}>
                        <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>Пригласить друзей</CellButton>
                        <CellButton before={<Icon28HelpOutline />} onClick={() => setActivePanel('faq')}>Помощь и FAQ</CellButton>
                        <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={() => { localStorage.clear(); window.location.reload(); }}>Сбросить прогресс</CellButton>
                      </Group>
                    </>
                  )}
                </Panel>

                <Panel id="faq">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('profile')} />}>Помощь</PanelHeader>
                  <Group>
                    {faq.map((item) => (
                      <Group key={item.id} header={<Header mode="secondary">{item.question}</Header>}>
                        <Div>{item.answer}</Div>
                      </Group>
                    ))}
                  </Group>
                </Panel>

                <Panel id="home">
                  <PanelHeader>АПГ: Зеленоград</PanelHeader>
                  <Header mode="secondary">События</Header>
                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                      {events.map(e => <Card key={e.id} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}><Title level="3">{e.title}</Title></Card>)}
                    </div>
                  </HorizontalScroll>

                  <Header mode="secondary">Наши партнеры</Header>
                  {loading ? <Spinner /> : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px' }}>
                      {partners.map((p) => (
                        <div key={p.id} style={{ background: '#fff', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid #f0f0f0' }}>
                          {p.logoUrl && <Avatar size={56} src={p.logoUrl} style={{ marginBottom: 12 }} />}
                          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>{p.name}</div>
                          <Button size="m" mode="primary" stretched onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>Открыть</Button>
                          <Button size="m" mode="tertiary" stretched onClick={() => toggleFavorite(p.id)}>{favorites.includes(p.id) ? "★" : "☆"}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>{activePartner?.name}</PanelHeader>
                  {activePartner && (
                    <Div>
                      <Title level="1">{activePartner.name}</Title>
                      <Div>{activePartner.description}</Div>
                      {activePartner.link && <Button size="l" stretched onClick={() => window.open(activePartner.link, '_blank')}>Перейти</Button>}
                    </Div>
                  )}
                </Panel>
              </View>
            </SplitCol>
          </SplitLayout>
          
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => setIsScannerOpen(true)} text="Сканировать"><Icon28QrCodeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
          {isScannerOpen && <Scanner onScan={handleConfirmScan} />}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}