import { APP_URL } from './constants.js';

export function buildReferralLink(userOrId) {
  const rawId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  const id = String(rawId || '').trim();
  return id ? `${APP_URL}/?ref=${encodeURIComponent(id)}` : APP_URL;
}

export function buildReferralInviteText(link = APP_URL) {
  return `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${link}`;
}
