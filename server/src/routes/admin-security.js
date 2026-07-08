import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { ROLE_PERMISSIONS, adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst']);
const MANAGE_ROLES = new Set(['owner', 'super_admin']);

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ADMIN_ROLES.has(role) || ['partner', 'expert', 'user'].includes(role) ? role : 'user';
}

function serializeValue(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  return value;
}

function safeActor(actor) {
  return {
    uid: actor.uid,
    userId: actor.userId,
    name: actor.name,
    role: actor.role,
    authSource: actor.authSource,
    permissions: ROLE_PERMISSIONS[actor.role] || [],
  };
}

function getDeviceInfo(request) {
  return {
    userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
    ip: String(request.headers['x-forwarded-for'] || request.ip || '').split(',')[0].trim(),
    appVersion: String(request.headers['x-apg-version'] || ''),
  };
}

async function listAdmins(db) {
  const snap = await db.collection('users').limit(1000).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...serializeValue(doc.data() || {}) }))
    .filter(user => ADMIN_ROLES.has(normalizeRole(user.role || user.userRole)))
    .map(user => ({
      id: user.id,
      uid: user.firebaseUid || user.authUid || user.id,
      name: user.name || user.firstName || user.displayName || user.email || 'Администратор АПГ',
      login: user.login || user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      photo: user.photo || user.avatar || user.photo_100 || '',
      position: user.position || user.jobTitle || '',
      role: normalizeRole(user.role || user.userRole),
      roles: Array.isArray(user.roles) ? user.roles.map(normalizeRole) : [normalizeRole(user.role || user.userRole)],
      status: user.adminStatus || user.status || 'active',
      createdAt: user.createdAt || user.registeredAt || null,
      lastLoginAt: user.lastLoginAt || user.lastSeen || null,
      activeDevices: Number(user.activeDevices || user.devicesCount || 0),
      trustedDevices: Array.isArray(user.trustedDevices) ? user.trustedDevices : [],
      permissions: Array.isArray(user.adminPermissions) ? user.adminPermissions : ROLE_PERMISSIONS[normalizeRole(user.role || user.userRole)] || [],
    }));
}

async function listAudit(db) {
  const [activitySnap, securitySnap] = await Promise.all([
    db.collection('adminActivity').orderBy('createdAt', 'desc').limit(250).get().catch(() => ({ docs: [] })),
    db.collection('adminSecurityLog').orderBy('createdAt', 'desc').limit(250).get().catch(() => ({ docs: [] })),
  ]);
  return [...activitySnap.docs, ...securitySnap.docs]
    .map(doc => ({ id: doc.id, ...serializeValue(doc.data() || {}) }))
    .sort((a, b) => Number(new Date(b.createdAt || b.timestamp || 0)) - Number(new Date(a.createdAt || a.timestamp || 0)))
    .slice(0, 250);
}

