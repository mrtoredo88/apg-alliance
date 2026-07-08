# 07 ADMIN PANEL

## Обзор

**URL:** `/#/admin`, `/#/admin-app`  
**Файл:** `src/AdminPanel.jsx` (~5000+ строк, единый компонент с V4.4-оболочкой)  
**Авторизация:** вход из профиля виден для `admin/owner` и legacy VK id; вход в админку проверяется через Firebase session/email+password и `/api/admin-security` с server-side role guard
**UI:** 100% inline styles, темизация через объект `A` (локальные токены для dark theme)

## V4.4 редакционная оболочка

Админка получила единый адаптивный интерфейс:

- `/#/admin-app` — отдельный роут под будущую PWA «Админка АПГ»
- профиль показывает кнопку «⚙️ Администрирование» для `admin/owner`
- на телефоне навигация становится горизонтальным верхним островом
- на ноутбуке и desktop остаётся боковая панель
- Dashboard показывает рабочие KPI: модерация, комментарии, ошибки, пользователей, партнёров, экспертов, события, новости, ключи и QR
- добавлены вкладки `moderation`, `comments`, `users`, `ai-drafts`
- новости получили карточный редакционный board поверх старого компактного списка
- комментарии новостей загружаются и модерируются через `/api/news-comments`
- раздел «Черновики ИИ» пока пустой и служит точкой подключения V4.5

## Навигация

Адаптивный сайдбар / верхний остров с вкладками:

```
📊 Рабочий стол
🚦 Модерация
💬 Комментарии
👥 Пользователи
📍 Партнёры      (с счётчиком кол-ва)
🧑‍💼 Эксперты      (с счётчиком)
🎉 События       (с счётчиком)
📢 Новости       (с счётчиком)
📣 Реклама       (активных баннеров)
🔔 Рассылка
✅ Задания       (с счётчиком)
🎁 Призы         (с счётчиком)
🔄 Ротация
📊 Активность
📈 Аналитика
🔐 Доступ
⚠️ Ошибки       (с счётчиком)
🤖 Черновики ИИ
🔬 Диагностика
```

## Sticky Toolbar (глобальная)

Прилипает к верху при скролле. Содержит:

- **Глобальный поиск** — ищет одновременно по партнёрам, экспертам, событиям, новостям, пользователям, призам и комментариям. Dropdown с результатами; click → переключает вкладку + раскрывает/подсвечивает элемент
- **⚠ Не проверены** — toggle фильтрации по флагу `linksCheckedAt` (< 30 дней)
- **Счётчики** — активные у каждой вкладки (обновляются в реальном времени)
- **➕ Добавить ▾** — dropdown: открывает модалку партнёра, эксперта, события, новости
- **🔧 ▾** — dropdown: Migrate categories, Геокодировать
- **Плавающие быстрые действия** — новость, фото к новости, партнёр, событие, приз, push, комментарии, черновики ИИ

## Вкладка «Модерация»

- Карточки очереди: новости, комментарии, подготовка ИИ-черновиков
- На телефоне карточная модель готова под свайп-действия
- На desktop используются кнопки/контекстные действия

## Вкладка «Комментарии»

- Карточки комментариев из `newsComments`
- Показывает автора, роль, новость, дату, текст, лайки
- Действия: `toggleUseful`, `togglePin`, `delete`, `blockUser`
- Backend: `/api/news-comments`, загрузка и модерация через Admin SDK без прямого Firestore read/write

## Вкладка «Пользователи»

- Карточки пользователей
- Поиск по имени, email и id
- Показывает источник регистрации и ключи

## Вкладка «Черновики ИИ»

- V5.0 рабочий раздел «Локи · Редакция»
- Backend: `/api/loki-editor`
- Источники: RSS/XML, JSON API, manual import architecture
- Очередь показывает KPI: найдено, готово, дубликатов, ошибок, опубликовано
- Карточка черновика: изображение, заголовок, источник, категория, статус, confidence, summary, объяснение Локи
- Действия редактора: просмотр, редактирование, публикация после подтверждения, отложить, отклонить
- Настройки: период проверки, порог доверия, максимум материалов за цикл
- Журнал Локи: проверенные источники, найденные материалы, ошибки обработки
- Автопубликация намеренно отсутствует: публикация возможна только по действию редактора

## Вкладка «Доступ»

