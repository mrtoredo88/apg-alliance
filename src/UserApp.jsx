import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Button, Progress, Footnote,
  Tabbar, TabbarItem, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner 
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, 
  Icon28HelpOutline 
} from '@vkontakte/icons';

import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } from 'firebase/firestore';

// ИЗМЕНЕНИЕ: Импортируем сканер как объект (на случай default или named exports)
import * as ScannerModule from './Scanner.jsx';
const ScannerComponent = ScannerModule.Scanner || ScannerModule.default || null;

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
      try {
        vkBridge.send('VKWebAppInit');
        const userData = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userData);
        
        const [pSnap, eSnap, fSnap] = await Promise.all([
          getDocs(collection(db, "partners")),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "faq"))
        ]);
        
        setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFaq(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const userRef = doc(db, "users", String(userData.id));
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserKeys(data.keys || 0);
          setFavorites(data.favorites || []);
        } else {
          await setDoc(userRef, { keys: 3, favorites: [] });
        }
      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    }
    initApp();
  }, []);

  const toggleFavorite = async (partnerId) => {
    if (!user) return;
    const newFavorites = favorites.includes(partnerId) 
      ? favorites.filter(id => id !== partnerId) 
      : [...favorites, partnerId];
    setFavorites(newFavorites);
    await updateDoc(doc(db, "users", String(user.id)), { favorites: newFavorites });
  };

  const handleConfirmScan = async () => {
    if (!user) return;
    await updateDoc(doc(db, "users", String(user.id)), { keys: increment(1) });
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
                          {events.map(e => <Card key={e.id} mode="shadow" style={{ width: 200, height: 100, padding: 16 }}><h3 style={{ margin: 0 }}>{e.title}</h3></Card>)}
                        </div>
                      </HorizontalScroll>
                      <Header mode="secondary">Наши партнеры</Header>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
                        {partners.map(p => (
                          <div key={p.id} style={{ background: '#fff', padding: 20, borderRadius: 20, textAlign: 'center', border: '1px solid #eee' }}>
                            {p.logoUrl && <Avatar size={56} src={p.logoUrl} />}
                            <div style={{ margin: '12px 0', fontWeight: 600 }}>{p.name}</div>
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
                  {!user ? <Spinner size="large" /> : (
                    <>
                      <Group>
                        <SimpleCell before={<Avatar size={64} src={user.photo_200} />}>
                          {user.first_name} {user.last_name}
                        </SimpleCell>
                        <Div><Progress value={Math.min(userKeys * 10, 100)} /><Footnote>Ключи: {userKeys}/10</Footnote></Div>
                      </Group>
                      <Group>
                        <CellButton before={<Icon28HelpOutline />} onClick={() => setActivePanel('faq')}>Помощь</CellButton>
                        <CellButton mode="danger" onClick={() => { localStorage.clear(); window.location.reload(); }}>Сброс</CellButton>
                      </Group>
                    </>
                  )}
                </Panel>
                
                {/* Остальные панели (faq, partner) оставляем без изменений */}
              </View>
            </SplitCol>
          </SplitLayout>
          
          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={() => setIsScannerOpen(true)} text="Сканировать"><Icon28QrCodeOutline /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
          
          {/* Итоговая защита сканера */}
          {isScannerOpen && ScannerComponent && <ScannerComponent onScan={handleConfirmScan} />}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}