# 05 FRONTEND

## Структура директорий

```
src/
├── App.jsx                    ← корневой компонент + HashRouter
├── main.jsx                   ← ReactDOM.createRoot
├── UserApp.jsx                ← главная оболочка пользовательского приложения
├── AdminPanel.jsx             ← панель администратора
├── HomePanelV2.jsx            ← единая V3-главная страница
├── ProfilePanel.jsx           ← экран «Профиль»
├── ExpertsPage.jsx            ← каталог экспертов
├── EventsPage.jsx             ← список событий
├── RewardsPage.jsx            ← призы и розыгрыши
├── TasksPage.jsx              ← задания
├── LeaderboardPage.jsx        ← топ пользователей
├── PartnerPage.jsx            ← карточка партнёра (модаль)
├── cabinet/
│   ├── CabinetCorePage.jsx    ← единое ядро личных кабинетов 2.0
│   ├── CabinetRoleEngine.js   ← определение ролей и подключение модулей
│   └── CabinetModules.js      ← общие данные Dashboard/Analytics/Tasks/etc.
├── workspace/
│   ├── WorkspaceCore.js       ← Layout Engine, breakpoints, regions, navigation, cache/virtualization helpers
│   ├── WorkspaceComponents.jsx← общие APG V2 компоненты Workspace
│   ├── DesktopWorkspace.jsx   ← рабочая desktop-среда Workspace 1.0
│   ├── WorkspaceFeatureFlags.js← staged rollout Workspace
│   ├── WorkspaceWidgets.js    ← архитектура виджетов Workspace
│   └── index.js               ← публичный экспорт Workspace Core
├── PartnerCabinetPage.jsx     ← legacy-компонент кабинета партнёра
├── ExpertCabinetPage.jsx      ← legacy-компонент кабинета эксперта
├── MapPage.jsx                ← карта (Яндекс iframe)
├── NearbyPage.jsx             ← «Рядом» (геолокация)
├── ActivityPage.jsx           ← лента активности
├── OffersPage.jsx             ← акции
├── ReferralPage.jsx           ← реферальная программа
├── NotificationsPage.jsx      ← уведомления
├── ForPartnersPage.jsx        ← лендинг для партнёров
├── Scanner.jsx                ← QR сканер
├── PhotoUpload.jsx            ← загрузка фото
├── LoginScreen.jsx            ← экран входа
├── EmailAuth.jsx              ← email форма
├── ConsentScreen.jsx          ← экран согласия
├── SplashScreen.jsx           ← сплэш
├── Onboarding.jsx             ← онбординг
├── components/
│   ├── RichText.jsx           ← Markdown рендер
│   ├── MdEditor.jsx           ← Markdown редактор
│   └── VideoSection.jsx       ← видеогалерея
├── home/
│   ├── HomeHydrationEngine.js    ← read-only incremental hydration facade for Home
│   ├── HomeHydrationScheduler.js ← staged shell/news/partners/events/journey/loki/recommendations queue
│   ├── HomeHydrationTask.js      ← stage constants and ready marks
│   ├── HomeHydrationMetrics.js   ← Performance Observatory marks for Home hydration
│   └── cache/
│       ├── HomeCache.js          ← read-only Home cache constants, sections, TTL and build version
│       ├── HomeCacheEngine.js    ← restore/refresh facade for per-section Home cache
│       ├── HomeCacheStorage.js   ← localStorage storage with 1 MB limit and build-version cleanup
│       ├── HomeCacheMetrics.js   ← Performance Observatory marks for cache hit/miss/refresh/update
│       └── HomeCacheValidator.js ← schema validation and sensitive field stripping
├── firebase/
│   └── resilience/
│       ├── FirebaseStartupResilience.js ← shared anonymous auth startup promise
│       ├── FirebaseRetryQueue.js        ← exponential backoff for temporary Firebase errors
│       ├── FirebaseStartupMetrics.js    ← Performance/APG Health startup diagnostics
│       ├── FirebaseAvailability.js      ← online/offline recovery gate
│       └── FirebaseRecovery.js          ← local recovery task registry
├── utils/
│   ├── geo.js
│   ├── parseVideoUrl.js
│   ├── uploadPhoto.js
│   └── index.js
├── design.js                  ← токены
├── constants.js
├── levels.js
├── tasks.js
├── firebase.js
├── vk.js
├── errorLogger.js
├── diagnostics.js
├── index.css
└── fonts.css
```

