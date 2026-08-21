import assert from 'node:assert/strict';
import { __test } from '../server/src/lib/salesContactEnrichment.js';

const contacts = __test.contactsFromHtml(`
  <a href="mailto:hello@example.ru">Email</a>
  <a href="https://vk.com/example_business">VK</a>
  <a href="https://t.me/example_business">Telegram</a>
`, 'https://example.ru');

assert.equal(contacts.email, 'hello@example.ru');
assert.equal(contacts.vk, 'https://vk.com/example_business');
assert.equal(contacts.telegram, 'https://t.me/example_business');
console.log(JSON.stringify({ status: 'PASS', fields: Object.keys(contacts).filter(key => contacts[key]) }));

