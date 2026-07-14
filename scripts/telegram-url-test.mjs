import assert from 'node:assert/strict';
import { TELEGRAM_BASE_URL, TELEGRAM_HOST, telegramPath, telegramShareUrl, telegramUrl } from '../server-shared/telegram.js';

const legacyHost = ['t', 'me'].join('.');

assert.equal(TELEGRAM_HOST, 'telegram.me');
assert.equal(TELEGRAM_BASE_URL, 'https://telegram.me');
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
