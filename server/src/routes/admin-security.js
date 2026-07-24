import { FieldValue } from '../lib/documentValues.js';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { ROLE_PERMISSIONS, adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';
import { createPasswordRecord, requireStrongAdminPassword } from '../../../server-shared/admin-password.js';
import { CAPABILITIES, getPrimaryRole, getUserRoles, hasCapability, hasRole, normalizeRole as normalizeSharedRole, ROLES } from '../../../server-shared/role-engine.js';

function normalizeRole(value) {
  return normalizeSharedRole(value) || 'user';
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
    mustChangePassword: Boolean(actor.mustChangePassword),
    permissions: ROLE_PERMISSIONS[actor.role] || [],
  };
}

function permissionForAction(action) {
  if (action === 'status' || action === 'admin:selfChangePassword') return 'system:read';
  if (action === 'audit:list') return 'audit:read';
  if (action === 'overview') return 'admins:read';
  return 'admins:read';
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
    .filter(user => hasCapability(user, CAPABILITIES.canOpenAdminPanel))
    .map(user => ({
      id: user.id,
      uid: user.firebaseUid || user.authUid || user.id,
      name: user.name || user.firstName || user.displayName || user.email || 'Администратор АПГ',
      login: user.login || user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      photo: user.photo || user.avatar || user.photo_100 || '',
      position: user.position || user.jobTitle || '',
      role: getPrimaryRole(user),
      roles: getUserRoles(user),
      status: user.adminStatus || user.status || 'active',
      createdAt: user.createdAt || user.registeredAt || null,
      lastLoginAt: user.lastLoginAt || user.lastSeen || null,
      activeDevices: Number(user.activeDevices || user.devicesCount || 0),
      trustedDevices: Array.isArray(user.trustedDevices) ? user.trustedDevices : [],
      permissions: Array.isArray(user.adminPermissions) ? user.adminPermissions : ROLE_PERMISSIONS[getPrimaryRole(user)] || [],
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
  if (!hasRole({ role: actor.role }, ROLES.owner) && !hasRole({ role: actor.role }, ROLES.superAdmin)) {
    const error = new Error('Недостаточно прав для управления администраторами.');
    error.statusCode = 403;
    throw error;
  }
  const currentRole = getPrimaryRole(currentData || {});
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

function requireStrongPassword(password) {
  return requireStrongAdminPassword(password);
}

function cleanAdminPayload(body = {}) {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const email = String(body.email || body.login || '').trim().toLowerCase();
  const role = normalizeRole(body.role || 'admin');
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : ROLE_PERMISSIONS[role] || [];
  const name = [firstName, lastName].filter(Boolean).join(' ') || String(body.name || '').trim() || email;
  if (!email || !email.includes('@')) {
    const error = new Error('Укажите корректный email администратора.');
    error.statusCode = 400;
    throw error;
  }
  return {
    firstName,
    lastName,
    email,
    role,
    permissions,
    name,
    position: String(body.position || '').trim(),
    photo: String(body.photo || '').trim(),
  };
}

export default async function adminSecurityRoutes(fastify) {
  fastify.post('/api/admin-security', async (request, reply) => {
    const db = getDb();
    try {
      const action = String(request.body?.action || 'status');
      const actor = await requireAdminPermission(request, permissionForAction(action));

      if (action === 'status') {
        await writeSecurityLog(db, request, actor, 'admin-login', actor.userId, { source: 'admin-security.status' });
        return reply.send({ ok: true, actor: safeActor(actor), roles: ROLE_PERMISSIONS, device: getDeviceInfo(request), passkeysSupported: true });
      }

      if (action === 'admin:selfChangePassword') {
        const password = requireStrongPassword(request.body?.password);
        await getDbAuth().updateUser(actor.uid, { password }).catch(() => {});
        const { ref, snap } = await findAdminUserRef(db, actor.userId || actor.uid);
        await db.collection('adminCredentials').doc(actor.uid).set({
          email: String(snap.data()?.email || '').trim().toLowerCase(),
          password: createPasswordRecord(password),
          updatedBy: actor.userId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const patch = {
          mustChangePassword: false,
          passwordChangedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(patch, { merge: true });
        await writeSecurityLog(db, request, actor, action, snap.id, { uid: actor.uid });
        return reply.send({ ok: true, id: snap.id });
      }

      if (actor.mustChangePassword) {
        const error = new Error('Перед работой в админке необходимо сменить временный пароль.');
        error.statusCode = 403;
        error.code = 'PASSWORD_CHANGE_REQUIRED';
        throw error;
      }

      if (action === 'overview') {
        const [admins, audit] = await Promise.all([listAdmins(db), listAudit(db)]);
        return reply.send({ ok: true, actor: safeActor(actor), roles: ROLE_PERMISSIONS, admins, audit });
      }

      if (action === 'audit:list') {
        return reply.send({ ok: true, audit: await listAudit(db) });
      }

      if (action === 'admin:create') {
        const nextAdmin = cleanAdminPayload(request.body || {});
        await assertCanManage(actor, { role: nextAdmin.role }, nextAdmin.role);
        if (nextAdmin.role === 'owner' && actor.role !== 'owner') {
          const error = new Error('Только Owner может создавать Owner.');
          error.statusCode = 403;
          throw error;
        }
        const password = requireStrongPassword(request.body?.password);
        const auth = getDbAuth();
        const existingAuth = await auth.getUserByEmail(nextAdmin.email).catch(() => null);
        if (existingAuth) {
          const error = new Error('Пользователь с таким email уже существует.');
          error.statusCode = 409;
          throw error;
        }
        const existingProfile = await db.collection('users').where('email', '==', nextAdmin.email).limit(1).get();
        if (!existingProfile.empty) {
          const error = new Error('Профиль с таким email уже существует.');
          error.statusCode = 409;
          throw error;
        }
        const record = await auth.createUser({
          email: nextAdmin.email,
          password,
          displayName: nextAdmin.name,
          emailVerified: true,
          disabled: false,
        });
        await auth.setCustomUserClaims(record.uid, { role: nextAdmin.role, owner: nextAdmin.role === ROLES.owner, admin: hasCapability({ role: nextAdmin.role }, CAPABILITIES.canOpenAdminPanel) });
        await db.collection('adminCredentials').doc(record.uid).set({
          email: nextAdmin.email,
          password: createPasswordRecord(password),
          updatedBy: actor.userId,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const profile = {
          firebaseUid: record.uid,
          authUid: record.uid,
          email: nextAdmin.email,
          login: nextAdmin.email,
          name: nextAdmin.name,
          firstName: nextAdmin.firstName,
          lastName: nextAdmin.lastName,
          position: nextAdmin.position,
          photo: nextAdmin.photo,
          role: nextAdmin.role,
          userRole: nextAdmin.role,
          roles: [nextAdmin.role],
          adminPermissions: nextAdmin.permissions,
          adminStatus: 'active',
          mustChangePassword: nextAdmin.role !== 'owner',
          createdBy: actor.userId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await db.collection('users').doc(record.uid).set(profile, { merge: true });
        await writeSecurityLog(db, request, actor, action, record.uid, { email: nextAdmin.email, role: nextAdmin.role, mustChangePassword: profile.mustChangePassword });
        return reply.send({ ok: true, id: record.uid, admin: { ...profile, createdAt: null, updatedAt: null } });
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
        await getDbAuth().setCustomUserClaims(String(currentData.firebaseUid || currentData.authUid || snap.id), { role: nextRole, owner: nextRole === ROLES.owner, admin: hasCapability({ role: nextRole }, CAPABILITIES.canOpenAdminPanel) }).catch(() => {});
        await writeSecurityLog(db, request, actor, 'admin:updateRole', snap.id, { before: getPrimaryRole(currentData || {}), after: nextRole });
        return reply.send({ ok: true, id: snap.id, patch });
      }

      if (action === 'admin:updateProfile') {
        await assertCanManage(actor, currentData);
        const patch = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        for (const [key, field] of [['name', 'name'], ['firstName', 'firstName'], ['lastName', 'lastName'], ['position', 'position'], ['photo', 'photo'], ['login', 'login']]) {
          if (Object.prototype.hasOwnProperty.call(request.body || {}, key)) patch[field] = String(request.body[key] || '').trim();
        }
        if (request.body?.email) {
          const email = String(request.body.email || '').trim().toLowerCase();
          if (!email.includes('@')) {
            const error = new Error('Укажите корректный email администратора.');
            error.statusCode = 400;
            throw error;
          }
          await getDbAuth().updateUser(String(currentData.firebaseUid || currentData.authUid || snap.id), { email });
          patch.email = email;
          patch.login = email;
        }
        await ref.set(patch, { merge: true });
        await writeSecurityLog(db, request, actor, action, snap.id, { fields: Object.keys(patch).filter(key => key !== 'updatedAt') });
        return reply.send({ ok: true, id: snap.id, patch });
      }

      if (action === 'admin:updatePassword') {
        await assertCanManage(actor, currentData);
        const uid = String(currentData.firebaseUid || currentData.authUid || snap.id);
        const password = requireStrongPassword(request.body?.password);
        await getDbAuth().updateUser(uid, { password }).catch(() => {});
        await db.collection('adminCredentials').doc(uid).set({
          email: String(currentData.email || '').trim().toLowerCase(),
          password: createPasswordRecord(password),
          updatedBy: actor.userId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const patch = {
          mustChangePassword: getPrimaryRole(currentData || {}) !== ROLES.owner,
          passwordChangedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(patch, { merge: true });
        await writeSecurityLog(db, request, actor, action, snap.id, { uid, mustChangePassword: patch.mustChangePassword });
        return reply.send({ ok: true, id: snap.id });
      }

      if (['admin:block', 'admin:unblock', 'admin:disable', 'admin:deleteAccess'].includes(action)) {
        await assertCanManage(actor, currentData);
        if (getPrimaryRole(currentData || {}) === ROLES.owner && action !== 'admin:unblock') {
          const error = new Error('Owner нельзя заблокировать, отключить или удалить через интерфейс.');
          error.statusCode = 403;
          throw error;
        }
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