## Роутинг

**Файл:** `src/App.jsx`

React Router DOM v7, `HashRouter` (из-за S3/SPA ограничений — нет server-side маршрутизации).

```jsx
<HashRouter>
  <Routes>
    <Route path="/" element={<UserApp />} />
    <Route path="/admin" element={<Suspense><AdminPanel /></Suspense>} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
</HashRouter>
```

**Навигация между экранами** — не через React Router, а через `activePanel` state в `UserApp.jsx`:
```js
const [activePanel, setActivePanel] = useState('home');
const goPanel = (id) => setActivePanel(id);
```

Экраны рендерятся через VKUI `<View activePanel={activePanel}>` с 18 `<Panel>` компонентами.

**Доступные панели:**
`home`, `experts`, `tasks`, `profile`, `partner`, `events`, `leaderboard`, `activity`, `offers`, `rewards`, `map`, `nearby`, `referral`, `notifications`, `partner-cabinet`, `expert-cabinet`, `for-partners`

Панели `partner-cabinet` и `expert-cabinet` сохранены как URL/nav entrypoints, но обе рендерят единый `CabinetCorePage`. Различие между партнёром и экспертом задаётся пропом `preferredRole`, а доступные разделы подключает `CabinetRoleEngine`.

**Свайп-навигация** работает между `SWIPE_TABS = ['home', 'experts', 'tasks', 'profile']` через `onTouchStart/onTouchEnd` на main wrapper.

**Deep links** парсятся из URL при монтировании UserApp:
- `?ref=ID` или `#ref_ID` → `localStorage['apg_pending_ref']`
- `?partner=ID` → auto-open partner modal
- `?expert=ID` → auto-open expert modal
- `?scan=expert_ID` → auto-trigger expert QR scan
- `?verify_email=TOKEN` → verify email action

## VKUI

Минимальное использование VKUI — только структурные компоненты:

```jsx
import { AdaptivityProvider, ConfigProvider, AppRoot, View, Panel } from '@vkontakte/vkui';
```

- `ConfigProvider` — тема VK (appearance: dark/light)
- `AdaptivityProvider` — адаптивность
- `AppRoot` — корневой контейнер
- `View activePanel={activePanel}` — переключение экранов
- `Panel id="home"` — обёртка каждого экрана

**НЕ используются:**
- `Epic`, `Root`, `Tabbar` — кастомный таббар через portal
- `Button`, `Cell`, `CardGrid` — всё через custom inline-styled элементы
- `Snackbar` — кастомный toast

## Компоненты

### UserApp.jsx (оболочка)

**Ответственности:**
- Инициализация: auth, загрузка данных, error handling
- Навигация: activePanel state, goPanel(), swipe detection
- Таббар: рендер через `createPortal(tabBarEl, document.body)`
- Push notifications: FCM init, subscribe/unsubscribe
- Overlay компоненты: Scanner, Onboarding, SplashScreen, Toast
- Offline detection: `navigator.onLine` + `online`/`offline` events

**Загрузка данных (loadData):**
- Home cache восстанавливается до сетевых запросов.
- Anonymous Auth запускается через `ensureFirebaseAnonymousAuth()` и не блокирует Home.
- Ошибки `identitytoolkit/accounts:signUp` фиксируются в Performance/APG Health и уходят в retry/backoff, но не превращаются в Fatal Error для пользователя.
```js
// Параллельный batch запрос
const [pSnap, eSnap, nSnap, ntSnap, prSnap, ctSnap, clSnap, exSnap, bnSnap] =
  await Promise.all([
    getDocs(query(collection(db, 'partners'), limit(100))),
    getDocs(query(collection(db, 'events'), limit(100))),
    getDocs(query(collection(db, 'news'), orderBy('createdAt','desc'), limit(30))),
    getDocs(query(collection(db, 'notifications'), limit(50))),
    getDocs(query(collection(db, 'prizes'), ...)),
    getDocs(query(collection(db, 'customTasks'), limit(50))),
    getDocs(query(collection(db, 'users', uid, 'claims'), ...)),
    getDocs(query(collection(db, 'experts'), limit(100))),
    getDocs(query(collection(db, 'banners'), orderBy('priority','asc'))),
  ]);
// + fetch('/api/vk-news') для VK постов
```

