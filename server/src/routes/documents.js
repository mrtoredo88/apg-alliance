import { getDb, getDbAuth } from '../lib/firebase.js';

const PUBLIC_COLLECTIONS = new Set([
  'partners', 'experts', 'events', 'news', 'prizes', 'notifications',
  'customTasks', 'stats', 'monthlyWinners', 'lokiKnowledge', 'reviews',
  'expertReviews', 'expertRotation',
]);
const AUTHENTICATED_COLLECTIONS = new Set(['users', 'raffleEntries', 'conversationRequests']);
const OPERATORS = new Set(['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any']);

function bearer(request) {
  return String(request.headers.authorization || request.headers['x-apg-auth'] || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function identity(request) {
  const token = bearer(request);
  if (!token) return null;
  return getDbAuth().verifyIdToken(token).catch(() => null);
}

function safePath(value = '') {
  const path = String(value).split('/').filter(Boolean).join('/');
  if (!path || path.includes('..') || path.length > 500) return '';
  return path;
}

function topCollection(path) {
  return path.split('/')[0] || '';
}

function allowRead(path, actor) {
  const collection = topCollection(path);
  const parts = path.split('/');
  if (PUBLIC_COLLECTIONS.has(collection)) {
    if (parts.length <= 2) return true;
    if (collection === 'partners' && parts[2] === 'reviews') return true;
    if (collection === 'events' && parts[2] === 'registrations') return Boolean(actor);
    return false;
  }
  if (!actor || !AUTHENTICATED_COLLECTIONS.has(collection)) return false;
  if (collection !== 'users' || parts.length <= 2) return true;
  return parts[1] === String(actor.userId || actor.uid);
}

function encode(value) {
  return JSON.parse(JSON.stringify(value));
}

export default async function documentRoutes(fastify) {
  fastify.post('/api/documents/read', async (request, reply) => {
    const body = request.body || {};
    const path = safePath(body.path);
    const actor = await identity(request);
    if (!path || !allowRead(path, actor)) return reply.code(actor ? 403 : 401).send({ ok: false, error: 'document_read_forbidden' });

    const db = getDb();
    if (body.kind === 'document') {
      const snapshot = await db.doc(path).get();
      return { ok: true, exists: snapshot.exists, id: snapshot.id, data: snapshot.exists ? encode(snapshot.data()) : null };
    }

    let query = db.collection(path);
    for (const filter of Array.isArray(body.filters) ? body.filters.slice(0, 8) : []) {
      if (!Array.isArray(filter) || filter.length !== 3 || !OPERATORS.has(filter[1])) return reply.code(400).send({ ok: false, error: 'invalid_document_filter' });
      query = query.where(String(filter[0]), filter[1], filter[2]);
    }
    for (const order of Array.isArray(body.orders) ? body.orders.slice(0, 3) : []) {
      if (!Array.isArray(order) || !['asc', 'desc'].includes(order[1] || 'asc')) return reply.code(400).send({ ok: false, error: 'invalid_document_order' });
      query = query.orderBy(String(order[0]), order[1] || 'asc');
    }
    query = query.limit(Math.min(Math.max(Number(body.limit || 500), 1), 500));
    const snapshot = await query.get();
    return { ok: true, docs: snapshot.docs.map(doc => ({ id: doc.id, data: encode(doc.data()) })) };
  });
}
