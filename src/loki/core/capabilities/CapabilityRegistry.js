export const CAPABILITY_CATEGORIES = {
  NAVIGATION: 'Navigation',
  BOOKING: 'Booking',
  SOCIAL: 'Social',
  PARTNER: 'Partner',
  WORKSPACE: 'Workspace',
  ADMIN: 'Admin',
  SEARCH: 'Search',
};

const CAPABILITIES = [
  { id: 'OPEN_HOME', title: 'Открыть главную', description: 'Переход на главный экран АПГ.', aliases: ['главная', 'домой', 'на главную', 'home'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: [], relatedScreens: ['home'], priority: 70, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_PROFILE', title: 'Открыть профиль', description: 'Показать профиль пользователя.', aliases: ['профиль', 'мой профиль', 'личный профиль', 'аккаунт'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['user'], relatedScreens: ['profile'], priority: 78, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_PARTNER', title: 'Открыть партнёра', description: 'Открыть карточку партнёра.', aliases: ['открой партнёра', 'карточка партнёра', 'партнёр', 'место'], requiredParameters: ['partnerId'], optionalParameters: ['locationId'], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner', 'partners'], priority: 76, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_EXPERT', title: 'Открыть эксперта', description: 'Открыть карточку эксперта.', aliases: ['открой эксперта', 'эксперт', 'специалист', 'карточка эксперта'], requiredParameters: ['expertId'], optionalParameters: [], requiredRole: 'user', requiredTools: ['expert'], relatedScreens: ['experts'], priority: 76, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_EVENT', title: 'Открыть событие', description: 'Открыть карточку мероприятия.', aliases: ['открой событие', 'мероприятие', 'афиша', 'событие'], requiredParameters: ['eventId'], optionalParameters: [], requiredRole: 'user', requiredTools: ['event'], relatedScreens: ['events'], priority: 76, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_NEWS', title: 'Открыть новость', description: 'Открыть новость или публикацию.', aliases: ['новость', 'читать новость', 'публикация', 'статья'], requiredParameters: ['newsId'], optionalParameters: [], requiredRole: 'user', requiredTools: ['news'], relatedScreens: ['news'], priority: 72, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_PROMOTION', title: 'Открыть акцию', description: 'Открыть конкретную акцию.', aliases: ['открой акцию', 'акция', 'скидка', 'предложение'], requiredParameters: ['promotionId'], optionalParameters: ['partnerId'], requiredRole: 'user', requiredTools: ['promotion'], relatedScreens: ['offers'], priority: 74, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_GIFTS', title: 'Открыть подарки', description: 'Показать подарки и призы.', aliases: ['подарки', 'призы', 'что получить', 'каталог подарков'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['gift'], relatedScreens: ['rewards'], priority: 78, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_REWARDS', title: 'Открыть награды', description: 'Показать награды, призы и вознаграждения.', aliases: ['награды', 'мои награды', 'вознаграждения', 'rewards'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['gift'], relatedScreens: ['rewards', 'profile'], priority: 82, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_KEYS', title: 'Открыть ключи', description: 'Показать баланс и способы заработать ключи.', aliases: ['ключи', 'баланс ключей', 'сколько ключей', 'заработать ключи'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['user'], relatedScreens: ['profile', 'tasks'], priority: 84, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_SETTINGS', title: 'Открыть настройки', description: 'Показать настройки пользователя.', aliases: ['настройки', 'параметры', 'preferences'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: [], relatedScreens: ['profile'], priority: 70, category: CAPABILITY_CATEGORIES.NAVIGATION },
  { id: 'OPEN_WORKSPACE', title: 'Открыть Workspace', description: 'Открыть рабочую зону партнёра или эксперта.', aliases: ['workspace', 'рабочая зона', 'кабинет', 'мой кабинет'], requiredParameters: [], optionalParameters: ['role'], requiredRole: 'partner', requiredTools: ['workspace'], relatedScreens: ['workspace', 'partner-cabinet', 'expert-cabinet'], priority: 80, category: CAPABILITY_CATEGORIES.NAVIGATION },

  { id: 'BOOK_APPOINTMENT', title: 'Записаться', description: 'Начать сценарий записи к партнёру или эксперту.', aliases: ['записаться', 'запись', 'бронь', 'прием', 'приём', 'хочу прийти', 'забронировать', 'запиши меня'], requiredParameters: ['partnerId', 'serviceId', 'date'], optionalParameters: ['expertId', 'locationId', 'time'], requiredRole: 'user', requiredTools: ['partner', 'expert', 'meeting'], relatedScreens: ['partner', 'experts', 'profile'], priority: 96, category: CAPABILITY_CATEGORIES.BOOKING },
  { id: 'VIEW_BOOKINGS', title: 'Показать записи', description: 'Показать текущие и будущие записи.', aliases: ['мои записи', 'записи', 'брони', 'забронировано', 'приёмы'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['meeting'], relatedScreens: ['profile', 'workspace'], priority: 86, category: CAPABILITY_CATEGORIES.BOOKING },
  { id: 'RESCHEDULE_BOOKING', title: 'Перенести запись', description: 'Определить намерение перенести существующую запись.', aliases: ['перенести запись', 'изменить время', 'поменять дату', 'перезаписаться'], requiredParameters: ['bookingId', 'date'], optionalParameters: ['time'], requiredRole: 'user', requiredTools: ['meeting'], relatedScreens: ['profile'], priority: 88, category: CAPABILITY_CATEGORIES.BOOKING },
  { id: 'CANCEL_BOOKING', title: 'Отменить запись', description: 'Определить намерение отменить запись.', aliases: ['отменить запись', 'убрать бронь', 'отказаться от записи', 'cancel booking'], requiredParameters: ['bookingId'], optionalParameters: [], requiredRole: 'user', requiredTools: ['meeting'], relatedScreens: ['profile'], priority: 88, category: CAPABILITY_CATEGORIES.BOOKING },

  { id: 'OPEN_DIALOG', title: 'Открыть диалог', description: 'Открыть диалог или чат.', aliases: ['диалог', 'чат', 'переписка', 'сообщения'], requiredParameters: ['dialogId'], optionalParameters: ['userId'], requiredRole: 'user', requiredTools: [], relatedScreens: ['profile'], priority: 72, category: CAPABILITY_CATEGORIES.SOCIAL },
  { id: 'SEND_MESSAGE', title: 'Отправить сообщение', description: 'Определить намерение написать сообщение.', aliases: ['написать', 'сообщение', 'отправить сообщение', 'напиши'], requiredParameters: ['recipientId', 'messageText'], optionalParameters: [], requiredRole: 'user', requiredTools: [], relatedScreens: ['profile'], priority: 72, category: CAPABILITY_CATEGORIES.SOCIAL },
  { id: 'VIEW_FRIENDS', title: 'Показать друзей', description: 'Показать друзей, знакомых или контакты.', aliases: ['друзья', 'знакомые', 'контакты', 'мои друзья'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['user'], relatedScreens: ['profile'], priority: 74, category: CAPABILITY_CATEGORIES.SOCIAL },
  { id: 'VIEW_ACTIVITY', title: 'Показать активность', description: 'Показать ленту активности.', aliases: ['активность', 'лента активности', 'что я делал', 'история действий'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['user'], relatedScreens: ['activity'], priority: 78, category: CAPABILITY_CATEGORIES.SOCIAL },
  { id: 'OPEN_FEED', title: 'Открыть ленту', description: 'Открыть общую ленту публикаций.', aliases: ['лента', 'feed', 'публикации', 'новости'], requiredParameters: [], optionalParameters: [], requiredRole: 'user', requiredTools: ['news'], relatedScreens: ['news'], priority: 72, category: CAPABILITY_CATEGORIES.SOCIAL },

  { id: 'VIEW_PARTNER_PROFILE', title: 'Профиль партнёра', description: 'Посмотреть публичный профиль партнёра.', aliases: ['профиль партнёра', 'информация о партнёре', 'о месте'], requiredParameters: ['partnerId'], optionalParameters: [], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner'], priority: 78, category: CAPABILITY_CATEGORIES.PARTNER },
  { id: 'CALL_PARTNER', title: 'Позвонить партнёру', description: 'Найти телефон и подготовить звонок.', aliases: ['позвонить', 'телефон', 'номер', 'набрать'], requiredParameters: ['partnerId'], optionalParameters: ['phone'], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner'], priority: 84, category: CAPABILITY_CATEGORIES.PARTNER },
  { id: 'BUILD_ROUTE', title: 'Построить маршрут', description: 'Построить маршрут к месту.', aliases: ['маршрут', 'как добраться', 'дорога', 'доехать', 'построить маршрут'], requiredParameters: ['partnerId'], optionalParameters: ['locationId'], requiredRole: 'user', requiredTools: ['partner', 'journey'], relatedScreens: ['map', 'nearby'], priority: 86, category: CAPABILITY_CATEGORIES.PARTNER },
  { id: 'OPEN_SITE', title: 'Открыть сайт', description: 'Открыть сайт партнёра или эксперта.', aliases: ['сайт', 'website', 'страница', 'открой сайт'], requiredParameters: ['partnerId'], optionalParameters: ['url'], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner'], priority: 72, category: CAPABILITY_CATEGORIES.PARTNER },
  { id: 'OPEN_WHATSAPP', title: 'Открыть WhatsApp', description: 'Открыть WhatsApp контакт.', aliases: ['whatsapp', 'ватсап', 'вацап', 'написать в whatsapp'], requiredParameters: ['partnerId'], optionalParameters: ['phone'], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner'], priority: 78, category: CAPABILITY_CATEGORIES.PARTNER },
  { id: 'OPEN_TELEGRAM', title: 'Открыть Telegram', description: 'Открыть Telegram контакт.', aliases: ['telegram', 'телеграм', 'тг', 'написать в телеграм'], requiredParameters: ['partnerId'], optionalParameters: ['telegram'], requiredRole: 'user', requiredTools: ['partner'], relatedScreens: ['partner'], priority: 78, category: CAPABILITY_CATEGORIES.PARTNER },

  { id: 'OPEN_ANALYTICS', title: 'Открыть аналитику', description: 'Открыть аналитику Workspace.', aliases: ['аналитика', 'статистика кабинета', 'показатели', 'метрики'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['workspace'], relatedScreens: ['workspace'], priority: 82, category: CAPABILITY_CATEGORIES.WORKSPACE },
  { id: 'OPEN_DAY_PLANNER', title: 'План дня', description: 'Открыть дневной планировщик.', aliases: ['план дня', 'расписание дня', 'day planner', 'задачи на день'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['workspace'], relatedScreens: ['workspace'], priority: 78, category: CAPABILITY_CATEGORIES.WORKSPACE },
  { id: 'OPEN_MEETINGS', title: 'Встречи', description: 'Открыть встречи и записи.', aliases: ['встречи', 'записи клиентов', 'meetings', 'календарь записей'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['meeting', 'workspace'], relatedScreens: ['workspace'], priority: 80, category: CAPABILITY_CATEGORIES.WORKSPACE },
  { id: 'OPEN_EVENTS_MANAGER', title: 'Управление событиями', description: 'Открыть управление мероприятиями.', aliases: ['управление событиями', 'менеджер мероприятий', 'создать мероприятие'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['event', 'workspace'], relatedScreens: ['workspace'], priority: 78, category: CAPABILITY_CATEGORIES.WORKSPACE },
  { id: 'OPEN_PROMOTIONS_MANAGER', title: 'Управление акциями', description: 'Открыть управление акциями.', aliases: ['управление акциями', 'менеджер акций', 'создать акцию', 'мои акции'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['promotion', 'workspace'], relatedScreens: ['workspace'], priority: 80, category: CAPABILITY_CATEGORIES.WORKSPACE },
  { id: 'OPEN_CONTENT_MANAGER', title: 'Контент', description: 'Открыть управление контентом.', aliases: ['контент', 'управление контентом', 'фото', 'медиа', 'публикации кабинета'], requiredParameters: [], optionalParameters: [], requiredRole: 'partner', requiredTools: ['workspace'], relatedScreens: ['workspace'], priority: 76, category: CAPABILITY_CATEGORIES.WORKSPACE },

  { id: 'OPEN_ADMIN', title: 'Открыть админку', description: 'Открыть административную панель.', aliases: ['админка', 'админ панель', 'admin', 'панель администратора'], requiredParameters: [], optionalParameters: [], requiredRole: 'admin', requiredTools: [], relatedScreens: ['admin'], priority: 86, category: CAPABILITY_CATEGORIES.ADMIN },
  { id: 'OPEN_MODERATION', title: 'Модерация', description: 'Открыть модерацию контента.', aliases: ['модерация', 'проверка контента', 'заявки', 'премодерация'], requiredParameters: [], optionalParameters: [], requiredRole: 'admin', requiredTools: [], relatedScreens: ['admin'], priority: 80, category: CAPABILITY_CATEGORIES.ADMIN },
  { id: 'OPEN_USERS', title: 'Пользователи', description: 'Открыть управление пользователями.', aliases: ['пользователи', 'юзеры', 'список пользователей', 'клиенты'], requiredParameters: [], optionalParameters: [], requiredRole: 'admin', requiredTools: ['user'], relatedScreens: ['admin'], priority: 78, category: CAPABILITY_CATEGORIES.ADMIN },
  { id: 'OPEN_STATISTICS', title: 'Статистика', description: 'Открыть статистику приложения.', aliases: ['статистика', 'цифры', 'метрики приложения', 'отчёт'], requiredParameters: [], optionalParameters: [], requiredRole: 'admin', requiredTools: ['workspace'], relatedScreens: ['admin'], priority: 78, category: CAPABILITY_CATEGORIES.ADMIN },

  { id: 'SEARCH_PARTNERS', title: 'Поиск партнёров', description: 'Найти партнёров по запросу.', aliases: ['найди партнёра', 'поиск партнёров', 'где', 'места', 'рядом'], requiredParameters: ['query'], optionalParameters: ['category', 'location'], requiredRole: 'user', requiredTools: ['partner', 'search'], relatedScreens: ['partners', 'nearby'], priority: 84, category: CAPABILITY_CATEGORIES.SEARCH },
  { id: 'SEARCH_EXPERTS', title: 'Поиск экспертов', description: 'Найти экспертов или специалистов.', aliases: ['найди эксперта', 'специалист', 'врач', 'консультант', 'эксперты'], requiredParameters: ['query'], optionalParameters: ['category'], requiredRole: 'user', requiredTools: ['expert', 'search'], relatedScreens: ['experts'], priority: 84, category: CAPABILITY_CATEGORIES.SEARCH },
  { id: 'SEARCH_EVENTS', title: 'Поиск событий', description: 'Найти мероприятия и события.', aliases: ['найди мероприятие', 'события', 'афиша', 'куда сходить', 'чем заняться'], requiredParameters: ['query'], optionalParameters: ['date', 'category'], requiredRole: 'user', requiredTools: ['event', 'search'], relatedScreens: ['events'], priority: 84, category: CAPABILITY_CATEGORIES.SEARCH },
  { id: 'SEARCH_PROMOTIONS', title: 'Поиск акций', description: 'Найти скидки, акции и предложения.', aliases: ['скидки', 'акции', 'предложения', 'выгодно', 'акции сегодня', 'промо'], requiredParameters: ['query'], optionalParameters: ['location', 'category'], requiredRole: 'user', requiredTools: ['promotion', 'search'], relatedScreens: ['offers', 'nearby'], priority: 88, category: CAPABILITY_CATEGORIES.SEARCH },
  { id: 'SEARCH_NEWS', title: 'Поиск новостей', description: 'Найти новости и публикации.', aliases: ['найди новости', 'новости', 'публикации', 'что нового', 'статьи'], requiredParameters: ['query'], optionalParameters: ['category'], requiredRole: 'user', requiredTools: ['news', 'search'], relatedScreens: ['news'], priority: 78, category: CAPABILITY_CATEGORIES.SEARCH },
];

const REGISTRY = CAPABILITIES.map(item => ({
  optionalParameters: [],
  requiredParameters: [],
  aliases: [],
  requiredTools: [],
  relatedScreens: [],
  requiredRole: 'user',
  priority: 50,
  ...item,
}));

export function getCapabilityRegistry() {
  return REGISTRY;
}

export function getCapabilityById(id = '') {
  return REGISTRY.find(item => item.id === id) || null;
}

export class CapabilityRegistry {
  all() {
    return getCapabilityRegistry();
  }

  get(id = '') {
    return getCapabilityById(id);
  }
}
