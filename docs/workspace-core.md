# Workspace Core

Workspace Core — единый фундамент интерфейса АПГ для мобильной версии, планшета, будущего Desktop Workspace, Cabinet Core 2.0, CRM, календаря, админки и Локи.

Задача слоя — не создавать отдельный desktop-интерфейс, а описать общие области, breakpoints, навигацию и компоненты, которые можно переиспользовать в разных компоновках.

## Layout Engine

Источник: `src/workspace/WorkspaceCore.js`.

Система работает с шестью областями:

| Область | Назначение |
|---|---|
| `header` | верхняя системная область, заголовок, действия, состояние |
| `leftSidebar` | навигация desktop/tablet-rail |
| `content` | основная рабочая область |
| `rightSidebar` | контекстная панель, подробности, Локи, фильтры |
| `statusBar` | desktop-строка состояния Workspace |
| `bottomBar` | мобильная нижняя навигация |
| `floatingPanels` | быстрые действия и overlay-панели |

Функция `buildWorkspaceLayout()` возвращает единую схему видимости областей. Модули подключаются независимо: навигация, рабочая область, контекстная панель, Локи, уведомления и быстрые действия.

## Breakpoints

Workspace Core использует три режима:

| Режим | Ширина | Поведение |
|---|---:|---|
| `mobile` | 0+ | header, content, bottomBar, floatingPanels; контекст открывается overlay |
| `tablet` | 768+ | сохраняется мобильная логика, подготовлен compact/rail-паттерн |
| `desktop` | 1180+ | leftSidebar + content + опциональный rightSidebar; bottomBar скрывается |

Текущая мобильная оболочка приложения не переключается в desktop-компоновку автоматически. Это сделано намеренно: Workspace Core уже знает desktop-режим, но Desktop Workspace будет собираться отдельным этапом поверх тех же контрактов.

## Navigation Engine

Источник истины навигации — `WORKSPACE_NAV_ITEMS`.

Один и тот же список отдаёт:

- mobile bottom navigation;
- tablet rail;
- desktop sidebar;
- будущие рабочие пространства;
- role-aware пункты, включая Cabinet Core.

`UserApp.jsx` теперь строит существующий нижний бар через `getWorkspaceNavigation()`, поэтому порядок и подписи вкладок живут в общем контракте, а не только в JSX мобильной оболочки.

## Общие компоненты

Источник: `src/workspace/WorkspaceComponents.jsx`.

Добавлены компоненты APG V2:

- `WorkspaceShell`;
- `WorkspaceHeader`;
- `Sidebar`;
- `WorkspacePanel`;
- `WorkspaceContextPanel`;
- `WorkspaceFloatingPanels`;
- `GlassContainer`;
- `ContentGrid`;
- `DashboardCard`;
- `MetricCard`;
- `QuickActions`;
- `InfoPanel`;
- `SectionHeader`;
- `ActionCard`.

Компоненты используют inline styles и существующие APG V2 primitives из `Apg2ProfileGlass.jsx`, без отдельной CSS-системы.

## Context Panels

Правая панель описана как часть Layout Engine:

- на desktop может быть `docked`;
- на mobile/tablet открывается как overlay;
- внутри могут жить Локи, подробности объекта, фильтры, история и комментарии.

## Dashboard Framework

Базовые элементы dashboard уже выделены:

- `DashboardCard`;
- `MetricCard`;
- `ContentGrid`;
- `QuickActions`;
- `InfoPanel`;
- `SectionHeader`.

Наполнение дашбордов не зашито в Workspace Core. Разделы должны поставлять данные сами, а Workspace Core отвечает только за структуру и единый визуальный язык.

## Performance foundation

В `WorkspaceCore.js` подготовлены:

- `lazyWorkspaceModule(loader)` для динамических workspace-модулей;
- `createWorkspaceCache()` для безопасного кэширования вычислений;
- `makeVirtualWindow()` для виртуализации больших списков.

Эти функции не делают тяжёлых запросов и не создают фоновые циклы. Они используются только по явному вызову раздела.

## Связь с Cabinet Core

`CabinetCorePage.jsx` уже начал использовать общий `ContentGrid`. Следующие модули Cabinet Core должны постепенно переходить на `DashboardCard`, `MetricCard`, `WorkspacePanel` и `QuickActions`, не создавая отдельный набор карточек для кабинетов.

## Правило для следующих экранов

Новый экран АПГ должен:

1. получать режим через `getWorkspaceMode()`;
2. строить видимость областей через `buildWorkspaceLayout()`;
3. брать навигацию из `WORKSPACE_NAV_ITEMS`;
4. использовать общие workspace-компоненты;
5. не создавать отдельные mobile/desktop JSX-версии без крайней необходимости.

Так Desktop Workspace и Cabinet Core будут развиваться как разные компоновки одной системы, а не как два независимых интерфейса.

## Desktop Workspace 1.0

Desktop Workspace реализован в `src/workspace/DesktopWorkspace.jsx` и описан в `docs/desktop-workspace.md`.

Он использует Workspace Core как основу:

- desktop layout;
- общий Navigation Engine;
- `ContentGrid`;
- `DashboardCard`;
- `MetricCard`;
- `WorkspacePanel`;
- `QuickActions`;
- `ActionCard`;
- `SectionHeader`.

Пользовательский режим остаётся отдельной простой средой. Workspace включается по feature flag и доступен только ролям, которым положена рабочая среда.