**Авторизация (приоритет):**
1. `manualLogout` в localStorage → показать LoginScreen
2. `apg_email_user` → email пользователь
3. `apg_tg_user` → Telegram пользователь
4. VK Bridge (`VKWebAppGetUserInfo`) → VK пользователь
5. Иначе → guest session

**Ключевые обработчики событий:**

| Handler | Что делает |
|---|---|
| `handleConfirmScan(id)` | Обрабатывает QR сканирование, начисляет ключи |
| `handleToggleFavorite(partnerId)` | Добавить/убрать из избранного |
| `handleCompleteTask(taskId, reward)` | Засчитать выполнение задания |
| `handleClaimPrize(prize)` | Получить приз за ключи |
| `handleRaffleEnter(prize, tickets)` | Купить билеты на розыгрыш |
| `handleEventRegister(eventId)` | Зарегистрироваться на событие |
| `handleEventUnregister(eventId)` | Отменить регистрацию |

### HomePanelV2.jsx (главная)

`HomePanelV2` — единственная главная страница пользовательского приложения. Старая `HomePanel.jsx` удалена в V3.1.

**Основные блоки сверху вниз:**

1. **AppHeader** — АПГ, подпись города, уведомления, аватар
2. **Greeting / Hero** — персональное приветствие и главный городской баннер
3. **Quick Actions** — ключи, подарки, рядом, события
4. **For you today** — горизонтальная подборка партнёров, экспертов, акций и подарков
5. **Новости** — превью полноценной ленты: горизонтальные карточки с изображением, категорией, метаданными, счётчиком новых материалов и кнопкой «Все новости»
6. **Ближайшие мероприятия** — карточки в стиле wallet
7. **Партнёр дня / рекомендации / отзывы / прогресс** — вторичные V3-секции

Все блоки используют локальные glass-примитивы и theme-aware токены. Старые карточки Home V1 не поддерживаются.

### Loki Recommendation Center

`src/loki/LokiRecommendationCenter.js` — единый слой рекомендаций для будущего использования в Локи, главной, карте, событиях, уведомлениях и партнёрских кабинетах.

Он строит:
- персональный профиль интересов без анкет (`favoriteCategories`, intents, screens, time buckets);
- ленту `Локи рекомендует`;
- сценарные подборки: вечер, выходной с детьми, красота, кофейни, спорт, авто, предприниматели;
- первые советы для режима партнёра и эксперта.

`LokiProvider` отдаёт `interestProfile`, `recommendationFeed`, `scenarioCollections` через `useLoki()`. `LokiPage` показывает персональную ленту и быстрые сценарии внутри пространства Локи.

### AdminPanel.jsx (администрирование)

Один монолитный файл ~3500+ строк, 13 вкладок. Подробно в `07_ADMIN_PANEL.md`.

### PhotoUpload.jsx

**Exports:**
- `PhotoUpload({ value, onChange, folder, label, shape, theme })` — одно фото
  - `shape: 'round'` — круглое (аватар)
  - `shape: 'cover'` — прямоугольное (обложка)
- `GalleryUpload({ photos, onChange, folder, max })` — до 6 фото
- `ProgressBar({ progress })` — индикатор загрузки

**Процесс загрузки:**
1. `<input type="file" accept="image/*">`
2. `browser-image-compression`: max 800px, 80% quality, формат WebP
3. `FileReader.readAsDataURL()` → base64 DataURL
4. Извлечь base64 часть
5. `POST /api/upload-photo` с `{ folder, filename, contentType, data }`
6. Получить `{ url }` → `onChange(url)` → отобразить preview

### Scanner.jsx

Использует библиотеку `qr-scanner` (wrapper над ZXing). Доступ к камере через `getUserMedia`. Функции: переключение камеры (фронт/тыл), torch (фонарик). Передаёт декодированный URL в `onScan` callback.

### components/RichText.jsx

Рендерит Markdown через `react-markdown` + `remark-gfm` + `remark-breaks`. Ссылки открываются в новой вкладке (`target="_blank" rel="noopener"`). Используется в описаниях партнёров, экспертов, событий.

### Cabinet Core 2.0

`src/cabinet/CabinetCorePage.jsx` — единый экран личных кабинетов для партнёров, экспертов и будущих ролей. Он не хранит отдельную реализацию кабинета под каждую роль: получает `user`, `partner`, `expert`, `preferredRole`, строит список ролей через `CabinetRoleEngine` и показывает общий набор модулей:

