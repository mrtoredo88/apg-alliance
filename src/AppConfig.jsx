import React, { useState } from 'react';
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

  const openScanner = () => {
    vkBridge.send('VKWebAppOpenQR')
      .then((data) => {
        if (data.qr_data) {
          alert('Код: ' + data.qr_data);
        }
      })
      .catch((error) => {
        console.error('Ошибка:', error);
      });
  };

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          {/* Сначала идет макет контента */}
          <SplitLayout>
            <SplitCol>
              <View activePanel={activePanel}>
                
                <Panel id="profile">
                  <PanelHeader>Профиль</PanelHeader>
                  <Group header={<Header mode="primary">Профиль участника</Header>}>
                    <Card mode="outline" style={{ margin: '12px', padding: '16px' }}>
                      <SimpleCell
                        before={<Avatar size={64} src="https://vk.com/images/camera_200.png" />}
                        description="ID: 988504"
                      >
                        <Title level="2" weight="1">Гость города 🪐</Title>
                      </SimpleCell>
                      
                      <Spacing size={16} />
                      
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <Footnote weight="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>Прогресс</Footnote>
                          <Footnote weight="2">60%</Footnote>
                        </div>
                        <Progress value={60} />
                        <Spacing size={8} />
                        <Footnote style={{ color: 'var(--vkui--color_text_secondary)' }}>Еще 4 ключа до уровня «Местный»</Footnote>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
                        <Button size="m" mode="secondary" stretched>Редактировать</Button>
                        <Button size="m" mode="outline">
                          <Icon28SettingsOutline width={20} height={20} />
                        </Button>
                      </div>
                    </Card>
                  </Group>
                </Panel>

                <Panel id="home">
                  <PanelHeader>Главная</PanelHeader>
                  <Placeholder
                    icon={<Icon28HomeOutline width={56} height={56} />}
                    header="Добро пожаловать в APG Alliance"
                  >
                    Здесь будут новости города и важные уведомления.
                  </Placeholder>
                </Panel>

              </View>
            </SplitCol>
          </SplitLayout>

          {/* А ТЕПЕРЬ ТАББАР ВСЕГДА ВНИЗУ */}
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