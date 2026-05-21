import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28SettingsOutline } from '@vkontakte/icons';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function initBridge() {
      try {
        // 1. Инициализируем мост
        await vkBridge.send('VKWebAppInit');
        
        // 2. Пробуем получить данные пользователя
        const userData = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userData);
      } catch (error) {
        console.warn('Приложение запущено вне VK или произошла ошибка:', error);
        // Если не в VK, можно поставить тестовое имя для отладки в браузере
        setUser({ first_name: 'Тестовый', last_name: 'Пользователь', id: 0 });
      }
    }
    initBridge();
  }, []);

  const openScanner = async () => {
    try {
      const isSupported = await vkBridge.supportsAsync('VKWebAppOpenQR');
      if (!isSupported) {
        alert('Сканер недоступен в этом окружении');
        return;
      }
      const data = await vkBridge.send('VKWebAppOpenQR');
      if (data.qr_data) {
        alert('Код: ' + data.qr_data);
      }
    } catch (error) {
      console.error('Ошибка сканера:', error);
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
                  <Group header={<Header mode="primary">Профиль участника</Header>}>
                    <Card mode="outline" style={{ margin: '12px', padding: '16px' }}>
                      <SimpleCell
                        before={user?.photo_200 ? <Avatar size={64} src={user.photo_200} /> : <Avatar size={64} />}
                        description={user ? `ID: ${user.id}` : "Загрузка..."}
                      >
                        <Title level="2" weight="1">
                          {user ? `${user.first_name} ${user.last_name}` : "Гость города 🪐"}
                        </Title>
                      </SimpleCell>
                      
                      <Spacing size={16} />
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <Footnote weight="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>Прогресс</Footnote>
                          <Footnote weight="2">60%</Footnote>
                        </div>
                        <Progress value={60} />
                      </div>
                    </Card>
                  </Group>
                </Panel>

                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  <Placeholder icon={<Icon28HomeOutline width={56} height={56} />}>
                    Добро пожаловать, {user?.first_name || 'друг'}!
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