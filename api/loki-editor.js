import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';
import { requireAdminPermission, writeAuditLog } from './_admin-security.js';

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
  return safeString(value, 8000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

function parseRss(xml) {
  const items = [...String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi)].slice(0, 30);
  return items.map(match => {
    const block = match[0];
    const pick = (tag) => stripHtml((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1] || '');
    const image = (block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] || '';
    return {
      title: pick('title'),
      text: pick('description') || pick('content:encoded'),
      url: pick('link') || pick('guid'),
      publishedAt: pick('pubDate') || null,
      imageUrl: image,
    };
  }).filter(item => item.title || item.text);
}

function parseJson(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.posts) ? data.posts : [];
  return rows.slice(0, 30).map(item => ({
    title: safeString(item.title || item.name || item.text?.slice?.(0, 80), 180),
    text: safeString(item.text || item.description || item.summary || item.body, 8000),
    url: safeString(item.url || item.linkUrl || item.link, 1000),
    imageUrl: safeString(item.imageUrl || item.coverPhoto || item.photo, 1000),
    publishedAt: item.publishedAt || item.createdAt || null,
  })).filter(item => item.title || item.text);
}

async function fetchSourceItems(source) {
  if (source.type === 'manual') return Array.isArray(source.manualItems) ? source.manualItems : [];
  const response = await fetch(source.url, { headers: { 'User-Agent': 'APG Loki Editor/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (source.type === 'json') return parseJson(await response.json());
  return parseRss(await response.text());
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
      const items = (await fetchSourceItems(source)).slice(0, Number(settings.maxItemsPerRun || 20));
      found += items.length;
      for (const item of items) {
        const sourceUrl = safeString(item.url || source.url, 1000);
        const fingerprint = hash(`${sourceUrl}|${item.title}|${safeString(item.text, 500)}`);
        const existing = await db.collection('aiDrafts').where('fingerprint', '==', fingerprint).limit(1).get();
        const duplicate = !existing.empty || (sourceUrl && !(await db.collection('news').where('linkUrl', '==', sourceUrl).limit(1).get()).empty);
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
      await doc.ref.set({ status: 'ok', lastCheckedAt: FieldValue.serverTimestamp(), lastError: null }, { merge: true });
      await logActivity(db, { type: 'source_checked', sourceId: source.id, sourceName: source.name, found: items.length, actorId: actor.userId });
    } catch (error) {
      errors++;
      await doc.ref.set({ status: 'error', lastCheckedAt: FieldValue.serverTimestamp(), lastError: safeString(error.message, 500) }, { merge: true });
      await logActivity(db, { type: 'source_error', sourceId: source.id, sourceName: source.name, error: safeString(error.message, 500), actorId: actor.userId });
    }
  }

  await runRef.set({ status: 'done', found, prepared, duplicates, errors, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeAuditLog(db, req, actor, 'loki-editor:run', 'aiEditorRuns', runRef.id, { found, prepared, duplicates, errors });
  return { ok: true, runId: runRef.id, found, prepared, duplicates, errors };
}

async function saveSource(db, req, actor) {
  const source = req.body?.source || {};
  const id = safeString(source.id, 120) || db.collection('aiSources').doc().id;
  const patch = {
    name: safeString(source.name || 'Новый источник', 180),
    type: safeString(source.type || 'rss', 40),
    url: safeString(source.url, 1000),
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-Auth,X-APG-Auth,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const db = getAdminDb();
  try {
    const actor = await requireAdminPermission(req, 'news:update');
    const action = safeString(req.body?.action, 80);
    if (action === 'status') return res.status(200).json(await getStatus(db));
    if (action === 'run-cycle') return res.status(200).json(await runCycle(db, actor, req));
    if (action === 'source:save') return res.status(200).json(await saveSource(db, req, actor));
    if (action === 'source:delete') {
      const id = safeString(req.body?.id, 120);
      await db.collection('aiSources').doc(id).delete();
      return res.status(200).json({ ok: true });
    }
    if (action === 'draft:update') return res.status(200).json(await updateDraft(db, req, actor));
    if (action === 'draft:publish') return res.status(200).json(await publishDraft(db, req, actor));
    if (action === 'settings:save') {
      await db.collection('config').doc('lokiEditor').set({ ...DEFAULT_SETTINGS, ...(req.body?.settings || {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message || 'Loki editor error' });
  }
}
