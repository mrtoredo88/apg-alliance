import { randomUUID } from 'node:crypto';
import { createApgAccessToken, verifyApgAccessToken } from '../lib/apgTokens.js';

function bearer(request) {
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export default async function sessionRoutes(fastify) {
  fastify.post('/api/session/anonymous', async () => {
    const uid = `guest_${randomUUID()}`;
    return {
      ok: true,
      token: createApgAccessToken(uid, { anonymous: true, role: 'guest', roles: ['guest'] }),
      user: { uid, anonymous: true, role: 'guest', roles: ['guest'] },
    };
  });

  fastify.post('/api/session/refresh', async (request, reply) => {
    try {
      const current = verifyApgAccessToken(bearer(request));
      const { exp, iat, jti, iss, aud, sub, ...claims } = current;
      return { ok: true, token: createApgAccessToken(current.uid, claims) };
    } catch (error) {
      return reply.code(401).send({ ok: false, code: error.code || 'AUTH_TOKEN_INVALID', error: 'Сессия недействительна.' });
    }
  });

  fastify.get('/api/session/me', async (request, reply) => {
    try {
      const claims = verifyApgAccessToken(bearer(request));
      return { ok: true, user: claims };
    } catch (error) {
      return reply.code(401).send({ ok: false, code: error.code || 'AUTH_TOKEN_INVALID', error: 'Сессия недействительна.' });
    }
  });
}
