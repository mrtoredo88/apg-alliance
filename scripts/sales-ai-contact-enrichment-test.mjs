import assert from 'node:assert/strict';
import { __test } from '../server/src/lib/salesContactEnrichment.js';
import { __test as osmTest } from '../server/src/lib/salesOsmContacts.js';

const contacts = __test.contactsFromHtml(`
  <a href="mailto:hello@example.ru">Email</a>
  <a href="https://vk.com/example_business">VK</a>
  <a href="https://t.me/example_business">Telegram</a>
`, 'https://example.ru');

assert.equal(contacts.email, 'hello@example.ru');
assert.equal(contacts.vk, 'https://vk.com/example_business');
assert.equal(contacts.telegram, 'https://t.me/example_business');
assert.ok(osmTest.similarity('Тануки, ресторан', 'Тануки') >= 0.9);
const osm = osmTest.rowFromElement({ type: 'node', id: 42, tags: { name: 'Тануки', 'contact:email': 'hello@example.ru', 'contact:website': 'https://example.ru', 'contact:vk': 'tanuki' } });
assert.equal(osm.email, 'hello@example.ru');
assert.equal(osm.vk, 'https://vk.com/tanuki');
console.log(JSON.stringify({ status: 'PASS', fields: Object.keys(contacts).filter(key => contacts[key]), osm: true }));
