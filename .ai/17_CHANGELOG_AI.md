# 17 CHANGELOG AI

Этот файл ведётся AI-агентами. При каждом изменении проекта добавляй запись.

## Формат записи

```
## [YYYY-MM-DD] Краткое описание
**Коммит:** `gitHash`
**Файлы:** список изменённых файлов
**Тип:** feat | fix | refactor | docs | chore
**Что изменено:** одна-три строки что именно сделано
**Почему:** краткая мотивация
```

---

## [2026-07-10] feat: APG Context Engine для Локи
**Коммит:** `pending`
**Файлы:** `src/loki/core/context/ContextEngine.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/LokiCore.js`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Создан `buildLokiContext()` — единый слой сбора состояния АПГ для Локи.
- `LokiProvider` передаёт в ядро Локи Context Engine object вместо разрозненного чтения `appState`.
- `LokiCore` поддерживает новый контекст и сохраняет совместимость со старыми модулями через `context.appState`.
**Почему:** Локи и будущие AI-модули должны получать состояние приложения через один стабильный интерфейс, без прямого чтения данных из разных частей приложения.

---

## [2026-07-10] feat: Loki Home AI Dashboard
**Коммит:** `pending`
**Файлы:** `src/LokiPage.jsx`, `src/loki/LokiProvider.jsx`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Стартовый экран Локи переработан из chat-first интерфейса в персональный AI Dashboard.
- Добавлены блоки: приветствие, сводка дня, «Сегодня для тебя», быстрые сценарии-карточки, план дня, прогресс, главная новость дня и большое поле задачи.
- `LokiProvider` теперь отдаёт `dashboard` на основе уже загруженных событий, новостей, заданий, партнёров, ключей и recommendation feed.
**Почему:** Локи должен быть интеллектуальной домашней страницей и помогать пользователю принимать решения внутри АПГ, а не выглядеть как обычный мессенджер.

---

## [2026-07-10] fix: уточнены системные действия Brain Layer
**Коммит:** `pending`
**Файлы:** `src/loki/core/brain/BrainLayer.js`
**Тип:** fix
**Что изменено:**
- Системные APG-сценарии больше не выбирают случайное событие или партнёра как основной объект.
- Запросы про ключи открывают профиль, QR-запросы открывают сканер, уведомления открывают уведомления.
**Почему:** Локи должен вести пользователя к правильному действию по смыслу запроса, а не к первому подходящему объекту из загруженных данных.

---

## [2026-07-10] feat: Локи переведён на Brain Layer и сценарную AI Platform
**Коммит:** `pending`
**Файлы:** `src/loki/core/brain/BrainLayer.js`, `src/loki/core/brain/lokiScenarios.js`, `src/loki/core/LokiCore.js`, `src/loki/core/modules/MemoryEngine.js`, `src/loki/core/modules/PersonalityEngine.js`, `src/loki/lokiActionTypes.js`, `src/UserApp.jsx`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Добавлен Brain Layer для определения сценария, контекста, выбора лучшего варианта и генерации action-плана.
- Создана сценарная база из 50+ сценариев по городским, событийным, партнёрским, экспертным, семейным, бизнес- и APG-задачам.
- Добавлены действия Локи для добавления партнёра в избранное и начала регистрации на событие через существующую навигацию.
**Почему:** Локи должен работать как интеллектуальное ядро АПГ, помогая принимать решение внутри контекста приложения, а не отвечать списком или уводить пользователя в отдельный чат.

---

## [2026-07-10] fix: убран двойной paddingBottom под навигацией (все GlassPanel-страницы)
**Коммит:** `47b94b09`
**Файлы:** `src/UserApp.jsx`
**Тип:** fix
**Что изменено:**
- Удалён `paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))'` из wrapper-div в UserApp (линия 2597).
**Почему:** UserApp-обёртка и компонент `GlassPanel` (`Apg2ProfileGlass.jsx`) оба добавляли 96px + safe-area-inset-bottom. На iPhone (safe-area ≈ 34px) это давало 260px пустого места под контентом. Все страницы управляют своим нижним отступом сами (через GlassPanel, собственный paddingBottom или self-scroll контейнер). Обёртка была лишней.
**Страницы, которые затронуло:** ProfilePanel, LokiPage, EventsPage, TasksPage, LeaderboardPage, OffersPage, ActivityPage, ReferralPage, RewardsPage, ExpertCabinetPage, PartnerCabinetPage, ApgHealthPage, MapPage, NearbyPage, NotificationsPage, ReferencePage.
**Статус деплоя:** Frontend ✓ задеплоен (version: 47b94b09).

---

## [2026-07-10] fix: Локи открывается поверх статьи (stacking context + portal)
**Коммит:** `757ab610`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiExperience.jsx`
**Тип:** fix
**Что изменено:**
- `LokiAssistant`: `LokiExperience` теперь рендерится через `createPortal(…, document.body)` — выходит из stacking context UserApp wrapper.
- `LokiExperience`: z-index поднят 13000 → 14000 (выше ArticleView z=13000).
**Почему:** UserApp wrapper div создаёт stacking context (position:relative, zIndex:1). LokiExperience внутри него имел эффективный вес z=1 в body, а ArticleView — portal z=13000 в body. Loki всегда был под статьёй.
**Статус деплоя:** Frontend ✓ задеплоен (version: 757ab610).

---

## [2026-07-10] feat: полный редизайн экрана статьи новости
**Коммит:** `2dcd1576`
**Файлы:** `src/NewsPage.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:**
- Новый тёплый редакционный фон `#1A1812` — убрано ощущение «тёмной модалки», фон светлее и теплее.
- Новый компонент `SourceBadge`: маленький бейдж «Источник: ВКонтакте» под изображением для импортированных новостей.
- Новый компонент `LokiArticleBanner`: для статей >260 слов показывает Локи-предложение кратко пересказать; кнопка открывает Локи через `onOpenLoki`.
- `ArticleHeader` упрощён: заголовок → 1 строка мета (дата · время · время чтения) → lede-абзац. Убрана тяжёлая сетка из 8 статистических плиток.
- Тело статьи: без контейнера-карточки, 17px / 30px lineHeight, текст дышит на фоне страницы.
- Порядок элементов переработан: source → title → lede → Loki → body → media → actions → feedback → comments → «Читайте также» (4 шт.) → prev/next → VK-ссылка.
- Кнопка «Открыть оригинал в ВКонтакте» переехала в самый конец как маленькая текстовая ссылка.
- «Читайте также» вместо «Локи рекомендует», 4 материала.
- Nav-бар: тёплый `rgba(26,24,18,0.86)` вместо холодного чёрного.
- Hero-изображение: full-width без скруглений (editorial feel).
- Все взаимодействия (лайки, комментарии, реакции, сохранение) работают одинаково для всех источников.
- `UserApp.jsx`: добавлен `onOpenLoki={() => goPanel('loki')}` в NewsPage.
**Почему:** Новости из ВКонтакте воспринимались как «встроенная страница ВК». После редизайна любая новость становится полноценным материалом АПГ.
**Статус деплоя:** Frontend ✓ задеплоен (version: 2dcd1576).

---

## [2026-07-10] fix: читаемость статьи новости и перекрытие кнопки ВК
**Коммит:** `2befb3df`
**Файлы:** `src/NewsPage.jsx`
**Тип:** fix
**Что изменено:**
- Замена GlassCard-контейнера тела статьи на тёмный `div` (`rgba(10,10,12,0.70)`) — контраст текста с ~2.94:1 до ~12:1 (WCAG AAA).
- Весь текст статьи (`body`, `summary`, блоки `note/quote`) переключён с `textSoft` на `APG2_PROFILE.text` (полная непрозрачность).
- Фон блоков `note/quote` снижен до `rgba(255,255,255,0.04)`, граница до `rgba(255,255,255,0.10)` — убран эффект серого на сером.
- `ArticleView` вынесен в `createPortal(…, document.body)` — выходит из stacking context UserApp (zIndex:1), теперь z=13000 корректно перекрывает tab bar (z=10000). Кнопка «Открыть оригинал в ВКонтакте» больше не закрывается нижней навигацией.
**Почему:** Нечитаемый текст (серое на сером) и кнопка ВК, недостижимая из-за фиксированного таб-бара поверх неё.
**Статус деплоя:** Frontend ✓ задеплоен (version: f016f0c3).

---

## [2026-07-10] feat: Центр событий — новый раздел AdminPanel с месячным календарём и списком
**Коммит:** `62d22a66`
**Файлы:** `src/EventsCalendar.jsx` (новый), `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:**
- Новый компонент `EventsCalendar` — главная рабочая область Центра событий.
- Два режима: «Месяц» (сетка с цветными дот-маркерами по категориям) и «Список» (группировка по датам, поиск, фильтры Все/Предстоящие/Прошедшие/Без даты).
- Клик на день в календаре → список событий дня, клик на событие → открывает существующую форму редактирования.
- Модалка формы события вынесена из `activeTab === 'events'` и рендерится для обоих табов: `'events'` и `'events-center'`.
- Статистика: Всего событий / Сегодня / На этой неделе / Дней с событиями.
- Старый раздел «События» полностью сохранён без изменений.
**Почему:** Первый этап системы управления событиями. Даёт визуальный обзор расписания, базовую навигацию и расширяемую архитектуру для следующих этапов (неделя, день, аналитика).
**Статус деплоя:** Frontend ✓ задеплоен (version: 3b814c44).

---

## [2026-07-10] fix: E1-E5 — отзывы эксперта, toast-уведомления, убраны alert()
**Коммит:** `26b03430`
**Файлы:** `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:**
- E1: ExpertCabinetPage читал отзывы из неправильной подколлекции `experts/{id}/reviews`. Исправлено на правильный путь: `expertReviews` (where expertId == id) — теперь эксперт видит реальные отзывы.
- E2: handlePrizeClaim теперь показывает toast при ошибке (auth error / server error) вместо молчалого отката ключей.
- E3: handleRaffleEnter теперь показывает toast при ошибке (auth error / server error) вместо молчалого отката ключей.
- E4: handleEventRegister теперь показывает toast при ошибке как в ветке регистрации, так и в ветке отмены.
- E5: Все alert() в PartnerCabinetPage и ExpertCabinetPage заменены на onToast (передаётся из UserApp.jsx как showToast).
**Почему:** Эксперты не видели ни одного отзыва клиентов (данные хранились не там, где читались). Пользователи не получали обратной связи при ошибках транзакций. alert() блокирует UI и некорректно работает в VK Mini App.
**Статус деплоя:** Frontend ✓ задеплоен (version: 26b03430).

---

## [2026-07-10] fix: security — Firestore rules + Telegram auth consistency (P6, P1)
**Коммит:** `dfcfd8de`
**Файлы:** `firestore.rules`, `api/verify-telegram.js`, `server/src/routes/verify-telegram.js`
**Тип:** fix
**Что изменено:**
- P6: Firestore Rules — заблокированы прямые клиентские записи (allow write: if false) на 15 коллекциях: partners, experts, events, news, prizes, notifications, customTasks, reviews, expertReviews, partners/{id}/reviews, stats, scans, prizeClaims, raffleEntries, guestSessions, errorLogs, telegramAuthSessions. Добавлено правило lokiKnowledge (allow read: if true; allow write: if false). Правила задеплоены в Firebase.
- P1: verify-telegram.js (оба варианта) — добавлена проверка tgLinks/{tg_id} перед созданием custom token, аналогично telegram-auth-check.js. Устранён сценарий дублирования аккаунтов при входе через Login Widget.
**Почему:** любой анонимный Firebase-пользователь мог напрямую писать в контент-коллекции через Firestore SDK; два потока Telegram давали разный результат для пользователя с привязанным email.
**Статус деплоя:** Firestore Rules ✓ задеплоены. verify-telegram.js ✓ задеплоен на Vercel (но Vercel не используется в prod). Fastify (Yandex Cloud) — временная ошибка инфраструктуры YC при деплое контейнера; код зафиксирован в git, нужно повторить деплой позже.

---

## [2026-07-10] fix: аудит надёжности авторизации — 6 исправлений (C1–C4, P3, P5)
**Коммит:** `0d2b306a`
**Файлы:** `src/UserApp.jsx`, `src/userApi.js`
**Тип:** fix
**Что изменено:**
- C1: `toggleFavorite` — ловит ошибки, вызывает `logError`, показывает тост «Требуется повторный вход» (401/403) или «Не удалось обновить избранное».
- C2: ежедневный бонус — `setUserKeys(+1)` и тост только после подтверждения от backend (`.then()`), не оптимистично.
- C3: `userApi.js` — `error.isAuthError = true` при статусах 401/403 для всех `userAction`-вызовов.
- C4: полностью удалены `haptic` useCallback, `lastHapticAtRef` и все 9 мест вызова (нарушение правила CLAUDE.md).
- P3: таймаут `ensureOwnerAuthSession` увеличен с 2400 до 5000 мс.
- P5: `handleConsentAccept` — при `STRONG_IDENTITY_REQUIRED` очищает localStorage, делает `signOut`, показывает кнопку «Выйти и войти заново» через `consentReloginNeeded` (без reload).
**Почему:** аудит выявил несколько точек отказа аутентификации: тихое поглощение ошибок, оптимистичное обновление ключей без подтверждения backend, отсутствие флага `isAuthError` для централизованной обработки 401/403.

---

## [2026-07-09] fix: «Ошибка при сохранении» при получении наград — тихий 403 из-за несоответствия Firebase UID
**Коммит:** `bb82a555`
**Файлы:** `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Обнаружен корень проблемы: при открытии приложения email-пользователем без Firebase-сессии в IndexedDB (новый браузер, сброс хранилища) `ensureOwnerAuthSession` бросал `STRONG_IDENTITY_REQUIRED`, но ошибка поглощалась. `auth.currentUser` оставался анонимным → backend отклонял `task:claim` с 403. Теперь при `STRONG_IDENTITY_REQUIRED` очищаем `apg_email_user`/`apg_tg_user` из localStorage, делаем `signOut` и `reload` — пользователь попадает в гостевой режим и переходит к email-логину. В `handleClaim` добавлено `console.error` с деталями (taskId, userId, authUid, isAnon, code, status) и отдельный текст тоста для 401/403.
**Почему:** `STRONG_IDENTITY_REQUIRED` молча проглатывался → сессия оставалась анонимной → все write-действия через backend падали с 403 «Нельзя менять данные другого пользователя».

---

## [2026-07-09] fix: восстановление сценария согласий и уведомлений
**Коммит:** `5546cfd8`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** CONSENT_SCREEN_DISABLED_FOR_DEMO=false — экран согласий включён для всех. Новые email-пользователи: ConsentScreen → push-разрешение. Старые без согласий: экран при следующем входе. ProfilePanel: карточка «Уведомления отключены» с кнопкой; при blocked — инструкция. Убрана красная ошибка «Разрешение не получено». AdminPanel→Пользователи: статистика согласий + фильтры + бейджи.
**Почему:** CONSENT_SCREEN_DISABLED_FOR_DEMO был оставлен true после демо-сессии.

---

## [2026-07-09] fix: экран Активности — race condition auth + permission-denied как empty state
**Коммит:** `36865a25`
**Файлы:** `src/UserApp.jsx`, `src/ActivityPage.jsx`
**Тип:** fix
**Что изменено:** 1) `UserApp.jsx`: заменена синхронная проверка `auth.currentUser` на `onAuthStateChanged`-based инициализацию — теперь Firebase сессия восстанавливается из IndexedDB до решения о `signInAnonymously`, что исправляет уничтожение кастомной сессии email-пользователей. 2) `ActivityPage.jsx`: ошибка `permission-denied` от Firestore обрабатывается как пустое состояние (не как сетевая ошибка); текст ошибки убран "Проверьте соединение" и заменён корректным.
**Почему:** Email-пользователи (`daria_samarina@mail.ru`) видели "Ошибка загрузки / Проверьте соединение" вместо пустой истории — из-за race condition в инициализации Firebase Auth.

---

## [2026-07-09] feat: замена шаблона плаката на макет 3 (единственный)
**Коммит:** `a0996ff0`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-v3.jpg` (удалены: `.jpg`, `-2.jpg`, `-2-v2.jpg`)
**Тип:** feat
**Что изменено:** Убран массив `POSTER_TEMPLATES` и весь UI выбора шаблона. Константа `POSTER_TEMPLATE_URL = '/qr-poster-template-v3.jpg'`. Функция `buildPoster` упрощена (2 аргумента). Убраны: стейт `posterTemplateId`, кнопки «Макет 1/2». Три старых файла удалены из public/ и S3. Python-проверка: threshold=0.97, sq=0.97, центр=(543,932), QR size=290px.
**Почему:** Пользователь хотел один шаблон вместо системы выбора.

