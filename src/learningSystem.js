export const LEARNING_VERSION = '1.0';

export const LEARNING_ONBOARDING_SLIDES = [
  {
    accent: '#C9A84C',
    orb: 'rgba(201,168,76,0.12)',
    tag: '1 / 7 · СТАРТ',
    title: 'АПГ помогает\nжить городом',
    desc: 'Здесь собраны партнёры, эксперты, события, новости, ключи и Локи — всё, что помогает быстрее находить полезное в Зеленограде.',
    visual: 'welcome',
  },
  {
    accent: '#4A90D9',
    orb: 'rgba(74,144,217,0.12)',
    tag: '2 / 7 · ПАРТНЁРЫ',
    title: 'Находи места\nи услуги',
    desc: 'Открывай партнёров, смотри акции, добавляй любимые места и используй QR у партнёра, чтобы получать ключи.',
    visual: 'partners',
    chips: ['Партнёры', 'Акции', 'QR'],
  },
  {
    accent: '#E8C97A',
    orb: 'rgba(232,201,122,0.1)',
    tag: '3 / 7 · СОБЫТИЯ',
    title: 'Выбирай\nкуда сходить',
    desc: 'Афиша помогает быстро найти мероприятия, открыть карточку события и зарегистрироваться, если есть места.',
    visual: 'scan',
  },
  {
    accent: '#4BB34B',
    orb: 'rgba(75,179,75,0.1)',
    tag: '4 / 7 · НОВОСТИ',
    title: 'Читай\nи обсуждай',
    desc: 'Новости АПГ можно читать, сохранять, комментировать и обсуждать с Локи прямо в контексте статьи.',
    visual: 'levels',
  },
  {
    accent: '#C9A84C',
    orb: 'rgba(201,168,76,0.12)',
    tag: '5 / 7 · КЛЮЧИ',
    title: 'Ключи открывают\nвозможности',
    desc: 'Ключи не цель сами по себе: они помогают получать возможности, билеты, награды и доступ к закрытым событиям.',
    visual: 'levels',
  },
  {
    accent: '#9C7CFF',
    orb: 'rgba(156,124,255,0.12)',
    tag: '6 / 7 · ЛОКИ',
    title: 'Спрашивай\nЛоки',
    desc: 'Локи понимает текущий экран и может объяснить, что здесь делать, подобрать место, событие или полезный следующий шаг.',
    visual: 'welcome',
  },
  {
    accent: '#4BB34B',
    orb: 'rgba(75,179,75,0.1)',
    tag: '7 / 7 · ПЕРВЫЕ ШАГИ',
    title: 'Начни\nс мини-заданий',
    desc: 'После знакомства открой задания: найди партнёра, событие, Локи и профиль. За первые действия начисляются ключи.',
    visual: 'partners',
  },
];

export const LEARNING_TASK_IDS = {
  PARTNER: 'learn_find_partner',
  EVENT: 'learn_open_event',
  COMMENT: 'learn_write_comment',
  LOKI: 'learn_open_loki',
  PROFILE: 'learn_open_profile',
};

export const LEARNING_TASKS = [
  {
    id: LEARNING_TASK_IDS.PARTNER,
    emoji: '🏢',
    title: 'Найди партнёра',
    desc: 'Открой карточку любого партнёра АПГ и посмотри, что он предлагает.',
    reward: 1,
    check: (k, f, r, s, sc, learning = {}) => Boolean(learning.partnerOpened),
    total: 1,
    progress: (k, f, r, s, sc, learning = {}) => learning.partnerOpened ? 1 : 0,
  },
  {
    id: LEARNING_TASK_IDS.EVENT,
    emoji: '📅',
    title: 'Открой событие',
    desc: 'Зайди в афишу и открой карточку мероприятия.',
    reward: 1,
    check: (k, f, r, s, sc, learning = {}) => Boolean(learning.eventOpened),
    total: 1,
    progress: (k, f, r, s, sc, learning = {}) => learning.eventOpened ? 1 : 0,
  },
  {
    id: LEARNING_TASK_IDS.COMMENT,
    emoji: '💬',
    title: 'Напиши комментарий',
    desc: 'Оставь комментарий к новости и попробуй обсуждение внутри АПГ.',
    reward: 1,
    check: (k, f, r, s, sc, learning = {}) => Boolean(learning.newsCommented),
    total: 1,
    progress: (k, f, r, s, sc, learning = {}) => learning.newsCommented ? 1 : 0,
  },
  {
    id: LEARNING_TASK_IDS.LOKI,
    emoji: '🦊',
    title: 'Открой Локи',
    desc: 'Зайди к Локи и задай вопрос или попроси объяснить экран.',
    reward: 1,
    check: (k, f, r, s, sc, learning = {}) => Boolean(learning.lokiOpened),
    total: 1,
    progress: (k, f, r, s, sc, learning = {}) => learning.lokiOpened ? 1 : 0,
  },
  {
    id: LEARNING_TASK_IDS.PROFILE,
    emoji: '👤',
    title: 'Изучи профиль',
    desc: 'Открой профиль: там ключи, задания, уведомления и личные разделы.',
    reward: 1,
    check: (k, f, r, s, sc, learning = {}) => Boolean(learning.profileOpened),
    total: 1,
    progress: (k, f, r, s, sc, learning = {}) => learning.profileOpened ? 1 : 0,
  },
];

