import { APP_URL } from '../constants.js';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

const ENTITY_PATHS = {
  news: 'news',
  event: 'event',
  partner: 'partner',
  expert: 'expert',
};

export function entityPath(entityType, id = '') {
  const type = ENTITY_PATHS[String(entityType || '').toLowerCase()] || String(entityType || '').toLowerCase();
  const cleanId = encodeURIComponent(String(id || '').trim());
  return cleanId ? `/${type}/${cleanId}` : `/${type}`;
}

export function shareLink(entityType, id = '') {
  return `${APP_URL}${entityPath(entityType, id)}`;
}

export async function shareEntity({ entityType, id, title = 'АПГ', text = '', fallbackText = '' } = {}) {
  const url = shareLink(entityType, id);
  const copyText = fallbackText || [text, url].filter(Boolean).join('\n');
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text: text || title, url, dialogTitle: 'Поделиться через' });
    return { ok: true, url, method: 'capacitor' };
  }
  if (navigator?.share) {
    await navigator.share({ title, text: text || title, url });
    return { ok: true, url, method: 'native' };
  }
  await navigator?.clipboard?.writeText(copyText);
  return { ok: true, url, method: 'clipboard' };
}
