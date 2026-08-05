import assert from 'node:assert/strict';
import { buildPersonalQrLink, buildReferralInviteText, buildReferralLink, buildReferralShareData } from '../src/referralInvite.js';
import { APP_URL } from '../src/constants.js';

const link = buildReferralLink({ id: 'user 42' });
assert.equal(link, `${APP_URL}/?ref=user%2042#ref=user%2042`);
const qrLink = buildPersonalQrLink({ id: 'user 42' });
assert.equal(qrLink, `${APP_URL}/?ref=user+42&source=personal_qr&qr=v2#ref=user%2042`);
assert.match(qrLink, /^https:\/\//, 'personal QR must always contain a scannable HTTPS link');

const text = buildReferralInviteText(link);
assert.equal(text, `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${link}`);
assert.ok(!/ключ|Стрик|Партнёров посещено|участник АПГ|Участник/.test(text));
assert.ok(text.includes('?ref=user%2042'));
assert.deepEqual(buildReferralShareData(link), {
  title: 'АПГ — Альянс Партнёров Города',
  text: 'Присоединяйся к Альянсу Партнёров Зеленограда 👇',
  url: link,
});

assert.equal(buildReferralInviteText(APP_URL), `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${APP_URL}`);

console.log('Referral invite template regression passed');