export const LEARNING_HINTS = {
  home: {
    id: 'home_overview',
    title: 'Главная собирает самое важное',
    text: 'Отсюда удобно перейти к событиям, партнёрам, новостям, заданиям и Локи.',
  },
  offers: {
    id: 'partners_catalog',
    title: 'Каталог партнёров',
    text: 'Открой карточку партнёра, посмотри акцию и добавь место в избранное.',
  },
  events: {
    id: 'events_agenda',
    title: 'Афиша событий',
    text: 'Нажми на мероприятие, чтобы увидеть дату, место, описание и регистрацию.',
  },
  news: {
    id: 'news_reader',
    title: 'Новости можно обсуждать',
    text: 'Открой статью, сохрани её, оставь реакцию или попроси Локи пересказать.',
  },
  profile: {
    id: 'profile_hub',
    title: 'Профиль — твой центр прогресса',
    text: 'Здесь ключи, задания, избранное, уведомления и кабинеты владельца.',
  },
  loki: {
    id: 'loki_helper',
    title: 'Локи работает в контексте',
    text: 'Спроси его, что делать дальше, или попроси объяснить текущий экран.',
  },
  rewards: {
    id: 'rewards_store',
    title: 'Магазин возможностей',
    text: 'Ключи можно обменивать на возможности, а билеты использовать в розыгрышах.',
  },
  tasks: {
    id: 'tasks_learning',
    title: 'Задания помогают освоиться',
    text: 'Выполняй первые действия в приложении и забирай ключи за прогресс.',
  },
};

export const LEARNING_KNOWLEDGE_SECTIONS = [
  {
    audience: 'users',
    label: 'Пользователи',
    categories: ['Старт', 'Ключи', 'События', 'Локи'],
    articles: [
      {
        id: 'user-first-minute',
        title: 'Первый запуск за одну минуту',
        description: 'Что открыть в АПГ сразу после входа.',
        emoji: '🚀',
        category: 'Старт',
        video: 'Короткое видео: обзор главной, партнёров и Локи.',
        keywords: ['старт', 'первый запуск', 'онбординг'],
        steps: [
          { title: 'Открой главную', text: 'Посмотри рекомендации дня, новости и быстрые входы.', visual: 'home' },
          { title: 'Найди партнёра', text: 'Перейди в партнёры и открой карточку интересного места.', visual: 'place' },
          { title: 'Спроси Локи', text: 'Если не знаешь, с чего начать, попроси Локи объяснить экран.', visual: 'message' },
        ],
      },
      {
        id: 'user-keys-tickets',
        title: 'Ключи, билеты и возможности',
        description: 'Как работает экономика АПГ простыми словами.',
        emoji: '🔑',
        category: 'Ключи',
        video: 'Короткое видео: как заработать ключи и обменять их на билеты.',
        keywords: ['ключи', 'билеты', 'розыгрыш', 'награды'],
        steps: [
          { title: 'Зарабатывай ключи', text: 'Читай, участвуй, оставляй отзывы, выполняй задания и посещай партнёров.', visual: 'reward' },
          { title: 'Обменивай на билеты', text: 'Для розыгрышей нужны билеты, которые можно получить за ключи.', visual: 'ticket' },
          { title: 'Выбирай возможности', text: 'В магазине возможностей можно тратить ключи на предложения АПГ.', visual: 'gift' },
        ],
      },
    ],
  },
  {
    audience: 'partners',
    label: 'Партнёры',
    categories: ['Кабинет', 'Новости', 'События', 'AI'],
    articles: [
      {
        id: 'partner-cabinet-start',
        title: 'Как партнёру начать работу',
        description: 'Карточка, новости, события и AI-помощник партнёра.',
        emoji: '🏢',
        category: 'Кабинет',
        video: 'Короткое видео: обзор кабинета партнёра.',
        keywords: ['партнёр', 'кабинет', 'ai'],
        steps: [
          { title: 'Проверь карточку', text: 'Заполни описание, фото, контакты, адрес и преимущества.', visual: 'card' },
          { title: 'Создай черновик', text: 'AI-помощник помогает подготовить новость, событие или акцию.', visual: 'message' },
          { title: 'Отправь на модерацию', text: 'Публикация остаётся за администрацией, чтобы сохранять качество.', visual: 'check' },
        ],
      },
    ],
  },
  {
    audience: 'experts',
    label: 'Эксперты',
    categories: ['Профиль', 'Расписание', 'Рекомендации'],
    articles: [
      {
        id: 'expert-profile-start',
        title: 'Как эксперту оформить профиль',
        description: 'Что помогает пользователям понять вашу пользу.',
        emoji: '🎓',
        category: 'Профиль',
        video: 'Короткое видео: сильный профиль эксперта.',
        keywords: ['эксперт', 'профиль', 'расписание'],
        steps: [
          { title: 'Опишите специализацию', text: 'Коротко объясните, с какими запросами вы помогаете.', visual: 'expert' },
          { title: 'Добавьте расписание', text: 'Планируйте мастер-классы, консультации и вебинары.', visual: 'calendar' },
          { title: 'Обновляйте AI Profile', text: 'Так Локи сможет точнее рекомендовать вас пользователям.', visual: 'message' },
        ],
      },
    ],
  },
];

