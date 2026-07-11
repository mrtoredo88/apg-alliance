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
- `super_admin` как владельческий уровень при flag `owner`;
- проектный owner-id `988504`, который уже используется в профиле для owner/admin-доступа;
- `admin/isAdmin`;
- `role/userRole/authRole`;
- наличие партнёрского кабинета;
- наличие экспертного кабинета.

Если `apg_app_mode` не установлен, Desktop Workspace открывается автоматически для пользователя с доступом. Если пользователь вручную выбрал «Пользовательский режим», сохраняется `apg_app_mode=user`, и Workspace не навязывается до следующего ручного переключения.

Desktop определяется через `isDesktopWorkspaceDevice()`: обычный desktop breakpoint `1180+`, а также Mac/Windows/Linux/ChromeOS при ширине `1024+`. iPadOS с touch-точками не считается desktop, чтобы мобильный/tablet UX не превращался в Workspace случайно.

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
LEFT SIDEBAR | CONTENT | AI WORKSPACE
STATUS BAR
```

Mobile и tablet продолжают использовать привычный пользовательский интерфейс. Desktop Workspace не заменяет мобильную оболочку.

## Layout stability

Desktop Workspace использует единый расчёт компоновки из `src/workspace/WorkspaceLayoutEngine.js`.

Ключевые правила:

- header является строкой основного grid, а не плавающим слоем поверх Dashboard;
- рабочая область — единый grid `sidebar | content | ai`;
- `content` всегда получает `minmax(0, 1fr)` и собственный vertical scroll;
- sidebar имеет собственный scroll и не обрезает нижние пункты меню;
- AI Workspace является самостоятельной колонкой, а на desktop уже 1180px переходит в drawer;
- root Workspace использует `overflow: hidden`, горизонтальный scroll страницы запрещён;
- sticky/fixed используются только для popover/drawer/overlay, а не для основных колонок.

Проверяемые desktop breakpoints:

- 1024×768;
- 1180×820;
- 1280×800;
- 1366×768;
- 1440×900;
- 1512×982;
- 1728×1117;
- 1920×1080.

Regression smoke:

```bash
npm run test:workspace-layout
```

Тест проверяет, что sidebar/content/AI не создают horizontal overflow, AI уходит в drawer на узком desktop, content остаётся читаемым, z-index scale упорядочен, а реальный asset Локи `public/loki.png` существует.

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
- Мой бизнес;
- CRM;
- Календарь;
- Локи;
- Настройки;
- Администрирование.

Панель можно свернуть. «Мой бизнес» открывает Business Hub внутри Workspace, а не отдельный классический кабинет. CRM и Календарь пока являются архитектурными заглушками, готовыми к подключению модулей.

## Content

Центральная область — рабочая область Workspace. Она не фиксирует мобильную ширину и использует `ContentGrid`.

Первая страница — Dashboard, который теперь открывается через Локи:

- персональное приветствие;
- briefing рабочего дня;
- сигналы “что требует внимания”;
- AI Dashboard с рабочими рекомендациями;
- новости и мероприятия;
- последние действия;
- статус бизнеса и профиля;
- быстрые действия.

Данные берутся из уже загруженного состояния `UserApp`: `partners`, `experts`, `events`, `news`, `notifications`, `ownedPartner`, `ownedExpert`.

## AI Workspace

Правая панель больше не считается sidebar. Это `AI Workspace`, постоянная рабочая область Локи.

В ней находятся:

- `LokiIdentity` с состояниями `thinking`, `answering`, `listening`, `waiting`, `recommending`;
- статус Локи;
- текущий контекст;
- последнее действие;
- рабочая память;
- следующее лучшее действие;
- Today / briefing;
- что требует внимания;
- контекстные рекомендации;
- история;
- чат;
- быстрые действия.

На desktop плавающий `LokiAssistant` не отображается поверх Workspace. Локи не открывается в отдельном окне и не уводит пользователя в User Mode: пункт меню “Локи”, `⌘L` и CTA “Спросить Локи” работают внутри `AI Workspace`.

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
- Sidebar как отдельная grid-колонка, а не overlay;
- compact Sidebar: 232px в раскрытом виде и 76px polished icon rail в collapsed-режиме;
- новости внутри Workspace используют общий `NewsCard` из `NewsPage`;
- мероприятия внутри Workspace используют общий `EventPosterCard` из `EventsPage`;
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
