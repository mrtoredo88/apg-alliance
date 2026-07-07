import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './_firebase-admin.js';

export const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['news:*', 'comments:*', 'push:*', 'system:*', 'audit:*', 'partners:*', 'experts:*', 'events:*', 'banners:*', 'prizes:*', 'notifications:*', 'tasks:*', 'users:*', 'settings:*', 'stats:*', 'claims:*', 'errors:*', 'maintenance:*'],
  editor: ['news:*', 'partners:update', 'experts:update', 'events:*', 'banners:*', 'prizes:*', 'notifications:create', 'tasks:*', 'system:read'],
  moderator: ['comments:*', 'news:update', 'news:delete', 'partners:update', 'experts:update', 'events:update', 'system:read'],
  partner: [],
  expert: [],
  user: [],
};

const ROLE_ORDER = ['user', 'expert', 'partner', 'moderator', 'editor', 'admin', 'owner'];

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ROLE_ORDER.includes(role) ? role : 'user';
}

function hasPermission(role, permission) {
  const grants = ROLE_PERMISSIONS[normalizeRole(role)] || [];
  const [scope] = permission.split(':');
  return grants.includes('*') || grants.includes(permission) || grants.includes(`${scope}:*`);
}

function getBearerToken(req) {
  const direct = String(req.headers['x-firebase-auth'] || req.headers['X-Firebase-Auth'] || req.headers['x-apg-auth'] || req.headers['X-APG-Auth'] || '').trim();
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function findUserByFirebaseUid(db, uid) {
  const direct = await db.collection('users').doc(uid).get().catch(() => null);
  if (direct?.exists) return { id: direct.id, data: direct.data() || {}, source: 'users.uid' };

  const map = await db.collection('auth_map').doc(uid).get().catch(() => null);
  const mappedUserId = map?.exists ? String(map.data()?.vkId || map.data()?.userId || '').trim() : '';
  if (mappedUserId) {
    const mapped = await db.collection('users').doc(mappedUserId).get().catch(() => null);
    if (mapped?.exists) return { id: mapped.id, data: mapped.data() || {}, source: 'auth_map' };
  }

  for (const field of ['firebaseUid', 'authUid']) {
    const snap = await db.collection('users').where(field, '==', uid).limit(1).get().catch(() => null);
    if (snap?.docs?.[0]) return { id: snap.docs[0].id, data: snap.docs[0].data() || {}, source: `users.${field}` };
  }
  return null;
}

export async function requireAdminPermission(req, permission) {
  const db = getAdminDb();
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Требуется авторизация администратора.');
    error.statusCode = 401;
    throw error;
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const claimRole = normalizeRole(decoded.role || decoded.userRole || (decoded.owner ? 'owner' : decoded.admin ? 'admin' : ''));
  const userRecord = await findUserByFirebaseUid(db, decoded.uid);
  const userRole = normalizeRole(userRecord?.data?.role || userRecord?.data?.userRole || claimRole);
  const role = ROLE_ORDER.indexOf(claimRole) > ROLE_ORDER.indexOf(userRole) ? claimRole : userRole;

  if (!hasPermission(role, permission)) {
    const error = new Error('Недостаточно прав для административного действия.');
    error.statusCode = 403;
    error.role = role;
    throw error;
  }

  return {
    uid: decoded.uid,
    role,
    userId: userRecord?.id || decoded.uid,
    name: userRecord?.data?.name || userRecord?.data?.firstName || userRecord?.data?.email || decoded.email || 'Администратор АПГ',
    authSource: userRecord?.source || 'claims',
  };
}

export async function writeAuditLog(db, req, actor, action, targetType, targetId, details = {}, result = 'success') {
  const entry = {
    action,
    targetType,
    targetId: String(targetId || ''),
    label: details.label || `${action}: ${targetType}`,
    actorId: actor?.userId || actor?.uid || 'unknown',
    actorUid: actor?.uid || '',
    actorName: actor?.name || 'Администратор АПГ',
    role: actor?.role || 'unknown',
    result,
    details,
    appVersion: String(req.headers['x-apg-version'] || ''),
    ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    idempotencyKey: String(req.headers['x-idempotency-key'] || details.idempotencyKey || ''),
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection('adminActivity').add(entry);
  return entry;
}

function classifyAdminError(error) {
  const status = error?.statusCode || 500;
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (error?.code) return error.code;
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN_ROLE';
  if (message.includes('Неизвестное административное действие')) return 'UNKNOWN_ACTION';
  if (message.includes('Неизвестный административный ресурс') || message.includes('Неизвестный административный список')) return 'UNKNOWN_RESOURCE';
  if (status === 400) return 'INVALID_PAYLOAD';
  if (code.includes('permission-denied') || message.includes('PERMISSION_DENIED')) return 'FIRESTORE_PERMISSION';
  if (code.includes('not-found') || message.includes('NOT_FOUND')) return 'FIRESTORE_COLLECTION_NOT_FOUND';
  if (message.includes('env var') || message.includes('Firebase не настроен')) return 'ENV_MISSING';
  return 'SERVER_ERROR';
}

export function adminError(res, error) {
  const status = error?.statusCode || 500;
  const code = classifyAdminError(error);
  return res.status(status).json({
    ok: false,
    error: status >= 500 ? 'Административное действие временно недоступно.' : error.message,
    code,
    role: error?.role || undefined,
  });
}
