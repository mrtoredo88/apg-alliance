import React, { useState, useEffect } from 'react';
import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote,
  Tabbar, TabbarItem, Placeholder, InfoRow, CellButton, PanelHeaderBack
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import vkBridge from '@vkontakte/vk-bridge';
import { Icon28QrCodeOutline, Icon28HomeOutline, Icon28UserCircleOutline, Icon28SettingsOutline, 
         Icon28KeyOutline, Icon28UserAddOutline, Icon28DoorArrowRightOutline } from '@vkontakte/icons';

export const AppConfig = () => {
  const [activePanel, setActivePanel] = useState('profile');
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function initBridge() {
      try {
        await vkBridge.send('VKWebAppInit');
        const userData = await vkBridge.send('VKWebAppGetUserInfo');
        setUser(userData);
      } catch (error) {
        setUser({ first_name: 'Гость', last_name: 'Города', id: 0 });
      }
    }
    initBridge();
  }, []);

  const openScanner = async () => {
    try {
      const data = await vkBridge.send('VKWebAppOpenQR');
      if (data.qr_data) alert('Находка: ' + data.qr_data);
    } catch (e) { console.error(e); }
  };

  // Функция приглашения друга
  const inviteFriend = () => {
    vkBridge.send('VKWebAppShowInviteBox')
      .catch((e) => console.log('Приглашение отменено', e));
  };

  // Эмуляция выхода
  const handleLogout = () => {
    alert('Выход из системы...');
    window.location.reload(); 
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
                    <div style={{ padding: '0 16px 16px' }}>
                      <Progress value={60} />
                      <Footnote style={{ marginTop: '8px', color: 'var(--vkui--color_text_secondary)' }}>Уровень: Исследователь</Footnote>
                    </div>
                  </Group>

                  {/* Список друзей */}
                  <Group header={<Header mode="secondary">Друзья в APG</Header>}>
                    <CellButton before={<Icon28UserAddOutline />} onClick={inviteFriend}>
                      Пригласить друзей
                    </CellButton>
                    <SimpleCell before={<Avatar size={32} />}>Алексей Иванов</SimpleCell>
                    <SimpleCell before={<Avatar size={32} />}>Мария Петрова</SimpleCell>
                  </Group>

                  {/* Настройки */}
                  <Group header={<Header mode="secondary">Настройки</Header>}>
                    <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={handleLogout}>
                      Выйти из профиля
                    </CellButton>
                  </Group>
                </Panel>

                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  <Placeholder icon={<Icon28HomeOutline width={56} height={56} />}>
                    Скоро здесь появятся задания!
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