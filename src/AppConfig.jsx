import { AdaptivityProvider, ConfigProvider, AppRoot, SplitLayout, SplitCol, View, Panel, PanelHeader, Group, Placeholder } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css'; // Обязательно импортируем стили!

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
                  <Group>
                    {/* Сюда мы будем добавлять твои компоненты */}
                    <Placeholder>
                      Дизайн в процессе настройки!
                    </Placeholder>
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
