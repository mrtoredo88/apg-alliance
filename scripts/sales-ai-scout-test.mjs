import assert from 'node:assert/strict';
import { buildScoutQuery, runSalesScout } from '../server/src/lib/salesScout.js';

const food = buildScoutQuery({ city: 'Зеленоград', district: 'Крюково', category: 'food', query: 'семейные' });
assert.match(food, /Зеленоград/);
assert.match(food, /Крюково/);
assert.match(food, /кафе ресторан/);
assert.match(food, /семейные/);
assert.doesNotMatch(food, /официальный сайт контакты/);

const sport = buildScoutQuery({ city: 'Зеленоград', category: 'sport' });
assert.match(sport, /фитнес клуб спортивная школа/);

const fallback = buildScoutQuery({ city: 'Зеленоград', category: 'unknown' });
assert.match(fallback, /локальный бизнес компания/);

const previousKey = process.env.TWOGIS_API_KEY;
const previousFetch = globalThis.fetch;

try {
  delete process.env.TWOGIS_API_KEY;
  delete process.env.DGIS_API_KEY;
  await assert.rejects(
    () => runSalesScout({ city: 'Зеленоград', category: 'food', limit: 2 }),
    error => error?.code === 'sales-ai/scout-provider-unconfigured' && error?.statusCode === 503,
  );

  process.env.TWOGIS_API_KEY = 'test-key';
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'catalog.api.2gis.com');
    assert.equal(url.pathname, '/3.0/items');
    assert.equal(url.searchParams.get('type'), 'branch');
    assert.equal(url.searchParams.get('key'), 'test-key');
    assert.match(url.searchParams.get('q') || '', /Зеленоград/);
    return new Response(JSON.stringify({
      result: {
        items: [
          {
            id: 'dg-1',
            name: 'Тестовое кафе',
            address_name: 'Зеленоград, Центральный проспект, 1',
            point: { lat: 55.99, lon: 37.19 },
            rubrics: [{ name: 'Кафе' }],
            contact_groups: [{ contacts: [
              { type: 'phone', value: '+7 999 000-00-00' },
              { type: 'website', value: 'example.test' },
            ] }],
          },
          {
            id: 'dg-1',
            name: 'Тестовое кафе дубль',
            address_name: 'Зеленоград, Центральный проспект, 1',
          },
        ],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await runSalesScout({ city: 'Зеленоград', category: 'food', limit: 10 });
  assert.equal(result.provider, '2gis');
  assert.equal(result.candidates.length, 1, 'Scout should deduplicate by 2GIS external id');
  const candidate = result.candidates[0];
  assert.equal(candidate.name, 'Тестовое кафе');
  assert.equal(candidate.website, 'https://example.test/');
  assert.equal(candidate.contact, '+7 999 000-00-00');
  assert.equal(candidate.scout.externalId, 'dg-1');
  assert.equal(candidate.scout.address, 'Зеленоград, Центральный проспект, 1');
  assert.ok(candidate.confidence >= 0.8);
  assert.ok(candidate.evidence.some(item => item.field === 'rubrics'));
  assert.ok(candidate.evidence.some(item => item.field === 'coordinates'));
} finally {
  if (previousKey === undefined) delete process.env.TWOGIS_API_KEY;
  else process.env.TWOGIS_API_KEY = previousKey;
  globalThis.fetch = previousFetch;
}

console.log('sales-ai-scout-test: ok');