- Backend: `/api/admin-security`
- Проверяет текущую Firebase-сессию администратора и роль через server-side guard
- Показывает текущую роль, список администраторов, матрицу прав и журнал безопасности
- Роли: owner, super_admin, admin, editor, moderator, analyst, partner, expert, user
- Действия для `owner/super_admin`: смена роли, блокировка/разблокировка, отзыв сессий, генерация reset password link
- Все действия пишутся в `adminSecurityLog` и `adminActivity`
- Touch ID / Face ID отображаются как WebAuthn/Passkeys-ready быстрый вход; биометрические данные не сохраняются в АПГ

## Вкладка «База знаний Локи»

- CRUD записей `lokiKnowledge` через защищённый `/api/admin-actions`
- Типы: FAQ, сценарий общения, инструкция, правило ответа
- Поля: название, вопрос/триггер, ответ Markdown, приоритет, теги, active
- Активные записи попадают в `/api/public-data` и становятся доступны Loki Core без нового релиза frontend

## Вкладка «Аналитика Локи»

- Читает `lokiAnalytics` через `/api/admin-actions`
- Показывает количество диалогов, долю вопросов без ответа, успешность, среднее время ответа
- Отдельные списки: популярные вопросы, непонятые вопросы, частые intents/actions и переходы после рекомендаций
- Непонятый вопрос можно сразу перенести в форму «База знаний Локи» как заготовку ответа
- Запись аналитики идёт best-effort через `/api/user-actions` action `loki:analytics`, поэтому сбой аналитики не ломает диалог

## Вкладка «Партнёры»

### Функционал
- CRUD партнёров через Firestore
- Модальная форма (position: fixed, fullscreen overlay)
- Аккордеон-список (клик по строке разворачивает детали)
- В раскрытой карточке: QR-коды и материалы для печати (`PartnerQRSection`)
- Поиск по имени/категории внутри вкладки
- Фильтр «Все» / «⚠ Непроверенные» (по linksCheckedAt)
- Сортировка: сначала не проверенные (linksCheckedAt null/старый), затем по дате
- Кнопка «✓ Проверено» — обновляет `linksCheckedAt: serverTimestamp()`
- Кнопки ↑↓ для изменения порядка (swap priorities)
- Геокодирование: отдельный раздел с кнопкой «Геокодировать всех»

### Форма партнёра (поля)
Название, категория (select), описание (MdEditor), логотип (PhotoUpload round), галерея (GalleryUpload, до 6 фото), адрес, телефон, сайт, VK/соцсеть, часы работы, stampTarget (кол-во сканов для бонуса), ключей за скан, активен (toggle), featured (toggle), ownerId (привязка кабинета).

## Вкладка «Эксперты»

### Функционал
- CRUD экспертов
- Модальная форма
- Аккордеон-список
- В раскрытой карточке: QR-коды и материалы для печати (`ExpertQRSection`)
- Поиск внутри вкладки (по имени, специализации)
- Фильтр непроверенных
- Сортировка по linksCheckedAt
- Кнопка «✓ Проверено»
- Тир (member/ambassador): влияет на ротацию

### Форма эксперта (поля)
Имя, категория (select из 15 EXPERT_CATEGORIES), специализация, описание (MdEditor), фото (PhotoUpload round), галерея (GalleryUpload), видео (текстовые URL), форматы (online/offline/group чекбоксы), ключей за скан, stampTarget, тир, активен, ownerId, ambassadorSince (date для ротации).

## Вкладка «События»

### Функционал
- CRUD событий
- Модальная форма
- Список с фильтром и сортировкой по priority
- Фильтр непроверенных ссылок
- Кнопка «✓ Проверено» для ссылок

### Форма события (поля)
Название, дата (текстовая, legacy), начало/конец (datetime-local, новые поля), партнёр (текст), привязка к партнёру АПГ (select), описание (MdEditor), ссылка регистрации, кнопка-ссылка (label + url), адрес (legacy), место проведения (новое поле), дедлайн, категория (CONTENT_CATEGORIES пилюли), обложка (PhotoUpload cover), эмодзи (EmojiPicker), приоритет (number + slider), «Закрытое мероприятие» (toggle):
- Минимум ключей
- Лимит участников
- Дата мероприятия для таймера

«Событие эксперта» (toggle):
- Цена для клуба
- Цена для всех

## Вкладка «Новости»

### Функционал
- CRUD новостей (только Firestore — не VK посты)
- Модальная форма
- Фильтр непроверенных

### Форма новости (поля)
V5 mini-CMS foundation: заголовок, подзаголовок, краткое описание, полный текст через `MdEditor`, автор, источник, эмодзи, основная ссылка, приоритет (0–10, number + slider), категория (CONTENT_CATEGORIES пилюли), обложка (PhotoUpload cover), галерея (GalleryUpload до 24 фото) с подписями и ручной сортировкой, несколько видео (VK Видео, YouTube, Rutube, Vimeo через `parseVideoUrl`), социальные ссылки, дополнительные блоки (`quote`, `tip`, `warning`, `button`, `divider`, `faq`), теги, дата публикации, дата окончания актуальности и toggle комментариев.

