import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, InfoRow, CellButton, CardGrid, HorizontalScroll, Div, PanelHeaderBack
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, 
         Icon28PlaceOutline, Icon28UserAddOutline, Icon28DoorArrowRightOutline } from '@vkontakte/icons';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
  const [activePartner, setActivePartner] = useState(null); // Для хранения выбранного партнера
  const [user, setUser] = useState(null);
  const [keysCount, setKeysCount] = useState(0);

  useEffect(() => {
    const savedKeys = localStorage.getItem('apg_keys_count');
    if (savedKeys) setKeysCount(parseInt(savedKeys, 10));
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo').then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('apg_keys_count', keysCount.toString());
  }, [keysCount]);

  const openScanner = async () => {
    const data = await vkBridge.send('VKWebAppOpenQR');
    if (data.qr_data) {
      setKeysCount(prev => prev + 1);
      alert('Ключ найден!');
    }
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
                      <Title level="2" weight="1">{user ? `${user.first_name} ${user.last_name}` : "Загрузка..."}</Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={keysCount * 10} />
                      <Footnote style={{ marginTop: '8px' }}>Собрано {keysCount} из 10 ключей</Footnote>
                    </Div>
                  </Group>

                  <Group header={<Header mode="secondary">Друзья</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>Пригласить друзей</CellButton>
                  </Group>

                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={() => { localStorage.clear(); window.location.reload(); }}>Выйти</CellButton>
                  </Group>
                </Panel>

                {/* ГЛАВНАЯ */}
                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  <Header mode="secondary">Наши партнеры</Header>
                  <CardGrid size="s">
                    {['Кафе "Вкус"', 'Магазин "Книги"', 'Музей "История"'].map((name) => (
                      <Card key={name} mode="outline" style={{ padding: 15 }}>
                        <Title level="3">{name}</Title>
                        <Button size="s" mode="outline" onClick={() => { setActivePartner(name); setActivePanel('partner'); }}>
                          Смотреть акции
                        </Button>
                      </Card>
                    ))}
                  </CardGrid>
                </Panel>

                {/* ПАНЕЛЬ ПАРТНЕРА */}
                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
                    {activePartner || "Партнер"}
                  </PanelHeader>
                  <Placeholder header="Спецпредложения" icon={<Icon28KeyOutline />}>
                    Здесь вы найдете все скидки от партнера {activePartner}.
                  </Placeholder>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          <Tabbar>
            <TabbarItem onClick={() => setActivePanel('home')} selected={activePanel === 'home'} text="Главная"><Icon28HomeOutline /></TabbarItem>
            <TabbarItem onClick={openScanner} text="Сканировать" style={{ backgroundColor: 'var(--vkui--color_background_accent)', borderRadius: '8px' }}><Icon28QrCodeOutline fill="white" /></TabbarItem>
            <TabbarItem onClick={() => setActivePanel('profile')} selected={activePanel === 'profile'} text="Профиль"><Icon28UserCircleOutline /></TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};