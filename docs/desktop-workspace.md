# Desktop Workspace 1.0

Desktop Workspace 1.0 — вторая среда использования АПГ. Это не растянутая мобильная версия, а рабочее пространство для партнёров, экспертов, модераторов, редакторов, администраторов и владельца проекта.

Пользовательский режим остаётся простым городским приложением для жителей: главная, новости, партнёры, эксперты, QR, профиль и Локи. Workspace включается только тем, кому доступна рабочая среда.

## Режимы приложения

| Режим | Для кого | Назначение |
|---|---|---|
| Пользовательский режим | жители города | простое мобильное/адаптивное приложение АПГ |
| Workspace | партнёры, эксперты, команда АПГ | SaaS-среда для работы с контентом, кабинетами, задачами, Локи и будущими CRM-модулями |

Переключение происходит в `UserApp.jsx` через `appMode`, без повторной авторизации и без перезагрузки приложения. Режим сохраняется в `localStorage` как `apg_app_mode`.

## Feature Flags

Источник: `src/workspace/WorkspaceFeatureFlags.js`.

Поддержаны уровни включения:

1. `off`
2. `owner`
3. `admin`
4. `partner`
5. `expert`
6. `all`

По умолчанию используется безопасный уровень `owner`. Для локального/постепенного включения можно задать `localStorage.apg_desktop_workspace_flag`.

Доступ вычисляется через `canUseDesktopWorkspace({ user, partner, expert, flag })`. Учитываются:

- `owner/isOwner`;
- `admin/isAdmin`;
- `role/userRole/authRole`;
- наличие партнёрского кабинета;
- наличие экспертного кабинета.

## Layout

Desktop Workspace полностью строится поверх Workspace Core:

- `buildWorkspaceLayout()`;
- `WORKSPACE_MODES.desktop`;
- `getWorkspaceNavigation()`;
- `ContentGrid`;
- `DashboardCard`;
- `MetricCard`;
- `WorkspacePanel`;
- `QuickActions`;
- `ActionCard`;
- `SectionHeader`.

Desktop layout:

```text
HEADER
LEFT SIDEBAR | CONTENT | RIGHT SIDEBAR
STATUS BAR
```

Mobile и tablet продолжают использовать привычный пользовательский интерфейс. Desktop Workspace не заменяет мобильную оболочку.

## Header

Header содержит:

- логотип АПГ;
- глобальный поиск;
- shortcut hint `⌘K / Ctrl K`;
- переключатель режима;
- быстрый запуск QR;
- уведомления;
- переключатель роли;
- профиль.

## Left Sidebar

Левая панель содержит:

- Dashboard;
- Контент;
- Новости;
- Мероприятия;
- Партнёры;
- Эксперты;
- Кабинеты;
- CRM;
- Календарь;
- Локи;
- Настройки;
- Администрирование.

Панель можно свернуть. CRM и Календарь пока являются архитектурными заглушками, готовыми к подключению модулей.

## Content

Центральная область — рабочая область Workspace. Она не фиксирует мобильную ширину и использует `ContentGrid`.

Первая страница — Dashboard:

- приветствие;
- метрики по партнёрам, экспертам, новостям и событиям;
- последние новости;
- ближайшие мероприятия;
- последние действия;
- статус профиля;
- задачи;
- быстрые действия.

Данные берутся из уже загруженного состояния `UserApp`: `partners`, `experts`, `events`, `news`, `notifications`, `ownedPartner`, `ownedExpert`.

## Right Sidebar

Правая панель — контекст Workspace. В версии 1.0 там находятся:

- Локи;
- уведомления;
- быстрые действия;
- последние события.

На desktop плавающий `LokiAssistant` не отображается поверх Workspace. Локи становится частью рабочей среды.

## Widgets

Источник: `src/workspace/WorkspaceWidgets.js`.

Добавлена архитектура виджетов:

- `WORKSPACE_WIDGETS`;
- `getWorkspaceWidgetLayout()`;
- `moveWorkspaceWidget()`;
- `dragHandleId`;
- `draggable`.

Полноценный drag & drop не включён в V1, но layout уже хранит порядок и ограничения. Locked-виджет `welcome` нельзя перемещать.

## Desktop UX

В Desktop Workspace 1.0 добавлены:

- hover-ready карточки и кнопки;
- collapsible sidebar;
- wide cards;
- рабочие списки;
- split view `sidebar/content/context`;
- keyboard shortcuts:
  - `⌘K / Ctrl K` — фокус глобального поиска;
  - `⌘1 / Ctrl 1` — Dashboard;
  - `⌘B / Ctrl B` — свернуть/развернуть sidebar.

## Будущее развитие

Следующие крупные этапы должны подключаться внутрь Workspace:

- Cabinet Core;
- CRM;
- календарь;
- аналитика;
- заявки;
- AI Workspace Локи;
- контентный редактор;
- role-based рабочие столы.

Новая функциональность должна использовать Workspace Core и Desktop Workspace shell, а не создавать отдельную desktop/mobile реализацию.