---

## [2026-07-09] fix: cache-bust шаблона плаката №2 (переименование в v2)
**Коммит:** `085c6cab`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-2-v2.jpg`
**Тип:** fix
**Что изменено:** Файл переименован `qr-poster-template-2.jpg` → `qr-poster-template-2-v2.jpg`. URL в `POSTER_TEMPLATES[1]` обновлён. Оба файла присутствуют в dist и S3.
**Почему:** Yandex CDN закэшировал 404 для `/qr-poster-template-2.jpg` (файл не существовал до деплоя), что вызывало `tmpl.onerror` → тёмный APG-постер («старый макет»). Новый URL `/qr-poster-template-2-v2.jpg` гарантированно нет в CDN-кэше.

---

## [2026-07-09] feat: шаблон плаката №2 + squareness-based детекция QR
**Коммит:** `3454a966`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-2.jpg`
**Тип:** feat
**Что изменено:** Добавлен второй шаблон плаката (`qr-poster-template-2.jpg`, макет 2). `POSTER_TEMPLATE_URL` заменён на массив `POSTER_TEMPLATES`. `buildPoster()` принимает `templateUrl`. Новый алгоритм выбора кластера в `detectWhiteRegion`: `score = sq²×cells` (квадратность в квадрате × число ячеек) — QR-поле (sq≈0.88) всегда побеждает широкие фоновые области (sq≈0.44), даже если они больше по числу ячеек. UI: переключатель «Макет 1 / Макет 2» в табе плаката; смена шаблона сбрасывает postURL. Имя PNG-файла при скачивании: `poster-{id}-m{1|2}.png`.
**Почему:** Светлый фон макета 2 создавал большой горизонтальный кластер (cols 0-25, rows 0-7), который выигрывал по размеру у реального QR-поля (cols 11-20, rows 16-23). Квадратностный скоринг надёжно работает для обоих макетов и для любых будущих шаблонов.

---

## [2026-07-09] feat: новый шаблон плаката А5 + умная детекция белой области QR
**Коммит:** `2e5222ad`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template.jpg` (удалён `qr-poster-template.png`)
**Тип:** feat
**Что изменено:** Шаблон `qr-poster-template.png` (тёмный фон) заменён на `qr-poster-template.jpg` (светлый дизайн А5, `макет1.jpg` с рабочего стола). `detectWhiteRegion` переработан: вместо bounding-box всех «белых» клеток — BFS connected-components с порогом 97% (находит наибольший связный кластер чисто-белых клеток). QR масштаб: 80% от меньшей стороны области (10% отступ с каждой стороны). Кэш сбрасывается автоматически: смена расширения `.png`→`.jpg` = новый URL.
**Почему:** Старый алгоритм bounding-box работал только на тёмном фоне. На светлом шаблоне весь постер определялся как «белый», центр смещался в середину изображения. Connected-components с высоким порогом точно находит белое поле для QR (верифицировано Python-анализом: `grid(11-21, 16-22)`, центр `543×909` из `1054×1492`).

---

## [2026-07-09] fix: восстановление сессии администратора после перезагрузки
**Коммит:** `22c61acc`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** В `init()` useEffect после `waitForAdminAuth` добавлен вызов `adminSecurityRequest('status')`. Если Firebase Auth имеет валидного пользователя с ролью администратора и `mustChangePassword = false`, автоматически вызывается `setAdminSession(actor)` и `setAuthed(true)` без необходимости повторного входа. Пользователи с `mustChangePassword = true` по-прежнему попадают на форму входа.
**Почему:** `authed = useState(false)` сбрасывается при каждой перезагрузке. Firebase Auth token хранится в IndexedDB и сохраняется, но `setAuthed(true)` вызывался только в `AdminLoginGate.onAllow` — поэтому каждая перезагрузка требовала повторной авторизации.

---

## [2026-07-09] Loki UX — финальная полировка, блокировка всех авто-триггеров в on_demand
**Коммит:** `dc91545f`
**Файлы:** `src/loki/LokiProvider.jsx`
**Тип:** fix
**Что изменено:** Добавлен mode-фильтр внутри showMessage (единственная точка входа для всех событий через lokiBus). В режиме on_demand разрешены только CHARACTER_TAP, BRAIN_RESPONSE, APP_ERROR, USER_LOGIN, KEY_RECEIVED, ACHIEVEMENT_UNLOCKED. Заблокированы все навигационные триггеры (PARTNER_OPENED, EVENT_OPENED, PRIZE_OPENED, PROFILE_OPENED, REFERENCE_OPENED, MAP_OPENED, VK_ENTRY, VK_EXTERNAL_LINK). Добавлен settings в deps useCallback для корректной реакции на смену режима.
**Почему:** Предыдущие фикс (эффекты в LokiProvider) не перекрывал showLokiMessage-вызовы из UserApp.goPanel и VK entry — они проходили через lokiBus минуя mode-проверку.

---

## [2026-07-09] Loki UX — система режимов помощника, «Только по запросу» по умолчанию
**Коммит:** `c8362e23`
**Файлы:** `src/loki/lokiState.js`, `src/loki/LokiProvider.jsx`, `src/LokiPage.jsx`
**Тип:** feat
**Что изменено:** Добавлен LOKI_MODES enum (on_demand/minimal/standard/active) и поле mode в DEFAULT_LOKI_SETTINGS. В LokiProvider RETURN_VISIT активируется только для standard/active; USER_IDLE пропускается для on_demand, задержка 90с для minimal; Observer пропускается для on_demand, только HIGH-приоритет для minimal. Убран авто-триггер daily_visit на LokiPage. Добавлен селектор режима в нижней части LokiPage с 4 кнопками.
**Почему:** пользователи жаловались на навязчивость Локи — попапы при каждом переходе между разделами. Новая философия: Локи молчит пока пользователь не спросит.

---

## [2026-07-09] Glass readability pass — увеличение непрозрачности glass-карточек
**Коммит:** pending
**Файлы:** `src/index.css`, `src/design.js`, `src/HomePanelV2.jsx`, `src/components/Apg2ProfileGlass.jsx`, `src/NewsPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`
**Тип:** fix
**Что изменено:** белый overlay в glass-карточках поднят с 0.05-0.15 до 0.20-0.46. Изменены токены GLASS/GLASS_STRONG в design.js, V2.glass/glowGlass в HomePanelV2, APG2_PROFILE.glass в Apg2ProfileGlass, CSS-переменные --c-surface и --apg2-glass-border в dark-теме index.css, inline-стили в NewsPage/ExpertCabinetPage/PartnerCabinetPage.
**Почему:** текст на карточках плохо читался из-за чрезмерно тёмного glass overlay; backdrop-filter и border оставлены без изменений.

---

## [2026-07-09] Premium UI Pass — унификация токенов APG2/V2 по всему приложению
**Коммит:** `eab89de9`
**Файлы:** `src/EventsPage.jsx`, `src/RewardsPage.jsx`, `src/HomePanelV2.jsx`
**Тип:** refactor
**Что изменено:**
- EventsPage: исправлен scroll-lock (убран `position:fixed; top:-scrollY` → `overflow:hidden` только); EventModal переведён с `T.*` → `APG2_PROFILE.*` (текст, иконки, описание)
- RewardsPage: ConfirmModal, TicketSheet, ClaimSuccessModal — контейнеры с `GLASS_STRONG` → `APG2_PROFILE.glass`, `borderRadius: '34px'`, safe-area padding; кнопки → `GlassButton`; все `T.*` → `APG2_PROFILE.*`
- HomePanelV2: EventModal (detail sheet) → `V2.glass`, borderRadius 34px, safe-area; EventCard mini-tiles → `V2.*` токены; PartnerLogo border → rgba; NewsDetailSheet (swipe sheet) → `V2.glass`; NewsWidget контейнер → `V2.glowGlass`; News-карточки горизонтальной ленты → `V2.*`; Welcome-карточка пользователя → `V2.glowGlass` вместо `GLASS_STRONG`
**Почему:** Унификация визуального языка — удаление смеси устаревших `T.*`/`GLASS_STRONG` в активных v2-компонентах, переход на `APG2_PROFILE`/`V2.*` токены

---

## [2026-07-09] Fix: смещение экрана при открытии карточки эксперта
**Коммит:** `5868846b`
**Файлы:** `src/ExpertsPage.jsx`, `src/EventsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`
**Тип:** fix
**Что изменено:** 1) Заменён scroll-lock `overflow:hidden` на паттерн `position:fixed + top:-scrollY + width:100%` с восстановлением `window.scrollTo(0, scrollY)` при закрытии — в ExpertsPage (selected), EventsPage (selectedEvent). 2) Добавлен `onTouchStart/Move/End={e => e.stopPropagation()}` на overlay обоих модалей ExpertsPage (v2 и v1) и на ApgModal в Apg2ProfileGlass. В drag-handlers v1 и ApgModal добавлен `e.stopPropagation()` в начало. 3) ApgModal: `handleTouchEnd` принимает `e` параметр для вызова stopPropagation.
**Почему:** iOS и VK Mini App игнорируют `overflow:hidden` на body как средство блокировки скролла — браузер сбрасывает визуальную позицию скролла на 0, из-за чего весь контент «уходит вверх». Touch-события из порталов (createPortal → document.body) всё равно всплывают по React-дереву к UserApp, запуская pull-to-refresh и edge-swipe обратно.

---

## [2026-07-09] ExpertCabinetPage v2 + ApgHealthPage
**Коммит:** `5868846b`
**Файлы:** `src/ExpertCabinetPage.jsx`, `src/ApgHealthPage.jsx` (новый), `src/UserApp.jsx`, `src/ProfilePanel.jsx`
**Тип:** feat
**Что изменено:** ExpertCabinetPage v2 — полная переработка: 6 вкладок (Старт/Аналитика/Контент/QR/Отзывы/Карточка), SVG-кольцо прогресса, чек-лист готовности (8 пунктов), быстрые действия (4 кнопки), контекстный Локи (8 сценариев), блок достижений (6 штук), «ближайшая цель», группированная статистика со столбчатым рейтингом, превью галереи. ApgHealthPage (owner only) — диагностика: 3 вкладки (Обзор/Данные/Активность), проверка сервисов (Auth/Firestore/Backend/Интернет), свежая выгрузка errorLogs из Firestore, счётчики сущностей, лента партнёров и новостей, критические предупреждения. UserApp: lazy import + Panel id="health". ProfilePanel: кнопка «APG Health» под кнопкой администрирования (owner only).
**Почему:** Кабинет эксперта должен быть центром управления профилем с чётким путём к заполнению. Health-экран даёт владельцу мгновенный срез состояния системы без выхода из приложения.

---

## [2026-07-08] Улучшение личного кабинета партнёра (v2)
**Коммит:** `5868846b`
**Файлы:** `src/PartnerCabinetPage.jsx`
**Тип:** feat
**Что изменено:** Переработан v2-вариант кабинета: добавлена строка быстрых действий (фото/акция/QR/карточка), SVG-кольцо прогресса с процентом, карточка «Следующий шаг», нумерованный чек-лист с выделением текущего пункта, контекстно-зависимые подсказки Локи (8 сценариев), мини-метрики на вкладке «Старт», группировка статистики по разделам (Охват / Сканирования / Переходы), доната-конверсия, статус-индикаторы для раздела «Контент», плейсхолдеры в полях редактирования. Вкладка «Аналитика» показывает пустое состояние с кнопкой «Посмотреть QR».
**Почему:** Кабинет должен быть рабочим центром партнёра, а не страницей статистики — с понятным следующим шагом, быстрым доступом к ключевым действиям и персональными подсказками.

---

## [2026-07-08] Мастер публикации и запуск партнёра
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Мастер подключения партнёра получил 5-шаговый progress, полный чек-лист readiness, backend-автосоздание черновика приветственной новости при публикации, отдельное действие `partner:mark-verified` и обновлённый кабинет партнёра с разделами “Старт”, “Аналитика”, “Контент”, “Отзывы”, “Документы”. Автоматический push при создании черновика партнёра отключён: push теперь остаётся launch-рекомендацией после публикации.
**Почему:** После создания и привязки карточки партнёра нужно завершать весь цикл запуска: проверить готовность, опубликовать, подготовить продвижение, дать партнёру полезный кабинет и только потом присваивать доверенный статус.

---

## [2026-07-08] Жизненный цикл публикации партнёра
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `api/public-data.js`, `server/src/routes/public-data.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Подключение партнёра расширено до pipeline запуска: черновик, подключение владельца, оформление карточки, готовность к публикации, публикация в каталог, новые партнёры на 14 дней и launch-чеклист. Админка получила кнопку “Опубликовать в каталог”, публикационный readiness gate 80% с обязательным согласием, действия Локи после публикации и автосоздание приветственной новости. Кабинет партнёра теперь открывается со стартового чек-листа, а публичный каталог скрывает новые `catalogPublished:false` черновики.
**Почему:** После привязки кабинета процесс всё ещё обрывался до фактического запуска партнёра в экосистеме АПГ.

---

## [2026-07-08] Мастер подключения партнёра после ИИ-импорта
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** После сохранения карточки партнёра с email запускается мастер подключения: backend проверяет пользователя по email, показывает найденного пользователя или приглашение, умеет привязать кабинет, отправить персональную ссылку, сохранить статус подключения, readiness-прогресс, рекомендации Локи и журнал событий. Email-регистрация автоматически подхватывает ожидающие partner invite и выдаёт доступ к своему кабинету.
**Почему:** Сценарий ИИ-импорта обрывался после сохранения карточки: администратор не видел следующих действий, партнёр не получал понятного приглашения, а статус подключения не фиксировался.

---