- Dashboard;
- Центр задач;
- Аналитика;
- Галерея / Media Manager;
- Контакты;
- Контент;
- Отзывы;
- Уведомления;
- Локи;
- Подписка;
- Настройки;
- История действий.

Ролевые расширения подключаются массивом `modules` в `CabinetRoleEngine.js`. Сейчас поддержаны:

- `partner`: акции, мероприятия, будущий каталог товаров;
- `expert`: услуги, стоимость/прайс как будущий модуль, опыт, запись, мероприятия;
- служебные роли `owner/admin/moderator/editor` подготовлены как role definitions без отдельного кабинета.

`CabinetModules.js` строит общий snapshot: метрики, заполненность профиля, задачи, уведомления, историю и публичную ссылку. Это позволяет добавить новую роль через role definition и отдельные role-specific modules без копирования кабинета.

### Workspace Core

`src/workspace/WorkspaceCore.js` — единый Layout Engine для мобильной версии, планшета, будущего Desktop Workspace, Cabinet Core, CRM, календаря, админки и Локи. Он описывает:

- режимы `mobile/tablet/desktop`;
- области `header/leftSidebar/content/rightSidebar/bottomBar/floatingPanels`;
- единый navigation contract `WORKSPACE_NAV_ITEMS`;
- helpers для кэша, lazy workspace modules и виртуализации больших списков.

`UserApp.jsx` использует `getWorkspaceNavigation()` как источник данных для существующего нижнего бара. Визуально bottom bar не менялся, но порядок/состав вкладок теперь живёт в общем Navigation Engine.

`src/workspace/WorkspaceComponents.jsx` содержит общие APG V2 компоненты: `WorkspaceShell`, `WorkspaceHeader`, `Sidebar`, `WorkspacePanel`, `WorkspaceContextPanel`, `GlassContainer`, `ContentGrid`, `DashboardCard`, `MetricCard`, `QuickActions`, `InfoPanel`, `SectionHeader`, `ActionCard`. Новые экраны должны использовать эти компоненты вместо отдельной mobile/desktop JSX-реализации.

Подробная архитектура: `docs/workspace-core.md`.

### Desktop Workspace 1.0

`src/workspace/DesktopWorkspace.jsx` — вторая среда использования АПГ для партнёров, экспертов и команды проекта. Она не заменяет пользовательский режим и не является растянутой мобильной версией.

В `UserApp.jsx` добавлен `appMode`:

- `user` — привычное приложение для жителей;
- `workspace` — desktop SaaS-среда.

Переключение происходит без повторной авторизации и без перезагрузки. Workspace доступен только на desktop-устройстве и только если `canUseDesktopWorkspace()` разрешает доступ по feature flag. Если `apg_app_mode` не выбран вручную, владелец/`super_admin` автоматически попадает в Workspace на desktop.

`WorkspaceFeatureFlags.js` поддерживает staged rollout: `off → owner → admin → partner → expert → all`. По умолчанию включён безопасный уровень `owner`.

Workspace содержит header, collapsible left sidebar, content area, AI Workspace panel и status bar. Dashboard берёт реальные данные из `UserApp`: партнёры, эксперты, новости, мероприятия, уведомления и активный кабинет. Первый экран открывается briefing-ом Локи, а пункт “Локи”, `⌘L` и CTA “Спросить Локи” работают внутри правой AI Workspace-панели без отдельного overlay и без выхода в User Mode.

Раздел `Встречи` находится среди основных пунктов левого меню Workspace после `Рабочий стол` и `Мероприятия`. Он использует существующий booking-модуль (`booking:calendar` и lifecycle-действия) как рабочий календарь партнёра/эксперта: KPI по статусам, режимы день/неделя/месяц, фильтры, поиск, ближайшие встречи, блоки сегодня/завтра и карточку встречи с быстрыми действиями.

Подробная архитектура: `docs/desktop-workspace.md`.

### components/MdEditor.jsx

Простой Markdown редактор для AdminPanel: textarea + кнопки Bold (Ж) и Bullet List (•). Не WYSIWYG — показывает raw markdown.

### components/VideoSection.jsx

**В VK контексте:** показывает только VK Video/Clips. YouTube, Rutube показываются как заглушка "доступно в PWA".  
**Вне VK:** показывает все платформы через `<iframe>`. Thumbnail → click → load iframe (deferred loading).

## Хуки и State

Проект **не использует** глобальный state менеджер (Redux, Zustand, Jotai и т.д.). Весь state — `useState` в компонентах.

