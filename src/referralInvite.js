import { APP_URL } from './constants.js';

export function buildReferralLink(userOrId) {
  const rawId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  const id = String(rawId || '').trim();
  return id ? `${APP_URL}/?ref=${encodeURIComponent(id)}` : APP_URL;
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
