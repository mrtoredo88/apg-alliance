const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CITY_BBOX = {
  'зеленоград': [55.93, 37.12, 56.05, 37.28],
};

let cache = { key: '', expiresAt: 0, rows: [] };

const clean = (value, max = 1500) => String(value ?? '').trim().slice(0, max);
const normalizeName = value => clean(value, 300)
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/[^а-яa-z0-9]+/g, ' ')
  .replace(/\b(кафе|ресторан|бар|кофейня|караоке|клуб|чайхана|корчма)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function similarity(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const aa = new Set(a.split(' '));
  const bb = new Set(b.split(' '));
  const overlap = [...aa].filter(token => bb.has(token)).length;
  return overlap / Math.max(aa.size, bb.size);
}

function tag(tags = {}, ...keys) {
  for (const key of keys) if (clean(tags[key])) return clean(tags[key]);
  return '';
}

function socialUrl(value, host) {
  const raw = clean(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${host}/${raw.replace(/^@/, '')}`;
}

function rowFromElement(element = {}) {
  const tags = element.tags || {};
  return {
    externalId: `osm:${element.type}:${element.id}`,
    name: clean(tags.name, 300),
    phone: tag(tags, 'contact:phone', 'phone', 'contact:mobile', 'mobile'),
    email: tag(tags, 'contact:email', 'email'),
    website: tag(tags, 'contact:website', 'website', 'url'),
    vk: socialUrl(tag(tags, 'contact:vk', 'vk'), 'vk.com'),
    telegram: socialUrl(tag(tags, 'contact:telegram', 'telegram'), 't.me'),
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', '),
  };
}

async function loadCity(city = 'Зеленоград') {
  const key = clean(city, 120).toLowerCase();
  const bbox = CITY_BBOX[key];
  if (!bbox) return [];
  if (cache.key === key && cache.expiresAt > Date.now()) return cache.rows;
  const query = `[out:json][timeout:25];nwr["name"]["amenity"~"restaurant|cafe|bar|fast_food|pub"](${bbox.join(',')});out tags center;`;
  let body = null;
  let lastStatus = 'network';
  for (const endpoint of OVERPASS_URLS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'APG-Sales-Contact-Enricher/1.0 (+https://myapg.ru)' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12000),
      });
      lastStatus = response.status;
      if (!response.ok) continue;
      body = await response.json();
      break;
    } catch (error) {
      lastStatus = error?.name === 'TimeoutError' ? 'timeout' : 'network';
    }
  }
  if (!body) throw new Error(`OpenStreetMap Overpass временно недоступен (${lastStatus}).`);
  const rows = (Array.isArray(body.elements) ? body.elements : []).map(rowFromElement).filter(row => row.name);
  cache = { key, rows, expiresAt: Date.now() + CACHE_TTL_MS };
  return rows;
}

export async function findOsmBusiness(lead = {}) {
  const rows = await loadCity(lead.city || 'Зеленоград');
  const ranked = rows.map(row => ({ row, score: similarity(lead.name, row.name) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.82 ? { ...ranked[0].row, confidence: ranked[0].score } : null;
}

export const __test = { normalizeName, similarity, rowFromElement };
