import { 
  AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, 
  Group, Header, Card, SimpleCell, Avatar, Title, Button, Spacing, Progress, Footnote 
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import { Icon28SettingsOutline } from '@vkontakte/icons';

export const AppConfig = () => {
  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout header={<PanelHeader separator={false} />}>
            <SplitCol>
              <View activePanel="main">
                <Panel id="main">
                  <PanelHeader>APG Alliance</PanelHeader>
                  
                  <Group header={<Header mode="primary">Профиль участника</Header>}>
                    <Card mode="outline" style={{ margin: '12px', padding: '16px' }}>
                      <SimpleCell
                        before={<Avatar size={64} src="https://vk.com/images/camera_200.png" />}
                        description="ID: 988504"
                      >
                        <Title level="2" weight="1">Гость города 🪐</Title>
                      </SimpleCell>
                      
                      <Spacing size={16} />
                      
                      {/* Блок с прогрессом */}
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <Footnote weight="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>
                            Прогресс уровня
                          </Footnote>
                          <Footnote weight="2">60%</Footnote>
                        </div>
                        <Progress value={60} />
                        <Spacing size={8} />
                        <Footnote style={{ color: 'var(--vkui--color_text_secondary)' }}>
                          Еще 4 ключа до звания «Местный житель»
                        </Footnote>
                      </div>

                      {/* Кнопки */}
                      <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
                        <Button size="m" mode="secondary" stretched>Редактировать</Button>
                        <Button size="m" mode="outline" aria-label="Настройки">
                          <Icon28SettingsOutline width={20} height={20} />
                        </Button>
                      </div>
                    </Card>
                  </Group>

                </Panel>
              </View>
            </SplitCol>
          </SplitLayout>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};