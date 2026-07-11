import assert from 'node:assert/strict';
import {
  BUSINESS_HUB_FLAG,
  buildBusinessHubModel,
  canUseBusinessHub,
  getBusinessProfileCompletion,
  normalizeBusinessHubFlag,
} from '../src/businessHub/BusinessHubCore.js';

const owner = { id: 'owner-1', roles: ['owner'] };
const partnerUser = { id: 'user-1' };
const partner = {
  id: 'partner-1',
  ownerId: 'user-1',
  name: 'Кофейня АПГ',
  description: 'Городская кофейня',
  category: 'food',
  phone: '+79990000000',
  website: 'https://example.com',
  logoUrl: 'https://example.com/logo.png',
  address: 'Зеленоград',
  hours: '10:00-20:00',
  offer: 'Скидка 10%',
  viewCount: 42,
  phoneClicks: 7,
  telegramClicks: 3,
  reviewCount: 2,
};
const expert = { id: 'expert-1', name: 'Анна Эксперт', category: 'psychology' };

assert.equal(normalizeBusinessHubFlag('bad'), BUSINESS_HUB_FLAG.owner);
assert.equal(canUseBusinessHub({ user: owner, flag: BUSINESS_HUB_FLAG.owner }), true);
assert.equal(canUseBusinessHub({ user: partnerUser, partner, flag: BUSINESS_HUB_FLAG.owner }), false);
assert.equal(canUseBusinessHub({ user: partnerUser, partner, flag: BUSINESS_HUB_FLAG.partner }), true);
assert.equal(canUseBusinessHub({ user: partnerUser, expert, flag: BUSINESS_HUB_FLAG.expert }), true);
assert.equal(canUseBusinessHub({ user: { id: '988504' }, flag: BUSINESS_HUB_FLAG.owner }), false);

const completion = getBusinessProfileCompletion(partner);
assert.equal(completion.value, 100);
assert.equal(completion.missing.length, 0);

const model = buildBusinessHubModel({
  user: partnerUser,
  partner,
  news: [
    { id: 'n1', title: 'Новость кофейни', partnerId: 'partner-1' },
    { id: 'n2', title: 'Чужая новость', partnerId: 'partner-2' },
  ],
  events: [
    { id: 'e1', title: 'Дегустация', organizer: 'Кофейня АПГ' },
  ],
  notifications: [{ id: 'notice', title: 'Проверка' }],
});

assert.equal(model.business.kind, 'partner');
assert.equal(model.relatedNews.length, 1);
assert.equal(model.relatedEvents.length, 1);
assert.equal(model.promotions.length, 1);
assert.equal(model.stats.views, 42);
assert.equal(model.stats.calls, 7);
assert.equal(model.stats.socials, 3);
assert.equal(model.totals.reviews, 2);
assert.equal(model.notifications.length, 1);

console.log('Business Hub 1.0 smoke: ok');