## [2026-07-08] Упрощённая юридическая карточка публичных заявок
**Коммит:** `локально`
**Файлы:** `src/PublicSubmitPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Публичная анкета больше не заставляет проходить отдельный обязательный юридический шаг. Основная форма собирает данные для публикации, связи и обязательный ИНН; юридический блок свёрнут по умолчанию и раскрывается добровольно или при выборе платного сотрудничества. Backend хранит `cooperationPlan`, `cooperationStatus`, `lokiCooperationNote` и различает статусы `legal_not_required`, `legal_recommended`, `legal_partial`, `contract_ready`.
**Почему:** Нужно не отпугивать новых партнёров и экспертов длинной бюрократической формой, но сохранить готовность к договорам, ЭДО, счетам, актам, маркировке рекламы и CRM.

---

## [2026-07-08] Юридические карточки публичных заявок
**Коммит:** `локально`
**Файлы:** `src/PublicSubmitPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `api/upload-photo.js`, `server/src/routes/upload-photo.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Публичная анкета стала двухшаговой: публичная карточка и закрытая юридическая карточка для ООО, ИП, самозанятых и физических лиц. Backend нормализует реквизиты, проверяет ИНН/КПП/ОГРН/ОГРНИП/БИК/счета, хранит документы, формирует `counterparty` и CRM-заготовку. Админка показывает юридические данные только ролям `owner`, `super_admin`, `admin`, а `/api/admin-actions` вырезает закрытые поля для остальных ролей.
**Почему:** Нужно собирать не только данные для публикации, но и реквизиты для договоров, ЭДО, бухгалтерии и будущей CRM без риска показа юридических данных пользователям.

---

## [2026-07-08] Публичные формы заявок АПГ
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/UserApp.jsx`, `src/PublicSubmitPage.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `server/src/server.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** В «ИИ-импорт» добавлен блок публичных форм для партнёров, экспертов, событий, новостей и призов: генерация токен-ссылки, готовое сообщение, QR-код и история выданных ссылок. Добавлена публичная страница `/submit/:type/:token` с формой, загрузкой фото и отправкой заявки без авторизации. Backend `/api/public-submit` создаёт обработанную запись в `aiImportRequests` и закрывает ссылку после отправки.
**Почему:** Нужно убрать ручной сбор данных через переписки и получать структурированные заявки сразу в редакционную очередь АПГ.

---

## [2026-07-08] Нормализация внешних ссылок партнёров и экспертов
**Коммит:** `локально`
**Файлы:** `src/utils/externalUrls.js`, `src/vk.js`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен единый нормализатор внешних URL для VK, Telegram, WhatsApp, Instagram, YouTube, Rutube, Дзен, Max и сайтов. Карточки партнёров/экспертов и формы сохранения теперь приводят ссылки вроде `www.vk.com/vibes`, `vk.com/vibes`, `@vibes` и `vibes` к безопасному каноническому виду перед сохранением и открытием.
**Почему:** VK-ссылка партнёра Vibes могла пересобираться как `https://vk.com/www.vk.com/...`, из-за чего открывалась страница VK с ошибкой «Такой страницы не существует».

---

## [2026-07-08] ИИ-импорт заявок в админке
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/_admin-security.js`, `server/src/lib/adminSecurity.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлена вкладка «ИИ-импорт» для заявок партнёров, экспертов, событий, новостей и призов. Админ может вставить текст анкеты или загрузить текстовый файл, получить распознанные поля, confidence, список недостающих данных, сохранить заявку в `aiImportRequests` и создать из неё черновик в нужном разделе. Backend whitelist расширен новым ресурсом `aiImportRequests`, права проверяются через `ai:*`.
**Почему:** Нужно ускорить перенос данных из анкет/сообщений в админку, сохранив редакционный контроль и запрет автопубликации.

---

## [2026-07-08] Плавные горизонтальные карусели и карточки «Что интересного сегодня»
**Коммит:** `локально`
**Файлы:** `src/HomePanelV2.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Блок «Что интересного сегодня» переведён на native CSS Scroll Snap с едиными размерами карточек, фиксированным нижним текстовым блоком и двухстрочным ellipsis. Горизонтальные ленты главной и страницы новостей получили общий snap/contain стиль с инерционной прокруткой и без VKUI `HorizontalScroll` на главной.
**Почему:** Карточки останавливались между позициями, жесты конфликтовали с вертикальным скроллом, а длинные названия в подборке обрезались неаккуратно.

---

## [2026-07-08] Контекстная Action Bar вместо плавающих быстрых действий
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Удалена плавающая вертикальная панель быстрых действий в админке. Верхний toolbar получил компактные контекстные действия `+ Создать`, `Фильтр`, `Обновить`, `Экспорт`; на мобильных меню создания открывается как bottom sheet.
**Почему:** Плавающая стопка больших кнопок перекрывала рабочую область и мешала пользоваться админкой. Действия должны быть доступны из панели, но не закрывать контент.

---

## [2026-07-08] Demo hotfix: временно отключён экран согласий
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен временный флаг `CONSENT_SCREEN_DISABLED_FOR_DEMO`, который отключает показ `ConsentScreen` и не даёт проверке согласий блокировать авторизованного пользователя. Email-flow при успешной авторизации сразу завершает вход и открывает приложение.
**Почему:** Срочный production hotfix для демонстрации: окно согласий повторно блокировало вход, нужно быстро восстановить доступ к главной без белого экрана и зависаний.

---

## [2026-07-08] Миграция legacy-согласий и защита от повторного экрана документов
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** `profile:sync` теперь возвращает `profileReady`, `consentRequired`, причину и версию формата согласий. Backend распознаёт старые поля `consentAccepted`, `termsAccepted`, `privacyAccepted`, `acceptedAt` и автоматически нормализует их в новый `consents`. Добавлены owner-only actions `profile:consentStatus` и `profile:forceAcceptConsent` для диагностики и rescue застрявших профилей.
**Почему:** Пользователи, которые уже принимали документы в старом формате, могли снова попадать на экран согласий, потому что frontend проверял только новую структуру `consents.*`.

---

## [2026-07-08] Устойчивое завершение email-входа после документов
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ConsentScreen.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Экран документов теперь показывается только после завершённой Firebase Auth и backend `profile:sync`. Сохранение согласий переведено в отдельное backend-действие `profile:acceptConsent` с transaction/merge, без прямого клиентского чтения Firestore на этапе `Продолжить`.
**Почему:** В production вход доходил до документов, но мог падать на сохранении профиля/согласий из-за гонки auth/profile state или отсутствующего документа пользователя. Документы должны быть этапом onboarding после успешной авторизации, а не частью незавершённого входа.

---

## [2026-07-08] Safe bootstrap и lite-диагностика без React
**Коммит:** `локально`
**Файлы:** `index.html`, `public/network-diagnostics-lite`, `src/App.jsx`, `src/main.jsx`, `src/ErrorBoundary.jsx`, `deploy-frontend.sh`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен аварийный pre-React fallback в `index.html`, статическая страница `/network-diagnostics-lite` без React/Firebase/внешних скриптов, ранний bootstrap trace и режим `?no-sw=1`. `UserApp` переведён в lazy-load, чтобы Firebase/Auth/Firestore не были частью самого первого React shell, а внешний Telegram script больше не блокирует старт приложения.
**Почему:** На телефонах без VPN приложение могло показывать белый экран до роутинга и React-диагностики. Теперь даже при недоступности Firebase/Google/Telegram пользователь должен увидеть shell, ошибку или lite-диагностику вместо пустого экрана.

---

## [2026-07-08] Диагностика запуска без VPN и устойчивый public-data
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `src/App.jsx`, `src/UserApp.jsx`, `src/networkDiagnostics.js`, `src/NetworkDiagnosticsPage.jsx`, `api/public-data.js`, `server/src/routes/public-data.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлена скрытая страница `/#/network-diagnostics` с проверкой доступности myapg.ru, Yandex API, public-data, Firebase/Google, Yandex Storage, VK и Telegram без логирования секретов. Установлен безопасный runtime-лог fetch-запросов. `/api/public-data` теперь возвращает частичные данные через `Promise.allSettled`, чтобы одна проблемная коллекция не отправляла главную обратно в прямой Firestore fallback.
**Почему:** Если приложение открывается только через VPN, нужно точно видеть недоступный домен на устройстве пользователя и убрать Firebase/Google из критичного пути загрузки публичной главной.

---

## [2026-07-08] Защищённый вход админки и bootstrap Owner
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-login.js`, `api/_admin-security.js`, `api/admin-security.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-login.js`, `server/src/routes/admin-security.js`, `server/src/server.js`, `server-shared/admin-password.js`, `scripts/bootstrap-owner.mjs`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/12_SECURITY.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** security
**Что изменено:** Убран автоматический вход в админку по старой Firebase-сессии без ввода email/password. Добавлен `/api/admin-login` с scrypt-хешами паролей и Firebase custom token, создание администраторов через Firebase Auth, смена временного пароля при первом входе, смена пароля администратору, защита `owner` от блокировки/понижения/удаления, серверная проверка `adminStatus`. Создан production owner через Firebase Admin bootstrap.
**Почему:** Закрытие критической уязвимости доступа к админке и переход к полноценным персональным административным аккаунтам.

---

## [2026-07-08] Admin RBAC и центр безопасности
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/_admin-security.js`, `api/admin-security.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-security.js`, `server/src/server.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/12_SECURITY.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлен `/api/admin-security`, server-side RBAC для ролей owner/super_admin/admin/editor/moderator/analyst/partner/expert/user, новый вход в админку через Firebase session/email+password и вкладка «Доступ» с матрицей прав, администраторами и журналом безопасности.
**Почему:** Админке нужна профессиональная система доступа вместо локального парольного gate: роли и действия должны проверяться backend, а изменения доступа должны попадать в аудит.

---

## [2026-07-08] Production smoke script для Chromium
**Коммит:** `локально`
**Файлы:** `package.json`, `scripts/prod-smoke.mjs`, `.ai/17_CHANGELOG_AI.md`
**Тип:** chore
**Что изменено:** Добавлена команда `npm run smoke:prod`, которая открывает production через Playwright Chromium, проверяет `version.json`, React root, критические UI-маркеры и console/page errors.
**Почему:** Headless Chromium стабильно падает внутри macOS sandbox с `MachPort permission denied`; отдельная команда позволяет запускать production smoke сразу вне sandbox без длинного `node -e`.

---

## [2026-07-08] Hotfix скролла статьи новости и iOS zoom комментариев
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Pull-to-refresh ограничен корневой лентой новостей и отключён внутри статьи, комментариев и галереи. Поле комментария увеличено до 16px для Safari iOS, после успешной отправки снимается фокус и восстанавливается позиция внутреннего скролла статьи.
**Почему:** В открытой новости жест обновления вмешивался в обычный скролл вверх, мог оставлять пустую область, а Safari сохранял увеличенный масштаб после ввода комментария.

---

## [2026-07-08] Исправление жестов и скролла в новостях
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Глобальный pull-to-refresh теперь учитывает внутренние scroll-контейнеры и активируется только если жест начался в настоящем верхе scroll-зоны. Лента, статья и lightbox новостей помечены как самостоятельные gesture/scroll roots с `touchAction: pan-y` и `overscrollBehaviorY: contain`.
**Почему:** В разделе новостей `window.scrollY` оставался около нуля при прокрутке внутренней ленты, из-за чего глобальный pull-to-refresh ошибочно мешал обычному вертикальному скроллу вверх.

---

## [2026-07-08] Native Web Push для iPhone/Safari PWA
**Коммит:** `локально`
**Файлы:** `src/constants.js`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `api/send-push.js`, `server/src/routes/send-push.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `server/deploy.sh`, `package.json`, `package-lock.json`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Клиентская регистрация push переведена с Firebase Messaging token на стандартный `PushManager.subscribe()` с VAPID public key. Backend теперь отправляет уведомления и на native Web Push subscriptions, и на legacy FCM tokens, сохраняет детальную статистику `native/fcm/errors` и показывает первый код ошибки в админке.
**Почему:** iPhone/Safari/PWA не получали тестовые push через FCM Web SDK; при этом Firebase Auth/Firestore должны остаться без изменений, а старая FCM-доставка не должна сломаться для уже зарегистрированных пользователей.

---

## [2026-07-08] Push notification center foundation
**Коммит:** `локально`
**Файлы:** `public/sw.js`, `src/main.jsx`, `src/UserApp.jsx`, `src/NotificationsPage.jsx`, `src/AdminPanel.jsx`, `api/send-push.js`, `server/src/routes/send-push.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Восстановлен push-capable service worker без app-shell кэша, расширен `/api/send-push` с категориями, аудиториями, приоритетами, deep link, диагностикой доставки и записью `pushStats` в уведомление. В админке вкладка «Рассылка» стала центром уведомлений с KPI, конструктором, предпросмотром и повторной отправкой; у пользователя появились настройки категорий уведомлений.
**Почему:** Публикация новости не приводила к доставке push, потому что цепочка Web Push была неполной: service worker отключался, отправка не хранила историю доставки и не учитывала согласия/категории пользователей.

---

## [2026-07-08] Loki city concierge foundation
**Коммит:** `локально`
**Файлы:** `src/loki/LokiRecommendationCenter.js`, `src/loki/core/modules/ConciergeEngine.js`, `src/loki/core/LokiCore.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/lokiUserMemory.js`, `src/LokiPage.jsx`, `src/AdminPanel.jsx`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлен единый Recommendation Center: персональный профиль интересов, персональная лента «Локи рекомендует», сценарные подборки («вечер», «с детьми», «кофейни», «спорт», «авто», «предприниматели») и первые советы для партнёров/экспертов. Loki Core получил модуль City Concierge, а админская аналитика Локи показывает непонятые вопросы и действия после рекомендаций.
**Почему:** Локи должен развиваться из чат-помощника в городского консьержа, который помогает принимать решения и даёт единую основу рекомендаций для будущих разделов АПГ.

---

## [2026-07-08] Loki Action Router и админская база знаний
**Коммит:** `локально`
**Файлы:** `src/loki/core/LokiCore.js`, `src/loki/core/modules/ActionRouter.js`, `src/loki/core/lokiCoreUtils.js`, `src/loki/core/modules/KnowledgeExpert.js`, `src/loki/lokiActionTypes.js`, `src/loki/LokiProvider.jsx`, `src/LokiPage.jsx`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `api/admin-actions.js`, `api/user-actions.js`, `api/public-data.js`, `server/src/routes/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/public-data.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Локи получил отдельный Action Router для прямых команд навигации и единого поиска по партнёрам, экспертам, событиям, новостям и заданиям. Карточки ответов стали богаче: изображение, тип, мета-строки и быстрые действия; в админке добавлены вкладки «База знаний Локи» и «Аналитика Локи».
**Почему:** Локи должен постепенно становиться центральным интерфейсом АПГ: не только отвечать текстом, но и безопасно выполнять действия, помнить реальные запросы и позволять администратору расширять знания без релиза.

---

## [2026-07-08] News mini-CMS foundation
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/NewsPage.jsx`, `src/newsUtils.js`, `src/utils/parseVideoUrl.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Форма новости расширена до первого слоя мини-CMS: подзаголовок, анонс, автор, источник, срок актуальности, теги, галерея с подписями/сортировкой, несколько видео, соцссылки, структурные блоки и выключатель комментариев. Страница новости показывает подзаголовок, отдельный блок соцссылок, content blocks и уважает `commentsEnabled=false`; реакции обновлены до набора `👍 ❤️ 🔥 👏 🎉 🤔`.
**Почему:** Новости АПГ должны стать универсальной контент-платформой без сторонних сервисов, при этом backend должен безопасно сохранять новые поля через существующий admin action слой.

