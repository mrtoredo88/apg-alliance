import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner,
  Input, FormLayout, FormLayoutGroup 
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, 
  Icon28PlaceOutline, Icon28UserAddOutline, Icon28DoorArrowRightOutline,
  Icon28StorefrontOutline 
} from '@vkontakte/icons';

import { db } from './firebase'; 
import { collection, getDocs, addDoc } from 'firebase/firestore';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
  const [activePartner, setActivePartner] = useState(null);
  const [user, setUser] = useState(null);
  const [keysCount, setKeysCount] = useState(0);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Состояния для админки
  const [newPartnerName, setNewPartnerName] = useState('');
  const MY_VK_ID = 988504; // <--- ВСТАВЬТЕ СЮДА СВОЙ ID ИЗ ВК

  useEffect(() => {
    const savedKeys = localStorage.getItem('apg_keys_count');
    if (savedKeys) setKeysCount(parseInt(savedKeys, 10));
    
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then(setUser).catch(() => {});

    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "partners"));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPartners(data);
    } catch (e) {
      console.error("Ошибка Firebase:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async () => {
    if (!newPartnerName.trim()) return;
    try {
      await addDoc(collection(db, "partners"), { name: newPartnerName });
      alert("Партнер добавлен!");
      setNewPartnerName('');
      fetchPartners(); // Обновляем список
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  };

  useEffect(() => {
    localStorage.setItem('apg_keys_count', keysCount.toString());
  }, [keysCount]);

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  <Group>
                    <SimpleCell before={user?.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}>
                      <Title level="2" weight="1">{user ? `${user.first_name} ${user.last_name}` : "Исследователь"}</Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={keysCount * 10} />
                      <Footnote style={{ marginTop: '10px' }}>Собрано {keysCount} из 10 ключей</Footnote>
                    </Div>
                  </Group>
                  
                  {/* Секция Администратора */}
                  {user?.id === MY_VK_ID && (
                    <Group header={<Header mode="primary">Панель администратора</Header>}>
                      <FormLayout>
                        <FormLayoutGroup mode="vertical">
                          <Input 
                            value={newPartnerName} 
                            onChange={(e) => setNewPartnerName(e.target.value)} 
                            placeholder="Название нового партнера" 
                          />
                          <Button size="m" onClick={handleAddPartner}>Добавить партнера</Button>
                        </FormLayoutGroup>
                      </FormLayout>
                    </Group>
                  )}
                  
                  <Group header={<Header mode="secondary">Друзья</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>Пригласить друзей</CellButton>
                  </Group>
                  
                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={() => { localStorage.clear(); window.location.reload(); }}>Сбросить прогресс</CellButton>
                  </Group>
                </Panel>

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
                  {loading ? (
                    <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', padding: '8px 16px 24px' }}>
                      {partners.map((p) => (
                        <div key={p.id} style={{ width: '150px', background: 'var(--vkui--color_background_content)', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Icon28StorefrontOutline /></div>
                          <div style={{ marginBottom: 12, fontSize: '14px', fontWeight: '600' }}>{p.name}</div>
                          <Button size="s" mode="primary" stretched onClick={() => { setActivePartner(p.name); setActivePanel('partner'); }}>
                            Смотреть
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>{activePartner}</PanelHeader>
                  <Placeholder header="Акции партнера" icon={<Icon28KeyOutline />}>
                    Все спецпредложения от {activePartner}.
                  </Placeholder>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>
          
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => vkBridge.send('VKWebAppOpenQR')} text="Сканировать"><Icon28QrCodeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};