### Список новостей
Иконка (imageUrl или эмодзи), заголовок, категорийный бейдж, дата публикации (из publishedAt или createdAt), кнопки: ↑↓, ✓, ✏️, 🗑️.

## Вкладка «Реклама»

### Функционал
- CRUD баннеров
- Модальная форма
- Максимум 5 активных баннеров (проверка в saveBanner)
- Статусы: active (активен + дата не истекла), inactive, expired

### Форма баннера (поля)
- Внутреннее название
- Изображение (PhotoUpload cover + URL input)
- Рекламодатель: Партнёр / Эксперт / Внешний (переключатель)
  - Партнёр: select из списка партнёров
  - Эксперт: select из списка экспертов
  - Внешний: текстовое поле названия
- Тип ссылки: internal_partner / internal_expert / external_url
- Значение ссылки: ID или URL
- Дата начала / Дата конца (date inputs)
- Приоритет (1–5)
- Активен (toggle)

### Список баннеров
Превью изображения, название, рекламодатель, статус (цветной бейдж), приоритет, даты, кнопки: ✏️, 🗑️.

## Вкладка «Рассылка»

### Функционал
- Центр уведомлений с KPI: всего уведомлений, отправлено push, ошибки доставки, открытия
- Конструктор уведомления: заголовок, текст, эмодзи, категория, тип, приоритет, кнопка действия, deep link, большое изображение
- Аудитории: все, новые, активные, неактивные, партнёры, эксперты, администраторы, город, ключей больше/меньше N
- Режим отправки: сразу или scheduled metadata (`10m`, `1h`, `tomorrow`, custom date). Автоматический исполнитель запланированных уведомлений подключается отдельным backend-шагом
- Предпросмотр Android / iPhone / Desktop / Telegram
- История уведомлений показывает `pushStatus`, `pushStats.sent`, `pushStats.failed`, получателей, CTR и кнопку повторной push-отправки
- Кнопка → `POST /api/send-push` с Firebase admin token; backend дополнительно поддерживает `x-push-secret`
- Пользовательские категории уведомлений хранятся в `users/{id}.notificationPreferences`

## Вкладка «Задания»

### Функционал
- CRUD кастомных заданий (`customTasks` коллекция)
- Список с кнопками редактирования/удаления

### Форма
Название, описание, эмодзи, количество ключей, условие выполнения, активно.

## Вкладка «Призы»

### Функционал
- CRUD призов
- Разделение: фиксированные (за ключи) и раффл (розыгрыш)
- Для раффл: дата розыгрыша, кол-во билетов за ключ
- Кнопка «Провести розыгрыш» → `POST /api/raffle-draw` с `RAFFLE_SECRET`

### Форма
Название, описание, эмодзи, тип (fixed/raffle), стоимость в ключах, остаток (для fixed), дата розыгрыша (для raffle), billets per key, партнёр, активен.

## Вкладка «Ротация»

### Функционал
- Отображение текущей ротации по категориям экспертов
- Читает `expertRotation/{category}` и показывает имя эксперта
- Кнопка «Сменить ротацию» → `POST /api/expert-rotation`
- Информация о дате последнего обновления

## Вкладка «Активность»

### Функционал
- Текущий индекс активности по всем партнёрам
- Таблица: партнёр, score, компоненты score
- Текущий «партнёр месяца»
- История победителей (`monthlyWinners`)
- Кнопка «Пересчитать» → `POST /api/activity-index` с `ACTIVITY_SECRET`
- Кнопка «Назначить победителя» → `forceAward: true`

## Вкладка «Аналитика»

### Функционал
- Читает `users` коллекцию (все) — тяжёлый запрос
- Статистика: всего пользователей, распределение по providers (VK/email/TG)
- Топ пользователей по ключам
- Читает `guestSessions` — анализ гостевого трафика
- `stats/global` — общие счётчики

### Данные
- Всего пользователей
- Активных (keys > 0)
- По провайдеру авторизации
- Кол-во гостевых сессий

## Вкладка «Ошибки»

### Функционал
- Читает `errorLogs` коллекцию
- Список ошибок: сообщение, источник, стек, userId, время
- Кнопка «Очистить» — удаляет все логи

## Вкладка «Диагностика»

