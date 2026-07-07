import _vkBridge from '@vkontakte/vk-bridge';

// true когда запущено внутри VK Mini App
// Намеренно НЕ используем _vkBridge.supports() — он возвращает true даже в обычном браузере
export const isVK = () =>
  /VKAndroidApp|VKiOSApp/i.test(navigator.userAgent) ||
  new URLSearchParams(window.location.search).has('vk_app_id') ||
  new URLSearchParams(window.location.search).has('vk_user_id');

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
        navigator.vibrate?.({
          light: 8,
          medium: [12, 18, 10],
          heavy: [18, 22, 16],
          success: [10, 20, 24],
        }[params.style] ?? 8);
        return {};

      case 'VKWebAppAllowNotifications':
        throw new Error('web_mode');

      case 'VKWebAppOpenCodeReader':
        throw new Error('web_mode');

      case 'VKWebAppJoinGroup':
        window.open(`https://vk.com/club${params.group_id}`, '_blank', 'noopener,noreferrer');
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

// VK OAuth для веб-браузера: открывает popup, ждёт токен, тянет данные пользователя
export const vkWebLogin = () => new Promise((resolve, reject) => {
  const REDIRECT = `${window.location.origin}/vk-auth.html`;
  const authUrl = `https://oauth.vk.com/authorize?client_id=54601851&display=popup&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=0&response_type=token&v=5.199`;
  const popup = window.open(authUrl, 'vk_auth', 'width=620,height=540,left=200,top=80');
  if (!popup) { reject(new Error('popup_blocked')); return; }

  const onMessage = async ({ origin, data }) => {
    if (origin !== window.location.origin) return;
    if (!data || data.type !== 'vk_auth_callback') return;
    window.removeEventListener('message', onMessage);
    clearInterval(closedTimer);

    const { access_token, user_id, error } = data;
    if (error || !access_token) { reject(new Error(error || 'cancelled')); return; }

    try {
      const apiUrl = new URL('https://api.vk.com/method/users.get');
      apiUrl.searchParams.set('access_token', access_token);
      apiUrl.searchParams.set('fields', 'photo_200');
      apiUrl.searchParams.set('v', '5.199');
      apiUrl.searchParams.set('lang', 'ru');
      const res = await fetch(apiUrl.toString());
      const json = await res.json();
      const u = json.response?.[0];
      if (!u) throw new Error('no_user');
      const userData = { id: u.id, first_name: u.first_name ?? 'Пользователь', last_name: u.last_name ?? '', photo_200: u.photo_200 ?? null };
      localStorage.setItem('apg_web_user', JSON.stringify(userData));
      resolve(userData);
    } catch {
      const uid = parseInt(user_id, 10);
      if (!uid) { reject(new Error('auth_failed')); return; }
      const userData = { id: uid, first_name: 'Пользователь', last_name: '', photo_200: null };
      localStorage.setItem('apg_web_user', JSON.stringify(userData));
      resolve(userData);
    }
  };

  window.addEventListener('message', onMessage);
  const closedTimer = setInterval(() => {
    if (popup?.closed) {
      clearInterval(closedTimer);
      window.removeEventListener('message', onMessage);
      reject(new Error('popup_closed'));
    }
  }, 500);
});

// Открывает URL из обработчика кнопки.
// ВАЖНО: <a>.click() вызывается синхронно (пока есть контекст жеста пользователя),
// иначе iOS WebView блокирует открытие новых окон.
// VK Bridge вызывается параллельно — для нативного Mini App контекста.
export const openUrl = (url) => {
  if (!url) return;
  const normalized = String(url).trim();

  if (isVK() && /^https?:\/\//i.test(normalized)) {
    let host = '';
    try { host = new URL(normalized).hostname.replace(/^www\./, ''); } catch {}
    const allowedDirect = host === 'vk.com' || host.endsWith('.vk.com') || host === 'myapg.ru';
    if (!allowedDirect) {
      window.dispatchEvent(new CustomEvent('apg:vk-external-link', { detail: { url: normalized, host } }));
      const ok = window.confirm(`Ссылка ведёт за пределы VK:\n${host || normalized}\n\nОткрыть внешний сайт?`);
      if (!ok) return;
    }
    _vkBridge.send('VKWebAppOpenLink', { link: normalized }).catch(() => {
      window.open(normalized, '_blank', 'noopener,noreferrer');
    });
    return;
  }

  // tel: — пробуем VK Bridge (работает в нативном WebView), потом fallback
  if (normalized.startsWith('tel:')) {
    _vkBridge.send('VKWebAppOpenLink', { link: normalized }).catch(() => {
      // fallback для браузера
      window.location.href = normalized;
    });
    return;
  }

  // http/https:
  // 1. Синхронный anchor click — работает в VK-браузере и обычных браузерах
  const a = document.createElement('a');
  a.href = normalized;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 100);

  // 2. VK Bridge — для нативного VK Mini App (Android/iOS)
  _vkBridge.send('VKWebAppOpenLink', { link: normalized }).catch(() => {});
};

export default vkBridge;
