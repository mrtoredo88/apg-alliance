import { FieldValue } from '../lib/documentValues.js';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { verifyPasswordRecord } from '../../../server-shared/admin-password.js';
import { CAPABILITIES, getPrimaryRole, hasCapability, hasRole, ROLES } from '../../../server-shared/role-engine.js';
import { serverFoundation } from '../apg/index.js';

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
      const identity = await serverFoundation.identityV2.resolveEmailIdentity({ email, createIfMissing: false }).catch(() => null);
      const user = identity?.user || {};
      const userId = identity?.userId ? String(identity.userId) : '';
      const userDoc = userId ? await db.collection('users').doc(userId).get().catch(() => null) : null;
      if (!identity && !userDoc?.exists) {
        await log('error', { code: 'ADMIN_NOT_FOUND' });
        return reply.code(401).send({ ok: false, code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль администратора.' });
      }
      const persistedUser = userDoc?.exists ? userDoc.data() || {} : {};
      const combinedUser = { ...persistedUser, ...user };
      const role = getPrimaryRole(combinedUser);
      const status = String(combinedUser.adminStatus || combinedUser.status || 'active').toLowerCase();
      if (!hasCapability(combinedUser, CAPABILITIES.canOpenAdminPanel) || status !== 'active') {
        await log('error', { code: 'FORBIDDEN_ROLE', role, status });
        return reply.code(403).send({ ok: false, code: 'FORBIDDEN_ROLE', error: 'Доступ администратора отключён.' });
      }
      const uid = String(userId || userDoc?.id || combinedUser.firebaseUid || combinedUser.authUid || email);
      const credentialSnap = await db.collection('adminCredentials').doc(uid).get().catch(() => null);
      const credential = credentialSnap?.exists ? credentialSnap.data() || {} : {};
      if (!verifyPasswordRecord(password, credential.password)) {
        await log('error', { code: 'INVALID_CREDENTIALS', role });
        return reply.code(401).send({ ok: false, code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль администратора.' });
      }
      await auth.updateUser(uid, { email, emailVerified: true, disabled: false }).catch(() => {});
      const owner = hasRole(combinedUser, ROLES.owner);
      await auth.setCustomUserClaims(uid, { role, owner, admin: true }).catch(() => {});
      const customToken = await auth.createCustomToken(uid, { role, owner, admin: true });
      if (userDoc?.ref) await userDoc.ref.set({ lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await log('success', { role, uid });
      return reply.send({ ok: true, customToken, actor: { uid, email, role, mustChangePassword: Boolean(combinedUser.mustChangePassword) } });
    } catch (error) {
      await log('error', { code: error?.code || 'SERVER_ERROR' });
      return reply.code(500).send({ ok: false, code: 'SERVER_ERROR', error: 'Вход администратора временно недоступен.' });
    }
  });
}
