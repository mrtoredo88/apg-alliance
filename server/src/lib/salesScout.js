const CATEGORY_QUERIES = {
  food: 'кафе ресторан гастрономический центр',
  beauty: 'салон красоты студия косметология',
  sport: 'фитнес клуб спортивная школа студия спорта',
  education: 'школа курсы детский центр обучение',
  entertainment: 'развлечения квест театр клуб досуг',
  health: 'клиника медицинский центр массаж здоровье',
  pets: 'зоомагазин ветеринарная клиника товары для животных',
  services: 'услуги сервис студия компания',
  other: 'локальный бизнес компания',
};

const PROVIDER = '2gis';
const TWOGIS_ENDPOINT = 'https://catalog.api.2gis.com/3.0/items';

function clean(value, max = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeUrl(value) {
  const raw = clean(value, 1500);
  if (!raw) return '';
  try { return new URL(raw).toString(); } catch { return ''; }
}

function firstContact(item = {}, type) {
  const groups = Array.isArray(item.contact_groups) ? item.contact_groups : [];
  for (const group of groups) {
    for (const contact of Array.isArray(group.contacts) ? group.contacts : []) {
      const kind = String(contact.type || contact.key || '').toLowerCase();
      if (kind === type || (type === 'website' && ['site', 'website'].includes(kind))) {
        return clean(contact.value || contact.text, 1000);
      }
    }
  }
  return '';
}

function extractWebsite(item = {}) {
  const contact = firstContact(item, 'website');
  if (contact) return normalizeUrl(/^https?:\/\//i.test(contact) ? contact : `https://${contact}`);
  const url = normalizeUrl(item.url || item.website || '');
  return url;
}

function extractPhone(item = {}) {
  return firstContact(item, 'phone') || clean(item.phone, 100);
}

function confidenceFor(item = {}, task = {}) {
  let score = 0.56;
  if (item.id) score += 0.08;
  if (item.address_name || item.full_address_name) score += 0.1;
  if (item.point?.lat != null && item.point?.lon != null) score += 0.08;
  if (Array.isArray(item.rubrics) && item.rubrics.length) score += 0.08;
  if (extractWebsite(item)) score += 0.05;
  if (task.city && String(item.full_address_name || item.address_name || '').toLowerCase().includes(String(task.city).toLowerCase())) score += 0.04;
  return Math.max(0, Math.min(0.98, Number(score.toFixed(2))));
}

function buildEvidence(item, task, sourceUrl, confidence) {
  const evidence = [
    { field: 'name', value: clean(item.name, 180), sourceUrl, confidence },
    { field: 'address', value: clean(item.full_address_name || item.address_name, 500), sourceUrl, confidence: item.address_name || item.full_address_name ? 0.94 : 0.3 },
    { field: 'location', value: task.city || '', sourceUrl, confidence: task.city ? 0.82 : 0.2 },
  ];
  if (item.point?.lat != null && item.point?.lon != null) {
    evidence.push({ field: 'coordinates', value: `${item.point.lat},${item.point.lon}`, sourceUrl, confidence: 0.98 });
  }
  if (Array.isArray(item.rubrics) && item.rubrics.length) {
    evidence.push({ field: 'rubrics', value: item.rubrics.map(r => r.name).filter(Boolean).join(', '), sourceUrl, confidence: 0.95 });
  }
  const website = extractWebsite(item);
  if (website) evidence.push({ field: 'website', value: website, sourceUrl, confidence: 0.9 });
  const phone = extractPhone(item);
  if (phone) evidence.push({ field: 'phone', value: phone, sourceUrl, confidence: 0.9 });
  return evidence.filter(entry => entry.value);
}

function buildCandidate(item, task, query) {
  const name = clean(item?.name, 180);
  if (!name) return null;
  const sourceUrl = `https://2gis.ru/search/${encodeURIComponent(name)}`;
  const confidence = confidenceFor(item, task);
  const website = extractWebsite(item);
  const phone = extractPhone(item);
  return {
    name,
    category: task.category || 'other',
    city: task.city || '',
    district: task.district || '',
    website,
    vk: '',
    telegram: '',
    contact: phone,
    source: `scout:${PROVIDER}`,
    sourceUrl,
    snippet: clean(item?.purpose_name || item?.address_comment || item?.description || '', 700),
    confidence,
    evidence: buildEvidence(item, task, sourceUrl, confidence),
    scout: {
      provider: PROVIDER,
      query,
      externalId: clean(item?.id, 180),
      address: clean(item?.full_address_name || item?.address_name, 500),
      latitude: item?.point?.lat ?? null,
      longitude: item?.point?.lon ?? null,
      rubrics: Array.isArray(item?.rubrics) ? item.rubrics.map(r => clean(r?.name, 180)).filter(Boolean).slice(0, 12) : [],
      schedule: item?.schedule || null,
    },
  };
}

async function twoGisSearch(query, count) {
  const apiKey = clean(process.env.TWOGIS_API_KEY || process.env.DGIS_API_KEY, 500);
  if (!apiKey) {
    const error = new Error('Scout не настроен: на сервере отсутствует TWOGIS_API_KEY.');
    error.code = 'sales-ai/scout-provider-unconfigured';
    error.statusCode = 503;
    throw error;
  }

  const pageSize = Math.max(1, Math.min(50, Number(count) || 20));
  const url = new URL(TWOGIS_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'branch');
  url.searchParams.set('locale', 'ru_RU');
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('fields', [
    'items.point',
    'items.address',
    'items.full_address_name',
    'items.rubrics',
    'items.schedule',
    'items.contact_groups',
    'items.description',
  ].join(','));

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'APG-Sales-Scout/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.meta?.error?.message || body?.message || body?.error || `2ГИС search failed (${response.status}).`;
    const error = new Error(message);
    error.code = 'sales-ai/scout-provider-error';
    error.statusCode = 502;
    throw error;
  }
  return Array.isArray(body?.result?.items) ? body.result.items : [];
}

export function buildScoutQuery(task = {}) {
  const city = clean(task.city || 'Зеленоград', 120);
  const district = clean(task.district, 120);
  const category = CATEGORY_QUERIES[task.category] || CATEGORY_QUERIES.other;
  const extra = clean(task.query, 300);
  return [category, extra, district, city].filter(Boolean).join(' ');
}

export async function runSalesScout(task = {}) {
  const limit = Math.max(1, Math.min(50, Number(task.limit) || 20));
  const query = buildScoutQuery(task);
  const results = await twoGisSearch(query, limit);
  const candidates = [];
  const seen = new Set();
  for (const item of results) {
    const candidate = buildCandidate(item, task, query);
    if (!candidate) continue;
    const key = candidate.scout.externalId || `${candidate.name.toLowerCase()}|${candidate.scout.address.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= limit) break;
  }
  return { provider: PROVIDER, query, candidates };
}
