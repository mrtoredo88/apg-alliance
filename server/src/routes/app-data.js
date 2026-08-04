import { serverFoundation } from '../apg/index.js';
import { getPrimaryRole } from '../../../server-shared/role-engine.js';

const PUBLIC_COLLECTIONS = new Set(['partners', 'experts', 'news', 'events', 'promotions', 'prizes', 'tasks', 'banners', 'reviews', 'expertReviews', 'stats', 'config']);
const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'editor', 'moderator']);
const clean = (value, max = 700) => String(value ?? '').trim().slice(0, max);

function bearer(request) {
  return clean(request.headers['x-apg-auth'] || request.headers.authorization?.replace(/^Bearer\s+/i, ''), 2200);
}

async function actorFor(request) {
  const token = bearer(request);
  return token ? serverFoundation.identity.verifySession({ token }).catch(() => null) : null;
}

function assertAccess(collectionName, parentPath, actor) {
  if (PUBLIC_COLLECTIONS.has(collectionName) && !parentPath) return;
  const publicParts = parentPath.split('/').filter(Boolean);
  if (collectionName === 'reviews'
    && publicParts.length === 2
    && ['partners', 'experts'].includes(publicParts[0])
    && publicParts[1]) return;
  if (!actor?.uid) throw Object.assign(new Error('Требуется авторизация.'), { statusCode: 401 });
  if (ADMIN_ROLES.has(getPrimaryRole(actor))) return;
  const parts = parentPath.split('/').filter(Boolean);
  if (parts[0] === 'users' && parts[1] === actor.uid) return;
  if (collectionName === 'users' && !parentPath) return;
  throw Object.assign(new Error('Нет доступа к данным.'), { statusCode: 403 });
}

function failure(reply, error, code) {
  return reply.code(error?.statusCode || 500).send({
    ok: false,
    code: error?.code || code,
    error: error?.statusCode ? error.message : 'Не удалось загрузить данные.',
  });
}

export default async function appDataRoutes(fastify) {
  fastify.post('/api/app-data/query', async (request, reply) => {
    try {
      const collectionName = clean(request.body?.collection, 160);
      const parentPath = clean(request.body?.parentPath);
      if (!collectionName) return reply.code(400).send({ ok: false, code: 'COLLECTION_REQUIRED' });
      const actor = await actorFor(request);
      assertAccess(collectionName, parentPath, actor);
      const documents = await serverFoundation.data.adapter.listDocuments(collectionName, {
        parentPath,
        limit: Math.min(10000, Math.max(1, Number(request.body?.limit) || 1000)),
      });
      return { ok: true, storage: 'postgres', documents };
    } catch (error) {
      return failure(reply, error, 'APP_DATA_QUERY_FAILED');
    }
  });

  fastify.post('/api/app-data/get', async (request, reply) => {
    try {
      const collectionName = clean(request.body?.collection, 160);
      const parentPath = clean(request.body?.parentPath);
      const id = clean(request.body?.id, 500);
      if (!collectionName || !id) return reply.code(400).send({ ok: false, code: 'DOCUMENT_REQUIRED' });
      const actor = await actorFor(request);
      assertAccess(collectionName, parentPath, actor);
      const document = await serverFoundation.data.adapter.getDocument(collectionName, id, { parentPath });
      return { ok: true, storage: 'postgres', document };
    } catch (error) {
      return failure(reply, error, 'APP_DATA_GET_FAILED');
    }
  });
}
