import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';

const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const millis = value => {
  const parsed = value == null || value === '' ? 0 : (typeof value === 'number' ? value : new Date(value).getTime());
  return Number.isFinite(parsed) ? parsed : 0;
};

function pluralRu(value, one, few, many) {
  const count = Math.abs(Number(value || 0)) % 100;
  const last = count % 10;
  if (count > 10 && count < 20) return many;
  if (last === 1) return one;
  if (last > 1 && last < 5) return few;
  return many;
}

function active(item = {}) {
  const status = String(item.status || item.moderationStatus || '').toLowerCase();
  return !['draft', 'pending', 'pending_review', 'archived', 'deleted', 'hidden'].includes(status)
    && item.active !== false && item.published !== false;
}

function sameDay(value, now) {
  const date = new Date(millis(value));
  return millis(value) > 0 && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function choosePrompt({ hour, events, offers, rewards, activeTasks }) {
  if (rewards.length) return { icon: '🎁', title: 'Проверить доступные подарки', text: 'У тебя может быть награда, на которую уже хватает ключей.', prompt: 'Какие подарки мне доступны?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE) };
  if (hour < 11) return { icon: '☕', title: 'Начать день с хорошего кофе', text: 'Покажу подходящее место и сразу дам маршрут.', prompt: 'Где выпить вкусный кофе рядом?' };
  if (hour >= 17 && events.length) return { icon: '◷', title: 'Выбрать план на вечер', text: `${events.length} ${pluralRu(events.length, 'событие', 'события', 'событий')} доступны в афише.`, prompt: 'Куда сходить сегодня вечером?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT) };
  if (offers.length) return { icon: '✦', title: 'Посмотреть выгодное предложение', text: `${offers.length} ${pluralRu(offers.length, 'акция', 'акции', 'акций')} доступны у партнёров.`, prompt: 'Какие акции доступны сейчас?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_OFFERS) };
  if (activeTasks.length) return { icon: '🗝️', title: 'Заработать ключи', text: 'Нашёл действие, с которого удобно начать.', prompt: 'Как быстрее заработать ключи?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_TASKS) };
  return { icon: '✨', title: 'Подобрать что-то интересное', text: 'Соберу лучший вариант из актуальных данных АПГ.', prompt: 'Что мне стоит сделать сегодня?' };
}

export function buildLokiDashboardPulse(appState = {}, now = new Date()) {
  const events = list(appState.events).filter(active);
  const news = list(appState.news).filter(active);
  const partners = list(appState.partners).filter(active);
  const rewards = list(appState.prizes ?? appState.rewards).filter(active);
  const tasks = list(appState.customTasks).filter(active);
  const completed = new Set(list(appState.completedTasks).map(String));
  const activeTasks = tasks.filter(item => !completed.has(String(item.id)));
  const todayEvents = events.filter(item => sameDay(item.date ?? item.startAt ?? item.startsAt ?? item.eventDate, now));
  const freshNews = news.filter(item => {
    const published = millis(item.publishedAt ?? item.createdAt ?? item.date ?? item.updatedAt);
    return published > 0 && now.getTime() - published < 3 * 86400000;
  });
  const offers = partners.filter(hasOffer);
  const counts = { news: freshNews.length, offers: offers.length, events: todayEvents.length || events.length, rewards: rewards.length };
  return {
    events, news, partners, rewards, tasks, activeTasks, todayEvents, freshNews, offers, counts,
    summary: `Сейчас в АПГ: ${counts.news} ${pluralRu(counts.news, 'свежая новость', 'свежие новости', 'свежих новостей')}, ${counts.offers} ${pluralRu(counts.offers, 'акция', 'акции', 'акций')} и ${counts.events} ${pluralRu(counts.events, 'событие', 'события', 'событий')}.`,
    proactivePrompt: choosePrompt({ hour: now.getHours(), events, offers, rewards, activeTasks }),
  };
}
