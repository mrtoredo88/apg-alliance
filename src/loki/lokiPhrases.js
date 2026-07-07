import { LOKI_EVENTS } from './lokiEvents.js';

const phrases = {
  [LOKI_EVENTS.USER_LOGIN]: [
    'Привет! Я Локи. Помогу тебе открыть город по-новому 🔑',
    'Рад видеть тебя в АПГ. Пойдём открывать город вместе.',
  ],
  [LOKI_EVENTS.KEY_RECEIVED]: [
    'Ух ты! Новый ключ у тебя. Город становится ближе ✨',
    'Ключ начислен. Отличный визит!',
  ],
  [LOKI_EVENTS.ACHIEVEMENT_UNLOCKED]: [
    'Есть новое достижение. Красиво идёшь!',
    'Готово! Ещё один шаг к наградам.',
  ],
  [LOKI_EVENTS.PARTNER_OPENED]: [
    'Здесь живут места, которые стоит открыть.',
    'Посмотри фото, акции и отзывы. Я рядом.',
  ],
  [LOKI_EVENTS.EVENT_OPENED]: [
    'Кажется, впереди что-то интересное.',
    'В афише можно найти повод выйти в город.',
  ],
  [LOKI_EVENTS.PRIZE_OPENED]: [
    'Тут ключи превращаются в подарки.',
    'Проверь призы и розыгрыши. Может, сегодня твой день.',
  ],
  [LOKI_EVENTS.PROFILE_OPENED]: [
    'В профиле живут твои ключи, достижения и настройки.',
    'Здесь можно проверить прогресс и настроить АПГ под себя.',
  ],
  [LOKI_EVENTS.REFERENCE_OPENED]: [
    'Здесь собраны ответы, чтобы не потеряться в мире АПГ.',
    'Справочник короткий: одна мысль, один шаг, без длинных инструкций.',
  ],
  [LOKI_EVENTS.VK_ENTRY]: [
    'Привет! Я Локи. Теперь я живу и здесь, в VK. Помогу тебе открыть АПГ быстрее.',
    'Добро пожаловать в VK Mini App АПГ. Это тот же город, те же ключи и тот же Локи.',
  ],
  [LOKI_EVENTS.VK_EXTERNAL_LINK]: [
    'Эта ссылка ведёт за пределы VK. Я покажу её аккуратно, чтобы всё было безопасно.',
    'Переход внешний, поэтому сначала лучше проверить, куда мы идём.',
  ],
  [LOKI_EVENTS.MAP_OPENED]: [
    'Люблю искать новые места.',
    'На карте город выглядит как маленькое приключение.',
  ],
  [LOKI_EVENTS.CHARACTER_TAP]: [
    'Я здесь. Просто смотрю, куда мы пойдём дальше.',
    'Кажется, сегодня у нас хороший маршрут.',
    'Если что, я рядом.',
    'Мне нравится, как ты исследуешь город.',
  ],
  [LOKI_EVENTS.RETURN_VISIT]: [
    'Рад снова тебя видеть.',
    'Ты вернулся. Значит, город зовёт дальше.',
  ],
  [LOKI_EVENTS.APP_ERROR]: [
    'Что-то пошло не так. Сейчас попробуем разобраться.',
    'Похоже, экран споткнулся. Перезагрузка обычно помогает.',
  ],
  [LOKI_EVENTS.USER_IDLE]: [
    'Я тут рядом, если что.',
    'Можно открыть партнёров, события или проверить призы.',
    'Я помолчу немного. Просто буду рядом.',
  ],
  [LOKI_EVENTS.DAILY_VISIT]: [
    'Сегодня в городе точно есть что открыть.',
    'Хороший день, чтобы забрать новый ключ.',
    'Пойдём посмотрим, чем город сегодня удивит.',
  ],
};

const timePhrases = {
  morning: {
    [LOKI_EVENTS.DAILY_VISIT]: ['Доброе утро. У города сегодня свежее настроение.'],
    [LOKI_EVENTS.USER_IDLE]: ['Утро любит маленькие открытия. Я рядом.'],
  },
  evening: {
    [LOKI_EVENTS.DAILY_VISIT]: ['Вечером город звучит мягче. Можно выбрать что-то спокойное.'],
    [LOKI_EVENTS.USER_IDLE]: ['Я рядом, но не буду мешать. Вечер всё-таки.'],
  },
  night: {
    [LOKI_EVENTS.USER_IDLE]: ['Я чуть тише ночью. Если что, я рядом.'],
    [LOKI_EVENTS.CHARACTER_TAP]: ['Тихо-тихо. Ночь в АПГ тоже живая.'],
  },
};

const seasonPhrases = {
  spring: {
    [LOKI_EVENTS.DAILY_VISIT]: ['Весной особенно приятно открывать новые места.'],
  },
  summer: {
    [LOKI_EVENTS.EVENT_OPENED]: ['Летом город будто сам зовёт куда-нибудь выбраться.'],
  },
  autumn: {
    [LOKI_EVENTS.PARTNER_OPENED]: ['Осенью новые места становятся чуть уютнее.'],
  },
  winter: {
    [LOKI_EVENTS.PRIZE_OPENED]: ['Зимой подарки ощущаются особенно вовремя.'],
  },
};

export function getLokiPhrase(eventType, payload = {}) {
  if (payload.message) return payload.message;
  if (eventType === LOKI_EVENTS.KEY_RECEIVED && Number(payload.keysCount) > 1) {
    return `Ух ты! +${payload.keysCount} ключа у тебя. Город становится ближе ✨`;
  }
  const emotional = payload.emotionalState ?? {};
  const timeList = timePhrases[emotional.timePhase]?.[eventType] ?? [];
  const seasonList = seasonPhrases[emotional.season]?.[eventType] ?? [];
  const baseList = phrases[eventType] ?? phrases[LOKI_EVENTS.DAILY_VISIT];
  const list = [...timeList, ...seasonList, ...baseList];
  const seed = `${eventType}:${payload.source ?? ''}:${payload.id ?? ''}:${emotional.mood ?? ''}:${emotional.phraseNonce ?? ''}:${Date.now()}`;
  const index = Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % list.length;
  return list[index];
}
