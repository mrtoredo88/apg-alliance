import { serverFoundation } from '../apg/index.js';
import { getDb } from '../lib/documentStore.js';

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearerToken(request) {
  const direct = safeString(request.headers['x-apg-auth'] || '', 2000);
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
    keys,
    tickets,
    reputation,
    reputationStatus,
    reputationStatusLabel,
    favorites,
    savedNews,
    readLaterNews,
    newsReactions,
    newsSubscriptions,
    interestProfile,
    scannedPartners,
    completedTasks,
    learningProgress,
    learningHintsEnabled,
    streak,
    lastScanDate,
    referralCount,
    scanDates,
    visitCounts,
    registeredEvents,
    joinedGroup,
    lastBonusDate,
    scannedExperts,
    consents,
    consentAcceptedAt,
    consentDocsVersion,
    consentLegalVersion,
    legalVersion,
    notificationConsent,
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
    keys,
    tickets,
    reputation,
    reputationStatus,
    reputationStatusLabel,
    favorites,
    savedNews,
    readLaterNews,
    newsReactions,
    newsSubscriptions,
    interestProfile,
    scannedPartners,
    completedTasks,
    learningProgress,
    learningHintsEnabled,
    streak,
    lastScanDate,
    referralCount,
    scanDates,
    visitCounts,
    registeredEvents,
    joinedGroup,
    lastBonusDate,
    scannedExperts,
    consents,
    consentAcceptedAt,
    consentDocsVersion,
    consentLegalVersion,
    legalVersion,
    notificationConsent,
  };
}

function syncProfileIdentityLinks(profile = null, identityUser = null) {
  if (!profile) return null;
  if (!identityUser) return profile;
  const linkedTelegram = identityUser.linkedTelegram || null;
  return {
    ...profile,
    linkedTelegram,
    telegramId: linkedTelegram?.tgId || linkedTelegram?.telegramId || '',
  };
}

export default async function accountRoutes(fastify) {
  fastify.post('/api/account/bootstrap', async (request, reply) => {
    const startedAt = Date.now();
    const token = getBearerToken(request);
    if (!token) return reply.code(401).send({ ok: false, code: 'AUTH_REQUIRED', error: 'Требуется авторизация.' });
    try {
      const decoded = await serverFoundation.identity.verifySession({ token });
      const sessionIdentity = await serverFoundation.identityV2.getUser(decoded.uid).catch(() => null);
      let userId = safeString(
        sessionIdentity?.canonicalUserId
          || sessionIdentity?.canonical_user_id
          || sessionIdentity?.id
          || decoded.uid,
        260,
      );
      const sessionUserId = safeString(sessionIdentity?.id || decoded.uid, 260);
      const legacyAccount = sessionUserId ? await getDb().collection('users').doc(sessionUserId).get().catch(() => null) : null;
      const legacyData = legacyAccount?.exists ? legacyAccount.data() || {} : {};
      const aliasAccount = !legacyAccount?.exists && sessionUserId
        ? await getDb().collection('accountAliases').doc(sessionUserId).get().catch(() => null)
        : null;
      const aliasData = aliasAccount?.exists ? aliasAccount.data() || {} : {};
      const mergedInto = safeString(legacyData.mergedInto || legacyData.dataMigratedInto || aliasData.canonicalUserId || '', 260);
      if (mergedInto && mergedInto !== sessionUserId) {
        await serverFoundation.account.linkMergedAccounts({
          targetId: mergedInto,
          sourceIds: [sessionUserId],
          profile: {},
          actorId: 'account-bootstrap-self-heal',
          idempotencyKey: `self_heal:${sessionUserId}:${mergedInto}`,
        });
        userId = mergedInto;
      }
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
      const identityUser = await serverFoundation.identityV2.getUser(userId).catch(() => null);
      const profile = syncProfileIdentityLinks(result.profile, identityUser);
      return reply.send({
        ok: true,
        canary,
        canonicalUserId: result.canonicalUserId,
        profile: publicProfile(profile),
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
