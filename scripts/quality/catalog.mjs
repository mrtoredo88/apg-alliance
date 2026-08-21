export const QUALITY_ROLES = ['owner', 'admin', 'moderator', 'partner', 'expert', 'user'];

export const QUALITY_VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844, isMobile: true },
  { id: 'desktop', width: 1440, height: 1000, isMobile: false },
];

export const QUALITY_ROUTES = [
  '/', '/#/home', '/#/partners', '/#/experts', '/#/events', '/#/news',
  '/#/people', '/#/messages', '/#/profile', '/#/scanner', '/#/notifications',
  '/#/admin', '/#/health', '/admin/sales-ai', '/admin/sales-ai/agents',
];

export const CRITICAL_USER_JOURNEYS = [
  ['auth.email', 'user', 'Вход по email и восстановление сессии'],
  ['auth.telegram', 'user', 'Вход через Telegram и повторный вход'],
  ['auth.vk', 'user', 'Вход через VK и возврат в PWA'],
  ['auth.logout', 'user', 'Выход и очистка приватного состояния'],
  ['onboarding.first', 'user', 'Первый запуск и завершение знакомства'],
  ['home.open', 'user', 'Загрузка главной без критических ошибок'],
  ['catalog.partner.search', 'user', 'Поиск и открытие партнёра'],
  ['catalog.expert.search', 'user', 'Поиск и открытие эксперта'],
  ['events.open', 'user', 'Открытие списка и карточки события'],
  ['events.booking', 'user', 'Запись на событие и отмена записи'],
  ['news.open', 'user', 'Открытие новости по прямой ссылке'],
  ['qr.partner', 'user', 'Переход по QR партнёра'],
  ['qr.scan', 'user', 'Открытие сканера и обработка разрешений'],
  ['referral.open', 'user', 'Переход по реферальной ссылке'],
  ['profile.edit', 'user', 'Редактирование профиля без потери идентичности'],
  ['notifications.open', 'user', 'Открытие и прочтение уведомления'],
  ['people.connect', 'user', 'Поиск человека и создание связи'],
  ['messages.start', 'user', 'Создание и открытие диалога'],
  ['pwa.install', 'user', 'Установка PWA и автономный запуск'],
  ['navigation.history', 'user', 'Back и Forward сохраняют экран'],
  ['navigation.deep-link', 'user', 'Прямые ссылки открывают нужный экран'],
  ['workspace.partner', 'partner', 'Открытие кабинета партнёра'],
  ['workspace.expert', 'expert', 'Открытие кабинета эксперта'],
  ['workspace.content', 'partner', 'Создание черновика публикации'],
  ['admin.open', 'admin', 'Открытие административной панели'],
  ['admin.users.search', 'admin', 'Поиск пользователя по идентификаторам'],
  ['admin.users.duplicates', 'admin', 'Поиск и разбор группы дублей'],
  ['admin.users.merge', 'owner', 'Предпросмотр и объединение аккаунтов'],
  ['admin.users.archive', 'admin', 'Архивирование и восстановление аккаунта'],
  ['admin.users.delete', 'owner', 'Защищённое необратимое удаление'],
  ['admin.content', 'moderator', 'Модерация контента'],
  ['admin.partners', 'admin', 'Редактирование партнёра'],
  ['admin.experts', 'admin', 'Редактирование эксперта'],
  ['admin.events', 'admin', 'Редактирование события'],
  ['admin.permissions', 'owner', 'Проверка матрицы ролей'],
  ['admin.health', 'owner', 'Открытие APG Health и отчёта качества'],
  ['admin.sales-ai.scout', 'admin', 'Открытие Разведчика и очереди кандидатов'],
  ['admin.sales-ai.agents', 'admin', 'Открытие Коммуникатора и сводки Руководителя'],
].map(([id, role, title]) => ({ id, role, title, critical: true }));

export const SAFE_CONTROL_PATTERN = /^(отмена|закрыть|назад|готово|понятно|обновить|повторить|проверить|найти|поиск|фильтр|активные|архив|дубли|карточка)/i;
export const DANGEROUS_CONTROL_PATTERN = /(удал|объедин|архивир|сохран|опубликов|отправ|восстанов|подтверд|выйти|начисл|списать)/i;
