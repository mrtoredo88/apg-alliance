import { Browser } from '@capacitor/browser';
import { isNativeApp } from './runtime.js';

const SAFE_PROTOCOLS = new Set(['https:', 'tel:', 'mailto:']);

export function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(tel:|mailto:)/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function openExternalUrl(value) {
  const url = normalizeExternalUrl(value);
  if (!url) return false;

  if (isNativeApp() && url.startsWith('https:')) {
    await Browser.open({ url, presentationStyle: 'popover' });
    return true;
  }

  if (/^(tel:|mailto:)/i.test(url)) {
    window.location.assign(url);
    return true;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
