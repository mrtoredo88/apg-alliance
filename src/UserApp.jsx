import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, CellButton, Div, PanelHeaderBack, HorizontalScroll, Spinner,
  ModalRoot, ModalPage, ModalPageHeader
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
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState({ title: '', text: '' });
  
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

  const openModal = (title, text) => {
    setModalData({ title, text });
    setActiveModal('achievement');
  };

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

  const modal = (
    <ModalRoot activeModal={activeModal}>
      <ModalPage 
        id="achievement" 
        onClose={() => setActiveModal(null)}
        header={<ModalPageHeader>{modalData.title}</ModalPageHeader>}
      >
        <Div>{modalData.text}</Div>
        <Div><Button stretched size="l" onClick={() => setActiveModal(null)}>Понятно</Button></Div>
      </ModalPage>
    </ModalRoot>
  );

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout modal={modal}>
            <SplitCol>
              <View activePanel={activePanel}>
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  {!user ? <Spinner size="large" style={{ marginTop: 20 }} /> : (
                    <>
                      <Group>
                        <SimpleCell before={user.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}>
                          <Title level="2" weight="1">{`${user.first_name} ${user.last_name}`}</Title>
                        </SimpleCell>
                        <Div>
                          <Progress value={userKeys * 10} />
                          <Footnote style={{ marginTop: '10px' }}>Собрано {userKeys} из 10 ключей</Footnote>
                        </Div>
                      </Group>

                      <Group header={<Header mode="secondary">Достижения</Header>}>
                        <SimpleCell 
                          before={<Icon28KeyOutline style={{ color: userKeys >= 1 ? 'gold' : 'gray' }}/>}
                          onClick={() => openModal("Первый ключ", userKeys >= 1 ? "Вы уже начали свое приключение!" : "Соберите 1 ключ, чтобы открыть достижение.")}
                        >Первый ключ</SimpleCell>
                        <SimpleCell 
                          before={<Icon28StorefrontOutline style={{ color: userKeys >= 5 ? 'gold' : 'gray' }}/>}
                          onClick={() => openModal("Исследователь", userKeys >= 5 ? "Вы посетили 5 мест!" : `Еще ${5 - userKeys} ключей до достижения.`)}
                        >Исследователь (5 ключей)</SimpleCell>
                      </Group>
                      {/* ... остальной код (Избранное, Настройки, Главная) оставляем как было ... */}
                    </>
                  )}
                </Panel>
                {/* ... остальные панели home и partner ... */}
              </View>
            </SplitCol>
          </SplitLayout>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}