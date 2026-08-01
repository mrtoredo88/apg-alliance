import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const ROUTES = new Set(['partner', 'profile', 'event', 'messages', 'dialogs', 'booking', 'qr', 'news']);

export function normalizeDeepLink(input = '') {
  try {
    const url = new URL(input, 'https://myapg.ru');
    if (url.protocol === 'https:' && url.hostname !== 'myapg.ru') return '/';
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'myapg:') parts.unshift(url.hostname);
    const section = String(parts[0] || '').toLowerCase();
    if (!ROUTES.has(section)) return '/';
    const normalized = section === 'dialogs' ? 'messages' : section;
    const id = parts[1] ? `/${encodeURIComponent(decodeURIComponent(parts[1]))}` : '';
    const query = new URLSearchParams(url.search);
    if (normalized === 'messages' && id && !query.has('dialogId')) query.set('dialogId', decodeURIComponent(parts[1]));
    return `/${normalized}${normalized === 'messages' ? '' : id}${query.size ? `?${query}` : ''}`;
  } catch {
    return '/';
  }
}

export function openDeepLink(input, { replace = false } = {}) {
  const route = normalizeDeepLink(input);
  if (route === '/') return false;
  window.history[replace ? 'replaceState' : 'pushState']({ nativeDeepLink: true }, '', route);
  window.dispatchEvent(new PopStateEvent('popstate', { state: { nativeDeepLink: true } }));
  window.dispatchEvent(new CustomEvent('apg:native_deep_link', { detail: { route } }));
  return true;
}

export async function installNativeDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listener = await CapacitorApp.addListener('appUrlOpen', ({ url }) => openDeepLink(url));
  const launch = await CapacitorApp.getLaunchUrl().catch(() => null);
  if (launch?.url) openDeepLink(launch.url, { replace: true });
  return () => listener.remove();
}
