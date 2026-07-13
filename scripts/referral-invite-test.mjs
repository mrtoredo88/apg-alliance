import assert from 'node:assert/strict';
import { buildReferralInviteText, buildReferralLink } from '../src/referralInvite.js';
import { APP_URL } from '../src/constants.js';

const link = buildReferralLink({ id: 'user 42' });
assert.equal(link, `${APP_URL}/?ref=user%2042`);

const text = buildReferralInviteText(link);
assert.equal(text, `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${link}`);
assert.ok(!/ключ|Стрик|Партнёров посещено|участник АПГ|Участник/.test(text));
assert.ok(text.includes('?ref=user%2042'));

assert.equal(buildReferralInviteText(APP_URL), `Присоединяйся к Альянсу Партнёров Зеленограда 👇\n${APP_URL}`);

console.log('Referral invite template regression passed');
