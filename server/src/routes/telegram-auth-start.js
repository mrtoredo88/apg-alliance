import { randomBytes } from 'crypto';
import { getDb } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase().trim());
  return Boolean(value);
}

function safeString(value, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

export default async function telegramAuthStartRoutes(fastify) {
  fastify.post('/api/telegram-auth-start', async (request, reply) => {
    const body = request.body ?? {};
    const linking = normalizeBoolean(body.linking);
    const ownerUserId = safeString(body.ownerUserId, 200);
    const ownerEmail = safeString(body.email || body.ownerEmail, 220).toLowerCase();
    const source = safeString(body.source, 120) || 'profile_panel';
    if (linking && !ownerUserId) {
      return reply.code(400).send({ ok: false, message: 'owner_required' });
    }
    const state = randomBytes(16).toString('hex');
    const db = getDb();
    await db.collection('telegramAuthSessions').doc(state).set({
      status: 'pending',
      linking: linking === true,
      ownerUserId: ownerUserId || null,
      ownerEmail: ownerEmail || null,
      source,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    return { state, url: `https://t.me/apg_zelenograd_bot?start=auth_${state}` };
  });
}
