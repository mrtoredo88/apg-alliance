const VK_ALLOWED_HOSTS = new Set(['vk.com', 'vk.ru', 'vk.me', 'vkontakte.ru']);

export function cleanVkCommunityInput(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function normalizeCommunityPath(path = '') {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/^@+/, '')
    .replace(/[?#].*$/, '')
    .replace(/\s+/g, '')
    .trim();
}

export function getVkCommunityScreenName(value) {
  const raw = cleanVkCommunityInput(value);
  if (!raw) return '';
  if (/^(javascript|data|vbscript):/i.test(raw)) return '';

  if (/^[A-Za-z0-9_.-]+$/.test(raw.replace(/^@+/, ''))) {
    return raw.replace(/^@+/, '').slice(0, 120);
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!VK_ALLOWED_HOSTS.has(host)) return '';
    const screenName = normalizeCommunityPath(url.pathname);
    if (!screenName || screenName.includes('/')) return '';
    return /^[A-Za-z0-9_.-]+$/.test(screenName) ? screenName.slice(0, 120) : '';
  } catch {
    return '';
  }
}

export function normalizeVkCommunityUrl(value) {
  const screenName = getVkCommunityScreenName(value);
  return screenName ? `https://vk.com/${screenName}` : '';
}
