import crypto from 'crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { FieldValue } from '../lib/documentValues.js';
import { getDb } from '../lib/documentStore.js';
import { requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const DEFAULT_SETTINGS = {
  intervalMinutes: 10,
  confidenceThreshold: 70,
  maxItemsPerRun: 20,
  categories: ['society', 'culture', 'education', 'transport', 'economy', 'sport'],
};

function safeString(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function stripHtml(value) {
  return safeString(value, 8000)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFor(text) {
  const value = text.toLowerCase();
  const pairs = [
    ['transport', ['транспорт', 'дорог', 'автобус', 'маршрут', 'парковк']],
    ['culture', ['культур', 'театр', 'концерт', 'выстав', 'фестиваль']],
    ['education', ['школ', 'образован', 'курс', 'лекц', 'университет']],
    ['sport', ['спорт', 'матч', 'турнир', 'забег', 'трениров']],
    ['economy', ['бизнес', 'предприним', 'эконом', 'инвест', 'рынок']],
  ];
  return pairs.find(([, keys]) => keys.some(key => value.includes(key)))?.[0] || 'society';
}

function importanceFor(text) {
  const value = text.toLowerCase();
  if (/(срочно|важно|экстренн|закрыт|ограничен|предупрежд)/.test(value)) return 'high';
  if (/(сегодня|завтра|открыт|начинается|регистрац)/.test(value)) return 'normal';
  return 'low';
}

function confidenceFor(item, duplicate) {
  let score = 62;
  if (item.title?.length > 18) score += 10;
  if (item.text?.length > 160) score += 10;
  if (item.sourceUrl) score += 8;
  if (item.imageUrl) score += 5;
  if (duplicate) score -= 35;
  return Math.max(30, Math.min(99, score));
}

function readingTime(text) {
  return Math.max(1, Math.ceil(stripHtml(text).split(/\s+/).filter(Boolean).length / 170));
}

function explain(item, category, importance, duplicate) {
  if (duplicate) return 'Локи нашёл похожий материал, поэтому черновик требует проверки редактором.';
  if (importance === 'high') return 'Материал содержит признаки важного городского сообщения и может быть полезен жителям.';
  if (category !== 'society') return `Материал относится к категории ${category} и дополняет редакционную повестку АПГ.`;
  return 'Материал подходит для городской ленты: есть источник, тема и потенциальная польза для жителей.';
}

function makeDraft(source, item, duplicate = false) {
  const rawText = stripHtml(item.text || item.description || item.summary || '');
  const title = safeString(item.title || rawText.slice(0, 80) || 'Новый материал', 180);
  const category = categoryFor(`${title} ${rawText}`);
  const importance = importanceFor(`${title} ${rawText}`);
  const confidence = confidenceFor({ ...item, title, text: rawText }, duplicate);
  const summary = rawText ? rawText.slice(0, 220) : 'Локи подготовил черновик на основе найденного материала.';
  return {
    title: title.replace(/\s+/g, ' '),
    summary,
    text: [
      `${title}`,
      '',
      rawText || 'Текст материала требует ручного уточнения редактором.',
      '',
      `Источник: ${source.name}`,
      item.url ? `Оригинал: ${item.url}` : '',
    ].filter(Boolean).join('\n'),
    category,
    tags: Array.from(new Set([category, source.type, importance].filter(Boolean))).slice(0, 8),
    importance,
    confidence,
    readingTime: readingTime(rawText),
    imageUrl: item.imageUrl || '',
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    sourceUrl: item.url || source.url || '',
    originalTitle: title,
    originalPublishedAt: item.publishedAt || null,
    status: duplicate ? 'duplicate' : 'ready',
    explain: explain(item, category, importance, duplicate),
    ai: { engine: 'loki-editor-v1', mode: 'assistive', autoPublish: false },
  };
}

export function parseRss(xml) {
  const items = [...String(xml || '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].slice(0, 30);
  return items.map(match => {
    const block = match[0];
    const pick = (tag) => stripHtml((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1] || '');
    const image = (block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] || '';
    const link = (block.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || pick('link') || pick('guid');
    return {
      title: pick('title'),
      text: pick('description') || pick('summary') || pick('content:encoded') || pick('content'),
      url: link,
      publishedAt: pick('pubDate') || pick('published') || pick('updated') || null,
      imageUrl: image,
    };
  }).filter(item => item.title || item.text);
}

export function parseJson(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.posts) ? data.posts : [];
  return rows.slice(0, 30).map(item => ({
    title: safeString(item.title || item.name || item.text?.slice?.(0, 80), 180),
    text: safeString(item.text || item.description || item.summary || item.body, 8000),
    url: safeString(item.url || item.linkUrl || item.link, 1000),
    imageUrl: safeString(item.imageUrl || item.coverPhoto || item.photo, 1000),
    publishedAt: item.publishedAt || item.createdAt || null,
  })).filter(item => item.title || item.text);
}

const WEBSITE_SECTION_RE = /(новост|афиш|событ|мероприят|репертуар|спектак|news|event|poster|schedule|repertoire)/i;
const WEBSITE_IGNORE_RE = /(privacy|cookie|agreement|политик|соглашен|контакт|about|login|signin|mailto:|tel:|javascript:)/i;
const MAX_SOURCE_BYTES = 2_000_000;

function isPrivateAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

export async function validatePublicUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('Укажите корректный URL, например https://vedogon.ru/.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Источник должен использовать http:// или https://.');
  if (url.username || url.password) throw new Error('URL источника не должен содержать логин или пароль.');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('Можно добавлять только публично доступные сайты.');
  if (net.isIP(hostname) && isPrivateAddress(hostname)) throw new Error('Можно добавлять только публично доступные сайты.');
  let addresses;
  try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }); } catch { throw new Error('Не удалось найти сайт по указанному адресу.'); }
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('Можно добавлять только публично доступные сайты.');
  return url;
}

async function fetchPublicResponse(value, options = {}) {
  let url = await validatePublicUrl(value);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'APG Loki Editor/1.0', Accept: 'text/html, application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5', ...(options.headers || {}) },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Сайт вернул перенаправление без адреса.');
      url = await validatePublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`Сайт вернул ошибку HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_SOURCE_BYTES) throw new Error('Ответ сайта слишком большой для безопасной обработки.');
    return { response, url };
  }
  throw new Error('Сайт перенаправляет запрос слишком много раз.');
}

async function responseText(response) {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES) throw new Error('Ответ сайта слишком большой для безопасной обработки.');
  return text;
}

function absoluteHttpUrl(value, baseUrl) {
  try {
    const url = new URL(stripHtml(value), baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href.split('#')[0] : '';
  } catch { return ''; }
}

function extractAnchors(html, baseUrl) {
  return [...String(html || '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({
    url: absoluteHttpUrl(match[1], baseUrl),
    title: stripHtml(match[2]),
  })).filter(item => item.url && item.title);
}

function extractMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  return stripHtml(patterns.map(pattern => String(html || '').match(pattern)?.[1]).find(Boolean) || '');
}

function pageAsItem(html, url) {
  const title = extractMeta(html, 'og:title') || stripHtml(String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const text = extractMeta(html, 'og:description') || extractMeta(html, 'description');
  const imageUrl = absoluteHttpUrl(extractMeta(html, 'og:image'), url);
  return title ? { title, text, url, imageUrl, publishedAt: null } : null;
}

function discoverFeedUrl(html, baseUrl) {
  const links = [...String(html || '').matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  for (const link of links) {
    if (!/(application\/(rss\+xml|atom\+xml)|text\/xml)/i.test(link)) continue;
    const href = link.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = absoluteHttpUrl(href, baseUrl);
    if (url) return url;
  }
  return '';
}

export async function discoverWebsiteItems(source) {
  const root = await fetchPublicResponse(source.url);
  const contentType = root.response.headers.get('content-type') || '';
  if (!/html|xhtml/i.test(contentType)) throw new Error('По этому адресу не найдена обычная HTML-страница сайта.');
  const homeHtml = await responseText(root.response);
  const feedUrl = discoverFeedUrl(homeHtml, root.url.href);
  if (feedUrl) {
    const feed = await fetchPublicResponse(feedUrl);
    const feedItems = parseRss(await responseText(feed.response));
    if (feedItems.length) return { items: feedItems, discoveredUrls: [feedUrl], discovery: 'rss' };
  }

  const rootHost = root.url.hostname;
  const anchors = extractAnchors(homeHtml, root.url.href);
  const navigationUrls = new Set(anchors.map(item => item.url));
  const sectionUrls = Array.from(new Set(anchors
    .filter(item => new URL(item.url).hostname === rootHost && WEBSITE_SECTION_RE.test(`${item.title} ${item.url}`) && !WEBSITE_IGNORE_RE.test(item.url))
    .map(item => item.url))).slice(0, 6);
  const pages = sectionUrls.length ? sectionUrls : [root.url.href];
  const items = [];
  for (const pageUrl of pages) {
    const page = pageUrl === root.url.href ? { html: homeHtml, url: root.url.href } : await (async () => {
      const result = await fetchPublicResponse(pageUrl);
      return { html: await responseText(result.response), url: result.url.href };
    })();
    const pageLinks = extractAnchors(page.html, page.url).filter(item => {
      const url = new URL(item.url);
      return url.hostname === rootHost && item.url !== page.url && !navigationUrls.has(item.url) && item.title.length >= 12 && item.title.length <= 220 && !WEBSITE_IGNORE_RE.test(`${item.url} ${item.title}`) && (WEBSITE_SECTION_RE.test(`${item.url} ${item.title}`) || pageUrl !== root.url.href);
    });
    pageLinks.slice(0, 20).forEach(item => items.push({ ...item, text: item.title, imageUrl: '', publishedAt: null }));
    if (!pageLinks.length) {
      const fallback = pageAsItem(page.html, page.url);
      if (fallback && page.url !== root.url.href) items.push(fallback);
    }
  }
  const unique = Array.from(new Map(items.map(item => [item.url, item])).values()).slice(0, 30);
  if (!unique.length) throw new Error('Не удалось автоматически найти публичные разделы с новостями или афишей. Проверьте адрес либо добавьте RSS/XML или JSON этого сайта.');
  return { items: unique, discoveredUrls: pages, discovery: 'html' };
}

async function fetchSourceItems(source) {
  if (source.type === 'manual') return { items: Array.isArray(source.manualItems) ? source.manualItems : [], discoveredUrls: [], discovery: 'manual' };
  if (source.type === 'website') return discoverWebsiteItems(source);
  const { response } = await fetchPublicResponse(source.url);
  if (source.type === 'json') return { items: parseJson(await response.json()), discoveredUrls: [], discovery: 'json' };
  return { items: parseRss(await responseText(response)), discoveredUrls: [], discovery: 'rss' };
}

async function getSettings(db) {
  const snap = await db.collection('config').doc('lokiEditor').get();
  return { ...DEFAULT_SETTINGS, ...(snap.exists ? snap.data() : {}) };
}

async function getStatus(db) {
  const [sources, drafts, runs, activity, settings] = await Promise.all([
    db.collection('aiSources').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('aiDrafts').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('aiEditorRuns').orderBy('createdAt', 'desc').limit(10).get(),
    db.collection('aiEditorActivity').orderBy('createdAt', 'desc').limit(80).get(),
    getSettings(db),
  ]);
  const draftRows = drafts.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    ok: true,
    settings,
    sources: sources.docs.map(d => ({ id: d.id, ...d.data() })),
    drafts: draftRows,
    runs: runs.docs.map(d => ({ id: d.id, ...d.data() })),
    activity: activity.docs.map(d => ({ id: d.id, ...d.data() })),
    stats: {
      found: draftRows.length,
      ready: draftRows.filter(d => d.status === 'ready').length,
      duplicates: draftRows.filter(d => d.status === 'duplicate').length,
      errors: draftRows.filter(d => d.status === 'error').length,
      published: draftRows.filter(d => d.status === 'published').length,
      lastRunAt: runs.docs[0]?.data()?.createdAt || null,
    },
  };
}

async function logActivity(db, entry) {
  await db.collection('aiEditorActivity').add({ ...entry, createdAt: FieldValue.serverTimestamp() });
}

async function runCycle(db, actor, req) {
  const settings = await getSettings(db);
  const sourceSnap = await db.collection('aiSources').where('active', '==', true).limit(100).get();
  let found = 0, prepared = 0, duplicates = 0, errors = 0;
  const runRef = await db.collection('aiEditorRuns').add({ status: 'running', createdAt: FieldValue.serverTimestamp(), actorId: actor.userId });

  for (const doc of sourceSnap.docs) {
    const source = { id: doc.id, ...doc.data() };
    try {
      const fetched = await fetchSourceItems(source);
      const items = fetched.items.slice(0, Number(settings.maxItemsPerRun || 20));
      if (!items.length) throw new Error('Источник доступен, но в нём не найдено материалов для редакции.');
      found += items.length;
      for (const item of items) {
        const sourceUrl = safeString(item.url || source.url, 1000);
        const fingerprint = hash(`${sourceUrl}|${item.title}|${safeString(item.text, 500)}`);
        const existing = await db.collection('aiDrafts').where('fingerprint', '==', fingerprint).limit(1).get();
        if (!existing.empty) {
          duplicates++;
          await existing.docs[0].ref.set({ fetchedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          continue;
        }
        const duplicate = sourceUrl && !(await db.collection('news').where('linkUrl', '==', sourceUrl).limit(1).get()).empty;
        const draft = makeDraft(source, item, duplicate);
        await db.collection('aiDrafts').doc(fingerprint.slice(0, 24)).set({
          ...draft,
          fingerprint,
          fetchedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (duplicate) duplicates++; else prepared++;
      }
      await doc.ref.set({ status: 'ok', lastCheckedAt: FieldValue.serverTimestamp(), lastError: null, discovery: fetched.discovery || source.type, discoveredUrls: fetched.discoveredUrls || [] }, { merge: true });
      await logActivity(db, { type: 'source_checked', sourceId: source.id, sourceName: source.name, found: items.length, discovery: fetched.discovery || source.type, actorId: actor.userId });
    } catch (error) {
      errors++;
      await doc.ref.set({ status: 'error', lastCheckedAt: FieldValue.serverTimestamp(), lastError: safeString(error.message, 500), discoveredUrls: [] }, { merge: true });
      await logActivity(db, { type: 'source_error', sourceId: source.id, sourceName: source.name, error: safeString(error.message, 500), actorId: actor.userId });
    }
  }

  await runRef.set({ status: 'done', found, prepared, duplicates, errors, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeAuditLog(db, req, actor, 'loki-editor:run', 'aiEditorRuns', runRef.id, { found, prepared, duplicates, errors });
  return { ok: true, runId: runRef.id, found, prepared, duplicates, errors };
}

async function saveSource(db, req, actor) {
  const source = req.body?.source || {};
  const type = safeString(source.type || 'rss', 40);
  if (!['website', 'rss', 'json'].includes(type)) {
    const error = new Error('Выберите тип источника: Сайт, RSS/XML или JSON.');
    error.statusCode = 400;
    throw error;
  }
  const url = (await validatePublicUrl(source.url)).href;
  const id = safeString(source.id, 120) || db.collection('aiSources').doc().id;
  const patch = {
    name: safeString(source.name || 'Новый источник', 180),
    type,
    url: safeString(url, 1000),
    method: safeString(source.method || 'GET', 20),
    intervalMinutes: Math.max(1, Number(source.intervalMinutes || 10)),
    active: source.active !== false,
    status: safeString(source.status || 'new', 40),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: source.id ? source.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
  };
  await db.collection('aiSources').doc(id).set(patch, { merge: true });
  await writeAuditLog(db, req, actor, 'loki-editor:source-save', 'aiSources', id, { label: patch.name });
  return { ok: true, id };
}

async function updateDraft(db, req, actor) {
  const id = safeString(req.body?.id, 120);
  if (!id) throw new Error('draft id required');
  const patch = {};
  ['title', 'summary', 'text', 'category', 'importance', 'status', 'imageUrl', 'sourceUrl', 'explain'].forEach(key => {
    if (req.body?.patch?.[key] !== undefined) patch[key] = req.body.patch[key];
  });
  if (Array.isArray(req.body?.patch?.tags)) patch.tags = req.body.patch.tags.map(v => safeString(v, 40)).slice(0, 12);
  patch.updatedAt = FieldValue.serverTimestamp();
  patch.editorActions = FieldValue.arrayUnion({ action: safeString(req.body?.editorAction || 'update', 40), actorId: actor.userId, at: new Date().toISOString() });
  await db.collection('aiDrafts').doc(id).set(patch, { merge: true });
  await logActivity(db, { type: 'draft_update', draftId: id, status: patch.status || null, actorId: actor.userId });
  return { ok: true };
}

async function publishDraft(db, req, actor) {
  const id = safeString(req.body?.id, 120);
  const snap = await db.collection('aiDrafts').doc(id).get();
  if (!snap.exists) throw new Error('draft not found');
  const draft = snap.data();
  const ref = await db.collection('news').add({
    title: safeString(req.body?.patch?.title || draft.title, 180),
    text: safeString(req.body?.patch?.text || draft.text, 12000),
    category: safeString(req.body?.patch?.category || draft.category, 80),
    imageUrl: safeString(req.body?.patch?.imageUrl || draft.imageUrl, 1000),
    coverPhoto: safeString(req.body?.patch?.imageUrl || draft.imageUrl, 1000),
    linkUrl: safeString(draft.sourceUrl, 1000),
    linkLabel: 'Источник материала',
    active: true,
    status: 'published',
    source: 'loki_editor',
    aiDraftId: id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
  });
  await db.collection('aiDrafts').doc(id).set({
    status: 'published',
    publishedNewsId: ref.id,
    publishedAt: FieldValue.serverTimestamp(),
    editorActions: FieldValue.arrayUnion({ action: 'publish', actorId: actor.userId, at: new Date().toISOString() }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writeAuditLog(db, req, actor, 'loki-editor:publish', 'aiDrafts', id, { newsId: ref.id, label: draft.title });
  return { ok: true, newsId: ref.id };
}

export default async function lokiEditorRoutes(fastify) {
  fastify.post('/api/loki-editor', async (req, reply) => {
    const db = getDb();
    try {
      const actor = await requireAdminPermission(req, 'news:update');
      const action = safeString(req.body?.action, 80);
      if (action === 'status') return getStatus(db);
      if (action === 'run-cycle') return runCycle(db, actor, req);
      if (action === 'source:save') return saveSource(db, req, actor);
      if (action === 'source:delete') {
        const id = safeString(req.body?.id, 120);
        await db.collection('aiSources').doc(id).delete();
        return { ok: true };
      }
      if (action === 'draft:update') return updateDraft(db, req, actor);
      if (action === 'draft:publish') return publishDraft(db, req, actor);
      if (action === 'settings:save') {
        await db.collection('config').doc('lokiEditor').set({ ...DEFAULT_SETTINGS, ...(req.body?.settings || {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return { ok: true };
      }
      return reply.code(400).send({ ok: false, error: 'Unknown action' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ ok: false, error: error.message || 'Loki editor error' });
    }
  });
}
