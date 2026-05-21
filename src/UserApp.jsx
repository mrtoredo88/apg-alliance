import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner,
  usePlatform, PLATFORMS
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

  // Инициализация Bridge
  useEffect(() => {
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then((u) => {
      setUser(u);
      loadUserData(u.id.toString());
    }).catch(console.error);
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
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    try {
      const snapshot = await getDocs(collection(db, "events"));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(data);
    } catch (e) { console.error(e); }
  };

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const userRef = doc(db, "users", user.id.toString());
    let newFavorites = favorites.includes(partnerId) ? favorites.filter(id => id !== partnerId) : [...favorites, partnerId];
    await updateDoc(userRef, { favorites: newFavorites });
    setFavorites(newFavorites);
  };

  return (
    <ConfigProvider platform={PLATFORMS.VKCOM}>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout style={{ height: '100vh' }}>
            <SplitCol>
              <View activePanel={activePanel}>
                
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  {!user ? <Spinner size="large" style={{ marginTop: 20 }} /> : (
                    <Group>
                       <SimpleCell before={user.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}>
                          <Title level="2">{`${user.first_name} ${user.last_name}`}</Title>
                        </SimpleCell>
                        <Div><Progress value={userKeys * 10} /><Footnote>Ключи: {userKeys}/10</Footnote></Div>
                        <CellButton mode="danger" onClick={() => { localStorage.clear(); window.location.reload(); }}>Сбросить</CellButton>
                    </Group>
                  )}
                </Panel>

                <Panel id="home">
                  <PanelHeader>APG Alliance</PanelHeader>
                  <Div>Привет, это главная!</Div>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>
          
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}