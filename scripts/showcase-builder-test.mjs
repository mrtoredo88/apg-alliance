import assert from 'node:assert/strict';
import {
  buildShowcaseDraft,
  buildShowcaseLokiTips,
  buildShowcasePatch,
  calculateShowcaseCompletion,
  moveShowcaseItem,
} from '../src/cabinet/ShowcaseBuilderCore.js';

const partner = {
  id: 'partner-1',
  name: 'Coffee Time',
  category: 'food',
  categoryLabel: 'Кофейня',
  description: 'Кофейня у парка',
  offer: 'Скидка 10%',
  phone: '+79990000000',
  address: 'Зеленоград',
  hours: '10:00-20:00',
  logoUrl: 'https://example.com/logo.webp',
  coverPhoto: 'https://example.com/cover.webp',
  gallery: ['https://example.com/1.webp', 'https://example.com/2.webp'],
  telegramUrl: 'https://telegram.me/apg',
  videos: [{ title: 'Обзор', url: 'https://rutube.ru/video/1' }],
  prices: ['Капучино 220'],
  faq: [{ question: 'Можно с детьми?', answer: 'Да' }],
};

const draft = buildShowcaseDraft(partner, 'partner');
assert.equal(draft.name, 'Coffee Time');
assert.equal(draft.slogan, 'Скидка 10%');
assert.equal(draft.gallery.length, 2);
assert.equal(draft.videos.length, 1);

const completion = calculateShowcaseCompletion(draft, 'partner');
assert.ok(completion.percent >= 80);
assert.equal(completion.checks.find(item => item.id === 'telegram').done, true);

const patch = buildShowcasePatch({ ...draft, district: 'Матушкино', services: ['Завтраки'] }, 'partner');
assert.equal(patch.offer, 'Скидка 10%');
assert.equal(patch.socialUrl, draft.vkUrl || draft.telegramUrl || draft.websiteUrl);
assert.deepEqual(patch.services, ['Завтраки']);
assert.equal(patch.district, 'Матушкино');

const moved = moveShowcaseItem(['a', 'b', 'c'], 1, -1);
assert.deepEqual(moved, ['b', 'a', 'c']);

const expertDraft = buildShowcaseDraft({ name: 'Анна', description: '', bookingUrl: '', gallery: [] }, 'expert');
const tips = buildShowcaseLokiTips(expertDraft, 'expert');
assert.ok(tips.some(item => item.tab === 'media'));
assert.ok(tips.some(item => item.id === 'description'));

console.log('Showcase builder core regression passed');