### Функционал
- Кнопка «Запустить проверку»
- Параллельные checks:
  - Firebase Auth (анонимный вход)
  - Firestore (чтение `config/health`)
  - Backend health (`/health` endpoint)
- Результат: ✅/❌ для каждого сервиса с временем ответа
- Читает последние `diagnostics` документы от пользователей

## Помощники AdminPanel

### EmojiPicker
Кастомный компонент — горизонтальный скролл с набором эмодзи. Отдельные наборы для `NEWS_EMOJIS` и `EVENT_EMOJIS`.

### PhotoUpload / GalleryUpload
Из `src/PhotoUpload.jsx` — те же компоненты, что и в кабинетах.

### MdEditor
Из `src/components/MdEditor.jsx` — textarea с кнопками форматирования.

### markLinksChecked helper
```js
const markLinksChecked = async (col, id, setList) => {
  await updateDoc(doc(db, col, id), { linksCheckedAt: serverTimestamp() });
  const now = { toDate: () => new Date() };
  setList(prev => prev.map(x => x.id === id ? { ...x, linksCheckedAt: now } : x));
};
```
Оптимистичное обновление state + Firestore запись.

### isCheckedRecently helper
```js
const isCheckedRecently = ts => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000; // 30 дней
};
```

### bulkGeocode
Геокодирование всех партнёров без координат через Nominatim API. Задержка 1100ms между запросами.

### navigateToResult
При выборе результата глобального поиска:
```js
const navigateToResult = r => {
  setActiveTab(r.tab);
  if (r.tab === 'partners') { setPartnerSearch(r.label); setExpandedPartnerId(r.id); }
  if (r.tab === 'experts')  { setExpandedExpertId(r.id); }
};
```

## State AdminPanel

Все состояния через `useState`. Основные:

```js
// Данные
const [partners, setPartners] = useState([]);
const [experts, setExperts] = useState([]);
const [events, setEvents] = useState([]);
const [news, setNews] = useState([]);
const [banners, setBanners] = useState([]);
const [prizes, setPrizes] = useState([]);
const [customTasks, setCustomTasks] = useState([]);

// Навигация
const [activeTab, setActiveTab] = useState('partners');

// Модалки
const [showPartnerModal, setShowPartnerModal] = useState(false);
const [showExpertModal, setShowExpertModal] = useState(false);
const [showEventModal, setShowEventModal] = useState(false);
const [showNewsModal, setShowNewsModal] = useState(false);
const [showBannerModal, setShowBannerModal] = useState(false);

// Аккордеон
const [expandedPartnerId, setExpandedPartnerId] = useState(null);
const [expandedExpertId, setExpandedExpertId] = useState(null);

// Фильтры
const [partnerLinksFilter, setPartnerLinksFilter] = useState('unverified');
const [expertLinksFilter, setExpertLinksFilter] = useState('unverified');
const [eventLinksFilter, setEventLinksFilter] = useState('all');
const [newsLinksFilter, setNewsLinksFilter] = useState('all');
const [expertSearch, setExpertSearch] = useState('');

// Toolbar
const [globalSearch, setGlobalSearch] = useState('');
const [showSearchDrop, setShowSearchDrop] = useState(false);
const [showAddDrop, setShowAddDrop] = useState(false);
const [showToolsDrop, setShowToolsDrop] = useState(false);

// Editing (каждая форма имеет свой editingXxx state)
const [editingPartner, setEditingPartner] = useState(null);
const [editingExpert, setEditingExpert] = useState(null);
// ... и т.д.
```

## CONTENT_CATEGORIES

Определены в начале файла (~строка 33):

```js
const CONTENT_CATEGORIES = [
  { id: 'economy',   label: 'Экономика',   color: '#6AABEC' },
  { id: 'society',   label: 'Общество',    color: '#A78BFA' },
  { id: 'sport',     label: 'Спорт',       color: '#4ade80' },
  { id: 'culture',   label: 'Культура',    color: '#f59e0b' },
  { id: 'education', label: 'Образование', color: '#38bdf8' },
  { id: 'transport', label: 'Транспорт',   color: '#fb923c' },
];
```

## Безопасность AdminPanel

**Нет серверной авторизации.** Любой Firebase-авторизованный пользователь технически может открыть `/admin` и использовать форму. Защита:
1. URL `/admin` не опубликован публично (security by obscurity)
2. Firestore Rules разрешают запись только auth пользователям
3. Планируется: проверка `isAdmin` поля в `users/{uid}` документе

**TODO:** Добавить проверку `isAdmin: true` в `users` документе и блокировать доступ для всех остальных.
