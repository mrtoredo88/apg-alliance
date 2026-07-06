import { getDb } from '../lib/firebase.js';
import { awardVisit, createVisitQrToken } from '../../../server-shared/reward-service.js';

export default async function qrTokenRoutes(fastify) {
  fastify.post('/api/qr-token', async (request, reply) => {
    const db = getDb();
    const action = request.body?.action;
    const result = action === 'create'
      ? await createVisitQrToken(db, request.body)
      : action === 'scan'
        ? await awardVisit(db, { qrValue: request.body?.qrValue, scannerUserId: request.body?.scannerUserId })
        : { ok: false, status: 400, code: 'BAD_ACTION', message: 'Неизвестное действие QR' };

    return reply.code(result.status ?? (result.ok ? 200 : 400)).send(result);
  });
}
