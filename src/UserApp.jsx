import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner
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
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then((u) => {
      setUser(u);
      loadUserData(u.id.toString());
    });
    fetchPartners();
    fetchEvents();
    fetchFaq();
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
      const partnersList = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        if (data.name) return { id: d.id, ...data };
        if (data.groupId) {
          try {
            const res = await vkBridge.send("VKWebAppCallAPIMethod", {
              method: "groups.getById",
              params: { group_id: data.groupId, fields: "photo_200", v: "5.199" }
            });
            if (res.response && res.response[0]) {
              return { id: d.id, name: res.response[0].name, logoUrl: res.response[0].photo_200, ...data };
            }
          } catch (e) { console.error(e); }
        }
        return { id: d.id, name: "Партнер", logoUrl: null, ...data };
      }));
      setPartners(partnersList);
    } catch (e) { console.error(e); } finally { setLoading(false); }
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
  {!user ? <Spinner size="large" /> : (
    <>
      <Group>
        <SimpleCell before={<Avatar size={64} src={user.photo_200} />}>
          <Title level="2">{`${user.first_name} ${user.last_name}`}</Title>
        </SimpleCell>
        <Div><Progress value={userKeys * 10} /><Footnote>Ключи: {userKeys}/10</Footnote></Div>
      </Group>

      {/* --- НОВЫЙ БЛОК ИЗБРАННОГО --- */}
      <Group header={<Header mode="secondary">Избранные партнеры</Header>}>
        {favorites.length === 0 ? (
          <Div>У вас пока нет избранных партнеров.</Div>
        ) : (
          partners
            .filter(p => favorites.includes(p.id)) // Оставляем только тех, кто в избранном
            .map(p => (
              <SimpleCell 
                key={p.id} 
                before={<Avatar size={40} src={p.logoUrl} />}
                onClick={() => { setActivePartner(p); setActivePanel('partner'); }}
                multiline
              >
                {p.name}
              </SimpleCell>
            ))
        )}
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
                          {p.logoUrl ? <Avatar size={56} src={p.logoUrl} style={{ marginBottom: 12 }} /> : <Icon28StorefrontOutline width={40} height={40} style={{ marginBottom: 12, color: '#999' }} />}
                          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>{p.name}</div>
                          <Button size="m" mode="primary" stretched onClick={() => { setActivePartner(p); setActivePanel('partner'); }}>Открыть</Button>
                          <Button size="m" mode="tertiary" stretched onClick={() => toggleFavorite(p.id)}>{favorites.includes(p.id) ? "★ В избранном" : "☆ В избранное"}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
                    {activePartner?.name}
                  </PanelHeader>
                  {activePartner && (
                    <Div>
                      <Avatar size={96} src={activePartner.logoUrl} style={{ margin: '0 auto 16px', display: 'block' }} />
                      <Title level="1" style={{ textAlign: 'center', marginBottom: 16 }}>{activePartner.name}</Title>
                      <div style={{ marginBottom: 24, lineHeight: '1.5' }}>{activePartner.description || "У этого партнера пока нет описания."}</div>
                      {activePartner.link && (
                        <Button size="l" mode="primary" stretched onClick={() => window.open(activePartner.link, '_blank')}>Перейти к партнеру</Button>
                      )}
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