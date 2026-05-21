import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, InfoRow, CellButton, CardGrid, HorizontalScroll, Div
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, Icon28PlaceOutline } from '@vkontakte/icons';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
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
      alert(keysCount + 1 >= 10 ? 'Поздравляем! Доступ к закрытому мероприятию открыт!' : 'Ключ найден!');
    }
  };

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
                      <Title level="2" weight="1">{user ? `${user.first_name} ${user.last_name}` : "Загрузка..."}</Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={keysCount * 10} />
                      <Footnote style={{ marginTop: '8px' }}>
                        {keysCount >= 10 
                          ? "🎉 Доступ к закрытому мероприятию открыт!" 
                          : `Собрано ${keysCount} из 10 ключей до доступа к закрытому мероприятию`}
                      </Footnote>
                    </Div>
                  </Group>
                  <Group>
                     <CellButton mode={keysCount >= 10 ? 'primary' : 'secondary'} disabled={keysCount < 10}>
                       {keysCount >= 10 ? "Перейти к мероприятию" : "Соберите 10 ключей"}
                     </CellButton>
                  </Group>
                </Panel>

                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  
                  {/* Горизонтальная карусель */}
                  <Header mode="secondary">События и акции</Header>
                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
                      {[1, 2, 3].map(i => (
                        <Card key={i} style={{ width: 200, height: 120, padding: 10, background: '#eee' }}>
                          Акция #{i}
                        </Card>
                      ))}
                    </div>
                  </HorizontalScroll>

                  {/* Стена партнеров */}
                  <Header mode="secondary">Наши партнеры</Header>
                  <CardGrid size="s">
                    {['Кафе', 'Магазин', 'Музей'].map((name, i) => (
                      <Card key={i} mode="outline" style={{ padding: 20 }}>
                        {name}
                        <Button size="s" mode="outline" style={{ marginTop: 10 }}>Смотреть</Button>
                      </Card>
                    ))}
                  </CardGrid>

                  {/* Карта */}
                  <Group header={<Header mode="secondary">Где мы находимся</Header>}>
                    <Div>
                      <Button before={<Icon28PlaceOutline />} stretched size="m" onClick={() => alert('Открываю карту...')}>
                        Показать на карте
                      </Button>
                    </Div>
                  </Group>
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