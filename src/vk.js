import _vkBridge from '@vkontakte/vk-bridge';

// true когда запущено внутри VK Mini App
export const isVK = () =>
  /VKAndroidApp|VKiOSApp/i.test(navigator.userAgent) ||
  new URLSearchParams(window.location.search).has('vk_app_id');

const send = async (method, params = {}) => {
  if (!isVK()) {
    switch (method) {
      case 'VKWebAppInit':
        return {};

      case 'VKWebAppGetUserInfo': {
        const saved = localStorage.getItem('apg_web_user');
        if (saved) { try { return JSON.parse(saved); } catch {} }
        throw new Error('web_mode');
      }

      case 'VKWebAppOpenLink':
        window.open(params.link, '_blank', 'noopener,noreferrer');
        return {};

      case 'VKWebAppShare': {
        const url  = params.link  || window.location.href;
        const text = params.text  || '';
        if (navigator.share) {
          await navigator.share({ url, text }).catch(() => {});
        } else {
          await navigator.clipboard?.writeText(url).catch(() => {});
        }
        return {};
      }

      case 'VKWebAppTapticImpactOccurred':
        navigator.vibrate?.(5);
        return {};

      case 'VKWebAppAllowNotifications':
        throw new Error('web_mode');

      case 'VKWebAppOpenCodeReader':
        throw new Error('web_mode');

      case 'VKWebAppGetAuthToken':
        throw new Error('web_mode');

      case 'VKWebAppShowWallPostBox':
        return {};

      case 'VKWebAppOpenApp':
        return {};

      default:
        throw new Error('web_mode');
    }
  }

  return _vkBridge.send(method, params);
};

const vkBridge = {
  send,
  supports:  _vkBridge.supports?.bind(_vkBridge),
  subscribe:  _vkBridge.subscribe?.bind(_vkBridge),
  unsubscribe: _vkBridge.unsubscribe?.bind(_vkBridge),
};

// Открывает URL надёжно: обходит isVK() и вызывает реальный _vkBridge напрямую.
// В браузере _vkBridge.send упадёт → перехватываем и делаем window.open.
export const openUrl = (url) => {
  if (!url) return;
  if (url.startsWith('tel:')) {
    window.location.href = url;
    return;
  }
  _vkBridge.send('VKWebAppOpenLink', { link: url }).catch(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
};

export default vkBridge;
