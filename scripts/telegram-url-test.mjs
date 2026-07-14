import assert from 'node:assert/strict';
import { TELEGRAM_BASE_URL, TELEGRAM_HOST, normalizeTelegramUrl, telegramPath, telegramShareUrl, telegramUrl } from '../server-shared/telegram.js';
import { normalizeExternalUrl } from '../src/utils/externalUrls.js';

const legacyHost = ['t', 'me'].join('.');

assert.equal(TELEGRAM_HOST, 'telegram.me');
assert.equal(TELEGRAM_BASE_URL, 'https://telegram.me');

const cases = [
  [`https://${legacyHost}/test`, 'https://telegram.me/test'],
  [`http://${legacyHost}/test`, 'https://telegram.me/test'],
  [`${legacyHost}/test`, 'https://telegram.me/test'],
  ['telegram.me/test', 'https://telegram.me/test'],
  ['http://telegram.me/test', 'https://telegram.me/test'],
  ['www.telegram.me/test', 'https://telegram.me/test'],
  ['https://telegram.me/test', 'https://telegram.me/test'],
  ['@test', 'https://telegram.me/test'],
  ['test', 'https://telegram.me/test'],
  ['/test', 'https://telegram.me/test'],
  ['joinchat/AAAA', 'https://telegram.me/joinchat/AAAA'],
  ['+AAAA', 'https://telegram.me/+AAAA'],
  ['share/url?url=https%3A%2F%2Fmyapg.ru%2F', 'https://telegram.me/share/url?url=https%3A%2F%2Fmyapg.ru%2F'],
  ['test?start=abc&ref=apg', 'https://telegram.me/test?start=abc&ref=apg'],
  ['test#profile', 'https://telegram.me/test#profile'],
  [`https://${legacyHost}/test?start=abc#profile`, 'https://telegram.me/test?start=abc#profile'],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeTelegramUrl(input), expected, input);
  assert.equal(telegramUrl(input), expected, input);
  assert.equal(normalizeExternalUrl(input, { platform: 'telegram' }), expected, input);
}

assert.equal(normalizeExternalUrl(`${legacyHost}/generic`), 'https://telegram.me/generic');

assert.equal(telegramUrl('apg_zelenograd_bot?start=auth_abc'), 'https://telegram.me/apg_zelenograd_bot?start=auth_abc');
assert.equal(telegramUrl('/apgzel'), 'https://telegram.me/apgzel');
assert.equal(telegramUrl('@apgzel'), 'https://telegram.me/apgzel');
assert.equal(telegramUrl('https://telegram.me/apgzel'), 'https://telegram.me/apgzel');
assert.equal(telegramUrl(`https://${legacyHost}/apgzel`), 'https://telegram.me/apgzel');
assert.equal(telegramPath(`http://${legacyHost}/share/url?url=https://myapg.ru/`), 'share/url?url=https://myapg.ru/');

const share = telegramShareUrl({ url: 'https://myapg.ru/?ref=abc', text: 'АПГ Зеленоград' });
assert.ok(share.startsWith('https://telegram.me/share/url?'));
assert.ok(share.includes('url=https%3A%2F%2Fmyapg.ru%2F%3Fref%3Dabc'));
assert.ok(share.includes('text=%D0%90%D0%9F%D0%93+%D0%97%D0%B5%D0%BB%D0%B5%D0%BD%D0%BE%D0%B3%D1%80%D0%B0%D0%B4'));

console.log('Telegram URL migration contract passed');
