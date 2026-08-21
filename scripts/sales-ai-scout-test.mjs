import assert from 'node:assert/strict';
import { buildScoutQuery } from '../server/src/lib/salesScout.js';

const food = buildScoutQuery({ city: 'Зеленоград', district: 'Крюково', category: 'food', query: 'семейные' });
assert.match(food, /Зеленоград/);
assert.match(food, /Крюково/);
assert.match(food, /кафе ресторан/);
assert.match(food, /семейные/);
assert.match(food, /официальный сайт контакты/);

const sport = buildScoutQuery({ city: 'Зеленоград', category: 'sport' });
assert.match(sport, /фитнес клуб спортивная школа/);

const fallback = buildScoutQuery({ city: 'Зеленоград', category: 'unknown' });
assert.match(fallback, /локальный бизнес компания/);

console.log('sales-ai-scout-test: ok');
