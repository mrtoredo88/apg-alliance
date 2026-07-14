import assert from 'node:assert/strict';
import { analyzePublicSubmission as analyzeFastify } from '../server/src/routes/public-submit.js';
import { calculateExpertProfileCompletion, hasPremiumExpertAccess, normalizeExpertVideo } from '../src/expertProfileForm.js';
import { hasPartnerAllianceAccess, hasPartnerPremiumAccess, normalizeExpertTariff, normalizePartnerTariff } from '../src/tariffConfig.js';
import { EXPERT_CATEGORIES, getExpertCategory, getExpertTelHref, normalizeExpertPhone, normalizeExpertRecord, validateExpertCategories } from '../server-shared/expert-directory.js';

const fields = {
  title: 'Иванов Иван Иванович', lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович',
  categories: ['law', 'finance'], category: 'law', shortDescription: 'Юрист', description: 'Работаю с предпринимателями.',
  services: 'Консультации', workFormats: ['online', 'individual'], audienceTags: ['entrepreneurs'], tariff: 'ambassador', phone: '+7 999 000-00-00',
  email: 'expert@example.ru', website: 'https://example.ru', bookingUrl: 'https://example.ru/book', vk: 'https://vk.com/expert',
  telegram: 'https://telegram.me/expert', max: 'https://max.ru/expert', otherSocials: ['https://example.com/social'], inn: '',
  whatsapp: '+7 999 000-00-00', address: 'Зеленоград', hours: 'Пн-Пт 10:00-19:00', experience: '15 лет', cost: 'от 3 000 ₽', offer: 'Первая консультация бесплатно',
  videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ', title: '', platform: 'youtube', platformLabel: 'YouTube' }],
  newsInfo: 'Темы публикаций', activities: 'Лекции', comment: 'Только для администрации',
};
const files = [{ url: 'https://example.ru/avatar.jpg', role: 'avatar', size: 1000 }];
const fastify = analyzeFastify('expert', fields, files);

assert.equal(fastify.missingFields.includes('city'), false);
assert.equal(fastify.missingFields.includes('inn'), false);
assert.deepEqual(fastify.fields.categories, ['law', 'finance']);
assert.deepEqual(fastify.fields.workFormats, ['online', 'individual']);
assert.deepEqual(fastify.fields.audienceTags, ['entrepreneurs']);
assert.equal(fastify.fields.cost, 'от 3 000 ₽');
assert.equal(fastify.fields.phone, '+79990000000');
assert.equal(fastify.fields.experience, '15 лет');
assert.equal(fastify.fields.offer, 'Первая консультация бесплатно');
assert.equal(fastify.fields.whatsapp, 'https://wa.me/79990000000');
assert.deepEqual(fastify.fields.serviceCatalog, []);
assert.equal(fastify.fields.tariff, 'ambassador');
assert.equal(normalizeExpertTariff('premium'), 'ambassador');
assert.equal(normalizeExpertTariff('start'), 'practice');
assert.equal(hasPremiumExpertAccess('practice'), false);
assert.equal(hasPremiumExpertAccess('ambassador'), true);
assert.equal(hasPremiumExpertAccess('standard'), false);
assert.equal(normalizeExpertVideo('https://max.ru/video/123').platform, 'max');
assert.equal(normalizeExpertPhone('8 (985) 548-08-59'), '+79855480859');
assert.equal(getExpertTelHref('+7 985 548-08-59'), 'tel:+79855480859');
assert.equal(getExpertCategory('real_estate')?.label, 'Недвижимость');
assert.equal(validateExpertCategories(EXPERT_CATEGORIES.map(item => item.id)).unknown.length, 0);
assert.equal(validateExpertCategories(['несуществующая']).valid, false);
const normalizedExpert = normalizeExpertRecord({ category: 'kids', phone: '89855480859', specialOffer: 'Бонус', workFormats: ['online', 'groups'] });
assert.equal(normalizedExpert.category, 'children');
assert.equal(normalizedExpert.phone, '+79855480859');
assert.equal(normalizedExpert.offer, 'Бонус');
assert.ok(normalizedExpert.formats.includes('group'));

const completion = calculateExpertProfileCompletion({ ...fields, primaryCategory: 'law', photo: files[0].url, coverPhoto: 'https://example.ru/cover.jpg' });
assert.ok(completion >= 80);

const partnerStart = analyzeFastify('partner', {
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

console.log('Tariff questionnaire V1: expert and partner schemas, Fastify analyzer, gating and preview contracts passed');
