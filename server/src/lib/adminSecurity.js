import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getDbAuth } from './firebase.js';
import { serverFoundation } from '../apg/index.js';
import { getPrimaryRole, normalizeRole as normalizeSharedRole, ROLE_REGISTRY } from '../../../server-shared/role-engine.js';

export const ROLE_PERMISSIONS = {
  owner: ['*'],
  super_admin: ['news:*', 'comments:*', 'push:*', 'system:*', 'audit:*', 'partners:*', 'experts:*', 'events:*', 'banners:*', 'prizes:*', 'notifications:*', 'tasks:*', 'users:*', 'settings:*', 'stats:*', 'claims:*', 'errors:*', 'maintenance:*', 'admins:*', 'security:*', 'devices:*', 'loki:*', 'ai:*'],
  admin: ['news:*', 'comments:*', 'push:*', 'system:read', 'audit:read', 'partners:*', 'experts:*', 'events:*', 'banners:*', 'prizes:*', 'notifications:*', 'tasks:*', 'users:*', 'stats:read', 'claims:*', 'errors:*', 'maintenance:read', 'loki:read', 'ai:*'],
  editor: ['news:*', 'comments:read', 'comments:update', 'comments:delete', 'events:read', 'partners:read', 'experts:read', 'notifications:create', 'system:read', 'ai:*', 'loki:read'],
  moderator: ['comments:*', 'users:read', 'users:update', 'news:read', 'news:update', 'system:read', 'audit:read'],
  analyst: ['stats:read', 'audit:read', 'system:read', 'news:read', 'partners:read', 'experts:read', 'events:read', 'users:read', 'errors:read'],
  partner: ['partnerCabinet:read', 'partnerCabinet:update'],
  expert: ['expertCabinet:read', 'expertCabinet:update'],
  user: [],
};

function normalizeRole(value) {
  return normalizeSharedRole(value) || 'user';
}

function roleRank(role) {
  return ROLE_REGISTRY[normalizeRole(role)]?.rank || 0;
}

function hasPermission(role, permission) {
  const grants = ROLE_PERMISSIONS[normalizeRole(role)] || [];
  const [scope] = permission.split(':');
  return grants.includes('*') || grants.includes(permission) || grants.includes(`${scope}:*`);
}

function getBearerToken(request) {
  const direct = String(request.headers['x-firebase-auth'] || request.headers['x-apg-auth'] || '').trim();
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = String(request.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function findUserByFirebaseUid(db, uid) {
  const identity = await serverFoundation.identityV2.getUser(uid).catch(() => null);
  if (identity?.id) return { id: identity.id, data: identity, source: 'identity_v2' };
  return null;
}

export async function requireAdminPermission(request, permission) {
  const db = getDb();
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error('Требуется авторизация администратора.');
    error.statusCode = 401;
    throw error;
  }

  const decoded = await getDbAuth().verifyIdToken(token);
  const userRecord = await findUserByFirebaseUid(db, decoded.uid);
  if (!userRecord) {
    const error = new Error('Пользователь Identity не найден.');
    error.statusCode = 401;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const adminStatus = String(userRecord.data.adminStatus || userRecord.data.status || 'active').toLowerCase();
  if (adminStatus && adminStatus !== 'active') {
    const error = new Error('Доступ администратора отключён.');
    error.statusCode = 403;
    error.role = normalizeRole(userRecord.data.role || userRecord.data.userRole);
    throw error;
  }
  const userRole = getPrimaryRole(userRecord?.data || {});
  if (!userRole) {
    const error = new Error('Роль администратора не определена в Identity.');
    error.statusCode = 403;
    error.code = 'ROLE_NOT_DEFINED';
    error.role = 'user';
    throw error;
  }
  const role = normalizeRole(userRole);

  if (!hasPermission(role, permission)) {
    const error = new Error('Недостаточно прав для административного действия.');
    error.statusCode = 403;
    error.role = role;
    throw error;
  }

  return {
    uid: decoded.uid,
    role,
    mustChangePassword: Boolean(userRecord?.data?.mustChangePassword),
    userId: userRecord?.id || decoded.uid,
    name: userRecord?.data?.name || userRecord?.data?.firstName || userRecord?.data?.email || decoded.email || 'Администратор АПГ',
    authSource: userRecord?.source || 'claims',
  };
}

export async function writeAuditLog(db, request, actor, action, targetType, targetId, details = {}, result = 'success') {
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
    appVersion: String(request.headers['x-apg-version'] || ''),
    ip: String(request.headers['x-forwarded-for'] || request.ip || '').split(',')[0].trim(),
    userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
    idempotencyKey: String(request.headers['x-idempotency-key'] || details.idempotencyKey || ''),
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

export function adminReplyError(reply, error) {
  const status = error?.statusCode || 500;
  const code = classifyAdminError(error);
  return reply.code(status).send({
    ok: false,
    error: status >= 500 ? 'Административное действие временно недоступно.' : error.message,
    code,
    role: error?.role || undefined,
  });
}
