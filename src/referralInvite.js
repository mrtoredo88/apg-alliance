import { APP_URL } from './constants.js';

export function buildReferralLink(userOrId) {
  const rawId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  const id = String(rawId || '').trim();
  if (!id) return APP_URL;
  const encoded = encodeURIComponent(id);
  // Keep the ref in both URL components. Android/PWA share targets and some
  // in-app browsers may discard either the query or the fragment on hand-off.
  return `${APP_URL}/?ref=${encoded}#ref=${encoded}`;
}

export function buildPersonalQrLink(userOrId) {
  const link = new URL(buildReferralLink(userOrId));
  link.searchParams.set('source', 'personal_qr');
  link.searchParams.set('qr', 'v2');
  return link.toString();
}

export function buildReferralInviteText(link = APP_URL) {
  return `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${link}`;
}

export function buildReferralShareData(link = APP_URL) {
  return {
    title: 'АПГ — Альянс Партнёров Города',
    text: 'Присоединяйся к Альянсу Партнёров Зеленограда 👇',
    url: link,
  };
}
