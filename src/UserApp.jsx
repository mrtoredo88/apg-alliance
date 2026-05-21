import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, 
  Icon28UserAddOutline, Icon28DoorArrowRightOutline, Icon28StorefrontOutline 
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then((u) => {
      setUser(u);
      loadUserData(u.id.toString());
    });
    fetchPartners();
    fetchEvents();
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
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "partners"));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(data);
    } catch (e) {
      console.error("Ошибка при загрузке партнеров:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const snapshot = await getDocs(collection(db, "events"));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(data);
    } catch (e) {
      console.error("Ошибка при загрузке событий:", e);
    }
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const userRef = doc(db, "users", user.id.toString());
    let newFavorites = favorites.includes(partnerId) 
      ? favorites.filter(id => id !== partnerId) 
      : [...favorites, partnerId];
    
    await updateDoc(userRef, { favorites: newFavorites });
    setFavorites(newFavorites);
  };

  const handleConfirmScan = async (partnerName) => {
    if (!user) return;
    const userRef = doc(db, "users", user.id.toString());
    await updateDoc(userRef, { keys: increment(1) });
    setUserKeys(prev => prev + 1);
    alert(`🎉 Успешно! Ты отсканировал "${partnerName}". +1 Ключ! 🔑`);
    setIsScannerOpen(false);
  };

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                
                {/* ПРОФИЛЬ */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  <Group>
                    <SimpleCell before={user?.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}>
                      <Title level="2" weight="1">{user ? `${user.first_name} ${user.last_name}` : "Исследователь"}</Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={userKeys * 10} />
                      <Footnote style={{ marginTop: '10px' }}>Собрано {userKeys} из 10 ключей</Footnote>
                    </Div>
                  </Group>

                  <Group header={<Header mode="secondary">Избранное</Header>}>
                    {favorites.length > 0 ? (
                      partners.filter(p => favorites.includes(p.id)).map(p => (
                        <SimpleCell key={p.id} onClick={() => { setActivePartner(p.name); setActivePanel('partner'); }}>
                          {p.name}
                        </SimpleCell>
                      ))
                    ) : (
                      <Placeholder>Здесь пока пусто</Placeholder>
                    )}
                  </Group>

                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>Пригласить друзей</CellButton>
                    <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={() => { localStorage.clear(); window.location.reload(); }}>Сбросить прогресс</CellButton>
                  </Group>
                </Panel>

                {/* ГЛАВНАЯ */}
                <Panel id="home">
                  <PanelHeader>APG Alliance</PanelHeader>
                  <Header mode="secondary">События</Header>
                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                      {events.length > 0 ? events.map(e => (
                        <Card key={e.id} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}>
                          <Title level="3">{e.title}</Title>
                        </Card>
                      )) : <div style={{ padding: '0 16px', color: '#999' }}>Нет активных событий</div>}
                    </div>
                  </HorizontalScroll>

                  <Header mode="secondary">Наши партнеры</Header>
                  {loading ? <Spinner /> : (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '12px', 
                      padding: '8px 16px 24px' 
                    }}>
                      {partners.map((p) => (
                        <div key={p.id} style={{ 
                          background: 'var(--vkui--color_background_content)', 
                          padding: '16px', 
                          borderRadius: '16px', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}>
                          <Icon28StorefrontOutline />
                          <div style={{ marginBottom: 12, fontSize: '14px', fontWeight: '600' }}>{p.name}</div>
                          <Button size="s" mode="primary" stretched onClick={() => { setActivePartner(p.name); setActivePanel('partner'); }}>Смотреть</Button>
                          <Button size="s" mode={favorites.includes(p.id) ? "secondary" : "outline"} stretched onClick={() => toggleFavorite(p.id)} style={{ marginTop: 8 }}>
                            {favorites.includes(p.id) ? "В избранном ❤️" : "В избранное 🤍"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>{activePartner}</PanelHeader>
                  <Placeholder header="Акции партнера" icon={<Icon28KeyOutline />}>Все спецпредложения от {activePartner}.</Placeholder>
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