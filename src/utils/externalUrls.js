import { TELEGRAM_HOST, normalizeTelegramUrl } from '../../server-shared/telegram.js';

const SOCIAL_HOSTS = {
  vk: 'vk.com',
  telegram: TELEGRAM_HOST,
  whatsapp: 'wa.me',
  instagram: 'instagram.com',
  youtube: 'youtube.com',
  rutube: 'rutube.ru',
  dzen: 'dzen.ru',
  max: 'max.ru',
};

const HOST_PLATFORM = [
  ['vk', /(^|\.)vk\.com$|(^|\.)vk\.me$|(^|\.)vkontakte\.ru$/i],
  ['telegram', /(^|\.)t[.]me$|(^|\.)telegram\.me$/i],
  ['whatsapp', /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i],
  ['instagram', /(^|\.)instagram\.com$/i],
  ['youtube', /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i],
  ['rutube', /(^|\.)rutube\.ru$/i],
  ['dzen', /(^|\.)dzen\.ru$/i],
  ['max', /(^|\.)max\.ru$/i],
];

export function cleanExternalUrlInput(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export function detectExternalUrlPlatform(value) {
  const raw = cleanExternalUrlInput(value);
  if (!raw) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^@+/, '')}`;
  try {
    const host = new URL(withProtocol).hostname.replace(/^www\./i, '');
    return HOST_PLATFORM.find(([, test]) => test.test(host))?.[0] || '';
  } catch {
    return '';
  }
}

function stripKnownHost(value, platform) {
  const host = SOCIAL_HOSTS[platform];
  if (!host) return value;
  const extraHosts = {
    vk: 'vk\\.me|vkontakte\\.ru',
    telegram: 't[.]me',
    whatsapp: 'whatsapp\\.com',
    youtube: 'youtu\\.be',
  }[platform];
  const hostPattern = [host.replace('.', '\\.'), extraHosts].filter(Boolean).join('|');
  return value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(new RegExp(`^(?:${hostPattern})/?`, 'i'), '')
    .replace(/^@+/, '');
}

function normalizeSocialPath(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/\s+/g, '')
    .replace(/^@+/, '');
}

export function normalizeExternalUrl(value, options = {}) {
  const raw = cleanExternalUrlInput(value);
  if (!raw) return '';
  if (/^(tel:|mailto:)/i.test(raw)) return raw;

  const platform = options.platform || detectExternalUrlPlatform(raw);
  if (platform && SOCIAL_HOSTS[platform]) {
    let path = normalizeSocialPath(stripKnownHost(raw, platform));
    if (platform === 'whatsapp' && !/[/?]/.test(path)) {
      path = path.replace(/[^\d]/g, '');
    }
    if (!path) return '';
    if (platform === 'telegram') return normalizeTelegramUrl(path);
    return `https://${SOCIAL_HOSTS[platform]}/${path}`;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/i.test(url.protocol)) return '';
    url.hostname = url.hostname.replace(/^www\./i, '');
    return url.toString();
  } catch {
    return '';
  }
}

export function validateExternalUrl(value, options = {}) {
  const normalized = normalizeExternalUrl(value, options);
  if (!normalized) return { ok: !cleanExternalUrlInput(value), url: '', error: cleanExternalUrlInput(value) ? 'Некорректная ссылка.' : '' };
  if (/^(tel:|mailto:)/i.test(normalized)) return { ok: true, url: normalized, error: '' };
  try {
    const url = new URL(normalized);
    return { ok: /^https?:$/i.test(url.protocol), url: normalized, error: /^https?:$/i.test(url.protocol) ? '' : 'Поддерживаются только http/https ссылки.' };
  } catch {
    return { ok: false, url: '', error: 'Некорректная ссылка.' };
  }
}

export function openNormalizedUrl(openUrl, value, options = {}) {
  const before = cleanExternalUrlInput(value);
  const normalized = normalizeExternalUrl(before, options);
  if (import.meta.env.DEV || new URLSearchParams(window.location.search).get('urlDebug') === '1') {
    console.info('[APG URL]', {
      databaseUrl: before,
      normalizedUrl: normalized,
      openUrl: normalized,
      platform: options.platform || detectExternalUrlPlatform(before) || 'generic',
    });
  }
  if (normalized) openUrl(normalized);
  return normalized;
}
