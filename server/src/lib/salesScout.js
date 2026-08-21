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

const PROVIDER = 'brave';

function clean(value, max = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeUrl(value) {
  const raw = clean(value, 1500);
  if (!raw) return '';
  try { return new URL(raw).toString(); } catch { return ''; }
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function titleToBusinessName(title = '') {
  return clean(String(title).split(/[|•—–-]/)[0], 180);
}

function confidenceFor(result = {}, city = '') {
  const text = `${result.title || ''} ${result.description || ''}`.toLowerCase();
  const host = hostnameOf(result.url || '');
  let score = 0.42;
  if (host) score += 0.16;
  if (city && text.includes(String(city).toLowerCase())) score += 0.16;
  if (/официальн|контакт|адрес|телефон|запис|услуг|меню|расписан/.test(text)) score += 0.12;
  if (/vk\.com|t\.me|instagram\.com|2gis\.|yandex\./.test(result.url || '')) score += 0.06;
  return Math.max(0, Math.min(0.98, Number(score.toFixed(2))));
}

function classifyLink(url = '') {
  const host = hostnameOf(url);
  if (host === 'vk.com' || host.endsWith('.vk.com')) return 'vk';
  if (host === 't.me' || host === 'telegram.me') return 'telegram';
  return 'website';
}

function buildCandidate(result, task, query) {
  const url = normalizeUrl(result?.url);
  const name = titleToBusinessName(result?.title);
  if (!url || !name) return null;
  const kind = classifyLink(url);
  const candidate = {
    name,
    category: task.category || 'other',
    city: task.city || '',
    district: task.district || '',
    website: kind === 'website' ? url : '',
    vk: kind === 'vk' ? url : '',
    telegram: kind === 'telegram' ? url : '',
    source: `scout:${PROVIDER}`,
    sourceUrl: url,
    snippet: clean(result?.description, 700),
    confidence: confidenceFor(result, task.city),
    evidence: [
      { field: 'name', value: name, sourceUrl: url, confidence: confidenceFor(result, task.city) },
      { field: kind, value: url, sourceUrl: url, confidence: 0.98 },
      { field: 'location', value: task.city || '', sourceUrl: url, confidence: task.city ? 0.58 : 0.2 },
    ].filter(item => item.value),
    scout: { provider: PROVIDER, query, rank: Number(result?.profile?.long_name ? 0 : 0) },
  };
  return candidate;
}

async function braveSearch(query, count) {
  const apiKey = clean(process.env.BRAVE_SEARCH_API_KEY, 500);
  if (!apiKey) {
    const error = new Error('Scout не настроен: на сервере отсутствует BRAVE_SEARCH_API_KEY.');
    error.code = 'sales-ai/scout-provider-unconfigured';
    error.statusCode = 503;
    throw error;
  }
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.max(1, Math.min(20, count))));
  url.searchParams.set('search_lang', 'ru');
  url.searchParams.set('country', 'RU');
  url.searchParams.set('safesearch', 'moderate');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
      'User-Agent': 'APG-Sales-Scout/1.0',
    },
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Scout search failed (${response.status}).`);
    error.code = 'sales-ai/scout-provider-error';
    error.statusCode = 502;
    throw error;
  }
  return Array.isArray(body?.web?.results) ? body.web.results : [];
}

export function buildScoutQuery(task = {}) {
  const city = clean(task.city || 'Зеленоград', 120);
  const district = clean(task.district, 120);
  const category = CATEGORY_QUERIES[task.category] || CATEGORY_QUERIES.other;
  const extra = clean(task.query, 300);
  return [city, district, category, extra, 'официальный сайт контакты'].filter(Boolean).join(' ');
}

export async function runSalesScout(task = {}) {
  const limit = Math.max(1, Math.min(50, Number(task.limit) || 20));
  const query = buildScoutQuery(task);
  const results = await braveSearch(query, Math.min(limit * 2, 20));
  const candidates = [];
  const seen = new Set();
  for (const result of results) {
    const candidate = buildCandidate(result, task, query);
    if (!candidate) continue;
    const key = `${candidate.name.toLowerCase()}|${hostnameOf(candidate.sourceUrl)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= limit) break;
  }
  return { provider: PROVIDER, query, candidates };
}
