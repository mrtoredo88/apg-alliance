import { randomUUID } from 'node:crypto';
import { serverFoundation } from '../apg/index.js';
import { createCompatibleBearerToken } from '../apg/identity/repositories/SessionRepository.js';

function bearer(request) {
  return String(request.headers['x-apg-auth'] || request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function device(request) {
  return {
    userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
    appVersion: String(request.headers['x-apg-version'] || '').slice(0, 100),
  };
}

export default async function authSessionRoutes(fastify) {
  const verifySession = async (request, reply) => {
    try {
      const identity = await serverFoundation.identity.verifySession({ token: bearer(request) });
      return { ok: true, identity };
    } catch (error) {
      return reply.code(401).send({ ok: false, code: error?.code || 'AUTH_SESSION_INVALID', error: 'Сессия недействительна.' });
    }
  };

  const refreshSession = async (request, reply) => {
    try {
      const session = await serverFoundation.identity.refreshSession({
        token: bearer(request),
        device: device(request),
        platform: String(request.body?.platform || 'web-app').slice(0, 120),
      });
      return { ok: true, token: session.token, expiresAt: session.expiresAt };
    } catch (error) {
      request.log.warn({ code: error?.code || 'AUTH_SESSION_REFRESH_FAILED' }, 'auth session refresh failed');
      return reply.code(401).send({ ok: false, code: error?.code || 'AUTH_SESSION_REFRESH_FAILED', error: 'Не удалось восстановить сессию.' });
    }
  };

  const logoutSession = async (request) => ({
    ok: true,
    revoked: await serverFoundation.identity.invalidateSession({ token: bearer(request) }).catch(() => false),
  });

  fastify.post('/api/auth-session/verify', verifySession);
  fastify.post('/api/auth-session/refresh', refreshSession);
  fastify.post('/api/auth-session/logout', logoutSession);

  // Backward-compatible routes used by the published RuStore 1.3.x bundle.
  fastify.post('/api/session/anonymous', async (request) => {
    const uid = `guest_${randomUUID()}`;
    request.log.info({ route: '/api/session/anonymous', compatibility: 'rustore-1.3' }, 'legacy anonymous session issued');
    return {
      ok: true,
      token: createCompatibleBearerToken(uid, { anonymous: true, role: 'guest', roles: ['guest'] }, 1),
      user: { uid, anonymous: true, role: 'guest', roles: ['guest'] },
    };
  });
  fastify.get('/api/session/me', verifySession);
  fastify.post('/api/session/refresh', refreshSession);
  fastify.post('/api/session/logout', logoutSession);
}
