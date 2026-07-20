import { getDbAuth } from '../lib/firebase.js';
import { serverFoundation } from '../apg/index.js';

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearerToken(request) {
  const direct = safeString(request.headers['x-firebase-auth'] || request.headers['x-apg-auth'] || '', 2000);
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = safeString(request.headers.authorization || '', 2200);
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function canaryAllowed(userId) {
  const canary = String(process.env.ACCOUNT_CANARY || '').toLowerCase();
  if (!['1', 'true', 'on'].includes(canary)) return false;
  const allowlist = String(process.env.ACCOUNT_CANARY_ALLOWLIST || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return allowlist.length === 0 || allowlist.includes(String(userId));
}

function canaryModeEnabled() {
  return ['1', 'true', 'on'].includes(String(process.env.ACCOUNT_CANARY || '').toLowerCase());
}

function publicProfile(profile = null) {
  if (!profile) return null;
  const {
    id,
    userId,
    canonicalUserId,
    email,
    emailVerified,
    linkedEmail,
    linkedTelegram,
    telegramId,
    displayName,
    firstName,
    lastName,
    photo,
    city,
    role,
    roles,
    partnerId,
    partnerCabinetIds,
    expertId,
    expertCabinetIds,
    onboardingDone,
    notificationPreferences,
    notificationsEnabled,
    messagingPrivacy,
  } = profile;
  return {
    id: userId || id,
    userId: userId || id,
    canonicalUserId,
    email,
    emailVerified,
    linkedEmail,
    linkedTelegram,
    telegramId,
    displayName,
    firstName,
    lastName,
    photo,
    city,
    role,
    roles,
    partnerId,
    partnerCabinetIds,
    expertId,
    expertCabinetIds,
    onboardingDone,
    notificationPreferences,
    notificationsEnabled,
    messagingPrivacy,
  };
}

export default async function accountRoutes(fastify) {
  fastify.post('/api/account/bootstrap', async (request, reply) => {
    const startedAt = Date.now();
    const token = getBearerToken(request);
    if (!token) return reply.code(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Требуется авторизация.' });
    try {
      const decoded = await getDbAuth().verifyIdToken(token);
      const requestedUserId = safeString(request.body?.userId || decoded.uid, 260);
      const userId = requestedUserId === decoded.uid || requestedUserId.startsWith('email:') || requestedUserId.startsWith('tg_')
        ? requestedUserId
        : decoded.uid;
      const canary = canaryAllowed(userId);
      if (canaryModeEnabled() && !canary) {
        return reply.code(403).send({ ok: false, code: 'ACCOUNT_CANARY_NOT_ALLOWED', error: 'Account Core canary недоступен для пользователя.' });
      }
      const result = await serverFoundation.account.bootstrapAccount({
        userId,
        firebaseUid: decoded.uid,
        sessionId: safeString(request.body?.sessionId || '', 260),
        telegramId: safeString(request.body?.telegramId || request.body?.tgId || '', 120),
      });
      return reply.send({
        ok: true,
        canary,
        canonicalUserId: result.canonicalUserId,
        profile: publicProfile(result.profile),
        roles: result.roles,
        permissions: result.permissions,
        cabinets: result.cabinets,
        access: result.access,
        session: result.session ? { id: result.session.id, status: result.session.status, lastSeenAt: result.session.lastSeenAt || null } : null,
        source: result.diagnostics,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      serverFoundation.account.metrics.recordError(error);
      return reply.code(error?.statusCode || 500).send({
        ok: false,
        code: error?.code || 'ACCOUNT_BOOTSTRAP_FAILED',
        error: error?.statusCode && error.statusCode < 500 ? error.message : 'Account bootstrap временно недоступен.',
      });
    }
  });
}