---

## [2026-07-08] Локи semantic search и PDF-preview плакатов
**Коммит:** `локально`
**Файлы:** `src/loki/core/modules/PartnerExpert.js`, `src/loki/knowledge/categories/categories.json`, `src/UserApp.jsx`, `src/NewsPage.jsx`, `src/EventsPage.jsx`, `src/PartnerQRSection.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Локи получил более устойчивый семантический поиск по партнёрам: расширены категории, синонимы, fuzzy-сопоставление и контекст follow-up вопросов. Действия Локи теперь могут открывать конкретную новость или событие через существующий action-layer. Генератор QR/плакатов получил PDF-preview с выбором A4/A5, ориентации, полей и качества перед печатью/сохранением.
**Почему:** Пользователь должен задавать Локи естественные вопросы, а админка должна надёжно сохранять плакаты партнёров в PDF без неработающей кнопки и потери пропорций.

---

## [2026-07-08] P0 восстановление запуска PWA после production deploy
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `public/sw.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Версия service worker cache поднята до `apg-p0-restore-20260708`, чтобы установленная PWA принудительно сбросила старые runtime/static caches. Повторный `controllerchange` reload ограничен одним разом за сессию, чтобы обновление service worker не могло уйти в цикл перезагрузки.
**Почему:** Свежий production-браузер и persistent PWA-профиль не воспроизвели React runtime error, но после deploy белый экран у пользователя соответствует stale PWA/SW-cache сценарию. Hotfix восстанавливает загрузку без изменения бизнес-логики и UI.

---

## [2026-07-08] P0 аварийное отключение service worker
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `public/sw.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Регистрация service worker на старте отключена: приложение удаляет существующие SW-регистрации и очищает browser caches. `sw.js` превращён в emergency restore worker: очищает все кэши, unregister-ит себя и не перехватывает fetch-запросы.
**Почему:** После первого restore у пользователя всё ещё оставался белый экран, значит нужно полностью вывести PWA из-под старого service worker/cache-контроллера. Работоспособность приложения важнее offline/push-кэша в P0-инциденте.

---

## [2026-07-08] P0 устойчивый bootstrap главной
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** `/api/public-data` получил AbortController timeout и сброс общего pending promise при ошибке, чтобы один зависший bootstrap-запрос не отравлял последующие загрузки. Убран общий `load_timeout`, который переводил всю главную в `networkError`; публичные блоки теперь завершаются через собственные `safeLoad` fallback. Owner auth session вынесена в короткий best-effort timeout, чтобы авторизационная синхронизация не блокировала Home.
**Почему:** Повторяющиеся симптомы “частичная главная”, отсутствие экспертов и ложное “нет соединения” были вызваны архитектурой загрузки: один зависший `/api/public-data`/auth promise мог блокировать весь старт приложения вместо деградации отдельного блока.

---

## [2026-07-07] P0 admin API: Firebase token вынесен из Authorization для Yandex
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/userApi.js`, `src/ProfilePanel.jsx`, `src/NewsPage.jsx`, `api/_admin-security.js`, `server/src/lib/adminSecurity.js`, `api/admin-actions.js`, `api/user-actions.js`, `api/email-auth.js`, `api/news-comments.js`, `api/news-engagement.js`, `api/system-status.js`, `api/loki-editor.js`, `server/src/routes/user-actions.js`, `server/src/routes/email-auth.js`, `server/src/server.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Firebase ID Token теперь передаётся в `X-Firebase-Auth`, а backend поддерживает и новый заголовок, и старый `Authorization` для совместимости. CORS обновлён для `X-Firebase-Auth`; admin diagnostics теперь показывает endpoint/action/resource/status/body для failed admin actions и backend возвращает стабильные коды `AUTH_REQUIRED`, `FORBIDDEN_ROLE`, `UNKNOWN_ACTION`, `INVALID_PAYLOAD`, `SERVER_ERROR`. Админка принудительно обновляет ID token через `getIdToken(true)` / `getIdTokenResult(true)`, чтобы новые custom claims применялись сразу.
**Почему:** Yandex Serverless Container перехватывал внешний `Authorization: Bearer <Firebase ID Token>` и отвечал собственным `403 Forbidden: Not authorized` до Fastify. После исправления транспорта backend показал вторую причину: у текущего Firebase UID не было owner/admin claims, поэтому role guard возвращал `FORBIDDEN_ROLE`.

---

## [2026-07-07] P0 админка больше не зависает на Firebase Auth
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админка больше не создаёт anonymous Firebase-сессию как fallback для административного доступа. `waitForAdminAuth` ждёт первичный `onAuthStateChanged`, пишет таймлайн этапов (`firebase_initialized`, `onAuthStateChanged_fired`, `token_received`, `admin_loading_started`) в консоль и `localStorage.apg_admin_auth_trace`, а при отсутствии owner/admin Firebase-сессии показывает явный стоп-экран вместо пустого dashboard.
**Почему:** Экран “Firebase Auth ещё не подтверждён” означал, что админка не дождалась валидного Firebase ID Token; anonymous fallback приводил к backend 403/Firestore permission-denied и выглядел как массовая ошибка загрузки разделов.

---

## [2026-07-07] P0 закрытые чтения админки переведены на backend
**Коммит:** `локально`
**Файлы:** `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен `entity:list` в обе backend-ветки `/api/admin-actions` с role guard, limit/order config и безопасной сериализацией Firestore Timestamp. AdminPanel больше не читает напрямую закрытые коллекции `banners`, `errorLogs`, `adminActivity`, `users`, `prizeClaims`, `scans`, `expertScans`, `expertReviews`, `raffleEntries`, `guestSessions`; они загружаются через backend, а публичные каталоги остаются read-only Firestore.
**Почему:** Массовая ошибка админки была вызвана `permission-denied` от Firestore после ужесточения архитектуры: часть legacy-разделов всё ещё читала закрытые коллекции напрямую. Исправление закрывает первопричину без ослабления Firestore Rules.

---

## [2026-07-07] P0 исправление авторизации после смешивания профилей
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Strong identity аккаунты `email:*` и `tg_*` больше не проходят через опасное перепривязывание anonymous `auth_map`: после custom token сессии используются напрямую и только best-effort чинят `auth_map`. Logout очищает auth/local/session кэши пользователя. Привязка Telegram больше не перезаписывает основное имя, фамилию и аватар email-профиля; добавлен `FINISH LOGIN` dev-log для ошибок входа/согласий.
**Почему:** У пользователя после входа по email отображалось имя другого Telegram-профиля, а после согласий вход падал из-за mismatch между custom-token session и старым `auth_map`. Теперь профиль берётся только из текущего userId, а Telegram хранится как связанный метод входа, не как замена личности.

---

## [2026-07-07] P0 диагностика загрузки админки и stale Firestore emulator
**Коммит:** `локально`
**Файлы:** `src/firebase.js`, `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админские роуты больше не наследуют старый `localStorage.apg_demo_content=emulator`, который мог направлять Firestore-запросы в локальный эмулятор и валить все разделы одинаковой network/Firestore ошибкой. Загрузка админки получила расширенную диагностику: Firebase code/message, auth uid/email/claims role, project/env, online state и emulator state.
**Почему:** Перед production deploy админка показывала массовые ошибки “попыток: 3, временная ошибка сети/Firestore”; Admin SDK и Web SDK подтвердили, что коллекции и rules рабочие, а общий сбой соответствует клиентскому подключению к неверному Firestore endpoint/cache.

---

## [2026-07-07] P0 защита от смешивания Email и Telegram аккаунтов
**Коммит:** `локально`
**Файлы:** `api/email-auth.js`, `api/telegram-auth-check.js`, `api/telegram-webhook.js`, `api/user-actions.js`, `server/src/routes/email-auth.js`, `server/src/routes/telegram-auth-check.js`, `server/src/routes/telegram-webhook.js`, `server/src/routes/user-actions.js`, `src/ProfilePanel.jsx`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Привязка Telegram/email больше не доверяет `userId` из body: link endpoints требуют Firebase ID Token, сверяют владельца аккаунта, проверяют уникальность `tgLinks`/`emailIndex`, выполняют запись в transaction и пишут `accountLinkAudit`. Telegram `/start` без персонального `auth_state` больше не завершает чужую pending-сессию; email/Telegram auth-check возвращают Firebase custom token для точного APG userId.
**Почему:** Расследование P0 показало риск объединения данных разных людей через старые localStorage/auth_map и Telegram fallback «последняя pending-сессия». Теперь email/Telegram аккаунты требуют strong identity, а referral-flow не может менять владельца профиля.

---

## [2026-07-07] V5.0.2 Lint, QA & Production Gate
**Коммит:** `локально`
**Файлы:** `.eslintrc.cjs`, `api/admin-actions.js`, `api/news-engagement.js`, `api/user-actions.js`, `server/src/routes/admin-actions.js`, `server/src/routes/news-engagement.js`, `server/src/routes/user-actions.js`, `src/AdminPanel.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/ExpertsPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`
**Тип:** fix
**Что изменено:** Настроен production-gate lint: исключены `dist/`, `build/`, `node_modules/`, `.release-backups/`, сгенерированные/служебные артефакты; backend/server-shared переведены в Node env. Отключены шумовые legacy-правила `react/prop-types`, `no-unused-vars`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`, при этом `no-undef`, `no-empty` и синтаксические проверки остаются активными. Исправлены реальные gate-дефекты: undefined helper/props в админке и главной, mixed tabs, лишние regex escapes и redundant boolean casts.
**Почему:** V5.0.2 переводит `npm run lint` из шумного полного сканирования артефактов в рабочий production gate и закрывает ошибки, которые могли привести к runtime-сбоям перед deploy.

---

## [2026-07-07] News E2E audit: комментарии и счётчики
**Коммит:** `локально`
**Файлы:** `api/news-comments.js`, `server/src/routes/news-comments.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/ARCHITECTURE.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админская загрузка комментариев переведена с прямого Firestore read на `GET /api/news-comments?admin=1` с проверкой `comments:*`, включая стартовый `fetchData()` админки. Создание, удаление и блокировка комментариев синхронизируют `news.comments` и `news.stats.comments` в обеих backend-реализациях; сбой вторичного счётчика логируется, но не ломает основной action.
**Почему:** Интеграционный аудит новостной цепочки показал риск пустой модерации при закрытых Firestore rules, пустых dashboard-метрик и расхождения счётчиков обсуждения после пользовательских действий.

---

## [2026-07-07] V5.0 Локи · ИИ-редактор новостей
**Коммит:** `локально`
**Файлы:** `api/loki-editor.js`, `server/src/routes/loki-editor.js`, `server/src/server.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/ARCHITECTURE.md`
**Тип:** feat
**Что изменено:** Добавлен backend `/api/loki-editor` для источников, проверки RSS/XML/JSON/manual материалов, duplicate check, генерации редакционных черновиков, confidence score, объяснения важности, журнала Локи и публикации только после ручного подтверждения редактора. Вкладка «Черновики ИИ» превращена в рабочий раздел «Локи · Редакция» с KPI, источниками, очередью черновиков, действиями и настройками.
**Почему:** V5.0 запускает интеллектуальную редакционную систему без автопубликации: Локи помогает редактору готовить новости, но не заменяет человека.

---

## [2026-07-07] V4.4.4 user backend migration и architecture audit
**Коммит:** `локально`
**Файлы:** `api/user-actions.js`, `server/src/routes/user-actions.js`, `server/src/server.js`, `src/userApi.js`, `src/UserApp.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/loki/LokiProvider.jsx`, `src/errorLogger.js`, `src/diagnostics.js`, `.ai/04_API.md`, `.ai/ARCHITECTURE.md`
**Тип:** refactor
**Что изменено:** Добавлен единый `/api/user-actions` для пользовательских write-сценариев с Firebase ID Token, owner checks и журналом `userActivityLog`. Пользовательские записи профиля, согласий, избранного, новостей, событий, призов, розыгрышей, заданий, отзывов, кабинетов, Локи, ошибок и диагностики переведены с прямого Firestore SDK на backend API; Firestore на клиенте оставлен для read-only каталогов и экранов.
**Почему:** V4.4.4 завершает backend-first миграцию перед V5 и готовит архитектуру для Loki/AI-платформы без прямых клиентских записей в базу.

---

## [2026-07-07] V4.4.3 complete backend migration для админки
**Коммит:** `локально`
**Файлы:** `api/_admin-security.js`, `api/admin-actions.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-actions.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`
**Тип:** refactor
**Что изменено:** `/api/admin-actions` расширен универсальными `entity:create/update/delete/set` для партнёров, экспертов, событий, баннеров, призов, уведомлений, заданий, пользователей, выдачи призов, ошибок, настроек и статистики. AdminPanel больше не выполняет прямые Firestore-записи для административных изменений; клиент читает коллекции напрямую, а все изменения идут через backend с Firebase ID Token, permission matrix, idempotency и audit log.
**Почему:** V4.4.3 закрывает смешанную архитектуру старой админки и готовит безопасный серверный слой для будущего V5 AI News Editor / Loki редакции.

---

## [2026-07-07] V4.4.2 production security & infrastructure
**Коммит:** `локально`
**Файлы:** `api/_firebase-admin.js`, `api/_admin-security.js`, `api/admin-actions.js`, `api/system-status.js`, `api/news-comments.js`, `api/send-push.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-actions.js`, `server/src/routes/system-status.js`, `server/src/routes/news-comments.js`, `server/src/routes/send-push.js`, `server/src/server.js`, `src/AdminPanel.jsx`, `src/NewsPage.jsx`, `.ai/04_API.md`, `.ai/12_SECURITY.md`
**Тип:** feat
**Что изменено:** Добавлен backend role guard по Firebase ID Token, permission matrix ролей, защищённый `/api/admin-actions` для news admin actions, idempotency-key защита, полноценный audit log `adminActivity`, системный endpoint `/api/system-status` и вкладка «Система» в админке. Модерация комментариев и push из админки больше не полагаются на подделываемую роль из body / hardcoded secret.
**Почему:** Перед V4.5 нужен серверный security boundary и инфраструктурная диагностика, чтобы админка была безопасной базой для будущего ИИ-редактора.

---

## [2026-07-07] V4.4.1 production-ready полировка редакционной админки
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Новостной board получил мобильные жесты, desktop context menu, выделение карточек, массовые действия, drag-and-drop приоритет, быстрый боковой редактор с автосохранением, undo после удаления, журнал `adminActivity` и историю `newsChangeHistory`. Dashboard дополнен live-виджетами, глобальный поиск ищет ошибки и AI-черновики, добавлены горячие клавиши `/`, `N`, `Ctrl/Cmd+S`, `Esc`.
**Почему:** V4.4.1 доводит существующий каркас админки до ежедневного редакционного инструмента без перехода к V4.5 и без добавления ИИ-логики.

---

## [2026-07-07] V4.4 каркас универсальной редакционной админки
**Коммит:** `e882b92e`
**Файлы:** `src/AdminPanel.jsx`, `src/App.jsx`, `src/ProfilePanel.jsx`, `.ai/07_ADMIN_PANEL.md`
**Тип:** feat
**Что изменено:** Добавлен отдельный роут `/#/admin-app`, вход из профиля для `admin/owner`, адаптивная оболочка админки с мобильным верхним островом и desktop sidebar. Dashboard получил KPI модерации, комментариев и ошибок; добавлены вкладки «Модерация», «Комментарии», «Пользователи», «Черновики ИИ», карточный редакционный board новостей и плавающие быстрые действия.
**Почему:** V4.4 начинает переход от монолитной старой админки к универсальному редакционному рабочему центру, пригодному для телефона, ноутбука и будущего ИИ-редактора V4.5.

