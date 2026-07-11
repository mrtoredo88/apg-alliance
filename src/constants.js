export const APP_URL = 'https://myapg.ru';

// Для отката на Vercel API: установить VITE_API_BASE_URL='' и передеплоить
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net';

export const WEB_PUSH_VAPID_PUBLIC_KEY = 'BNzifwh-L302BzWUiw3hv3g9tlPBb5CJ8lGu1lfRpGdJZhyq0yzHqV0K9EkDAokVBv6OrInWqev-Vihw-2gBpYU';

export { EXPERT_CATEGORIES } from '../server-shared/expert-directory.js';
