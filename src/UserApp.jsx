import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, Icon28UserAddOutline, Icon28DoorArrowRightOutline, Icon28StorefrontOutline } from '@vkontakte/icons';

import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } from "firebase/firestore";
import { Scanner } from './Scanner.jsx';

export function UserApp() {
  const [activePanel, setActivePanel] = useState('home');
  const [userId, setUserId] = useState(null);
  const [userKeys, setUserKeys] = useState(3);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then((data) => {
      setUserId(data.id.toString());
      loadUserData(data.id.toString());
    });
    fetchPartners();
  }, []);

  const loadUserData = async (id) => {
    const userRef = doc(db, "users", id);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) setUserKeys(docSnap.data().keys);
    else await setDoc(userRef, { keys: 3 });
  };

  const fetchPartners = async () => {
    const querySnapshot = await getDocs(collection(db, "partners"));
    setPartners(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const handleConfirmScan = async (partnerName) => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { keys: increment(1) });
    setUserKeys(prev => prev + 1);
    alert(`Успешно! +1 Ключ!`);
    setIsScannerOpen(false);
  };

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                <Panel id="home">
                  <PanelHeader>APG Alliance</PanelHeader>
                  <Header mode="secondary">Твой прогресс: {userKeys} ключей</Header>
                  <Div><Progress value={userKeys * 10} /></Div>
                  <Header mode="secondary">Партнеры</Header>
                  {partners.map(p => <div key={p.id}>{p.name}</div>)}
                </Panel>
                {/* Здесь добавьте панели профиля и партнера из вашего старого AppConfig */}
              </View>
            </SplitCol>
          </SplitLayout>
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => setIsScannerOpen(true)} text="Сканер"><Icon28QrCodeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}