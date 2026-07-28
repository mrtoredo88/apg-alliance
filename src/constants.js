export const APP_URL = 'https://myapg.ru';

const VITE_ENV = import.meta.env || {};

export const API_BASE_URL = (VITE_ENV.VITE_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net').replace(/\/$/, '');

const ANDROID_INSTALL_PROVIDER = String(VITE_ENV.VITE_ANDROID_INSTALL_PROVIDER || 'apk').trim().toLowerCase();
const ANDROID_INSTALL_URL = String(
  VITE_ENV.VITE_ANDROID_INSTALL_URL || VITE_ENV.VITE_ANDROID_DOWNLOAD_URL || 'https://myapg.ru/downloads/apg-android.apk',
).trim();

export const ANDROID_INSTALL_SOURCE = {
  provider: ANDROID_INSTALL_PROVIDER === 'rustore' ? 'rustore' : 'apk',
  url: ANDROID_INSTALL_URL,
  buttonLabel: ANDROID_INSTALL_PROVIDER === 'rustore' ? 'Установить из RuStore' : '⬇ Скачать APK',
};

export const WEB_PUSH_VAPID_PUBLIC_KEY = 'BIY6fBBaGoouByjJosD9BKLXBRVoChXSpwgkXTwDJZs_gykj9gr8Fe5LVnTKCs8hseG5iJGLR-rqprfbS3Y3YLs';

export { EXPERT_CATEGORIES } from '../server-shared/expert-directory.js';
