import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner,
  Input, FormItem, Textarea
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, 
  Icon28UserAddOutline, Icon28DoorArrowRightOutline, Icon28StorefrontOutline 
} from '@vkontakte/icons';

import { db } from './firebase'; 
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('home');
  const [currentPartner, setCurrentPartner] = useState(null);
  const [user, setUser] = useState(null);
  const [keysCount, setKeysCount] = useState(0);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newPartnerName, setNewPartnerName] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImg, setEditImg] = useState('');
  
  const MY_VK_ID = 988504; 

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
      setPartners(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAddPartner = async () => {
    if (!newPartnerName.trim()) return;
    await addDoc(collection(db, "partners"), { name: newPartnerName, description: '', imageUrl: '' });
    setNewPartnerName('');
    fetchPartners();
  };

  const handleUpdatePartner = async () => {
    if (!currentPartner) return;
    await updateDoc(doc(db, "partners", currentPartner.id), { name: editName, description: editDesc, imageUrl: editImg });
    alert("Сохранено!");
    fetchPartners();
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
                    <Div><Progress value={keysCount * 10} /><Footnote>Собрано {keysCount} из 10 ключей</Footnote></Div>
                  </Group>

                  {user?.id === MY_VK_ID && (
                    <Group header={<Header mode="primary">Администрирование</Header>}>
                      <FormItem top="Добавить партнера"><Input value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)} /></FormItem>
                      <Div><Button stretched onClick={handleAddPartner}>Создать партнера</Button></Div>
                    </Group>
                  )}
                  
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', padding: '8px 16px' }}>
                      {partners.map((p) => (
                        <div key={p.id} style={{ width: '150px', background: 'var(--vkui--color_background_content)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                          <Icon28StorefrontOutline />
                          <div style={{ fontWeight: '600' }}>{p.name}</div>
                          <Button size="s" mode="primary" stretched onClick={() => { 
                            setCurrentPartner(p); setEditName(p.name); setEditDesc(p.description || ''); setEditImg(p.imageUrl || ''); 
                            setActivePanel('partner'); 
                          }}>Смотреть</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {/* ПАРТНЕР */}
                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>{currentPartner?.name}</PanelHeader>
                  {currentPartner?.imageUrl && <img src={currentPartner.imageUrl} style={{ width: '100%', borderRadius: 12 }} alt="" />}
                  <Placeholder header={currentPartner?.name}>{currentPartner?.description || "Описание пока пустое"}</Placeholder>
                  {user?.id === MY_VK_ID && (
                    <Group header={<Header>Редактирование</Header>}>
                      <FormItem top="Название"><Input value={editName} onChange={e => setEditName(e.target.value)} /></FormItem>
                      <FormItem top="Описание"><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} /></FormItem>
                      <FormItem top="Ссылка на картинку"><Input value={editImg} onChange={e => setEditImg(e.target.value)} /></FormItem>
                      <Div><Button stretched onClick={handleUpdatePartner}>Сохранить изменения</Button></Div>
                    </Group>
                  )}
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