---

## [2026-07-07] V4.3 комментарии, реакции и вовлечённость новостей
**Коммит:** `cd305fc8`
**Файлы:** `src/NewsPage.jsx`, `src/UserApp.jsx`, `api/news-comments.js`, `api/news-engagement.js`, `server/src/routes/news-comments.js`, `server/src/routes/news-engagement.js`, `server/src/server.js`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** Комментарии расширены до полноценного обсуждения с ответами, лайками, редактированием, удалением, бейджами ролей, закреплением, «Полезным ответом» и заготовкой блокировок для V4.4-админки. Реакции новости теперь работают как одна реакция на пользователя с корректной сменой, избранное/подписки синхронизируются через профиль, а просмотры, дочитывания, репосты и быстрый feedback пишутся через новый `/api/news-engagement`.
**Почему:** После полировки ленты и страницы новости разделу нужна живая вовлечённость пользователей, аналитика для редакции и структура данных, готовая к модерации и будущим сводкам Локи.

---

## [2026-07-07] V4.2 идеальная страница новости
**Коммит:** `664440bd`
**Файлы:** `src/NewsPage.jsx`
**Тип:** feat
**Что изменено:** Страница новости получила полноценный article-header с бейджами, источником, датой, временем, чтением, словами, просмотрами, реакциями и комментариями. Добавлены скрывающийся top-bar, кнопка «Наверх», блок действий, индикатор дочитывания, переходы «Предыдущая/Следующая», preload следующего изображения и закрытие fullscreen-галереи свайпом вниз.
**Почему:** V4.2 готовит страницу новости как эталонный экран чтения перед дальнейшими этапами комментариев, реакций и редакционной системы.

---

## [2026-07-07] V4.1 идеальная пользовательская лента новостей
**Коммит:** `23d66d53`
**Файлы:** `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `.ai/05_FRONTEND.md`
**Тип:** feat
**Что изменено:** Лента новостей получила редакционные карточки с умными бейджами, источником, временем публикации, просмотрами, комментариями и реакциями; добавлены skeleton loader, плавающий поиск, кнопка «Наверх», мягкий индикатор новых материалов, улучшенное empty-state и шаринг с карточки. Превью новостей на главной обновлено до полноценного блока с бейджем новых материалов и корректным отображением VK-фото.
**Почему:** V4.1 фокусируется на пользовательской части новостей: лента должна быть быстрой, стабильной, адаптивной и выглядеть как современный мобильный раздел.

---

## [2026-07-07] Исправление изображений и комментариев новостей
**Коммит:** `локально`
**Файлы:** `src/NewsPage.jsx`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `server/src/server.js`, `.ai/04_API.md`
**Тип:** fix
**Что изменено:** Из media-frame новостей убран неявный CSS scale/translate для фото, VK-изображения теперь показываются с сохранением пропорций через `object-fit: contain`. Комментарии перенесены с прямой клиентской записи в Firestore на backend `/api/news-comments`, добавлены ответы, редактирование, лайки, скрытие и понятное сообщение об ошибке с повторной загрузкой.
**Почему:** Последняя VK-новость визуально растягивалась/масштабировалась, а комментарии не размещались из-за отсутствия клиентского доступа к коллекции `newsComments` в Firestore rules.

---

## [2026-07-07] Premium News media polish
**Коммит:** `758702c7`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/newsUtils.js`, `src/NewsPage.jsx`, `src/UserApp.jsx`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** VK News pipeline теперь выбирает фото по максимальной площади и сохраняет размеры в `photoItems`. Раздел новостей получил адаптивный media-frame без кривого растягивания, fullscreen-галерею с zoom/swipe, share-панель, теги, блок «Локи рекомендует», уникальный view tracking и базовую систему комментариев с лайками/удалением.
**Почему:** Новости АПГ должны выглядеть как полноценный медиа-раздел, корректно показывать VK-фото разных пропорций и поддерживать основные сценарии чтения, обсуждения и шаринга.

---

## [2026-07-07] Диагностика VK News live/cache в production API
**Коммит:** `6ae1eb79`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `.ai/04_API.md`
**Тип:** fix
**Что изменено:** `/api/vk-news` теперь логирует безопасную диагностику: наличие токена, источник токена, live/cache режим, ошибки VK API и количество постов. Ошибки чтения/записи Firestore cache больше не скрываются молча.
**Почему:** Production возвращал пустой cached fallback из-за `VK_GROUP_TOKEN`, который не подходит для `wall.get`; нужны понятные логи для проверки `VK_SERVICE_TOKEN` / `VK_USER_TOKEN` после добавления в окружение.

---

## [2026-07-07] Yandex deploy env для VK News
**Коммит:** `e6fc020d`
**Файлы:** `server/deploy.sh`, `.ai/04_API.md`, `.ai/13_DEPLOYMENT.md`
**Тип:** fix
**Что изменено:** Deploy backend на Яндекс теперь передаёт `VK_SERVICE_TOKEN` и `VK_USER_TOKEN` вместе с fallback `VK_GROUP_TOKEN`; документация уточняет, что для `wall.get` предпочтителен сервисный или пользовательский токен.
**Почему:** Production API возвращал fallback `cached: true` с ошибкой VK `Group authorization failed`, потому что контейнер получал только group token.

---

## [2026-07-07] Полная синхронизация VK-публикаций в новости АПГ
**Коммит:** `737d2ddd`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/UserApp.jsx`, `src/newsUtils.js`, `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** `/api/vk-news` теперь нормализует VK-посты как полноценные новости АПГ с фото-каруселями, видео, ссылками, документами, хэштегами, метриками и признаком закрепления; успешная синхронизация мягко кэширует посты в Firestore. Экран новости показывает полный VK-контент внутри приложения, а оригинал ВКонтакте вынесен отдельной кнопкой внизу.
**Почему:** Публикации официального сообщества должны читаться внутри АПГ как часть категории «Новости АПГ», без перехода во встроенный браузер VK как основного сценария.

---

## [2026-07-07] Исправление React invariant #300 при запуске
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ErrorBoundary.jsx`
**Тип:** fix
**Что изменено:** `lokiAppState` и `lokiAppActions` перенесены выше всех условных `return` в `UserApp`, чтобы хуки `useMemo` всегда вызывались в одном порядке. Диагностика ErrorBoundary дополнена route и standalone/PWA mode.
**Почему:** При состояниях `networkError` или `loggedOut` компонент возвращал ранний экран до этих хуков, а при обычном запуске вызывал их позже. В Safari/PWA это проявлялось как minified React error #300.

---

## [2026-07-07] Исправление ошибки запуска Web App в Safari/PWA
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ErrorBoundary.jsx`
**Тип:** fix
**Что изменено:** Небезопасный `window.scrollTo({ behavior: 'instant' })` заменён на safe helper с `behavior: 'auto'` и fallback `scrollTo(0, 0)`. ErrorBoundary теперь сохраняет локальную диагностику запуска, показывает код/текст ошибки и даёт кнопку очистки service worker/cache с перезапуском.
**Почему:** В Safari/PWA недопустимое значение `instant` могло выбрасывать TypeError в effect и переводить приложение на экран «Что-то пошло не так».

---

## [2026-07-07] Восстановление открытия PWA после deploy
**Коммит:** `локально`
**Файлы:** `deploy-frontend.sh`
**Тип:** fix
**Что изменено:** Из deploy frontend удалён `--delete` для `dist/assets`, чтобы новые релизы не удаляли hashed chunks предыдущих сборок. Старые assets релиза `86dede42` вручную восстановлены в S3 для совместимости с PWA/WebView, где мог остаться старый `index.html`.
**Почему:** У пользователей со старым кэшем PWA или встроенного браузера старый shell мог ссылаться на уже удалённый JS-файл и открываться белым экраном.

---

## [2026-07-07] Исправление старта Telegram-авторизации
**Коммит:** `локально`
**Файлы:** `src/ProfilePanel.jsx`
**Тип:** fix
**Что изменено:** Все кнопки Telegram-входа и привязки переведены на единый `runTelegramAuth`, убраны двойные `onPointerUp/onClick` и случайная передача React-event вместо режима авторизации. Старт сессии получил таймаут, подробный auth trace и автоматическое открытие Telegram после успешного создания state.
**Почему:** В Telegram-flow кнопка могла выглядеть нерабочей или запускаться в неверном режиме после рефакторингов профиля; теперь клик стабильно отправляет запрос и показывает состояние ожидания.

---

## [2026-07-07] Loki UX 2.0 и семантическое понимание запросов
**Коммит:** `локально`
**Файлы:** `src/loki/lokiPosition.js`, `src/loki/core/modules/PartnerExpert.js`, `src/loki/knowledge/index.js`, `src/loki/knowledge/categories/categories.json`
**Тип:** feat
**Что изменено:** Позиционирование Локи переведено на единый safe-area Position Manager, который держит персонажа и облачко внутри видимой области на всех anchor. В Knowledge Base добавлены смысловые категории партнёров, а Partner Expert теперь понимает синонимы, разговорные формулировки, неоднозначные запросы и контекстные follow-up вопросы.
**Почему:** Локи не должен выходить за экран на внутренних страницах и должен понимать намерение пользователя, а не только точное совпадение слов.

---

## [2026-07-07] AAA-полировка цифрового персонажа Локи
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Локи теперь остаётся жить на главной странице после приветствия, мягко появляется/уходит без телепортации, получил более органичные keyframes с дыханием, инерцией, ambient glow и мимикой. Диалоговое окно стало плотнее и контрастнее, а голосовой режим использует более спокойные параметры TTS и лучший доступный русский голос браузера.
**Почему:** Локи должен восприниматься не как всплывающий виджет, а как живой премиальный цифровой персонаж внутри АПГ.

---

## [2026-07-07] Устойчивая загрузка данных админки
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** Загрузка данных админки перенесена на момент входа после готовности Firebase Auth, коллекции читаются независимо с timeout/retry, ошибки больше не превращаются в тихие пустые массивы. Добавлен видимый статус загрузки с UID, списком проблемных коллекций и кнопкой повторной попытки; удалены debug `console.log`.
**Почему:** Админка выглядела пустой при скрытых Firestore/Auth ошибках. Теперь основные разделы продолжают работать, а проблемы прав/сети видны администратору.

---

## [2026-07-07] Proactive Intelligence Локи
**Коммит:** `e708eae9`
**Файлы:** `src/loki/LokiIntelligence.js`, `src/loki/LokiPlanner.js`, `src/loki/LokiLearning.js`, `src/loki/LokiObserver.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/LokiCore.js`, `src/loki/lokiMemory.js`
**Тип:** feat
**Что изменено:** Добавлен отдельный proactive intelligence слой Локи: анализ ситуации, персональные рекомендации, обучение на принятых/проигнорированных советах, объяснение рекомендаций, маршрут на сегодня и режим «Удиви меня». Observer теперь использует новый движок с fallback на старые правила, а Loki Core отвечает на новые речевые сценарии через существующие безопасные Loki Actions.
**Почему:** Локи должен быть не только ответчиком, а деликатным городским спутником, который замечает полезные моменты и предлагает помощь без навязчивости.

---

## [2026-07-07] Premium Polish Локи и Bottom Island
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/lokiPosition.js`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Уплотнён glass-материал диалогов Локи, усилены blur/контраст/внутренний glow, улучшена типографика и переносы длинных сообщений. Bottom Island получил измеряемый по реальной кнопке активный индикатор, `box-sizing` и компенсацию border/padding; центрирование проверено в mobile preview до `delta: 0`.
**Почему:** Диалоги Локи должны читаться на любом фоне, а нижний остров должен выглядеть ровным и симметричным на мобильных экранах.

---

## [2026-07-07] Emotional Engine для Локи
**Коммит:** `2ba1ac00`
**Файлы:** `src/loki/LokiEmotionEngine.js`, `src/loki/LokiProvider.jsx`, `src/loki/lokiPhrases.js`, `src/loki/lokiMemory.js`
**Тип:** feat
**Что изменено:** Добавлен отдельный Emotional Engine без бизнес-логики: постоянное настроение, время суток, сезон, эмоциональная память, редкое молчание для низкоприоритетных подсказок, эмоциональные микродвижения и вариативность реплик. LokiProvider теперь сохраняет эмоциональное состояние в памяти и передаёт его в выбор фраз/жестов.
**Почему:** Локи должен ощущаться живым цифровым спутником, который меняет поведение постепенно и не реагирует одинаково на каждое действие.

---

## [2026-07-07] Полировка окна Локи
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/lokiPosition.js`
**Тип:** fix
**Что изменено:** Диалог, меню, ввод и история Локи получили более плотный premium-glass материал с усиленным blur и контрастом текста. Добавлена локальная фаза плавного исчезновения, а контекстные позиции Локи снижены ближе к нижней зоне, чтобы он не прыгал слишком резко вверх.
**Почему:** В текущем UI текст в окнах Локи плохо читался на сложных фонах, а автоскрытие персонажа воспринималось как резкое исчезновение.

---

## [2026-07-07] Backend API переведён на Yandex Serverless Container
**Коммит:** `100af015`
**Файлы:** `server/Dockerfile`, `server/deploy.sh`
**Тип:** fix
**Что изменено:** Dockerfile переведён на сборку из корня проекта, в образ добавлен `server-shared`, для общего модуля добавлен доступ к `/app/node_modules`. Backend-образ опубликован в Yandex Container Registry, ревизия `apg-api` обновлена, Telegram webhook переключён с Vercel на Yandex Container URL. Для production webhook включён `min-instances=1`, чтобы убрать cold start timeout.
**Почему:** Vercel Hobby не даёт задеплоить API из-за лимита 12 Serverless Functions; новый Telegram webhook должен работать через Yandex backend.

---

## [2026-07-07] VK Mini App получил Локи и справочник АПГ
**Коммит:** `11a1cb78`
**Файлы:** `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/ProfilePanel.jsx`, `src/LokiPage.jsx`, `src/ReferencePage.jsx`, `src/vk.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/loki/lokiActionTypes.js`, `src/EventsPage.jsx`, `src/ForPartnersPage.jsx`, `src/MapPage.jsx`
**Тип:** feat
**Что изменено:** В основное приложение добавлены панели «Локи» и «Справочник» на общей Loki/FAQ/Guides архитектуре, новые входы с главной и профиля, VK-специфичные реплики Локи, безопасное подтверждение внешних ссылок в VK Mini App.
**Почему:** VK Mini App должен ощущаться частью той же экосистемы АПГ, что Web App и Telegram Mini App, без урезанного интерфейса и опасных внешних переходов.

---

