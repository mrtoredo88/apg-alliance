import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { verifyPasswordRecord } from '../../../server-shared/admin-password.js';
import { resolveEmailIdentity } from '../lib/identityCore.js';

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst']);

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ADMIN_ROLES.has(role) ? role : 'user';
}

function getDeviceInfo(request) {
  return {
    userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
    ip: String(request.headers['x-forwarded-for'] || request.ip || '').split(',')[0].trim(),
    appVersion: String(request.headers['x-apg-version'] || ''),
  };
}

export default async function adminLoginRoutes(fastify) {
  fastify.post('/api/admin-login', async (request, reply) => {
    const email = String(request.body?.email || request.body?.login || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    if (!email || !password) {
      return reply.code(400).send({ ok: false, code: 'INVALID_PAYLOAD', error: 'Введите email и пароль администратора.' });
    }

    const db = getDb();
    const auth = getDbAuth();
    const log = async (result, details = {}) => db.collection('adminSecurityLog').add({
      action: 'admin-login',
      targetId: email,
      actorId: email,
      actorUid: '',
      actorName: email,
      role: details.role || 'unknown',
      result,
      details,
      ...getDeviceInfo(request),
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    try {
      const identity = await resolveEmailIdentity(db, { email, createIfMissing: false }).catch(() => null);
      const userDoc = identity?.userId ? await db.collection('users').doc(identity.userId).get() : null;
      if (!userDoc?.exists) {
        await log('error', { code: 'ADMIN_NOT_FOUND' });
        return reply.code(401).send({ ok: false, code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль администратора.' });
      }
      const user = userDoc.data() || {};
      const role = normalizeRole(user.role || user.userRole);
      const status = String(user.adminStatus || user.status || 'active').toLowerCase();
      if (!ADMIN_ROLES.has(role) || status !== 'active') {
        await log('error', { code: 'FORBIDDEN_ROLE', role, status });
        return reply.code(403).send({ ok: false, code: 'FORBIDDEN_ROLE', error: 'Доступ администратора отключён.' });
      }
      const uid = String(user.firebaseUid || user.authUid || userDoc.id);
      const credentialSnap = await db.collection('adminCredentials').doc(uid).get();
      const credential = credentialSnap.exists ? credentialSnap.data() || {} : {};
      if (!verifyPasswordRecord(password, credential.password)) {
        await log('error', { code: 'INVALID_CREDENTIALS', role });
        return reply.code(401).send({ ok: false, code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль администратора.' });
      }
      await auth.updateUser(uid, { email, emailVerified: true, disabled: false }).catch(() => {});
      await auth.setCustomUserClaims(uid, { role, owner: role === 'owner' }).catch(() => {});
      const customToken = await auth.createCustomToken(uid, { role, owner: role === 'owner' });
      await userDoc.ref.set({ lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await log('success', { role, uid });
      return reply.send({ ok: true, customToken, actor: { uid, email, role, mustChangePassword: Boolean(user.mustChangePassword) } });
    } catch (error) {
      await log('error', { code: error?.code || 'SERVER_ERROR' });
      return reply.code(500).send({ ok: false, code: 'SERVER_ERROR', error: 'Вход администратора временно недоступен.' });
    }
  });
}