**Ключевые state в UserApp:**

```js
const [user, setUser] = useState(null);           // текущий пользователь
const [userKeys, setUserKeys] = useState(0);       // баланс ключей
const [partners, setPartners] = useState([]);
const [events, setEvents] = useState([]);
const [news, setNews] = useState([]);
const [experts, setExperts] = useState([]);
const [loading, setLoading] = useState(true);
const [activePanel, setActivePanel] = useState('home');
const [appearance, setAppearance] = useState('dark');
const [streak, setStreak] = useState(0);
const [scannerActive, setScannerActive] = useState(false);
```

**Кастомные хуки:** не используются (всё inline в компонентах).

**Контексты:** не используются (данные передаются через props drilling).

## Дизайн-система

### design.js — токены

```js
export const T = {
  bg:       'var(--c-bg,    #0F0F1A)',      // фон страницы
  surface:  'var(--c-card,  #1A1A2E)',      // фон карточки
  border:   'var(--c-border, rgba(255,255,255,0.07))',
  textPri:  'var(--c-text,  #F0F0F0)',
  textSec:  'var(--c-text-sec, rgba(240,240,240,0.5))',
  gold:     '#C9A84C',   // неизменный золотой
  goldL:    '#E8C97A',   // светлый золотой
  blue:     '#4A90D9',
  green:    '#4BB34B',
  red:      '#E64646',
};

export const GLASS = {
  background: 'var(--c-glass, rgba(255,255,255,0.04))',
  backdropFilter: 'blur(28px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
  border: '1px solid var(--c-border, rgba(255,255,255,0.07))',
  borderRadius: 20,
};

export const GLASS_GOLD = {
  ...GLASS,
  background: 'rgba(201,168,76,0.08)',
  border: '1px solid rgba(201,168,76,0.25)',
};
```

### index.css — CSS переменные

```css
:root {
  --c-bg:       #0F0F1A;
  --c-card:     #1A1A2E;
  --c-border:   rgba(255,255,255,0.07);
  --c-text:     #F0F0F0;
  --c-text-sec: rgba(240,240,240,0.5);
  /* ... */
}
[data-theme="light"] {
  --c-bg:       #F0F2F5;
  --c-card:     #FFFFFF;
  /* ... */
}
```

**Body background:** тройной `radial-gradient` — фиолетовый шар сверху + синий снизу + золотой центр. `background-attachment: fixed`.

**Анимации CSS:** `fadeInUp`, `shimmer`, `keyBounceIn`, `keyFlyToCounter`, `tabFadeIn`, `toastIn`, `pulse`, `bounce`, `scanLine`, `float`.

## Fonts

Manrope (self-hosted), веса 400/500/600/700/800. Preload в `index.html`:
```html
<link rel="preload" href="/fonts/manrope/manrope-400.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/manrope/manrope-600.woff2" as="font" type="font/woff2" crossorigin />
```

## Кэширование данных

```js
// При старте: мгновенно читаем localStorage
const cachedPartners = JSON.parse(localStorage.getItem('apg_partners_cache') || '[]');
setPartners(cachedPartners); // UI сразу показывает старые данные

// Параллельно: делаем Firestore запрос
const freshPartners = await getDocs(...);
setPartners(freshPartners);                         // обновляем UI
localStorage.setItem('apg_partners_cache', JSON.stringify(freshPartners));
localStorage.setItem('apg_cache_ts', Date.now());
```

**Ключи localStorage:**

| Ключ | Содержимое |
|---|---|
| `apg_build` | Git hash последней сборки (для автообновления) |
| `apg_theme` | `'dark'` / `'light'` |
| `apg_notif_enabled` | `'1'` если разрешены |
| `apg_cache_ts` | timestamp последнего обновления данных |
| `apg_partners_cache` | JSON массив партнёров |
| `apg_events_cache` | JSON массив событий |
| `apg_news_cache` | JSON массив новостей |
| `apg_notif_cache` | JSON массив уведомлений |
| `apg_pending_ref` | referral ID из URL |
| `apg_email_user` | JSON профиль email-пользователя |
| `apg_tg_user` | JSON профиль Telegram-пользователя |
| `apg_web_user` | JSON профиль VK web OAuth |
| `apg_guest_id` | UUID гостевой сессии |
| `apg_notif_seen` | timestamp просмотра уведомлений |
| `manualLogout` | `'true'` — блокирует auto-login |

## PWA

