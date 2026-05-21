import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, InfoRow, CellButton, CardGrid, HorizontalScroll, Div, PanelHeaderBack
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { 
  Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28KeyOutline, 
  Icon28PlaceOutline, Icon28UserAddOutline, Icon28DoorArrowRightOutline,
  Icon28CupOutline, Icon28BookOutline, Icon28PaletteOutline, Icon28TheaterOutline, Icon28MusicOutline
} from '@vkontakte/icons';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
  const [activePartner, setActivePartner] = useState(null);
  const [user, setUser] = useState(null);
  const [keysCount, setKeysCount] = useState(0);

  // Инициализация при старте
  useEffect(() => {
    const savedKeys = localStorage.getItem('apg_keys_count');
    if (savedKeys) setKeysCount(parseInt(savedKeys, 10));

    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo')
      .then(setUser)
      .catch(() => {
        setUser({ first_name: 'Тестовый', last_name: 'Пользователь', id: 0 });
      });
  }, []);

  // Сохранение ключей
  useEffect(() => {
    localStorage.setItem('apg_keys_count', keysCount.toString());
  }, [keysCount]);

  // Сканер
  const openScanner = async () => {
    try {
      const data = await vkBridge.send('VKWebAppOpenQR');
      if (data.qr_data) {
        setKeysCount(prev => prev + 1);
        alert('Ключ найден! Прогресс обновлен.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Данные партнеров (вынесено для удобства)
  const partners = [
    { name: 'Кафе "Вкус"', icon: <Icon28CupOutline fill="#FF9800" /> },
    { name: 'Магазин "Книги"', icon: <Icon28BookOutline fill="#2196F3" /> },
    { name: 'Музей города', icon: <Icon28PaletteOutline fill="#9C27B0" /> },
    { name: 'Кинотеатр', icon: <Icon28TheaterOutline fill="#E91E63" /> },
    { name: 'Концерт-холл', icon: <Icon28MusicOutline fill="#4CAF50" /> },
  ];

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                
                {/* === ПРОФИЛЬ === */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  
                  <Group>
                    <SimpleCell
                      before={user?.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}
                      description={user ? `ID: ${user.id}` : "Загрузка..."}
                    >
                      <Title level="2" weight="1">
                        {user ? `${user.first_name} ${user.last_name}` : "Исследователь 🪐"}
                      </Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={keysCount * 10} />
                      <Footnote style={{ marginTop: '10px', color: 'var(--vkui--color_text_secondary)' }}>
                        {keysCount >= 10 
                          ? "🎉 Доступ к закрытому мероприятию открыт!" 
                          : `Собрано ${keysCount} из 10 ключей до секретного ивента`}
                      </Footnote>
                    </Div>
                  </Group>

                  <Group header={<Header mode="secondary">Друзья</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>
                      Пригласить друзей
                    </CellButton>
                  </Group>

                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton 
                      mode="danger" 
                      before={<Icon28DoorArrowRightOutline />} 
                      onClick={() => { 
                        localStorage.clear(); 
                        window.location.reload(); 
                      }}
                    >
                      Выйти и сбросить прогресс
                    </CellButton>
                  </Group>
                </Panel>

                {/* === ГЛАВНАЯ === */}
                <Panel id="home">
                  <PanelHeader>APG Alliance</PanelHeader>
                  
                  {/* Карусель */}
                  <Header mode="secondary">События и акции</Header>
                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                      {[1, 2, 3].map(i => (
                        <Card key={i} mode="shadow" style={{ width: 240, height: 110, flexShrink: 0, padding: 16, background: 'var(--vkui--color_background_content)' }}>
                          <Title level="3" weight="2" style={{ color: 'var(--vkui--color_text_accent)', marginBottom: 6 }}>Событие #{i}</Title>
                          <Footnote style={{ opacity: 0.8 }}>Участвуй и получи бонусные баллы APG сегодня!</Footnote>
                        </Card>
                      ))}
                    </div>
                  </HorizontalScroll>

                  <Spacing size={16} />

                  {/* Сетка партнеров (Центрированная) */}
                  <Header mode="secondary">Наши партнеры</Header>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '0 8px 24px' }}>
                    <CardGrid size="s" style={{ width: '100%', maxWidth: '600px' }}>
                      {partners.map((p) => (
                        <Card key={p.name} mode="shadow" style={{ padding: 16, textAlign: 'center', borderRadius: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            {p.icon}
                          </div>
                          <div style={{ marginBottom: 14, fontWeight: '600', fontSize: '15px' }}>{p.name}</div>
                          <Button 
                            size="s" 
                            mode="primary" 
                            stretched 
                            onClick={() => { 
                              setActivePartner(p.name);
                              setActivePanel('partner');
                            }}
                          >
                            Смотреть
                          </Button>
                        </Card>
                      ))}
                    </CardGrid>
                  </div>

                  <Group header={<Header mode="secondary">Локации</Header>}>
                    <Div>
                      <Button before={<Icon28PlaceOutline />} stretched size="l" mode="secondary" onClick={() => alert('Карта загружается...')}>
                        Карта всех точек
                      </Button>
                    </Div>
                  </Group>
                </Panel>

                {/* === ПАНЕЛЬ ПАРТНЕРА === */}
                <Panel id="partner">
                  <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
                    {activePartner}
                  </PanelHeader>
                  
                  <Group>
                    <Placeholder 
                      header="Акции партнера" 
                      icon={<Icon28KeyOutline width={56} height={56} fill="var(--vkui--color_background_accent)" />}
                    >
                      Скидка 10% для участников APG Alliance при предъявлении QR-кода профиля.
                    </Placeholder>
                    
                    <Div>
                      <Button before={<Icon28PlaceOutline />} stretched size="l" mode="outline">
                        Маршрут до {activePartner}
                      </Button>
                    </Div>
                  </Group>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          {/* Таббар */}
          <Tabbar>
            <TabbarItem 
              onClick={() => setActivePanel('home')} 
              selected={activePanel === 'home'} 
              text="Главная"
            >
              <Icon28HomeOutline />
            </TabbarItem>
            
            <TabbarItem 
              onClick={openScanner} 
              text="Сканировать" 
              style={{ backgroundColor: 'var(--vkui--color_background_accent)', borderRadius: '12px', margin: '4px' }}
            >
              <Icon28QrCodeOutline fill="white" />
            </TabbarItem>
            
            <TabbarItem 
              onClick={() => setActivePanel('profile')} 
              selected={activePanel === 'profile'} 
              text="Профиль"
            >
              <Icon28UserCircleOutline />
            </TabbarItem>
          </Tabbar>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};