import { getDb } from '../lib/firebase.js';
import { createOrRestoreReferralSession } from '../lib/referralSessions.js';

export default async function referralSessionRoutes(fastify) {
  fastify.post('/api/referral-session', async (request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const db = getDb();
      const result = await createOrRestoreReferralSession(db, request, request.body || {});
      if (result?.ok === false) return reply.code(400).send(result);
      return result;
    } catch (error) {
      request.log.warn({ message: error?.message || String(error) }, 'referral session failed');
      return reply.code(500).send({ ok: false, error: 'referral_session_failed' });
    }
  });
}
