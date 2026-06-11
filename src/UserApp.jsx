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
        const userInfo = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userInfo);
        
        // Загружаем данные параллельно
        const [pSnap, eSnap, fSnap] = await Promise.all([
          getDocs(collection(db, "partners")),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "faq"))
        ]);
        
        setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFaq(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        await loadUserData(userInfo.id.toString());
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setLoading(false);
      }
    }
    initApp();
  }, []);

  const loadUserData = async (id) => {
    try {
      const userRef = doc(db, "users", id);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserKeys(data.keys || 0);
        setFavorites(data.favorites || []);
      } else {
        await setDoc(userRef, { keys: 3, favorites: [] });
      }
    } catch (e) { console.error(e); }
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const newFavorites = favorites.includes(partnerId) 
      ? favorites.filter(id => id !== partnerId) 
      : [...favorites, partnerId];
    setFavorites(newFavorites);
    await updateDoc(doc(db, "users", user.id.toString()), { favorites: newFavorites });
  };

  const handleConfirmScan = async () => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.id.toString()), { keys: increment(1) });
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
                <Panel id="home">
                  <PanelHeader>АПГ: Зеленоград</PanelHeader>
                  {loading ? <Spinner size="large" /> : (
                    <>
                      <Header mode="secondary">События</Header>
                      <HorizontalScroll showArrows>
                        <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                          {events.map(e => <Card key={e.id} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}><Title level="3">{e.title}</Title></Card>)}
                        </div>
                      </HorizontalScroll>
                      <Header mode="secondary">Наши партнеры</Header>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px' }}>
                        {partners.map((p) => (
                          <div key={p.id} style={{ background: '#fff', padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>{p.name}</div>
                            <Button size="m" stretched onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>Открыть</Button>
                            <Button size="m" mode="tertiary" stretched onClick={() => toggleFavorite(p.id)}>{favorites.includes(p.id) ? "★" : "☆"}</Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>

                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  {loading ? <Spinner size="large" /> : !user ? <Div>Ошибка загрузки данных</Div> : (
                    <>
                      <Group>
                        <SimpleCell before={<Avatar size={64} src={user?.photo_200} />}>
                          <Title level="2">{`${user.first_name} ${user.last_name}`}</Title>
                        </SimpleCell>
                        <Div><Progress value={userKeys * 10} /><Footnote>Ключи: {userKeys}/10</Footnote></Div>
                      </Group>
                      <Group header={<Header mode="secondary">Избранные</Header>}>
                        {partners.filter(p => favorites.includes(p.id)).map(p => (
                          <SimpleCell key={p.id} onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>{p.name}</SimpleCell>
                        ))}
                      </Group>
                      <Group>
                        <CellButton before={<Icon28HelpOutline />} onClick={() => setActivePanel('faq')}>Помощь</CellButton>
                        <CellButton mode="danger" onClick={() => { localStorage.clear(); window.location.reload(); }}>Сброс</CellButton>
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

                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>{activePartner?.name}</PanelHeader>
                  {activePartner && <Div><Title level="1">{activePartner.name}</Title><Div>{activePartner.description}</Div></Div>}
                </Panel>
              </View>
            </SplitCol>
          </SplitLayout>
          
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => setIsScannerOpen(true)} text="Сканировать"><Icon28QrCodeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}