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
  ],
  [LOKI_EVENTS.DAILY_VISIT]: [
    'Сегодня в городе точно есть что открыть.',
    'Хороший день, чтобы забрать новый ключ.',
  ],
};

export function getLokiPhrase(eventType, payload = {}) {
  if (eventType === LOKI_EVENTS.KEY_RECEIVED && Number(payload.keysCount) > 1) {
    return `Ух ты! +${payload.keysCount} ключа у тебя. Город становится ближе ✨`;
  }
  const list = phrases[eventType] ?? phrases[LOKI_EVENTS.DAILY_VISIT];
  const seed = `${eventType}:${payload.source ?? ''}:${payload.id ?? ''}`;
  const index = Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % list.length;
  return list[index];
}
