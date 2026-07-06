import { randomBytes } from 'crypto';
import { getDb } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function telegramAuthStartRoutes(fastify) {
  fastify.post('/api/telegram-auth-start', async (request, reply) => {
    const state = randomBytes(16).toString('hex');
    const db = getDb();
    await db.collection('telegramAuthSessions').doc(state).set({
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    return { state, url: `https://t.me/apg_zelenograd_bot?start=auth_${state}` };
  });
}
