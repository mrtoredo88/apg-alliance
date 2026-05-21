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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then((u) => {
      setUser(u);
      loadUserData(u.id.toString());
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
    setLoading(true);
    const snapshot = await getDocs(collection(db, "partners"));
    setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
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
                      {[1, 2, 3].map(i => (
                        <Card key={i} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}>
                          <Title level="3">Событие {i}</Title>
                        </Card>
                      ))}
                    </div>
                  </HorizontalScroll>

                  <Header mode="secondary">Наши партнеры</Header>
                  {loading ? <Spinner /> : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', padding: '8px 16px 24px' }}>
                      {partners.map((p) => (
                        <div key={p.id} style={{ width: '150px', background: 'var(--vkui--color_background_content)', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                          <Icon28StorefrontOutline />
                          <div style={{ marginBottom: 12, fontSize: '14px', fontWeight: '600' }}>{p.name}</div>
                          <Button size="s" mode="primary" stretched onClick={() => { setActivePartner(p.name); setActivePanel('partner'); }}>Смотреть</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {/* ПАРТНЕР */}
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