const SCREEN_EXPLANATIONS = {
  home: 'Это главная АПГ. Здесь собраны важные новости, события, быстрые действия, задания и рекомендации. Если не знаешь, куда идти дальше, начни с блока «Сегодня для тебя» или спроси Локи.',
  offers: 'Это каталог партнёров. Здесь можно найти места, услуги, акции и карточки партнёров. Открой карточку, посмотри контакты, добавь в избранное или используй QR у партнёра.',
  partner: 'Это карточка партнёра. Здесь описание, контакты, акции, отзывы, QR и связанные возможности. Если место понравилось, добавь его в избранное.',
  events: 'Это афиша событий. Нажми на мероприятие, чтобы открыть карточку с датой, временем, местом, описанием и регистрацией.',
  news: 'Это новости АПГ. Открой статью, сохрани её, оставь реакцию или комментарий. Локи может кратко пересказать новость и объяснить, что она значит.',
  experts: 'Это раздел экспертов. Здесь можно найти специалиста, открыть профиль и понять, с каким запросом к нему обратиться.',
  profile: 'Это профиль. Здесь видны ключи, билеты, репутация, задания, избранное, уведомления и кабинеты партнёра или эксперта, если они доступны.',
  rewards: 'Это магазин возможностей. Ключи можно тратить на предложения, а для розыгрышей использовать билеты.',
  tasks: 'Это задания. Выполняй действия в приложении, забирай ключи и повышай активность внутри АПГ.',
  loki: 'Это Локи — помощник АПГ. Он учитывает текущий экран и может объяснить раздел, подобрать событие, партнёра, эксперта или следующий полезный шаг.',
  reference: 'Это центр знаний. Здесь инструкции для пользователей, партнёров и экспертов, поиск, категории и пошаговые сценарии.',
};

export function getLearningScreenExplanation(panel) {
  return SCREEN_EXPLANATIONS[String(panel || '').trim()] || 'Это раздел АПГ. Я могу объяснить, что здесь делать, какие действия доступны и какой следующий шаг будет полезным.';
}

export function flattenLearningKnowledgeArticles() {
  return LEARNING_KNOWLEDGE_SECTIONS.flatMap(section => section.articles.map(article => ({ ...article, audience: section.audience, audienceLabel: section.label })));
}

export function normalizeLearningProgress(value = {}) {
  return value && typeof value === 'object' ? value : {};
}

export function nextLearningProgress(progress = {}, key) {
  if (!key || progress[key]) return normalizeLearningProgress(progress);
  return { ...normalizeLearningProgress(progress), [key]: true, updatedAt: new Date().toISOString() };
}