async function writeSecurityLog(db, request, actor, action, targetId, details = {}, result = 'success') {
  const entry = {
    action,
    targetId: String(targetId || ''),
    actorId: actor.userId,
    actorUid: actor.uid,
    actorName: actor.name,
    role: actor.role,
    result,
    details,
    ...getDeviceInfo(request),
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection('adminSecurityLog').add(entry);
  await writeAuditLog(db, request, actor, action, 'adminSecurity', targetId, details, result);
  return entry;
}

async function findAdminUserRef(db, id) {
  const direct = await db.collection('users').doc(String(id || '')).get().catch(() => null);
  if (direct?.exists) return { ref: direct.ref, snap: direct };
  for (const field of ['firebaseUid', 'authUid', 'email', 'login']) {
    const snap = await db.collection('users').where(field, '==', String(id || '')).limit(1).get().catch(() => null);
    if (snap?.docs?.[0]) return { ref: snap.docs[0].ref, snap: snap.docs[0] };
  }
  const error = new Error('Администратор не найден.');
  error.statusCode = 404;
  throw error;
}

async function assertCanManage(actor, currentData, nextRole = '') {
  if (!MANAGE_ROLES.has(actor.role)) {
    const error = new Error('Недостаточно прав для управления администраторами.');
    error.statusCode = 403;
    throw error;
  }
  const currentRole = normalizeRole(currentData?.role || currentData?.userRole);
  if (currentRole === 'owner' && actor.role !== 'owner') {
    const error = new Error('Только Owner может изменять доступ Owner.');
    error.statusCode = 403;
    throw error;
  }
  if (currentRole === 'owner' && nextRole && normalizeRole(nextRole) !== 'owner') {
    const error = new Error('Нельзя случайно ограничить Owner.');
    error.statusCode = 403;
    throw error;
  }
}

export default async function adminSecurityRoutes(fastify) {
  fastify.post('/api/admin-security', async (request, reply) => {
    const db = getDb();
    try {
      const action = String(request.body?.action || 'status');
      const actor = await requireAdminPermission(request, action === 'status' ? 'system:read' : action === 'audit:list' ? 'audit:read' : 'admins:read');

      if (action === 'status') {
        await writeSecurityLog(db, request, actor, 'admin-login', actor.userId, { source: 'admin-security.status' });
        return reply.send({ ok: true, actor: safeActor(actor), roles: ROLE_PERMISSIONS, device: getDeviceInfo(request), passkeysSupported: true });
      }

      if (action === 'overview') {
        const [admins, audit] = await Promise.all([listAdmins(db), listAudit(db)]);
        return reply.send({ ok: true, actor: safeActor(actor), roles: ROLE_PERMISSIONS, admins, audit });
      }

      if (action === 'audit:list') {
        return reply.send({ ok: true, audit: await listAudit(db) });
      }

      const targetId = String(request.body?.adminId || request.body?.userId || '').trim();
      const { ref, snap } = await findAdminUserRef(db, targetId);
      const currentData = snap.data() || {};

      if (action === 'admin:updateRole') {
        const nextRole = normalizeRole(request.body?.role);
        await assertCanManage(actor, currentData, nextRole);
        const patch = {
          role: nextRole,
          userRole: nextRole,
          roles: Array.isArray(request.body?.roles) ? request.body.roles.map(normalizeRole) : [nextRole],
          adminPermissions: Array.isArray(request.body?.permissions) ? request.body.permissions.map(String) : ROLE_PERMISSIONS[nextRole] || [],
          updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(patch, { merge: true });
        await getDbAuth().setCustomUserClaims(String(currentData.firebaseUid || currentData.authUid || snap.id), { role: nextRole }).catch(() => {});
        await writeSecurityLog(db, request, actor, 'admin:updateRole', snap.id, { before: normalizeRole(currentData.role || currentData.userRole), after: nextRole });
        return reply.send({ ok: true, id: snap.id, patch });
      }

      if (['admin:block', 'admin:unblock', 'admin:disable', 'admin:deleteAccess'].includes(action)) {
        await assertCanManage(actor, currentData);
        const status = action === 'admin:unblock' ? 'active' : action === 'admin:disable' ? 'disabled' : action === 'admin:deleteAccess' ? 'access_removed' : 'blocked';
        const patch = { adminStatus: status, updatedAt: FieldValue.serverTimestamp() };
        if (status !== 'active') patch.forceLogoutAt = FieldValue.serverTimestamp();
        await ref.set(patch, { merge: true });
        await writeSecurityLog(db, request, actor, action, snap.id, { status });
        return reply.send({ ok: true, id: snap.id, patch });
      }

      if (action === 'admin:revokeSessions') {
        await assertCanManage(actor, currentData);
        const uid = String(currentData.firebaseUid || currentData.authUid || snap.id);
        await getDbAuth().revokeRefreshTokens(uid).catch(() => {});
        await ref.set({ forceLogoutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await writeSecurityLog(db, request, actor, action, snap.id, { uid });
        return reply.send({ ok: true, id: snap.id });
      }

      if (action === 'admin:resetPassword') {
        await assertCanManage(actor, currentData);
        const email = String(currentData.email || request.body?.email || '').trim().toLowerCase();
        if (!email) {
          const error = new Error('У администратора не указан email для сброса пароля.');
          error.statusCode = 400;
          throw error;
        }
        const resetLink = await getDbAuth().generatePasswordResetLink(email).catch(() => '');
        await writeSecurityLog(db, request, actor, action, snap.id, { email, linkGenerated: Boolean(resetLink) });
        return reply.send({ ok: true, id: snap.id, resetLinkGenerated: Boolean(resetLink), resetLink });
      }

      const error = new Error('Неизвестное действие безопасности.');
      error.statusCode = 400;
      throw error;
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
