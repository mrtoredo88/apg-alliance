import assert from 'node:assert/strict';
import { buildLokiDashboardPulse } from '../src/loki/core/dashboard/DashboardPulse.js';

const now = new Date('2026-07-30T19:00:00+03:00');
const dashboard = buildLokiDashboardPulse({
    events: [
      { id: 'event-1', title: 'Вечерняя встреча', date: '2026-07-30T20:00:00+03:00', active: true },
      { id: 'draft-event', title: 'Черновик', date: '2026-07-30T21:00:00+03:00', status: 'draft' },
    ],
    news: [
      { id: 'news-1', title: 'Свежая новость', publishedAt: '2026-07-30T12:00:00+03:00', active: true },
    ],
    partners: [
      { id: 'partner-1', name: 'Кафе', offer: 'Скидка 10%', active: true },
      { id: 'hidden-partner', name: 'Скрытый', offer: 'Скидка', active: false },
    ],
    customTasks: [],
    completedTasks: [],
    prizes: [],
  }, now);

assert.deepEqual(dashboard.counts, { news: 1, offers: 1, events: 1, rewards: 0 });
assert.match(dashboard.summary, /1 свежая новость, 1 акция и 1 событие/);
assert.equal(dashboard.proactivePrompt.title, 'Выбрать план на вечер');
assert.equal(dashboard.proactivePrompt.prompt, 'Куда сходить сегодня вечером?');

const rewards = buildLokiDashboardPulse(
  { prizes: [{ id: 'gift-1', title: 'Подарок', active: true }] },
  new Date('2026-07-30T09:00:00+03:00'),
);
assert.equal(rewards.proactivePrompt.title, 'Проверить доступные подарки');
assert.equal(rewards.counts.rewards, 1);

console.log('Loki dashboard tests passed');
