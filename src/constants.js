export const APP_URL = 'https://myapg.ru';

// Для отката на Vercel API: установить VITE_API_BASE_URL='' и передеплоить
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net';

export const WEB_PUSH_VAPID_PUBLIC_KEY = 'BNzifwh-L302BzWUiw3hv3g9tlPBb5CJ8lGu1lfRpGdJZhyq0yzHqV0K9EkDAokVBv6OrInWqev-Vihw-2gBpYU';

export const EXPERT_CATEGORIES = [
  { id: 'food',      label: 'Еда',          emoji: '🍳' },
  { id: 'beauty',    label: 'Красота',       emoji: '💅' },
  { id: 'sport',     label: 'Спорт',         emoji: '🏋️' },
  { id: 'health',    label: 'Здоровье',      emoji: '🩺' },
  { id: 'home',      label: 'Дом и ремонт',  emoji: '🔧' },
  { id: 'pets',      label: 'Животные',      emoji: '🐾' },
  { id: 'fashion',   label: 'Одежда',        emoji: '👔' },
  { id: 'auto',      label: 'Авто',          emoji: '🚙' },
  { id: 'psychology', label: 'Психология',    emoji: '🧠' },
  { id: 'kids',      label: 'Дети',          emoji: '🧸' },
  { id: 'law',       label: 'Право',         emoji: '⚖️' },
  { id: 'insurance', label: 'Страхование',   emoji: '🛡️' },
  { id: 'photo',     label: 'Фото/Видео',    emoji: '📸' },
  { id: 'entertainment', label: 'Развлечения', emoji: '🎉' },
  { id: 'other',     label: 'Другое',        emoji: '✨' },
];
