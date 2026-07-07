import { getDb } from '../lib/firebase.js';

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

export default async function publicDataRoutes(fastify) {
  fastify.get('/api/public-data', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const db = getDb();
      const requested = String(request.query?.resources || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      const names = requested.length ? requested.filter(name => PUBLIC_COLLECTIONS[name]) : Object.keys(PUBLIC_COLLECTIONS);
      const entries = await Promise.all(names.map(async name => [name, await readPublicCollection(db, name, PUBLIC_COLLECTIONS[name])]));
      const statsSnap = !requested.length || requested.includes('stats')
        ? await db.collection('stats').doc('global').get().catch(() => null)
        : null;
      return {
        ok: true,
        source: 'backend',
        data: {
          ...Object.fromEntries(entries),
          ...(statsSnap?.exists ? { stats: { id: statsSnap.id, ...serializePublicValue(statsSnap.data()) } } : {}),
        },
      };
    } catch (error) {
      request.log.error({
        code: error?.code || null,
        message: error?.message || String(error),
      }, 'public-data failed');
      reply.code(500);
      return { ok: false, error: 'PUBLIC_DATA_FAILED' };
    }
  });
}
