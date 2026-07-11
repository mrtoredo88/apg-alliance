import assert from 'node:assert/strict';
import { analyzePublicSubmission as analyzeVercel } from '../api/public-submit.js';
import { analyzePublicSubmission as analyzeFastify } from '../server/src/routes/public-submit.js';
import { calculateExpertProfileCompletion, hasPremiumExpertAccess, normalizeExpertVideo } from '../src/expertProfileForm.js';

const fields = {
  title: 'Иванов Иван Иванович', lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович',
  categories: ['law', 'finance'], category: 'law', shortDescription: 'Юрист', description: 'Работаю с предпринимателями.',
  services: 'Консультации', workFormats: ['online', 'individual'], tariff: 'premium', phone: '+7 999 000-00-00',
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
assert.equal(vercel.fields.cost, '');
assert.deepEqual(vercel.fields.serviceCatalog, []);
assert.equal(hasPremiumExpertAccess('premium'), true);
assert.equal(hasPremiumExpertAccess('ambassador'), true);
assert.equal(hasPremiumExpertAccess('standard'), false);
assert.equal(normalizeExpertVideo('https://max.ru/video/123').platform, 'max');

const completion = calculateExpertProfileCompletion({ ...fields, primaryCategory: 'law', photo: files[0].url, coverPhoto: 'https://example.ru/cover.jpg' });
assert.ok(completion >= 80);
console.log('Expert questionnaire V2: dynamic tariff schema, API parity, draft and preview checks passed');
