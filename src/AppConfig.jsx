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

  // Инициализация при старте
  useEffect(() => {
    // 1. Восстанавливаем ключи из localStorage
    const savedKeys = localStorage.getItem('apg_keys_count');
    if (savedKeys) setKeysCount(parseInt(savedKeys, 10));

    // 2. Инициализируем VK Bridge и получаем данные пользователя
    vkBridge.send('VKWebAppInit');
    vkBridge.send('VKWebAppGetUserInfo')
      .then(setUser)
      .catch(() => {
        // Если запуск вне ВК, ставим заглушку для дебага
        setUser({ first_name: 'Тестовый', last_name: 'Пользователь', id: 0 });
      });
  }, []);

  // Сохраняем ключи при каждом изменении
  useEffect(() => {
    localStorage.setItem('apg_keys_count', keysCount.toString());
  }, [keysCount]);

  // Функция сканирования
  const openScanner = async () => {
    try {
      const data = await vkBridge.send('VKWebAppOpenQR');
      if (data.qr_data) {
        setKeysCount(prev => prev + 1);
        alert('Ключ успешно найден!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                
                {/* === ПАНЕЛЬ ПРОФИЛЯ === */}
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  
                  {/* Основная инфо */}
                  <Group>
                    <SimpleCell
                      before={user?.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}
                      description={user ? `ID: ${user.id}` : "Загрузка..."}
                    >
                      <Title level="2" weight="1">
                        {user ? `${user.first_name} ${user.last_name}` : "Гость города 🪐"}
                      </Title>
                    </SimpleCell>
                    <Div>
                      <Progress value={keysCount * 10} />
                      <Footnote style={{ marginTop: '8px', color: 'var(--vkui--color_text_secondary)' }}>
                        {keysCount >= 10 
                          ? "🎉 Доступ к закрытому мероприятию открыт!" 
                          : `Собрано ${keysCount} из 10 ключей до секретного мероприятия`}
                      </Footnote>
                    </Div>
                  </Group>

                  {/* Секция Друзей (ВЕРНУЛАСЬ) */}
                  <Group header={<Header mode="secondary">Друзья в APG</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={() => vkBridge.send('VKWebAppShowInviteBox')}>
                      Пригласить друзей из ВКонтакте
                    </CellButton>
                  </Group>

                  {/* Настройки и Выход */}
                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton 
                      mode="danger" 
                      before={<Icon28DoorArrowRightOutline />} 
                      onClick={() => { 
                        localStorage.clear(); // Сброс прогресса
                        window.location.reload(); 
                      }}
                    >
                      Выйти и сбросить прогресс
                    </CellButton>
                  </Group>
                </Panel>

                {/* === ГЛАВНАЯ ПАНЕЛЬ === */}
                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  
                  {/* ГОВОРИЗОНТАЛЬНАЯ КАРУСЕЛЬ АКЦИЙ (ВЕРНУЛАСЬ) */}
                  <Header mode="secondary">События и топовые акции</Header>
                  <HorizontalScroll showArrows>
                    <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                      {[1, 2, 3].map(i => (
                        <Card key={i} mode="outline" style={{ width: 220, height: 130, flexShrink: 0, position: 'relative' }}>
                          <div style={{ padding: 12 }}>
                            <Title level="3" weight="2" style={{ marginBottom: 4 }}>Супер-Акция #{i}</Title>
                            <Footnote style={{ color: 'var(--vkui--color_text_secondary)' }}>Короткое описание события или бонуса для привлечения внимания.</Footnote>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </HorizontalScroll>

                  <Spacing size={16} />

                  {/* Стена партнеров (Grid) */}
                  <Header mode="secondary">Партнеры города</Header>
                  <CardGrid size="s">
                    {['Кафе "Вкус"', 'Магазин "Книги"', 'Музей "История"', 'Кинотеатр', 'Спортзал'].map((name) => (
                      <Card key={name} mode="outline" style={{ padding: 15, textAlign: 'center' }}>
                        <Title level="3" style={{ marginBottom: 10 }}>{name}</Title>
                        <Button 
                          size="s" 
                          mode="outline" 
                          stretched 
                          onClick={() => { 
                            setActivePartner(name); // Запоминаем кого открыли
                            setActivePanel('partner'); // Переключаем панель
                          }}
                        >
                          Смотреть акции
                        </Button>
                      </Card>
                    ))}
                  </CardGrid>
                </Panel>

                {/* === ПАНЕЛЬ КОНКРЕТНОГО ПАРТНЕРА === */}
                <Panel id="partner">
                  <PanelHeader 
                    before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}
                  >
                    {activePartner || "Партнер"}
                  </PanelHeader>
                  
                  <Group header={<Header mode="secondary">Актуальные предложения</Header>}>
                    <Placeholder 
                      header="Спецпредложения" 
                      icon={<Icon28KeyOutline width={56} height={56} />}
                    >
                      Здесь будет список всех скидок, акций и секретных кодов от партнера {activePartner}.
                    </Placeholder>
                    
                    <Div>
                      <Button before={<Icon28PlaceOutline />} stretched size="l" mode="secondary">
                        Показать {activePartner} на карте
                      </Button>
                    </Div>
                  </Group>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          {/* Нижняя навигация (Tabbar) */}
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
              style={{ backgroundColor: 'var(--vkui--color_background_accent)', borderRadius: '8px' }}
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