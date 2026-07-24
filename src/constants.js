export const APP_URL = 'https://myapg.ru';

const VITE_ENV = import.meta.env || {};

export const API_BASE_URL = (VITE_ENV.VITE_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net').replace(/\/$/, '');

export const ANDROID_DOWNLOAD_URL = String(
  VITE_ENV.VITE_ANDROID_DOWNLOAD_URL || 'https://myapg.ru/downloads/apg-android.apk',
).trim();

export const WEB_PUSH_VAPID_PUBLIC_KEY = 'BNzifwh-L302BzWUiw3hv3g9tlPBb5CJ8lGu1lfRpGdJZhyq0yzHqV0K9EkDAokVBv6OrInWqev-Vihw-2gBpYU';

export { EXPERT_CATEGORIES } from '../server-shared/expert-directory.js';
