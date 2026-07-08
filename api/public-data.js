import { getAdminDb } from './_firebase-admin.js';

const PUBLIC_COLLECTIONS = {
  partners:      { collection: 'partners', limit: 100 },
  events:        { collection: 'events', limit: 100 },
  news:          { collection: 'news', orderBy: ['createdAt', 'desc'], limit: 30 },
  notifications: { collection: 'notifications', orderBy: ['createdAt', 'desc'], limit: 50 },
  reviews:       { collection: 'reviews', orderBy: ['createdAt', 'desc'], limit: 50 },
  customTasks:   { collection: 'customTasks', orderBy: ['createdAt', 'asc'], limit: 50 },
  experts:       { collection: 'experts', limit: 100 },
  lokiKnowledge: { collection: 'lokiKnowledge', orderBy: ['priority', 'desc'], limit: 120, activeOnly: true },
};

function serializePublicValue(value) {
  if (!value) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (Array.isArray(value)) return value.map(serializePublicValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializePublicValue(item)]));
  }
  return value;
}

async function readPublicCollection(db, name, config) {
  let ref = db.collection(config.collection);
  if (config.orderBy) ref = ref.orderBy(config.orderBy[0], config.orderBy[1]);
  if (config.limit) ref = ref.limit(config.limit);
  const snap = await ref.get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...serializePublicValue(doc.data()) }))
    .filter(item => !config.activeOnly || item.active !== false);
}

async function readPublicCollections(db, names) {
  const settled = await Promise.allSettled(names.map(async name => {
    const rows = await readPublicCollection(db, name, PUBLIC_COLLECTIONS[name]);
    return [name, rows];
  }));
  const data = {};
  const errors = [];
  settled.forEach((result, index) => {
    const name = names[index];
    if (result.status === 'fulfilled') {
      const [key, rows] = result.value;
      data[key] = rows;
      return;
    }
    const error = result.reason;
    errors.push({
      name,
      code: error?.code || null,
      message: error?.message || String(error),
    });
  });
  if (errors.length) console.warn('[public-data] partial failure', { errors });
  return { data, errors };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  try {
    const db = getAdminDb();
    const requested = String(req.query?.resources || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const names = requested.length ? requested.filter(name => PUBLIC_COLLECTIONS[name]) : Object.keys(PUBLIC_COLLECTIONS);
    const { data, errors } = await readPublicCollections(db, names);
    const statsSnap = !requested.length || requested.includes('stats')
      ? await db.collection('stats').doc('global').get().catch(() => null)
      : null;
    return res.json({
      ok: errors.length === 0,
      partial: errors.length > 0,
      source: 'backend',
      errors,
      data: {
        ...data,
        ...(statsSnap?.exists ? { stats: { id: statsSnap.id, ...serializePublicValue(statsSnap.data()) } } : {}),
      },
    });
  } catch (error) {
    console.error('[public-data] failed', {
      code: error?.code || null,
      message: error?.message || String(error),
    });
    return res.status(500).json({ ok: false, error: 'PUBLIC_DATA_FAILED' });
  }
}
