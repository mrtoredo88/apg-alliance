export const TELEGRAM_HOST = 'telegram.me';
export const TELEGRAM_BASE_URL = `https://${TELEGRAM_HOST}`;

const LEGACY_TELEGRAM_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?(?:telegram\.me|t[.]me)\/?/i;

export function telegramPath(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(LEGACY_TELEGRAM_HOST_RE, '')
    .replace(/^\/+/, '')
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
}

export function telegramUrl(path = '') {
  const clean = telegramPath(path);
  return clean ? `${TELEGRAM_BASE_URL}/${clean}` : TELEGRAM_BASE_URL;
}

export function telegramShareUrl({ url = '', text = '' } = {}) {
  const params = new URLSearchParams();
  if (url) params.set('url', url);
  if (text) params.set('text', text);
  const query = params.toString();
  return telegramUrl(`share/url${query ? `?${query}` : ''}`);
}
