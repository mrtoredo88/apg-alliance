import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { verifyPasswordRecord } from '../server-shared/admin-password.js';

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst']);

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ADMIN_ROLES.has(role) ? role : 'user';
}

function getDeviceInfo(req) {
  return {
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
    appVersion: String(req.headers['x-apg-version'] || ''),
  };
}

function fail(res, status, code, error) {
  return res.status(status).json({ ok: false, code, error });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');

  const email = String(req.body?.email || req.body?.login || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return fail(res, 400, 'INVALID_PAYLOAD', 'Введите email и пароль администратора.');

  const db = getAdminDb();
  const auth = getAdminAuth();
  const log = async (result, details = {}) => db.collection('adminSecurityLog').add({
    action: 'admin-login',
    targetId: email,
    actorId: email,
    actorUid: '',
    actorName: email,
    role: details.role || 'unknown',
    result,
    details,
    ...getDeviceInfo(req),
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});

  try {
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    const userDoc = userSnap.docs[0];
    if (!userDoc) {
      await log('error', { code: 'ADMIN_NOT_FOUND' });
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Неверный email или пароль администратора.');
    }
    const user = userDoc.data() || {};
    const role = normalizeRole(user.role || user.userRole);
    const status = String(user.adminStatus || user.status || 'active').toLowerCase();
    if (!ADMIN_ROLES.has(role) || status !== 'active') {
      await log('error', { code: 'FORBIDDEN_ROLE', role, status });
      return fail(res, 403, 'FORBIDDEN_ROLE', 'Доступ администратора отключён.');
    }
    const uid = String(user.firebaseUid || user.authUid || userDoc.id);
    const credentialSnap = await db.collection('adminCredentials').doc(uid).get();
    const credential = credentialSnap.exists ? credentialSnap.data() || {} : {};
    if (!verifyPasswordRecord(password, credential.password)) {
      await log('error', { code: 'INVALID_CREDENTIALS', role });
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Неверный email или пароль администратора.');
    }
    await auth.updateUser(uid, { email, emailVerified: true, disabled: false }).catch(() => {});
    await auth.setCustomUserClaims(uid, { role, owner: role === 'owner' }).catch(() => {});
    const customToken = await auth.createCustomToken(uid, { role, owner: role === 'owner' });
    await userDoc.ref.set({ lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await log('success', { role, uid });
    return res.status(200).json({ ok: true, customToken, actor: { uid, email, role, mustChangePassword: Boolean(user.mustChangePassword) } });
  } catch (error) {
    await log('error', { code: error?.code || 'SERVER_ERROR' });
    return fail(res, 500, 'SERVER_ERROR', 'Вход администратора временно недоступен.');
  }
}