- `public/manifest.json` — Web App Manifest
- `public/sw.js` — Service Worker (cache-first, Cache API `apg-v2`)
- SW кэширует: `/`, `/manifest.json`, `/192.png`, `/512.png`, `/180.png`
- SW получает Web Push и вызывает `showNotification()`
- Нет Vite PWA плагина в текущем конфиге (был удалён)

## Автообновление

`App.jsx` при монтировании вызывает `checkForUpdate()`:
```js
const v = await fetch('/version.json').then(r => r.json());
if (v.v !== localStorage.getItem('apg_build')) {
  localStorage.setItem('apg_build', v.v);
  // очистка caches API
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  window.location.reload();
}
```

Каждый `vite build` записывает `dist/version.json` с git short hash.

## Lazy Loading

Все компоненты кроме `HomePanel` и `UserApp` загружаются через `React.lazy`:
```js
const AdminPanel = lazy(() => import('./AdminPanel'));
const ProfilePanel = lazy(() => import('./ProfilePanel'));
// ... и т.д.
```

Это создаёт отдельные JS-чанки для каждого экрана и существенно снижает initial bundle.

**Ограничение:** в VK Mini App среде `import()` может работать медленно на слабых устройствах. Поэтому `HomePanel` (главный экран) подключён статически.

## Partnership acquisition flow

`src/PartnershipPage.jsx` — ленивый экран сценария «Стать партнёром АПГ», открывается из профиля через кнопку `ProfilePanel`.

Поток:

1. Информационная страница о партнёрстве АПГ.
2. Актуальные тарифы бизнеса (`PARTNER_TARIFFS`) и экспертов (`EXPERT_TARIFFS`) из `src/tariffConfig.js`.
3. Встроенная FAQ-помощь Локи по участию, ключам, подключению, требованиям и выбору тарифа.
4. Выбор направления: бизнес или эксперт.
5. Открытие существующих анкет `PartnerQuestionnaire` / `ExpertQuestionnaire`.
6. Отправка заявки в `/api/partnership-application`.
7. Экран «Спасибо» и возврат в приложение.

Анкета автосохраняется в `localStorage` под ключом `apg_partnership_flow_v1`. Фото загружаются через общий `uploadPhoto` в каталог `partnership-applications/{userId|guest}`. Тарифная логика не дублируется: карточки, форма и backend используют общие тарифные ID.

## Встречи / онлайн-запись

`src/booking/BookingFlow.jsx` — универсальный сценарий записи для партнёров и экспертов.

Подключения:
- карточка партнёра показывает `📅 Записаться`, если профиль поддерживает онлайн-запись;
- карточка эксперта использует тот же сценарий;
- профиль пользователя показывает блок `Мои записи` с группами: ожидание, требуют действия, предстоящие, прошедшие, отменённые, история;
- кабинет партнёра/эксперта содержит модуль `Запись/Встречи`: включение записи, базовые слоты, календарь день/неделя/месяц, фильтры по специалисту и статусу, действия подтверждения/отмены/переноса/завершения;
- Desktop Workspace содержит основной рабочий раздел `Встречи`, который подгружает календарь активного партнёра/эксперта и открывает связанный контекстный диалог встречи;
- `UserApp` автоматически показывает экран “Спасибо за визит” для завершённой rewarded-встречи: штамп-карта, ключи, достижение, отзыв, Локи-подсказка и повторная запись;
- после завершения встречи профиль показывает начисленные ключи/штамп и действие `Оставить отзыв`, связанное с `bookingId`;
- кабинет партнёра/эксперта показывает компактную journey-аналитику встреч: завершения, ключи, штампы, отзывы;
- контекстный диалог `type: booking` показывает закреплённую карточку встречи с текущим статусом, быстрыми действиями по роли и post-visit summary;
- серверные действия `booking:create`, `booking:confirm`, `booking:cancel`, `booking:requestReschedule`, `booking:respondReschedule`, `booking:complete`, `booking:noShow`, `booking:list`, `booking:calendar` ведут жизненный цикл встречи.

## VK Platform

```js
// src/vk.js
export const isVK = () =>
  /VKApp|vk\.com\/app/.test(navigator.userAgent) ||
  new URLSearchParams(location.search).has('vk_app_id');

// Открытие URL внутри VK
export const openUrl = (url) => {
  if (isVK()) {
    vkBridge.send('VKWebAppOpenLink', { link: url });
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
  }
};
```