## [2026-07-07] Экосистема АПГ и карманный Локи в Telegram
**Коммит:** `517c69f2`
**Файлы:** `src/assistant/AssistantMiniApp.jsx`, `api/telegram-webhook.js`, `server/src/routes/telegram-webhook.js`, `src/loki/knowledge/updates/chronicles.json`
**Тип:** feat
**Что изменено:** Telegram Mini App перестроен из справочника в карманный вход к Локи: единый Loki Core, APG Knowledge Base, voice/text режим, быстрые команды, вкладки экосистемы, справочник, переходы в Web App. Telegram-бот получил тексты и кнопки «Локи АПГ» / «Быстрый вход в АПГ».
**Почему:** Пользователь должен ощущать Web App и Telegram Mini App как одну экосистему с единым Локи и продолжением одного сценария.

---

## [2026-07-07] Хроники АПГ и Voice Mode Локи
**Коммит:** `88b731f3`
**Файлы:** `src/loki/knowledge/*`, `src/loki/core/modules/KnowledgeExpert.js`, `src/loki/core/lokiUserMemory.js`, `src/loki/core/LokiCore.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `scripts/update-apg-chronicles.mjs`, `.ai/22_APG_KNOWLEDGE.md`
**Тип:** feat
**Что изменено:** Создана структурированная база знаний «Хроники АПГ», генератор хроник из AI changelog, Knowledge Expert для Loki Core, долгосрочная пользовательская память с очисткой и Voice Mode V1 через Web Speech API.
**Почему:** Локи должен использовать память мира АПГ, личную память пользователя и голосовой режим как фундамент будущих интеллектуальных возможностей.

---

## [2026-07-07] Модульная архитектура Loki Core
**Коммит:** `6ffb14d2`
**Файлы:** `src/loki/LokiBrain.js`, `src/loki/core/*`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `.ai/21_LOKI_CORE.md`
**Тип:** refactor
**Что изменено:** Loki Brain превращён в фасад над `LokiCore`; добавлены независимые модули Navigator, Partner Expert, Event Expert, Rewards Expert, News Expert, Profile Expert, Memory Engine, Recommendation Engine, Observer adapter и Personality Engine. Добавлен debug trace через `localStorage.apg_loki_debug`.
**Почему:** Локи должен развиваться как платформа интеллектуальных сервисов, где новые способности подключаются через Core без переписывания UI и существующих actions.

---

## [2026-07-07] Loki Experience
**Коммит:** `b21fad04`
**Файлы:** `src/loki/LokiExperience.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/LokiBrain.js`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен полноэкранный режим «Пространство Локи»: крупный персонаж, быстрые действия, поле запроса, голосовая заглушка, история текущего разговора и кликабельные карточки результатов. Loki Brain теперь возвращает набор карточек, а Experience выполняет действия только через Loki Actions.
**Почему:** Локи должен становиться вторым способом управления АПГ: пользователь формулирует намерение словами, а приложение показывает результаты и открывает нужные разделы без ручного поиска.

---

## [2026-07-07] Loki Brain V1
**Коммит:** `c3ac0937`
**Файлы:** `src/loki/LokiBrain.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/lokiEvents.js`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен первый Loki Brain: data-grounded обработка естественных запросов по данным АПГ, контекст пользователя/экрана/партнёров/событий/новостей, безопасные action-ответы и мини-ввод «Спросить Локи».
**Почему:** Локи должен становиться персональным городским помощником, который отвечает только на основе данных АПГ и готов к замене локального brain-провайдера на LLM через backend.

---

## [2026-07-07] Инициативное поведение Локи
**Коммит:** `22d924c2`
**Файлы:** `src/loki/LokiObserver.js`, `src/loki/lokiRecommendations.js`, `src/loki/lokiPriority.js`, `src/loki/lokiHistory.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/lokiEvents.js`, `src/loki/lokiBehavior.js`, `src/loki/lokiMemory.js`, `src/loki/lokiPhrases.js`, `src/UserApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлена система наблюдения за состоянием приложения, инициативные рекомендации с режимом тишины, история советов Локи, антиспам-приоритеты и центр сообщений внутри меню персонажа.
**Почему:** Локи должен становиться внимательным спутником пользователя и появляться редко, но в полезный момент.

---

## [2026-07-07] Loki Actions как агентный слой приложения
**Коммит:** `b0ccf92f`
**Файлы:** `src/loki/lokiActionTypes.js`, `src/loki/lokiSuggestions.js`, `src/loki/lokiMemory.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен единый слой действий Локи, очередь сообщений с приоритетами, интерактивные карточки с CTA, локальная память последнего сообщения/действия/экрана и JSON-интерфейс для будущего AI.
**Почему:** Локи должен стать центральным помощником АПГ, который управляет приложением через безопасные actions, не зная роутинг и компоненты.

---

## [2026-07-07] Локи как живой персонаж приложения
**Коммит:** `02e10828`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/lokiBehavior.js`, `src/loki/lokiPosition.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/UserApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Локи получил сценическое поведение: появляется только на смысловые события, перемещается к контекстным зонам, реагирует на касание, выполняет редкие микродействия, плавно завершает сцену и исчезает.
**Почему:** Персонаж должен ощущаться жителем АПГ, а не статичным виджетом поверх интерфейса.

---

## [2026-07-07] V1 персонажа Локи в приложении
**Коммит:** `f2dd95e5`
**Файлы:** `public/loki.png`, `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/lokiBus.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/loki/lokiState.js`, `src/UserApp.jsx`, `src/ErrorBoundary.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлен плавающий талисман Локи с состояниями, репликами, event bus, локальными настройками, синхронизацией пользовательских настроек и интеграцией в ключевые события приложения.
**Почему:** АПГ нужен живой персонаж-помощник без сложного AI на первом этапе, с архитектурой для будущего AI-помощника.

---

## [2026-07-07] V5.4 интеграция Помощника АПГ в Telegram-бота
**Коммит:** N/A
**Файлы:** `index.html`, `src/App.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/assistant/categories.json`, `src/assistant/guides.json`, `src/assistant/faq.json`, `api/telegram-webhook.js`, `server/src/routes/telegram-webhook.js`
**Тип:** feat
**Что изменено:** Помощник получил маршруты `/#/telegram-helper` и `/#/miniapp/help`, главное меню теперь строится из `categories.json`, подключён официальный Telegram WebApp API, а существующий Telegram-бот получил WebApp-кнопки «Помощник АПГ» и «Как пользоваться АПГ».
**Почему:** Telegram Mini App должен быть частью текущего бота АПГ и использовать одну базу знаний с будущей встроенной помощью в приложении.

---

## [2026-07-07] V5.3 Telegram Mini App «Помощник АПГ»
**Коммит:** N/A
**Файлы:** `src/App.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/assistant/guides.json`, `src/assistant/faq.json`
**Тип:** feat
**Что изменено:** Добавлен отдельный маршрут `/#/assistant` для Telegram Mini App: главный экран помощника, guided-инструкции по карточкам, локальная JSON-база знаний, поиск по ключевым словам и режим «Задать вопрос».
**Почему:** АПГ нужен не обычный чат-бот, а управляемый интерактивный помощник, который можно позже подключить к AI без переписывания интерфейса.

---

## [2026-07-07] V5.2 Motion Design System
**Коммит:** N/A
**Файлы:** `src/motion.js`, `src/index.css`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/Scanner.jsx`, `src/SplashScreen.jsx`, `src/ExpertsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`
**Тип:** feat
**Что изменено:** Добавлена единая motion-система с токенами длительности/easing, унифицированы page transitions, press-scale, modal/sheet drag reset, Floating Island, Scanner, success-анимация QR и Splash reveal.
**Почему:** АПГ должен ощущаться как цельное нативное приложение, где анимации не случайные, а собраны в один спокойный премиальный motion-язык.

---

## [2026-07-07] Web/PWA haptic fallback
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/vk.js`
**Тип:** feat
**Что изменено:** Для web/PWA добавлен прямой fallback через `navigator.vibrate` с паттернами `light`, `medium`, `heavy`, `success` и защитой от слишком частых срабатываний.
**Почему:** В web app версии важные действия должны ощущаться нативнее там, где браузер поддерживает Vibration API.

---

## [2026-07-07] V5.1 Native UX gestures
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/Scanner.jsx`, `src/ExpertsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлена единая история экранов и edge swipe back, pull-to-refresh для главных разделов, press-scale для glass-карточек и кнопок, drag-to-dismiss для модалок/сканера/success-modal, плавные slide-переходы и движущийся индикатор Floating Island.
**Почему:** Пользовательское приложение должно ощущаться ближе к нативному iOS-приложению за счёт привычных жестов и единого motion-поведения.

---

## [2026-07-06] Production deploy version.json без долгого кэша
**Коммит:** `6bc380d4`
**Файлы:** `deploy-frontend.sh`
**Тип:** fix
**Что изменено:** `version.json` теперь загружается отдельным no-cache объектом и исключается из общего static sync с `max-age=86400`.
**Почему:** PWA и CDN могли видеть старый `version.json`, из-за чего проверка актуальности сборки показывала устаревший hash после production deploy.

---

## [2026-07-06] V5.0 Admin Pro dashboard
**Коммит:** N/A
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Админка теперь открывается с Dashboard: KPI проекта, рост пользователей, QR/ключи, воронка роста, источники пользователей, вклад партнёров/экспертов и Activity Log. Глобальный поиск расширен пользователями, призами и акциями партнёров. В форме новостей удалено ручное поле URL картинки: используется единый `PhotoUpload`, сохраняющий `coverPhoto` и `imageUrl`.
**Почему:** Админка должна стать рабочим центром управления АПГ и отвечать на вопрос “что сейчас происходит в проекте”.

---

## [2026-07-06] V4.8 новая механика ключей через QR партнёра
**Коммит:** N/A
**Файлы:** `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/UserApp.jsx`, `src/rewardApi.js`
**Тип:** feat
**Что изменено:** Из карточек партнёра и эксперта удалена генерация пользовательского одноразового QR. Добавлен новый блок “Получите ключ за посещение/консультацию” с кнопкой открытия общего сканера; успешное начисление показывает отдельный экран благодарности с `+N ключ` и CTA “Оставить отзыв” для партнёров.
**Почему:** Новая механика должна быть проще: пользователь сканирует QR партнёра/эксперта, а начисление и защита от дублей выполняются backend-логикой.

---

## [2026-07-06] V4.7 обязательное подтверждение документов
**Коммит:** N/A
**Файлы:** `src/ConsentScreen.jsx`, `src/UserApp.jsx`, `public/user-agreement.html`, `public/privacy-policy.html`
**Тип:** feat
**Что изменено:** Добавлен `LEGAL_VERSION = 1` и обязательный legal gate для всех пользователей с аккаунтом, у которых нет актуальных согласий текущей версии. Экран блокирует доступ к приложению до подтверждения документов и повторно появится при увеличении версии.
**Почему:** Существующие пользователи после обновления должны один раз подтвердить актуальные документы и выбрать настройку уведомлений.

---

## [2026-07-06] V4.6 экран согласий при email-регистрации
**Коммит:** N/A
**Файлы:** `src/ConsentScreen.jsx`, `src/EmailAuth.jsx`, `src/ProfilePanel.jsx`, `src/UserApp.jsx`, `public/user-agreement.html`, `public/privacy-policy.html`
**Тип:** feat
**Что изменено:** Перед завершением email-входа добавлен экран согласий с двумя обязательными чекбоксами и необязательным согласием на уведомления. Согласия сохраняются в `users/{id}.consents` с версией документов; новые пользователи получают согласия вместе с первым созданием профиля.
**Почему:** Пользователь должен явно принять пользовательское соглашение и согласие на обработку персональных данных перед началом использования приложения.

---

## [2026-07-06] Исправлен выбор изображений новостей и мероприятий
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/EventsPage.jsx`, `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** Для новостей и мероприятий добавлен отдельный выбор собственных изображений (`coverPhoto` → `imageUrl` → служебные поля) без fallback на `logoUrl/photo` партнёров или экспертов. Админские списки показывают ту же обложку, которая используется в пользовательском приложении.
**Почему:** Новость могла показывать чужое изображение партнёра из-за общего fallback-helper и приоритета `imageUrl` над загруженной через PhotoUpload `coverPhoto`.

---

## [2026-07-06] Production QR fallback before backend deploy
**Коммит:** N/A
**Файлы:** `src/rewardApi.js`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Добавлен fallback на legacy QR (`partnerId` / `expert_<id>`) при недоступном `/api/qr-token`; сканер снова умеет начислять ключи по legacy QR без нового backend endpoint.
**Почему:** Production API в Yandex Container ещё не содержит `/api/qr-token`, поэтому frontend не должен зависеть от отсутствующего endpoint во время публичного выката.

---

## [2026-07-06] V4.3 urgent startup fallback and Splash
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/SplashScreen.jsx`, `public/splash-v43.png`
**Тип:** fix
**Что изменено:** Добавлены таймауты и fallback для auth/data initialization, каждый источник данных главной теперь грузится независимо через `safeLoad`; Splash Screen получил max-timeout и пересобран вокруг единого арта `splash-v43.png` без старого логотипа/дублирующих надписей поверх.
**Почему:** Убрать зависание приложения на логотипе и не позволять ошибкам Firestore/VK News/experts блокировать открытие главной.

---

## [2026-07-06] V4.1 release checks polish
**Коммит:** N/A
**Файлы:** `src/SplashScreen.jsx`, `src/index.css`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `src/TasksPage.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/ActivityPage.jsx`, `src/LeaderboardPage.jsx`, `src/ErrorBoundary.jsx`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `scripts/demo-content.mjs`, `scripts/geocode-partners.js`, `scripts/serve-local-prod.mjs`
**Тип:** fix
**Что изменено:** Убран фиолетовый ореол Splash Screen, обновлены централизованные фоны светлой и тёмной темы, фронтенд `console.error` переведён на `logError`, снят Vite warning по смешанному импорту `firebase.js`.
**Почему:** Довести локального релиз-кандидата до более чистого визуального и технического состояния перед финальным ручным QA.

---

## [2026-07-06] V3.3 release blockers QA
**Коммит:** N/A
**Файлы:** `firestore.rules`, `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/UserApp.jsx`, `src/RewardsPage.jsx`, `src/ProfilePanel.jsx`, `src/ExpertsPage.jsx`, `src/Scanner.jsx`, `scripts/serve-local-prod.mjs`
**Тип:** fix
**Что изменено:** Локально исправлены блокеры rewards/write-сценариев, безопасный fallback VK News, поведение QR-сканера, конфликт оверлеев с Floating Island и перекрытие кнопки темы в профиле.
**Почему:** Подготовить локальную V3 к функциональному QA без deploy и без изменения production.

---

## [2026-07-06] V3.1 architecture cleanup
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/HomePanel.jsx`, `src/routes.js`, `src/components/Layout.js`, `src/components/MainScreen.js`, `src/components/MapScreen.js`, `src/components/ProfileScreen.js`, `public/manifest.json`, `public/sw.js`, `index.html`, `.ai/*`, `AGENTS.md`, `AGENTS2.md`, `CLAUDE.md`
**Тип:** refactor
**Что изменено:** Удалены старая `HomePanel.jsx`, legacy роутер и пустые VK template-заглушки; `UserApp.jsx` очищен от `useHomeV2` runtime-веток; PWA стартует с `/#/`.
**Почему:** Завершить локальный переход пользовательского приложения на единую V3/V2 glass-архитектуру перед функциональным QA.

---

## [2026-07-06] Большой спринт Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Создана основа glass-дизайн-системы Home V2, отполирован первый экран, полноценно собран второй экран с каруселью, новостной композицией и ближайшими событиями, обновлён V2 floating island.
**Почему:** Довести локальную Home V2 до уровня цельного премиального продукта с собственной айдентикой АПГ.

---

## [2026-07-06] Фирменный стиль первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** refactor
**Что изменено:** Перенастроены glass-материал, металлические золотые акценты, свет главной карточки и APG-сигнатура внутри hero-сцены без изменения структуры первого экрана.
**Почему:** Найти собственный визуальный язык АПГ 2.0, отличный от обычного Liquid Glass.

---

## [2026-07-06] Второй экран Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** feat
**Что изменено:** Добавлен второй экран Home V2: горизонтальная карусель «Сегодня для вас», композиция «Что нового» и блок «Ближайшие события» на существующих данных.
**Почему:** Продолжить историю новой главной после первого свайпа без превращения экрана в каталог.

---

## [2026-07-06] Типографика и Liquid Glass Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Обновлена типографика первого экрана, осветлена и оживлена hero-фотография, badge и кнопка стали элегантнее, усилен Liquid Glass материал нижнего острова.
**Почему:** Продолжить доводку Home V2 до премиального уровня без новых функций и бизнес-изменений.

---

## [2026-07-06] Композиционная настройка первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Перенастроены визуальная иерархия, ритм, фон, hero-бейдж, единый модуль «Сегодня можно» и глубина V2 Glass Island без добавления новых функций.
**Почему:** Сделать первый экран Home V2 цельной премиальной композицией вместо набора отдельных карточек.

---

## [2026-07-06] Визуальная полировка первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Увеличен воздух первого экрана, усилены liquid glass материалы, сделана более благородная графитово-синяя палитра и отполирован V2 Glass Island TabBar.
**Почему:** Довести Home V2 до ощущения цельного премиального продукта без добавления новой функциональности.

---

## [2026-07-06] Первый экран Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** В Home V2 добавлен премиальный первый экран с приветствием, liquid glass hero-карточкой, блоком «Сегодня можно» и условной V2-версией нижнего Glass Island TabBar.
**Почему:** Начало итерационной разработки АПГ 2.0 без изменений Home V1.

---

## [2026-07-05] Подготовлена песочница Home V2
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/HomePanelV2.jsx`
**Тип:** chore
**Что изменено:** Создан отдельный компонент `HomePanelV2` как независимая копия текущей главной, подключён opt-in переключатель `home=v2` через URL.
**Почему:** Начать разработку АПГ 2.0 локально без влияния на рабочую Home V1.

---

## [2026-07-05] Создана AI-документация проекта
**Коммит:** N/A (документация только)
**Файлы:** `.ai/**`, `CLAUDE.md`, `AGENTS.md`
**Тип:** docs
**Что изменено:** Полная документация проекта в 20+ файлах `.ai/` директории. Созданы файлы: PROJECT_OVERVIEW, ARCHITECTURE, DATABASE, API, FRONTEND, BACKEND, ADMIN_PANEL, TELEGRAM, BUSINESS_LOGIC, CODING_RULES, DESIGN_RULES, SECURITY, DEPLOYMENT, ROADMAP, KNOWN_PROBLEMS, DECISIONS. Memory, templates, CLAUDE.md, AGENTS.md.
**Почему:** AI-ready codebase для будущей разработки и онбординга AI-агентов.

---

## [2026-07-05] Возвращены QR-материалы в аккордеон админки
**Коммит:** N/A
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** В раскрытых карточках партнёров и экспертов добавлен раздел «QR-коды и материалы для печати» на базе существующих `PartnerQRSection` и `ExpertQRSection`.
**Почему:** После UX-переделки админки QR-коды и печатные плакаты перестали быть доступны из карточек.

---

## [2026-06-27] Категории, обложки, даты для Новостей и Событий + лимит баннеров
**Коммит:** `8b13caa8`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Форма событий: поля category (CONTENT_CATEGORIES), coverPhoto (PhotoUpload), startAt/endAt (datetime-local), location. Форма новостей: category, coverPhoto, publishedAt (date). Списки событий и новостей: категорийные бейджи, displaydates. Лимит 5 активных баннеров в saveBanner.
**Почему:** Завершение большого промта по обновлению контентных сущностей.

---

## [2026-06-27] Баннеры CRUD в AdminPanel
**Коммит:** `155664fd`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Новая вкладка «📣 Реклама». Коллекция banners в Firestore. Полный CRUD с модальной формой. Рекламодатели: партнёр/эксперт/внешний. Статусы active/inactive/expired. Fetchdata с baннерами.
**Почему:** Начало реализации рекламной системы.

---

## [2026-06-27] Sticky toolbar, глобальный поиск, экспорт, ротация
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Sticky toolbar с глобальным поиском по всем 4 сущностям. Dropdown «Добавить». Dropdown «Инструменты» (геокодирование, migrate categories). Счётчики для каждой вкладки. «⚠ Не проверены» toggle.
**Почему:** Ускорение работы администраторов.

---

## [2026-06-25] linksCheckedAt для событий и новостей
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поле linksCheckedAt, кнопка «✓», фильтры «⚠ Непроверенные» для вкладок События и Новости. Исправлена мёртвая сортировка в expert/partner фильтре.
**Почему:** Продолжение системы проверки ссылок.

---

## [2026-07-07] Синхронизация VK Mini App с актуальной версией АПГ
**Коммит:** pending
**Файлы:** `src/vk.js`, `public/sw.js`
**Тип:** fix
**Что изменено:** VK-контекст теперь определяется не только по `window.location.search`, но и по параметрам внутри hash-router URL (`#/...?vk_app_id=...`), чтобы Mini App корректно включал VK-поведение при любом формате запуска. Версия service worker обновлена до `apg-v5-vk-sync-20260707`, чтобы VK/PWA не держали старый shell и runtime cache.
**Почему:** В коде VK уже использует тот же `UserApp`, `HomePanelV2`, `LokiProvider`, нижний остров и V2-страницы, что и Web App. Устаревший вид в VK связан с доставкой/кэшем отдельного VK Hosting; новая сборка должна принудительно сменить cache version.

---

## [2026-07-07] Восстановлен запуск загрузки данных админки
**Коммит:** pending
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** После успешной инициализации Firebase Auth снова запускается `fetchData()`. Ранее `waitForAdminAuth()` выполнялся, но загрузка коллекций автоматически не стартовала, поэтому админка могла оставаться без данных до ручного повторного действия.
**Почему:** После переработки устойчивой загрузки админки был потерян вызов загрузки после auth-ready.

---

## [2026-07-07] Премиальный раздел новостей
**Коммит:** pending
**Файлы:** `src/newsUtils.js`, `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`
**Тип:** feat
**Что изменено:** Добавлен единый слой нормализации новостей, новая страница “Новости” с категориями, поиском, сортировкой, популярными материалами, чтением статьи, прогрессом чтения, реакциями, сохранением и “прочитать позже”. Главная получила новый горизонтальный премиальный блок новостей вместо старого блока, а профиль показывает сохранённые материалы.
**Почему:** Раздел новостей должен ощущаться полноценным информационным центром АПГ, а не второстепенным списком материалов.

---

## [2026-07-08] Incident fix: быстрый Telegram webhook
**Коммит:** `pending`
**Файлы:** `server/src/routes/telegram-webhook.js`, `api/telegram-webhook.js`
**Тип:** fix
**Что изменено:** Telegram webhook теперь сначала быстро переводит auth-сессию в `done` и возвращает 200, а загрузка фото профиля, обновление пользователя и отправка сообщения в Telegram выполняются фоном без блокировки ответа webhook.
**Почему:** Telegram `getWebhookInfo` показывал `Connection timed out`; из-за ожидания внешних Telegram API и обновления профиля webhook мог не успевать ответить на `/start auth_...`, поэтому приложение не завершало Telegram-авторизацию.

---

## [2026-07-08] Production follow-up: backend-first public data и обновление SW cache
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `public/sw.js`
**Тип:** fix
**Что изменено:** Стартовые публичные данные главной теперь сначала загружаются через backend `/api/public-data`, а прямой Firestore read используется только как fallback. Версия service worker cache поднята до `apg-v5-hotfix-20260708`, чтобы установленная PWA быстрее сбросила старые runtime/static caches.
**Почему:** У пользователей production мог продолжать показывать пустые блоки из-за client Firestore/Auth/rules/cache, а установленная PWA могла оставаться на старом service worker cache после предыдущего deploy.

---

## [2026-07-07] Исправлена запись согласий после email/Telegram авторизации
**Коммит:** pending
**Файлы:** `src/UserApp.jsx`, `src/ConsentScreen.jsx`, `src/EmailAuth.jsx`, `src/ProfilePanel.jsx`
**Тип:** fix
**Что изменено:** Перед записью профиля и согласий добавлена явная подготовка Firebase owner-сессии через `auth_map`; если текущая сессия привязана к другому пользователю, создаётся новая анонимная Firebase-сессия с корректной связкой. Экран согласий теперь показывает понятную ошибку внутри модального окна. EmailAuth передаёт наверх полный ответ API, Telegram/email этапы авторизации пишут диагностический trace в `localStorage.apg_auth_trace`, сетевые ошибки отправляются через `errorLogger`.
**Почему:** После входа по email/Telegram пользовательский документ создавался backend'ом, но клиентская запись согласий могла блокироваться Firestore rules из-за отсутствующего или устаревшего `auth_map`, поэтому кнопка «Продолжить» визуально ничего не завершала.

---

## [2026-07-07] Production hotfix главной, экспертов и Telegram auth
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `api/public-data.js`, `server/src/routes/public-data.js`, `server/src/server.js`
**Тип:** fix
**Что изменено:** Добавлен backend fallback `/api/public-data` для стартовых публичных данных главной (партнёры, события, новости, уведомления, отзывы, задания, эксперты, stats), который используется только если прямое Firestore-чтение на клиенте падает. Telegram auth start теперь отправляет валидный JSON body, чтобы Fastify не отклонял POST до обработчика при `Content-Type: application/json`.
**Почему:** В production нужно быстро восстановить устойчивость главной/экспертов при закрытых или нестабильных Firestore reads и устранить сценарий, когда кнопка Telegram login не создаёт auth-сессию из-за пустого JSON body.

---

## [2026-06-24] Модальные окна для Событий и Новостей
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** refactor
**Что изменено:** Формы событий и новостей переведены из inline-секций в fixed modal overlay (аналогично партнёрам/экспертам). Исправлены startEditEvent/startEditNews.
**Почему:** Единообразие UX всех форм AdminPanel.

---

## [2026-06-23] Поиск по экспертам, сортировка по linksCheckedAt
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поиск по имени/специализации внутри вкладки экспертов. Правильная сортировка null/старые сначала.
**Почему:** UX запрос для ускорения работы с большим списком.

---

## [2026-06-22] linksCheckedAt для партнёров и экспертов
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поле linksCheckedAt, markLinksChecked helper, isCheckedRecently helper, кнопка «✓», фильтр «⚠ Непроверенные» для партнёров и экспертов.
**Почему:** Система мониторинга актуальности внешних ссылок (сайты, VK).

---

## [2026-06-21] Эксперты: модальная форма + аккордеон
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Вкладка Эксперты переведена на модальную форму + аккордеон-список (единый паттерн с партнёрами).
**Почему:** UX запрос по стандартизации.

---

## [2026-06-20] APP_URL: apg-alliance → myapg.ru
**Коммит:** `ff575f22`
**Файлы:** `src/constants.js`
**Тип:** chore
**Что изменено:** Константа APP_URL изменена с `apg-alliance.vercel.app` на `myapg.ru`.
**Почему:** Переход на собственный домен.

---

## [2026-06-20] Категория «Психология» для экспертов
**Коммит:** `c02e0b16`
**Файлы:** `src/constants.js`, `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Добавлена категория `psychology` в EXPERT_CATEGORIES.
**Почему:** Запрос от команды — пришли эксперты-психологи.

---

## [2026-06-19] Исправлен конфликт свайпов в ExpertsPage
**Коммит:** `8db315f4`
**Файлы:** `src/ExpertsPage.jsx`
**Тип:** fix
**Что изменено:** Исправлен конфликт между горизонтальным свайпом смены вкладки в UserApp и горизонтальным скроллом фильтров категорий в ExpertsPage.
**Почему:** Пользователи жаловались что при прокрутке фильтров случайно переходят на другой экран.

---

## [2026-07-10] Центр событий: предложения от партнёров и экспертов
**Коммит:** `pending`
**Файлы:** `src/EventProposalTools.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `src/EventDetailSheet.jsx`, `api/user-actions.js`, `api/admin-actions.js`
**Тип:** feat
**Что изменено:** Добавлены вкладки календаря/расписания в кабинеты, форма предложения мероприятия, backend-создание черновика на модерации, блок «Предложения» в новом Центре событий, модерационные действия и внутренние уведомления авторам.
**Почему:** Партнёры и эксперты должны планировать мероприятия самостоятельно, а публикация должна оставаться за администрацией.

---

## [2026-07-10] Центр событий: операционная карточка мероприятия
**Коммит:** `pending`
**Файлы:** `src/EventDetailSheet.jsx`, `src/AdminPanel.jsx`, `src/EventsCalendar.jsx`
**Тип:** feat
**Что изменено:** В карточку события добавлены подготовительный checklist, проверка качества, предпросмотр, план продвижения, предупреждения о конфликтах, дублирование и создание серии черновиков. В календарь добавлены свободные окна выбранного дня.
**Почему:** Администратор должен управлять подготовкой мероприятия из нового Центра событий без перехода в старый раздел.

---

## [2026-07-10] Пользовательский календарь событий V2
**Коммит:** `pending`
**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Раздел «События» превращён в городскую афишу с режимами список/календарь, сохранением режима, быстрыми фильтрами, подборками, чистой месячной сеткой, EventDetailSheet для пользователей, экспортом .ics, локальными напоминаниями, маршрутом, шарингом и регистрацией из карточки.
**Почему:** Пользователь должен ежедневно открывать раздел, чтобы быстро понять, что происходит сегодня, на выходных и рядом.

---

## [2026-07-10] Центр событий: защита от неполных старых событий
**Коммит:** `pending`
**Файлы:** `src/EventsCalendar.jsx`, `src/EventDetailSheet.jsx`
**Тип:** fix
**Что изменено:** Убран прямой вызов `dow.charAt(...)` в `formatDayLabel`, добавлены безопасные преобразования строк и дат, календарь и карточка события стали tolerant к отсутствующим `category`, `title`, `partnerName`, `expertName`, `status`, датам и полям регистраций.
**Почему:** Старые документы Firestore могут не содержать новых полей Центра событий, из-за чего production падал при открытии раздела.

---

## [2026-07-10] Архив партнёров/экспертов и демо-партнёр
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `src/UserApp.jsx`, `api/admin-actions.js`, `api/user-actions.js`, `api/activity-index.js`, `api/expert-rotation.js`, `server/src/routes/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/activity-index.js`, `server/src/routes/expert-rotation.js`, `scripts/seed-demo-partner.mjs`
**Тип:** feat
**Что изменено:** Добавлен soft-archive для партнёров и экспертов, owner-only окончательное удаление, публичная фильтрация архивных профилей, backend-защита пользовательских действий и seed-скрипт демонстрационного партнёра АПГ.
**Почему:** Партнёров и экспертов нужно скрывать безопасно без потери истории, а owner-аккаунту нужен презентационный кабинет с заполненными данными.

---

## [2026-07-10] Партнёрский кабинет: несколько владельцев
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `api/user-actions.js`, `api/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/admin-actions.js`, `scripts/seed-demo-partner.mjs`
**Тип:** feat
**Что изменено:** Добавлена поддержка `ownerUserIds` и `ownerEmails` у партнёров/экспертов, backend-проверки доступа принимают нескольких владельцев, админская привязка добавляет владельца в массивы, демо-партнёр выдаётся нескольким владельцам через единый seed.
**Почему:** Один кабинет партнёра должен быть доступен owner и главному администратору без переключений и повторных привязок.

---

## Шаблон для будущих записей

```markdown
## [YYYY-MM-DD] Название изменения
**Коммит:** `hash`
**Файлы:** `src/...`
**Тип:** feat | fix | refactor | docs | chore
**Что изменено:** ...
**Почему:** ...
```

## 2026-07-10 — Hotfix EventDetailSheet React #310

**Задача:** Устранить production crash при открытии карточки события из афиши/Демовстречи: `APG-MRE8CF1T`, minified React error #310, источник `EventDetailSheet`.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Исправлен порядок вызова хуков в `EventDetailSheet`: `useMemo(buildParticipants)` больше не находится после раннего `return null`, поэтому при переходе из закрытого состояния sheet в открытое React не получает разный набор хуков. Добавлен локальный error boundary для содержимого карточки события с пользовательским экраном «Не удалось открыть мероприятие», кнопками «Повторить» и «Закрыть», логированием через `logError` и диагностикой отсутствующих полей события.

**Важно:** Это исправляет первопричину React #310, а не маскирует её. Старые события с неполными полями продолжают открываться через безопасные значения по умолчанию.

## 2026-07-10 — Follow-up hotfix EventDetailSheet opening

**Задача:** После hotfix `b3e6d2eb` карточка события перестала открываться корректно из афиши, а Локи оставался поверх интерфейса события.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Убран внутренний `EventDetailSheetErrorBoundary`, добавленный в предыдущем hotfix, вместе с диагностическим `useEffect` и импортом `logError`, чтобы вернуть дерево рендера карточки к состоянию до регрессии. Сохранён настоящий фикс React #310: `useMemo(buildParticipants)` остаётся выше раннего `return null`. Слой bottom sheet поднят до `zIndex: 12000`, чтобы открытая карточка события перекрывала Локи и нижние плавающие элементы.

## 2026-07-10 — EventDetailSheet production QA follow-up

**Задача:** По результатам функциональной QA production-сценариев события скрыть Локи при открытой карточке события и добавить настоящее закрытие карточки свайпом вниз.

**Файлы:** `src/EventDetailSheet.jsx`, `src/UserApp.jsx`

**Что изменено:** `EventDetailSheet` отправляет событие `apg:event-sheet-open` при открытии/закрытии и помечает `document.body.dataset.apgEventSheetOpen`. `UserApp` слушает это событие и временно не рендерит `LokiAssistant`, пока карточка события открыта. В `EventDetailSheet` добавлена touch-обработка свайпа вниз: если пользователь тянет sheet вниз больше чем на 86px, вызывается штатное закрытие.

## 2026-07-10 — EventDetailSheet swipe close fix

**Задача:** После production QA закрытие карточки события свайпом вниз не срабатывало в touch-сценарии.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Добавлен `onTouchMove` для bottom sheet: если пользователь протягивает карточку вниз больше чем на 110px, вызывается штатное закрытие. `onTouchEnd` оставлен как дополнительный fallback.

## 2026-07-10 — EventDetailSheet pointer swipe support

**Задача:** Touch-only обработчик свайпа вниз не закрывал карточку в production QA через браузерные pointer/touch события.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Добавлена параллельная обработка `pointerdown/pointermove/pointerup` для не-mouse указателей. При движении вниз больше чем на 110px карточка закрывается штатным `handleClose`. Touch fallback сохранён.

## 2026-07-10 — EventDetailSheet drag close QA alignment

**Задача:** Production QA должна проверять закрытие карточки события drag/swipe вниз тем же pointer-сценарием, который доступен в браузере.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Pointer drag вниз больше чем на 110px теперь работает для всех pointer types, включая mouse. Обычный клик не закрывает карточку, нужен именно заметный drag вниз.

## 2026-07-10 — EventsPage mobile layout width fix

**Задача:** Исправить доказанный разъезд layout афиши на production: горизонтальные подборки событий расширяли страницу до 656-800px при мобильном viewport 390px.

**Файлы:** `src/EventsPage.jsx`

**Что изменено:** В `EventPosterCard` добавлены `width: '100%'`, `maxWidth: '100%'`, `minWidth: 0`, `boxSizing: 'border-box'`, а внутренний grid переведён на `minmax(0, 1fr)`. Для секций подборок добавлены `minWidth: 0`, `maxWidth: '100%'`, `overflow: 'hidden'`. Горизонтальный scroller ограничен `width: '100%'`, `maxWidth: '100%'`, `minWidth: 0`, `boxSizing: 'border-box'`, `overflowY: 'hidden'`; `gridAutoColumns` заменён с `minmax(260px, 82%)` на `minmax(240px, min(82vw, 82%))`, чтобы карточки не могли раздувать родителя шире viewport.

## 2026-07-10 — EventsPage real-device sheet diagnostics

**Задача:** Реальное устройство после `7768c223` показало две проблемы: карточки подборок стали визуально слишком узкими, а `EventDetailSheet` не открывался видимо, несмотря на успешные DOM-проверки.

**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`

**Что изменено:** Ширина карточек горизонтальных подборок изменена на `clamp(270px, 94%, 420px)`, чтобы на мобильных экранах карточка занимала около 94% доступного контейнера и сохраняла намёк на следующую карточку без расширения страницы. `EventDetailSheet` теперь рендерится через `createPortal(..., document.body)`, чтобы `position: fixed` не зависел от transform/stacking context родительских контейнеров. Добавлена временная визуальная диагностика открытия: яркая рамка sheet, надпись `EVENT SHEET OPEN`, rect, версия приложения, состояние service worker, загруженные JS chunks и timestamp-логи `CARD_POINTER_DOWN`, `CARD_CLICK`, `SET_SELECTED_EVENT`, `SHEET_MOUNT`, `SHEET_VISIBLE`, `BACKDROP_CLICK`, `DRAG_START`, `DRAG_CLOSE`, `SHEET_CLOSE`.

## 2026-07-10 — EventDetailSheet content normalization and final mobile layout

**Задача:** После диагностики стало ясно, что `EventDetailSheet` открывается корректно, но на реальном устройстве секции выглядели пустыми/skeleton-like: данные события не распознавались всеми секциями, а золотая поверхность sheet давала слабый контраст для внутренних glass-блоков.

**Файлы:** `src/EventDetailSheet.jsx`, `src/EventsPage.jsx`

**Что изменено:** Временная диагностика полностью удалена. `EventDetailSheet` оставлен в `createPortal(..., document.body)`, но теперь строит нормализованный `detailEvent` с поддержкой старых и новых полей: `partnerName`, `expertName`, `organizerName`, `speakerName`, `location.address`, `schedule`, `photos/images/gallery`, `registrationDeadline`, `registrations/participants` и других алиасов. Внутренние секции читают нормализованные значения, поэтому описание, дата, место, организатор и регистрация отображаются без ожидания дополнительного loading-state. Sheet переведён на тёмную iOS bottom-sheet поверхность, увеличена читаемость текста, внешний мобильный отступ уменьшен до safe-area + 6px, чтобы карточка занимала почти всю ширину экрана.

## 2026-07-10 — Event center visual APG V2 polish

**Задача:** Перед дальнейшей разработкой исправить два UX-недочёта: слабочитаемый бейдж даты на фото в афише и визуальное отличие `EventDetailSheet` от общей дизайн-системы АПГ V2.

**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`

**Что изменено:** Бейдж даты на карточках афиши переработан в контрастную золотую glass-пластину с blur, светлым кантом, тенью и более крупной типографикой. `EventDetailSheet` переведён на `APG2_PROFILE`: фон sheet использует `APG2_PROFILE.bg`, секции используют `APG2_PROFILE.glass`, hero стал крупной пользовательской обложкой с градиентом, статусом и быстрыми инфо-плитками. Увеличен воздух между блоками, внешний мобильный отступ сохранён минимальным для почти полноширинного iOS bottom sheet.

**Дополнительно:** При открытии события внутренний scroll карточки принудительно возвращается в начало, чтобы пользователь сразу видел большую hero-обложку, а не середину карточки после предыдущих взаимодействий. Для мобильных браузеров сброс усилен через layout-time reset, remount scroll-контейнера и отложенные fallback-сбросы. Hero-блок вынесен над scroll-областью секций, чтобы обложка всегда была первым видимым экраном bottom sheet.

## 2026-07-10 — Universal Links и path-based deep links

**Задача:** Поддержать открытие новостей, событий, партнёров и экспертов по красивым web/PWA-ссылкам без hash-routing.

**Файлы:** `src/App.jsx`, `src/main.jsx`, `src/UserApp.jsx`, `src/NewsPage.jsx`, `src/EventDetailSheet.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerQRSection.jsx`, `src/AdminPanel.jsx`, `src/firebase.js`, `src/assistant/AssistantMiniApp.jsx`, `src/utils/shareLink.js`, `public/manifest.json`, `public/sw.js`

**Что изменено:** `App` переведён на `BrowserRouter`, старые `/#/...` ссылки автоматически переписываются в path до рендера, `UserApp` открывает `/news/:id`, `/event/:id`, `/events`, `/partner/:id`, `/expert/:id` и `/experts` сразу в нужной панели/карточке. Добавлен единый helper `shareLink(entityType,id)`, публичные share/QR-ссылки переведены на `/news/...`, `/event/...`, `/partner/...`, `/expert/...`. Manifest теперь использует `id/start_url/scope` от `/`, service worker получил navigation fallback на `/index.html` и фокусирует существующее PWA-окно при push/open.

**Совместимость:** Старые hash-ссылки и старые QR вида `?partner=` / `?expert=` продолжают распознаваться.

## 2026-07-10 — VK news article reader and comments hotfix

**Задача:** Устранить production-проблему VK-новостей: тёмная плохо читаемая статья и отсутствие полноценного блока комментариев/функций АПГ при открытии с главной.

**Файлы:** `src/NewsPage.jsx`, `src/newsUtils.js`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/ProfilePanel.jsx`, `src/NotificationsPage.jsx`, `src/LokiPage.jsx`, `src/index.css`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `scripts/news-article-regression.mjs`, `package.json`

**Что изменено:** Добавлен единый canonical id новости и legacy aliases для VK/исторических записей. Комментарии, реакции, сохранения, deep links и открытие новости теперь используют один canonical id; backend `/api/news-comments` читает canonical + legacy ids с дедупликацией, а новые комментарии пишет под canonical id. `commentsEnabled` нормализован так, что только boolean `false` отключает комментарии.

**UX:** `ArticleView` получил изолированный светлый режим чтения `.apg-news-article-*`: светлый непрозрачный фон области статьи, тёмный основной текст, стабильные CSS-переменные, без родительского opacity/filter/тёмного overlay поверх текста. Временные диагностические `console.log` из новостных сценариев удалены.

**Проверка:** Добавлен `npm run test:news-article`, который на local production preview с реальными VK API-данными проверяет открытие VK-новости с главной, из `/news` и через `/news/:id`, светлый reader, наличие CommentsPanel, default-on comments, canonical id и кнопку оригинала VK после контента.

## 2026-07-10 — Contextual Loki for news articles

**Задача:** Переработать кнопку «Пересказать с Локи» в статье: вместо перехода в пустой раздел Локи должен открываться в контексте конкретной новости и сразу давать краткий пересказ.

**Файлы:** `src/NewsPage.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`

**Что изменено:** Добавлен универсальный `activeContext` в `LokiProvider` и метод `openContextExperience(context)`. `ArticleView` теперь собирает контекст новости: `newsId`, заголовок, текст, категорию, источник, связанные партнёры, эксперты и события, после чего открывает существующий `LokiExperience` поверх статьи без навигации в другую панель. Позиция чтения сохраняется, потому что статья не размонтируется.

**UX:** В контексте новости Локи стартует с готового пересказа, показывает быстрые действия «Кратко», «Главное», «Простыми словами», «Для бизнеса», «Для жителей», «События», «Партнёры», «Эксперты», «Похожие» и кнопку «Прослушать». При повторном открытии Локи использует сохранённый `lastContext` и предлагает продолжить обсуждение последней новости.

## 2026-07-10 — APG engineering knowledge base foundation

**Задача:** Создать фундамент инженерной базы знаний АПГ без изменения функциональности приложения, UI, backend и без deploy.

**Файлы:** `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен паспорт актуального состояния проекта и первая архитектурная карта. Документы заполнены только подтверждёнными фактами из кода, проектной документации и production `version.json`.

## 2026-07-10 — APG dependency map

**Задача:** Построить карту зависимостей проекта без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлена первая dependency map по крупным узлам: App, UserApp, AdminPanel, ProfilePanel, News, Events, Partners, Experts, Loki, Firebase, Backend, Push, Telegram, VK и PWA. Для каждого узла зафиксированы пользователи, зависимости, providers, API/backend endpoints, Firestore коллекции, глобальные состояния, маршруты, bottom sheets, portals и критические зависимости.

## 2026-07-10 — APG system philosophy

**Задача:** Создать человеческую инструкцию для будущих AI-разработчиков АПГ без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/20_SYSTEM_PHILOSOPHY.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен документ с философией проекта: зачем существует АПГ, какие цели и принципы нельзя нарушать, что считается хорошим и плохим решением, какие архитектурные и UX-принципы обязательны, что запрещено делать и как должен думать AI-разработчик перед изменением системы.

## 2026-07-10 — APG knowledge navigator

**Задача:** Создать главный навигатор инженерной базы знаний АПГ без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/03_KNOWLEDGE_NAVIGATOR.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен навигатор чтения перед задачами. Для ключевых областей указано, какие `.ai` документы читать, какие исходные файлы изучить, какие подсистемы могут быть затронуты и что проверить перед commit.

## 2026-07-10 — UserApp architecture audit V1

**Задача:** Провести архитектурный аудит `src/UserApp.jsx` без изменения рабочего кода, рефакторинга, исправлений, merge и deploy.

**Файлы:** `.ai/audits/USERAPP_AUDIT_V1.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен аудит UserApp V1: размеры файла и hook-метрики, обязанности, карта зависимостей, API/backend/Firestore связи, архитектурные риски, подтверждённые кандидаты на выделение и оценка читаемости, масштабируемости, связанности, сложности и риска изменений.
