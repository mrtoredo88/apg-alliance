import assert from 'node:assert/strict';
import { analyzePublicSubmission as analyzeVercel } from '../api/public-submit.js';
import { analyzePublicSubmission as analyzeFastify } from '../server/src/routes/public-submit.js';
import { calculateExpertProfileCompletion, hasPremiumExpertAccess, normalizeExpertVideo } from '../src/expertProfileForm.js';
import { hasPartnerAllianceAccess, hasPartnerPremiumAccess, normalizeExpertTariff, normalizePartnerTariff } from '../src/tariffConfig.js';

const fields = {
  title: 'Иванов Иван Иванович', lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович',
  categories: ['law', 'finance'], category: 'law', shortDescription: 'Юрист', description: 'Работаю с предпринимателями.',
  services: 'Консультации', workFormats: ['online', 'individual'], audienceTags: ['entrepreneurs'], tariff: 'ambassador', phone: '+7 999 000-00-00',
  email: 'expert@example.ru', website: 'https://example.ru', bookingUrl: 'https://example.ru/book', vk: 'https://vk.com/expert',
  telegram: 'https://t.me/expert', max: 'https://max.ru/expert', otherSocials: ['https://example.com/social'], inn: '',
  videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ', title: '', platform: 'youtube', platformLabel: 'YouTube' }],
  newsInfo: 'Темы публикаций', activities: 'Лекции', comment: 'Только для администрации',
};
const files = [{ url: 'https://example.ru/avatar.jpg', role: 'avatar', size: 1000 }];
const vercel = analyzeVercel('expert', fields, files);
const fastify = analyzeFastify('expert', fields, files);

assert.deepEqual(fastify, vercel);
assert.equal(vercel.missingFields.includes('city'), false);
assert.equal(vercel.missingFields.includes('inn'), false);
assert.deepEqual(vercel.fields.categories, ['law', 'finance']);
assert.deepEqual(vercel.fields.workFormats, ['online', 'individual']);
assert.deepEqual(vercel.fields.audienceTags, ['entrepreneurs']);
assert.equal(vercel.fields.cost, '');
assert.deepEqual(vercel.fields.serviceCatalog, []);
assert.equal(vercel.fields.tariff, 'ambassador');
assert.equal(normalizeExpertTariff('premium'), 'ambassador');
assert.equal(normalizeExpertTariff('start'), 'practice');
assert.equal(hasPremiumExpertAccess('practice'), false);
assert.equal(hasPremiumExpertAccess('ambassador'), true);
assert.equal(hasPremiumExpertAccess('standard'), false);
assert.equal(normalizeExpertVideo('https://max.ru/video/123').platform, 'max');

const completion = calculateExpertProfileCompletion({ ...fields, primaryCategory: 'law', photo: files[0].url, coverPhoto: 'https://example.ru/cover.jpg' });
assert.ok(completion >= 80);

const partnerStart = analyzeVercel('partner', {
  title: 'Студия АПГ', category: 'beauty', shortDescription: 'Студия красоты', description: 'Маникюр и уход.',
  phone: '+7 999 111-22-33', email: 'studio@example.ru', tariff: 'start', bookingUrl: 'https://example.ru/book',
  newsInfo: 'Новости', activities: 'Мастер-классы', inn: '7701234567',
}, files);
assert.equal(partnerStart.fields.tariff, 'start');
assert.equal(partnerStart.fields.bookingUrl, '');
assert.equal(partnerStart.fields.newsInfo, '');
assert.equal(partnerStart.fields.activities, '');
assert.equal(partnerStart.fields.inn, '');

const partnerPremium = analyzeFastify('partner', {
  title: 'Студия АПГ', category: 'beauty', shortDescription: 'Студия красоты', description: 'Маникюр и уход.',
  phone: '+7 999 111-22-33', email: 'studio@example.ru', tariff: 'premium', bookingUrl: 'https://example.ru/book',
  newsInfo: 'Новости', activities: 'Мастер-классы', inn: '7701234567',
}, files);
assert.equal(partnerPremium.fields.tariff, 'premium');
assert.equal(partnerPremium.fields.bookingUrl, 'https://example.ru/book');
assert.equal(partnerPremium.fields.newsInfo, 'Новости');
assert.equal(partnerPremium.fields.activities, 'Мастер-классы');
assert.equal(partnerPremium.fields.inn, '7701234567');
assert.equal(normalizePartnerTariff('альянс'), 'alliance');
assert.equal(normalizeExpertTariff('Практика'), 'practice');
assert.equal(normalizeExpertTariff('Амбассадор'), 'ambassador');
assert.equal(normalizePartnerTariff('alliance'), 'alliance');
assert.equal(hasPartnerAllianceAccess('alliance'), true);
assert.equal(hasPartnerPremiumAccess('alliance'), false);
assert.equal(hasPartnerPremiumAccess('premium'), true);

console.log('Tariff questionnaire V1: expert and partner schemas, API parity, gating and preview contracts passed');
