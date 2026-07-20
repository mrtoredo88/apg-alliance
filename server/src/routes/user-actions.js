import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { serverFoundation } from '../apg/index.js';
import { APP_URL } from '../lib/config.js';
import { getDbMessaging } from '../lib/firebase.js';
import webpush from 'web-push';
import { ECONOMY_CONFIG, ECONOMY_VERSION, calculateTicketExchange, economyMigrationPatch, getEconomyReward, getReputationStatus } from '../../../server-shared/economy-engine.js';
import { upsertErrorLog } from '../../../server-shared/error-log.js';
import { buildIdentityDiagnostics, resolveFirebaseIdentity } from '../lib/identityCore.js';
import { hasRole, ROLES } from '../../../server-shared/role-engine.js';
import {
  CONTEXT_DIALOG_TYPES,
  buildContextDialogId,
  buildDialogContext,
  buildDialogDeepLink,
  buildDialogNotificationBody,
  buildDialogNotificationTitle,
  normalizeDialogType,
  safeDialogIdPart,
} from '../../../server-shared/context-dialogs.js';
import {
  BOOKING_ACTIVE_STATUSES,
  BOOKING_STATUSES,
  bookingBlocksSlot,
  buildBookingHistoryEntry,
  buildBookingDialogContext,
  buildBookingProfile,
  buildBookingReminders,
  canTransitionBookingStatus,
  formatBookingDateKey,
  getBookingStatusLabel,
  isOnlineBookingEnabled,
  normalizeBooking,
  normalizeBookingStatus,
  rangesOverlap,
} from '../../../server-shared/booking.js';
import {
  getLocationById,
  locationBookingPayload,
  locationToProvider,
} from '../../../server-shared/locations.js';
import {
  buildBookingChangeEntry,
  sanitizeBookingInternalNotes,
} from '../../../server-shared/workspace-bookings.js';
import { sanitizeDialogWorkspaceNotes } from '../../../server-shared/workspace-dialogs.js';
import {
  buildApgNewsDistributionPatch,
  buildProfileOnlyNewsPatch,
  buildWorkspaceNewsFromEvent,
  isApgNewsPublication,
  sanitizeWorkspaceNewsPatch,
  workspaceNewsBelongsToProfile,
} from '../../../server-shared/workspace-news.js';
import {
  buildPromotionOfferText,
  buildWorkspacePromotionFromProfile,
  sanitizeWorkspacePromotionPatch,
} from '../../../server-shared/workspace-promotions.js';
import {
  buildWorkspaceGift,
  sanitizeWorkspaceGiftPatch,
  workspaceGiftBelongsToProfile,
} from '../../../server-shared/workspace-gifts.js';
import {
  buildWorkspaceAnalyticsRange,
  buildWorkspaceAnalyticsSnapshot,
  workspaceAnalyticsRowsToCsv,
} from '../../../server-shared/workspace-analytics.js';
import { buildLifecyclePatch, normalizeContentStatus } from '../../../server-shared/content-lifecycle.js';
import { normalizeTelegramUrl } from '../../../server-shared/telegram.js';
import { normalizeVkCommunityUrl } from '../../../server-shared/vk-community.js';
import { actorOwnsEditableProfile } from '../../../server-shared/profile-access.js';
import { buildReferralRecoveryDecision } from '../../../server-shared/referral-recovery.js';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import { recordReferralClientEventsAsync, recordReferralEventAsync, referralContextFromBody } from '../lib/referralEvents.js';
import { completeReferralSessionAsync, resolveReferralSessionReferrer } from '../lib/referralSessions.js';
import {
  buildWorkspaceEventBase,
  buildWorkspaceEventDuplicate,
  filterWorkspaceEvents,
  findWorkspaceEventConflicts,
  sanitizeWorkspaceEventPatch,
  workspaceEventBelongsToProfile,
  workspaceEventStatus,
} from '../../../server-shared/workspace-events.js';
import {
  CONNECTION_STATUS,
  SOCIAL_DECLINE_COOLDOWN_MS,
  SOCIAL_EVENTS,
  SOCIAL_PRIVACY,
  SOCIAL_REQUEST_LIMIT,
  SOCIAL_REQUEST_STATUS,
  buildConnectionSharedContext,
  cleanSocialId,
  createConnectionContext,
  createSocialRequestRecord,
  isDeclineCooldownActive,
  isRecentSocialRequest,
  normalizeConnectionStatus,
  normalizeSocialPair,
  normalizeSocialPrivacy,
  normalizeSocialRequestStatus,
  socialPublicUser,
  socialDirectDialogId,
  socialRequestId,
} from '../../../server-shared/social-messaging.js';

const MAX_TEXT = 4000;
const MAX_DIALOG_TEXT = 1800;

function accountCoreWriteEnabled() {
  return ['1', 'true', 'on'].includes(String(process.env.ACCOUNT_DUAL_WRITE || process.env.ACCOUNT_CANARY || '').toLowerCase())
    || String(process.env.ACCOUNT_STORAGE || '').toLowerCase() === 'postgres';
}

async function writeAccountProfileBestEffort(userId, profile = {}, extra = {}) {
  if (!accountCoreWriteEnabled()) return null;
  return serverFoundation.account.upsertProfile({
    ...profile,
    ...extra,
    id: userId,
    userId,
    canonicalUserId: profile.canonicalUserId || userId,
  }).catch(error => {
    serverFoundation.account.metrics.recordError(error);
    return null;
  });
}

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

const URL_FIELD_PLATFORMS = {
  telegramUrl: 'telegram',
  telegramCommunityUrl: 'telegram',
  vkUrl: 'vk',
  vkGroupUrl: 'vk',
  maxUrl: 'max',
  maxCommunityUrl: 'max',
  whatsappUrl: 'whatsapp',
  websiteUrl: '',
  bookingUrl: '',
  socialUrl: '',
  linkUrl: '',
};

function normalizeProfileUrl(value, platform = '') {
  const raw = safeString(value, 1000).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!raw) return '';
  if (platform === 'telegram' || /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?(?:telegram\.me|t[.]me)\//i.test(raw)) return normalizeTelegramUrl(raw);
  if (platform === 'vk') return normalizeVkCommunityUrl(raw);
  const hostMap = { vk: 'vk.com', max: 'max.ru', whatsapp: 'wa.me' };
  if (platform && hostMap[platform]) {
    const extraHosts = {
      vk: 'vk\\.me|vkontakte\\.ru',
      whatsapp: 'whatsapp\\.com',
    }[platform];
    const hostPattern = [hostMap[platform].replace('.', '\\.'), extraHosts].filter(Boolean).join('|');
    let path = raw
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(new RegExp(`^(?:${hostPattern})/?`, 'i'), '')
      .replace(/^@+/, '')
      .replace(/\s+/g, '');
    if (platform === 'whatsapp' && !/[/?]/.test(path)) path = path.replace(/\D/g, '');
    return path ? `https://${hostMap[platform]}/${path}` : '';
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/i.test(url.protocol)) return '';
    url.hostname = url.hostname.replace(/^www\./i, '');
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeProfileSocialLinks(value) {
  return (Array.isArray(value) ? value : []).slice(0, 24).map(item => {
    if (!item || typeof item !== 'object') return null;
    const type = safeString(item.type || item.id, 80);
    const platform = type === 'telegram' ? 'telegram' : type === 'vk' ? 'vk' : type === 'max' ? 'max' : type === 'whatsapp' ? 'whatsapp' : '';
    return {
      ...item,
      id: safeString(item.id || type, 100) || undefined,
      type,
      label: safeString(item.label, 120),
      url: normalizeProfileUrl(item.url, platform),
    };
  }).filter(item => item?.url);
}

function normalizeProfilePatchField(key, value) {
  if (key === 'aiProfile') return sanitizeAiProfile(value);
  if (key === 'socialLinks') return normalizeProfileSocialLinks(value);
  if (Object.hasOwn(URL_FIELD_PLATFORMS, key)) return normalizeProfileUrl(value, URL_FIELD_PLATFORMS[key]);
  return typeof value === 'string' ? safeString(value, 4000) : value;
}

function safeUserId(value) {
  return safeString(value, 180);
}

function canUseReferral(referrerId, userId) {
  return !!referrerId && referrerId !== userId && !referrerId.startsWith('guest_') && !userId.startsWith('guest_');
}

function referralServerLog(stage, details = {}) {
  try {
    console.log('[REF]', stage, details);
  } catch {}
}

function jsonError(res, status, message, code = 'USER_ACTION_ERROR') {
  return res.status(status).json({ ok: false, code, error: message });
}

function getBearerToken(req) {
  const direct = String(req.headers['x-firebase-auth'] || req.headers['x-apg-auth'] || '').trim();
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function sanitizePublicProfile(input = {}) {
  return {
    displayName: safeString(input.displayName || [input.first_name, input.last_name].filter(Boolean).join(' ') || input.name || '', 160) || null,
    firstName: safeString(input.firstName || input.first_name, 80) || null,
    lastName: safeString(input.lastName || input.last_name, 80) || null,
    photo: safeString(input.photo || input.photo_200, 1000) || null,
    email: safeString(input.email, 200) || null,
    emailVerified: input.emailVerified === undefined ? undefined : Boolean(input.emailVerified),
  };
}

function stripUndefined(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function boolFromLegacy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getConsentStatus(profile = {}) {
  const consents = profile.consents && typeof profile.consents === 'object' ? profile.consents : {};
  const explicitTerms = boolFromLegacy(consents.termsAccepted)
    || boolFromLegacy(profile.termsAccepted)
    || boolFromLegacy(profile.acceptedTerms)
    || boolFromLegacy(profile.userAgreementAccepted)
    || boolFromLegacy(profile.consentAccepted);
  const explicitPrivacy = boolFromLegacy(consents.privacyAccepted)
    || boolFromLegacy(profile.privacyAccepted)
    || boolFromLegacy(profile.acceptedPrivacy)
    || boolFromLegacy(profile.privacyPolicyAccepted)
    || boolFromLegacy(profile.consentAccepted);
  const acceptedAt = consents.acceptedAt
    || profile.consentAcceptedAt
    || profile.acceptedAt
    || profile.termsAcceptedAt
    || profile.privacyAcceptedAt
    || null;
  const hasLegacyAcceptedMarker = !!acceptedAt || boolFromLegacy(profile.consentAccepted);
  const termsAccepted = explicitTerms || (hasLegacyAcceptedMarker && profile.termsAccepted !== false);
  const privacyAccepted = explicitPrivacy || (hasLegacyAcceptedMarker && profile.privacyAccepted !== false);
  const rawLegalVersion = consents.legalVersion ?? profile.legalVersion ?? profile.consentLegalVersion ?? profile.documentsVersion ?? 1;
  const legalVersion = Number(rawLegalVersion || 1);
  const versionOk = !Number.isFinite(legalVersion) || legalVersion >= 1;
  const valid = !!termsAccepted && !!privacyAccepted && versionOk;
  const missing = [];
  if (!termsAccepted) missing.push('missing_termsAccepted');
  if (!privacyAccepted) missing.push('missing_privacyAccepted');
  if (!versionOk) missing.push('outdated_legalVersion');
  const formatVersion = consents.termsAccepted || consents.privacyAccepted ? 'v1' : (hasLegacyAcceptedMarker ? 'legacy' : 'missing');
  return {
    consentRequired: !valid,
    reason: valid ? 'accepted' : (missing[0] || 'missing_consent'),
    formatVersion,
    acceptedAt,
    normalizedConsent: valid ? {
      termsAccepted: true,
      privacyAccepted: true,
      notificationsAccepted: boolFromLegacy(consents.notificationsAccepted ?? profile.notificationConsent ?? profile.notificationsConsent ?? profile.notificationsEnabled),
      legalVersion: Number.isFinite(legalVersion) && legalVersion > 0 ? legalVersion : 1,
      docsVersion: safeString(consents.docsVersion || profile.consentDocsVersion || profile.documentsVersion || 'legacy', 80) || 'legacy',
    } : null,
  };
}

function buildConsentMigrationPatch(status) {
  if (!status?.normalizedConsent || status.formatVersion === 'v1') return null;
  return {
    consents: { ...status.normalizedConsent, acceptedAt: status.acceptedAt || FieldValue.serverTimestamp() },
    consentAcceptedAt: status.acceptedAt || FieldValue.serverTimestamp(),
    consentDocsVersion: status.normalizedConsent.docsVersion,
    consentLegalVersion: status.normalizedConsent.legalVersion,
    legalVersion: status.normalizedConsent.legalVersion,
    notificationConsent: status.normalizedConsent.notificationsAccepted,
    consentMigratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function sanitizeWebPushSubscription(input = {}) {
  const endpoint = safeString(input.endpoint, 2000);
  const p256dh = safeString(input.keys?.p256dh, 500);
  const auth = safeString(input.keys?.auth, 300);
  if (!endpoint || !p256dh || !auth) return null;
  return {
    endpoint,
    expirationTime: input.expirationTime || null,
    keys: { p256dh, auth },
  };
}

function pushEndpointInfo(subscription = {}) {
  const endpoint = safeString(subscription.endpoint, 2000);
  if (!endpoint) return { host: '', length: 0 };
  try {
    return { host: new URL(endpoint).host, length: endpoint.length };
  } catch {
    return { host: endpoint.slice(0, 24), length: endpoint.length };
  }
}

function safePushDiagnostics(input = {}) {
  const allowed = [
    'deviceId', 'platform', 'device', 'os', 'browser', 'appVersion',
    'notificationPermission', 'notificationSupported', 'serviceWorkerSupported',
    'serviceWorkerReady', 'serviceWorkerController', 'pushManagerSupported',
    'subscriptionExists', 'subscriptionActiveInProfile', 'subscriptionEndpointHost',
    'subscriptionEndpointLength', 'fcmTokenCount', 'registeredDeviceCount',
    'profileSubscriptionCount', 'lastRegistration', 'lastSuccessfulPush', 'lastPushStatus',
  ];
  return Object.fromEntries(allowed.map(key => [key, input[key]]).filter(([, value]) => value !== undefined));
}

function mergePushSubscriptions(existing = [], current = null) {
  const byEndpoint = new Map();
  [...(Array.isArray(existing) ? existing : []), current].filter(Boolean).forEach(item => {
    const sanitized = sanitizeWebPushSubscription(item);
    if (sanitized?.endpoint) byEndpoint.set(sanitized.endpoint, sanitized);
  });
  return [...byEndpoint.values()].slice(-5);
}

async function resolveActor(db, decoded) {
  const identity = await resolveFirebaseIdentity(db, decoded.uid).catch(() => null);
  if (identity?.userId) return identity;

  const direct = await db.collection('users').doc(decoded.uid).get().catch(() => null);
  if (direct?.exists) return { uid: decoded.uid, userId: decoded.uid, user: direct.data() || {}, source: 'users.uid' };

  const map = await db.collection('auth_map').doc(decoded.uid).get().catch(() => null);
  const mappedUserId = map?.exists ? safeUserId(map.data()?.vkId || map.data()?.userId) : '';
  if (mappedUserId) {
    const mapped = await db.collection('users').doc(mappedUserId).get().catch(() => null);
    return { uid: decoded.uid, userId: mappedUserId, user: mapped?.data?.() || {}, source: 'auth_map' };
  }

  for (const field of ['firebaseUid', 'authUid']) {
    const snap = await db.collection('users').where(field, '==', decoded.uid).limit(1).get().catch(() => null);
    if (snap?.docs?.[0]) return { uid: decoded.uid, userId: snap.docs[0].id, user: snap.docs[0].data() || {}, source: `users.${field}` };
  }
  return { uid: decoded.uid, userId: decoded.uid, user: {}, source: 'token' };
}

async function requireActor(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Требуется авторизация.');
    error.statusCode = 401;
    throw error;
  }
  const decoded = await getDbAuth().verifyIdToken(token);
  return resolveActor(getDb(), decoded);
}

function assertOwn(actor, userId) {
  const target = safeUserId(userId);
  if (!target || target.startsWith('guest_')) throw Object.assign(new Error('Действие доступно только авторизованному пользователю.'), { statusCode: 401 });
  if (actor.userId !== target && actor.uid !== target) throw Object.assign(new Error('Нельзя менять данные другого пользователя.'), { statusCode: 403 });
  return target;
}

function assertOwner(actor) {
  if (!hasRole(actor?.user || {}, ROLES.owner)) throw Object.assign(new Error('Действие доступно только Owner.'), { statusCode: 403, code: 'OWNER_REQUIRED' });
}

async function findUserRefForOwner(db, req) {
  const userId = safeUserId(req.body?.userId || req.body?.uid);
  const email = safeString(req.body?.email, 200).toLowerCase();
  if (userId) return db.collection('users').doc(userId);
  if (email) {
    const emailDoc = db.collection('users').doc(`email:${email}`);
    const emailSnap = await emailDoc.get();
    if (emailSnap.exists) return emailDoc;
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.docs[0]) return snap.docs[0].ref;
  }
  throw Object.assign(new Error('Пользователь не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
}

async function audit(db, req, actor, action, targetType, targetId, result = 'success', details = {}) {
  await db.collection('userActivityLog').add({
    action,
    targetType,
    targetId: safeString(targetId, 220),
    userId: actor?.userId || null,
    firebaseUid: actor?.uid || null,
    result,
    details,
    userAgent: safeString(req?.headers?.['user-agent'], 300),
    appVersion: safeString(req?.headers?.['x-apg-version'], 80),
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

async function actionAuthLink(db, req, actor) {
  const userId = safeUserId(req.body?.userId);
  if (!userId) throw Object.assign(new Error('Не указан пользователь.'), { statusCode: 400 });
  if ((userId.startsWith('email:') || userId.startsWith('tg_')) && actor.uid !== userId) {
    await audit(db, req, actor, 'auth:linkUser:blocked', 'auth_map', actor.uid, 'blocked', { requestedUserId: userId, reason: 'strong_identity_required' });
    throw Object.assign(new Error('Для этого аккаунта требуется повторная авторизация.'), { statusCode: 403 });
  }
  await db.collection('auth_map').doc(actor.uid).set({
    vkId: userId,
    userId,
    canonicalUserId: actor.user?.canonicalUserId || userId,
    source: safeString(req.body?.source || 'user-actions', 80),
    identityVersion: 'identity-core-v1',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, { ...actor, userId }, 'auth:linkUser', 'auth_map', actor.uid);
  return { ok: true, userId, canonicalUserId: actor.user?.canonicalUserId || userId };
}

async function actionIdentityDiagnostics(db, req, actor) {
  const requestedUserId = safeUserId(req.body?.userId || actor.userId);
  if (requestedUserId && requestedUserId !== actor.userId && actor.uid !== requestedUserId) {
    assertOwner(actor);
  }
  const email = safeString(req.body?.email || actor.user?.email || actor.user?.linkedEmail, 220).toLowerCase();
  const diagnostics = await buildIdentityDiagnostics(db, {
    userId: requestedUserId || actor.userId,
    email,
    firebaseUid: actor.uid,
  });
  await audit(db, req, actor, 'identity:diagnostics', 'users', diagnostics.canonicalUserId || requestedUserId, 'success', { documents: diagnostics.documents.length });
  return diagnostics;
}

async function actionProfileSync(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const todayKey = new Date().toLocaleDateString('sv');
  const profile = stripUndefined(sanitizePublicProfile(req.body?.profile || {}));
  if (profile.email) {
    const normalizedEmail = safeString(profile.email, 200).toLowerCase();
    if (userId.startsWith('email:') && normalizedEmail === userId.slice(6).toLowerCase()) {
      profile.email = normalizedEmail;
    } else {
      delete profile.email;
      delete profile.emailVerified;
    }
  }
  const requestedRefId = safeUserId(req.body?.referrerId);
  const sessionResolution = await resolveReferralSessionReferrer(db, req.body?.referralSessionId || req.body?.sessionId || '', { markMissing: true, source: 'profile-sync', userId }).catch(() => ({ referrerId: '', session: null, status: 'missing' }));
  const refId = safeUserId(sessionResolution.referrerId || requestedRefId);
  const referralContext = referralContextFromBody(req.body || {}, { referralCode: refId, referralFlowId: sessionResolution.session?.data?.flowId || '' });
  const hasReferralObservability = Boolean(refId || referralContext.referralFlowId || Array.isArray(req.body?.referralClientEvents));
  if (hasReferralObservability) {
    recordReferralClientEventsAsync(db, req.body?.referralClientEvents, {
      ...referralContext,
      referralCode: refId || referralContext.referralCode,
      referrerId: refId || referralContext.referralCode,
      referredUserId: userId,
      source: 'profile-sync:client',
      metadata: { action: 'profile:sync' },
    });
    recordReferralEventAsync(db, {
      ...referralContext,
      referralCode: refId || referralContext.referralCode,
      referrerId: refId || referralContext.referralCode,
      referredUserId: userId,
      type: REFERRAL_EVENT_TYPES.PROFILE_SYNC_STARTED,
      status: 'started',
      source: 'profile-sync',
      metadata: { hasReferrerId: !!refId },
    });
  }
  const consent = req.body?.consent || null;
  const ref = db.collection('users').doc(userId);
  let created = false;
  let dailyBonusAwarded = false;
  let referralBonusAwarded = false;
  let referralRecoveryStatus = 'skipped';
  let referralRecoveryReason = 'not_started';
  let userDoc = {};
  let consentStatus = null;

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const isValidRef = canUseReferral(refId, userId);
    if (snap.exists) {
      const before = snap.data() || {};
      const currentReferrer = safeUserId(before.referredBy);
      const effectiveReferrerId = currentReferrer || (isValidRef ? refId : '');
      referralServerLog('recovery started', { userId, requestedReferrerId: refId || null, currentReferrer: currentReferrer || null, alreadyGranted: before.referralBonusGranted === true });
      const referrerRef = canUseReferral(effectiveReferrerId, userId) && before.referralBonusGranted !== true
        ? db.collection('users').doc(effectiveReferrerId)
        : null;
      const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;
      const referrerData = referrerSnap?.exists ? (referrerSnap.data() || {}) : {};
      const referralDecision = buildReferralRecoveryDecision({
        userId,
        requestedReferrerId: refId,
        currentReferredBy: currentReferrer,
        referralBonusGranted: before.referralBonusGranted === true,
        referrerExists: !!referrerSnap?.exists,
        referrerRewardedUsers: referrerData.referralRewardedUsers,
      });
      referralRecoveryStatus = referralDecision.status;
      referralRecoveryReason = referralDecision.reason;
      const patch = { ...profile, lastSeen: FieldValue.serverTimestamp() };
      let keyIncrement = 0;
      let reputationIncrement = 0;
      consentStatus = getConsentStatus(before);
      const consentMigration = buildConsentMigrationPatch(consentStatus);
      if (consentMigration) Object.assign(patch, consentMigration);
      Object.assign(patch, economyMigrationPatch(before));
      if (before.lastBonusDate !== todayKey) {
        const reward = getEconomyReward('daily_activity');
        keyIncrement += reward.keys;
        reputationIncrement += reward.reputation;
        patch.lastBonusDate = todayKey;
        dailyBonusAwarded = true;
      }
      if (referralDecision.markInvitedRewarded) {
        const reward = getEconomyReward('referral');
        referralBonusAwarded = referralDecision.grantReferrerReward;
        keyIncrement += referralDecision.grantInviteeReward ? reward.keys : 0;
        reputationIncrement += referralDecision.grantInviteeReward ? reward.reputation : 0;
        patch.referredBy = referralDecision.effectiveReferrerId;
        patch.referralBonusGranted = true;
        patch.referralBonusGrantedTo = referralDecision.effectiveReferrerId;
        patch.referralBonusGrantedAt = FieldValue.serverTimestamp();
        if (referralDecision.grantReferrerReward) {
          tx.set(referrerRef, {
            keys: FieldValue.increment(reward.keys),
            reputation: FieldValue.increment(reward.reputation),
            economyVersion: ECONOMY_VERSION,
            referralCount: FieldValue.increment(1),
            referralRewardedUsers: FieldValue.arrayUnion(userId),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
      referralServerLog(
        referralRecoveryStatus === 'recovery_completed' ? 'recovery completed'
          : referralRecoveryStatus === 'duplicate_prevented' ? 'duplicate prevented'
            : referralRecoveryStatus === 'already_rewarded' ? 'already rewarded'
              : 'recovery skipped',
        { userId, referrerId: referralDecision.effectiveReferrerId || null, reason: referralRecoveryReason },
      );
      if (keyIncrement > 0) patch.keys = FieldValue.increment(keyIncrement);
      if (reputationIncrement > 0) patch.reputation = FieldValue.increment(reputationIncrement);
      tx.set(ref, patch, { merge: true });
      const newReputation = Number(before.reputation || before.keys || 0) + reputationIncrement;
      const reputationStatus = getReputationStatus(newReputation);
      userDoc = {
        ...before,
        ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== null)),
        ...(referralDecision.markInvitedRewarded ? {
          referredBy: referralDecision.effectiveReferrerId,
          referralBonusGranted: true,
          referralBonusGrantedTo: referralDecision.effectiveReferrerId,
          referralBonusGrantedAt: null,
        } : {}),
        ...(consentMigration ? {
          consents: { ...consentStatus.normalizedConsent, acceptedAt: consentStatus.acceptedAt || null },
          consentAcceptedAt: consentStatus.acceptedAt || before.consentAcceptedAt || null,
          consentDocsVersion: consentStatus.normalizedConsent.docsVersion,
          consentLegalVersion: consentStatus.normalizedConsent.legalVersion,
          legalVersion: consentStatus.normalizedConsent.legalVersion,
          notificationConsent: consentStatus.normalizedConsent.notificationsAccepted,
        } : {}),
        lastBonusDate: patch.lastBonusDate || before.lastBonusDate,
        keys: Number(before.keys || 0) + keyIncrement,
        tickets: Number(before.tickets || 0),
        reputation: newReputation,
        reputationStatus: reputationStatus.id,
        reputationStatusLabel: reputationStatus.label,
        economyVersion: ECONOMY_VERSION,
      };
      return;
    }

    created = true;
    const referrerRef = isValidRef ? db.collection('users').doc(refId) : null;
    const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;
    const referrerData = referrerSnap?.exists ? (referrerSnap.data() || {}) : {};
    const referralDecision = buildReferralRecoveryDecision({
      userId,
      requestedReferrerId: refId,
      currentReferredBy: '',
      referralBonusGranted: false,
      referrerExists: !!referrerSnap?.exists,
      referrerRewardedUsers: referrerData.referralRewardedUsers,
    });
    const shouldGrantReferral = referralDecision.markInvitedRewarded;
    referralBonusAwarded = referralDecision.grantReferrerReward;
    referralRecoveryStatus = referralDecision.status;
    referralRecoveryReason = referralDecision.reason;
    const referralReward = getEconomyReward('referral');
    const baseReputation = referralDecision.grantInviteeReward ? referralReward.reputation : 0;
    const baseStatus = getReputationStatus(baseReputation);
    const base = {
      keys: referralDecision.grantInviteeReward ? referralReward.keys : 0,
      tickets: 0,
      reputation: baseReputation,
      reputationStatus: baseStatus.id,
      reputationStatusLabel: baseStatus.label,
      economyVersion: ECONOMY_VERSION,
      favorites: [],
      scannedPartners: {},
      savedNews: [],
      readLaterNews: [],
      newsReactions: {},
      newsSubscriptions: {},
      completedTasks: [],
      streak: 0,
      onboardingDone: false,
      scanDates: [],
      lastBonusDate: todayKey,
      referredBy: shouldGrantReferral ? referralDecision.effectiveReferrerId : null,
      referralBonusGranted: shouldGrantReferral,
      referralBonusGrantedTo: shouldGrantReferral ? referralDecision.effectiveReferrerId : null,
      referralBonusGrantedAt: shouldGrantReferral ? FieldValue.serverTimestamp() : null,
      registeredEvents: [],
      registeredAt: FieldValue.serverTimestamp(),
      lastSeen: FieldValue.serverTimestamp(),
      ...profile,
    };
    if (consent?.termsAccepted && consent?.privacyAccepted) {
      base.consents = { ...consent, acceptedAt: FieldValue.serverTimestamp() };
      base.consentAcceptedAt = FieldValue.serverTimestamp();
      base.consentDocsVersion = consent.docsVersion || null;
      base.consentLegalVersion = consent.legalVersion || null;
      base.legalVersion = consent.legalVersion || null;
      base.notificationConsent = Boolean(consent.notificationsAccepted);
      if (consent.notificationsAccepted) base.notificationsRequestedAt = FieldValue.serverTimestamp();
    }
    consentStatus = getConsentStatus(base);
    tx.set(ref, base, { merge: true });
    if (referralDecision.grantReferrerReward) {
      tx.set(referrerRef, {
        keys: FieldValue.increment(referralReward.keys),
        reputation: FieldValue.increment(referralReward.reputation),
        economyVersion: ECONOMY_VERSION,
        referralCount: FieldValue.increment(1),
        referralRewardedUsers: FieldValue.arrayUnion(userId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    referralServerLog(
      referralRecoveryStatus === 'completed' ? 'recovery completed'
        : referralRecoveryStatus === 'duplicate_prevented' ? 'duplicate prevented'
          : 'recovery skipped',
      { userId, referrerId: referralDecision.effectiveReferrerId || null, reason: referralRecoveryReason },
    );
    tx.set(db.collection('stats').doc('global'), { userCount: FieldValue.increment(1) }, { merge: true });
    userDoc = { ...base, keys: base.keys };
  });

  consentStatus = getConsentStatus(userDoc);
  await audit(db, req, actor, created ? 'profile:create' : 'profile:sync', 'users', userId, 'success', { dailyBonusAwarded, referralBonusAwarded, referralRecoveryStatus, referralRecoveryReason, consentRequired: consentStatus.consentRequired, consentReason: consentStatus.reason, consentFormatVersion: consentStatus.formatVersion });
  await writeAccountProfileBestEffort(userId, userDoc, { bootstrap: { profileSync: true, created } });
  if (hasReferralObservability) {
    const effectiveReferrerId = userDoc?.referredBy || userDoc?.referralBonusGrantedTo || refId || referralContext.referralCode;
    recordReferralEventAsync(db, {
      ...referralContext,
      referralCode: refId || referralContext.referralCode,
      referrerId: effectiveReferrerId,
      referredUserId: userId,
      type: REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED,
      status: 'completed',
      source: 'profile-sync',
      metadata: { created, referralRecoveryStatus, referralRecoveryReason, referralBonusAwarded },
    });
    if (created) {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.USER_CREATED,
        status: 'completed',
        source: 'profile-sync',
        metadata: { created },
      });
    }
    if (effectiveReferrerId) {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED,
        status: ['completed', 'recovery_completed'].includes(referralRecoveryStatus) ? 'completed' : 'info',
        source: 'profile-sync',
        metadata: { referralRecoveryStatus, referralRecoveryReason },
      });
    }
    const terminalType = referralRecoveryStatus === 'already_rewarded'
      ? REFERRAL_EVENT_TYPES.ALREADY_GRANTED
      : referralRecoveryStatus === 'duplicate_prevented'
        ? REFERRAL_EVENT_TYPES.DUPLICATE_PREVENTED
        : referralRecoveryStatus === 'recovery_completed'
          ? REFERRAL_EVENT_TYPES.RECOVERY_COMPLETED
          : referralBonusAwarded
            ? REFERRAL_EVENT_TYPES.REWARD_GRANTED
            : '';
    if (referralRecoveryStatus === 'recovery_completed') {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.RECOVERY_STARTED,
        status: 'started',
        source: 'profile-sync',
        metadata: { referralRecoveryReason },
      });
    }
    if (terminalType) {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: terminalType,
        status: terminalType === REFERRAL_EVENT_TYPES.DUPLICATE_PREVENTED ? 'warning' : 'completed',
        source: 'profile-sync',
        metadata: { referralRecoveryStatus, referralRecoveryReason },
      });
    }
    if (referralBonusAwarded && terminalType !== REFERRAL_EVENT_TYPES.REWARD_GRANTED) {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.REWARD_GRANTED,
        status: 'completed',
        source: 'profile-sync',
        metadata: { referralRecoveryStatus, referralRecoveryReason },
      });
    }
    if (req.body?.referralSessionId || req.body?.sessionId) {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.SESSION_PROFILE_SYNC,
        status: referralBonusAwarded || userDoc?.referralBonusGranted ? 'completed' : 'info',
        source: 'profile-sync',
        metadata: { referralRecoveryStatus, referralRecoveryReason },
      });
      if (referralBonusAwarded || userDoc?.referralBonusGranted) {
        completeReferralSessionAsync(db, req.body?.referralSessionId || req.body?.sessionId || '', { userId, authType: userId.startsWith('tg_') ? 'telegram' : userId.startsWith('email:') ? 'email' : 'profile', source: 'profile-sync' });
      }
    }
    if (!terminalType && refId && referralRecoveryStatus === 'skipped') {
      recordReferralEventAsync(db, {
        ...referralContext,
        referrerId: effectiveReferrerId,
        referredUserId: userId,
        referralCode: refId || referralContext.referralCode,
        type: REFERRAL_EVENT_TYPES.FAILED,
        status: 'error',
        source: 'profile-sync',
        metadata: { referralRecoveryStatus, referralRecoveryReason },
      });
    }
  }
  return { ok: true, userId, created, dailyBonusAwarded, referralBonusAwarded, referralRecoveryStatus, referralRecoveryReason, profileReady: true, consentRequired: consentStatus.consentRequired, consentReason: consentStatus.reason, consentFormatVersion: consentStatus.formatVersion, consentAcceptedAt: consentStatus.acceptedAt || null, user: userDoc };
}

async function actionProfilePatch(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const allowed = new Set(['onboardingDone', 'consents', 'consentAcceptedAt', 'consentDocsVersion', 'consentLegalVersion', 'legalVersion', 'notificationConsent', 'notificationsRequestedAt', 'notificationsEnabled', 'notificationProvider', 'notificationPreferences', 'displayName', 'firstName', 'lastName', 'photo', 'joinedGroup', 'webPushUpdatedAt', 'interestProfile', 'learningProgress', 'learningHintsEnabled', 'learningAnalytics', 'messagingPrivacy']);
  const patch = {};
  Object.entries(req.body?.patch || {}).forEach(([key, value]) => {
    if (allowed.has(key)) patch[key] = key === 'messagingPrivacy' ? normalizeSocialPrivacy(value) : value;
  });
  if (req.body?.serverConsentAt && patch.consents) {
    patch.consents = { ...patch.consents, acceptedAt: FieldValue.serverTimestamp() };
    patch.consentAcceptedAt = FieldValue.serverTimestamp();
    if (patch.notificationsRequestedAt) patch.notificationsRequestedAt = FieldValue.serverTimestamp();
  }
  if (Array.isArray(req.body?.patch?.fcmTokens)) {
    const tokens = req.body.patch.fcmTokens.map(token => safeString(token, 500)).filter(Boolean).slice(0, 5);
    if (tokens.length) patch.fcmTokens = FieldValue.arrayUnion(...tokens);
  }
  if (Array.isArray(req.body?.patch?.webPushSubscriptions)) {
    const subscriptions = req.body.patch.webPushSubscriptions.map(sanitizeWebPushSubscription).filter(Boolean).slice(0, 5);
    if (subscriptions.length) patch.webPushSubscriptions = FieldValue.arrayUnion(...subscriptions);
  }
  if (!Object.keys(patch).length) throw Object.assign(new Error('Нет данных для сохранения.'), { statusCode: 400 });
  patch.updatedAt = FieldValue.serverTimestamp();
  await db.collection('users').doc(userId).set(patch, { merge: true });
  await writeAccountProfileBestEffort(userId, patch, { bootstrap: { profileUpdate: true } });
  await audit(db, req, actor, 'profile:update', 'users', userId, 'success', { fields: Object.keys(patch) });
  return { ok: true, userId, patch: req.body?.patch || {} };
}

async function actionProfileAcceptConsent(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const consent = req.body?.consent || {};
  if (!consent.termsAccepted || !consent.privacyAccepted) {
    throw Object.assign(new Error('Не приняты обязательные документы.'), { statusCode: 400, code: 'CONSENT_REQUIRED' });
  }
  const profile = stripUndefined(sanitizePublicProfile(req.body?.profile || {}));
  if (profile.email) {
    const normalizedEmail = safeString(profile.email, 200).toLowerCase();
    if (userId.startsWith('email:') && normalizedEmail === userId.slice(6).toLowerCase()) {
      profile.email = normalizedEmail;
    } else {
      delete profile.email;
      delete profile.emailVerified;
    }
  }
  const ref = db.collection('users').doc(userId);
  let created = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    created = !snap.exists;
    const patch = {
      ...(created ? {
        keys: 0,
        favorites: [],
        scannedPartners: {},
        savedNews: [],
        readLaterNews: [],
        newsReactions: {},
        newsSubscriptions: {},
        completedTasks: [],
        streak: 0,
        scanDates: [],
        registeredEvents: [],
        onboardingDone: false,
        registeredAt: FieldValue.serverTimestamp(),
      } : {}),
      ...profile,
      consents: { ...consent, acceptedAt: FieldValue.serverTimestamp() },
      consentAcceptedAt: FieldValue.serverTimestamp(),
      consentDocsVersion: consent.docsVersion || null,
      consentLegalVersion: consent.legalVersion || null,
      legalVersion: consent.legalVersion || null,
      notificationConsent: Boolean(consent.notificationsAccepted),
      lastSeen: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (consent.notificationsAccepted) patch.notificationsRequestedAt = FieldValue.serverTimestamp();
    tx.set(ref, patch, { merge: true });
    if (created) tx.set(db.collection('stats').doc('global'), { userCount: FieldValue.increment(1) }, { merge: true });
  });
  await audit(db, req, actor, 'profile:acceptConsent', 'users', userId, 'success', {
    created,
    docsVersion: consent.docsVersion || null,
    legalVersion: consent.legalVersion || null,
    notificationsAccepted: Boolean(consent.notificationsAccepted),
  });
  return { ok: true, userId, created, profileReady: true, consentRequired: false, consentReason: 'accepted', code: 'CONSENT_SAVED' };
}

async function actionProfileConsentStatus(db, req, actor) {
  const requestedId = safeUserId(req.body?.userId || req.body?.uid);
  const email = safeString(req.body?.email, 200);
  if ((requestedId && requestedId !== actor.userId && requestedId !== actor.uid) || email) assertOwner(actor);
  const ref = requestedId
    ? db.collection('users').doc(requestedId)
    : (email ? await findUserRefForOwner(db, req) : db.collection('users').doc(actor.userId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: true, profileReady: false, profileExists: false, consentRequired: true, consentReason: 'profile_not_found', userId: ref.id };
  const profile = snap.data() || {};
  const status = getConsentStatus(profile);
  return {
    ok: true,
    profileReady: true,
    profileExists: true,
    userId: ref.id,
    provider: ref.id.startsWith('email:') ? 'email' : (ref.id.startsWith('tg_') ? 'telegram' : 'unknown'),
    consentRequired: status.consentRequired,
    consentReason: status.reason,
    consentFormatVersion: status.formatVersion,
    acceptedAt: status.acceptedAt || null,
    lastLoginAt: profile.lastSeen || null,
    onboardingStep: profile.onboardingDone ? 'done' : 'onboarding',
    reasonWhyConsentScreenIsShown: status.consentRequired ? status.reason : 'not_shown',
  };
}

async function actionProfileForceAcceptConsent(db, req, actor) {
  assertOwner(actor);
  const ref = await findUserRefForOwner(db, req);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Профиль пользователя не найден.'), { statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  const consent = {
    termsAccepted: true,
    privacyAccepted: true,
    notificationsAccepted: boolFromLegacy(req.body?.notificationsAccepted),
    legalVersion: Number(req.body?.legalVersion || 1),
    docsVersion: safeString(req.body?.docsVersion || 'owner-rescue', 80) || 'owner-rescue',
    rescue: true,
  };
  await ref.set({
    consents: { ...consent, acceptedAt: FieldValue.serverTimestamp() },
    consentAcceptedAt: FieldValue.serverTimestamp(),
    consentDocsVersion: consent.docsVersion,
    consentLegalVersion: consent.legalVersion,
    legalVersion: consent.legalVersion,
    notificationConsent: consent.notificationsAccepted,
    consentRescuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'profile:forceAcceptConsent', 'users', ref.id, 'success', { docsVersion: consent.docsVersion, legalVersion: consent.legalVersion });
  return { ok: true, userId: ref.id, profileReady: true, consentRequired: false, consentReason: 'owner_rescue' };
}

async function actionProfileDelete(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  await db.collection('users').doc(userId).delete();
  await audit(db, req, actor, 'profile:delete', 'users', userId);
  return { ok: true };
}

async function assertPublicProfileAvailable(db, collectionName, id, label) {
  const snap = await db.collection(collectionName).doc(id).get();
  if (!snap.exists || snap.data()?.archived === true) {
    throw Object.assign(new Error(`${label} недоступен.`), { statusCode: 404 });
  }
  return { id: snap.id, ...(snap.data() || {}) };
}

function safeStringList(value) {
  return Array.isArray(value) ? value.map(item => safeString(item, 220)).filter(Boolean) : [];
}

function safeAiProfileList(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[\n,;]+/);
  return Array.from(new Set(source.map(item => safeString(item, 220)).filter(Boolean))).slice(0, 12);
}

function sanitizeAiProfile(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    summary: safeString(source.summary, 1200),
    specialization: safeString(source.specialization, 500),
    strengths: safeAiProfileList(source.strengths),
    categories: safeAiProfileList(source.categories),
    typicalClients: safeAiProfileList(source.typicalClients),
    recommendedFor: safeAiProfileList(source.recommendedFor),
    typicalRequests: safeAiProfileList(source.typicalRequests),
    relatedCategories: safeAiProfileList(source.relatedCategories),
    relatedPartnerIds: safeAiProfileList(source.relatedPartnerIds),
    relatedExpertIds: safeAiProfileList(source.relatedExpertIds),
    status: ['draft', 'submitted', 'approved', 'generated'].includes(safeString(source.status, 40)) ? safeString(source.status, 40) : 'draft',
    source: safeString(source.source || 'cabinet', 80),
    needsReview: source.needsReview !== false,
    missingFields: safeAiProfileList(source.missingFields),
  };
}

function actorOwnsProfile(data, actor, type = '') {
  return actorOwnsEditableProfile(data, actor, type);
}

async function assertOwnedProfile(db, actor, type = 'partner', id = '') {
  const collection = type === 'expert' ? 'experts' : 'partners';
  const profileId = safeString(id, 180);
  if (!profileId) throw Object.assign(new Error('Не указан рабочий профиль.'), { statusCode: 400, code: 'PROFILE_BAD_ID' });
  const snap = await db.collection(collection).doc(profileId).get();
  if (!snap.exists) throw Object.assign(new Error('Профиль не найден.'), { statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  const profile = { id: snap.id, ...(snap.data() || {}) };
  if (!actorOwnsProfile(profile, actor, type) && !hasRole(actor.user || {}, ROLES.admin) && !hasRole(actor.user || {}, ROLES.owner)) {
    throw Object.assign(new Error('Нет доступа к этому профилю.'), { statusCode: 403, code: 'PROFILE_FORBIDDEN' });
  }
  return profile;
}

async function actionFavoritesToggle(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const partnerId = safeString(req.body?.partnerId, 160);
  if (!partnerId) throw Object.assign(new Error('Не указан партнёр.'), { statusCode: 400 });
  const partner = await assertPublicProfileAvailable(db, 'partners', partnerId, 'Партнёр');
  const userRef = db.collection('users').doc(userId);
  const partnerRef = db.collection('partners').doc(partnerId);
  let favorites = [];
  let isAdding = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const before = Array.isArray(snap.data()?.favorites) ? snap.data().favorites.map(String) : [];
    isAdding = !before.includes(partnerId);
    favorites = isAdding ? [...before, partnerId] : before.filter(id => id !== partnerId);
    tx.set(userRef, { favorites, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(partnerRef, { favoritesCount: FieldValue.increment(isAdding ? 1 : -1) }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: isAdding ? 'favorite_add' : 'favorite_remove',
      icon: isAdding ? '⭐' : '✕',
      text: isAdding ? `Добавлено в избранное: ${partnerId}` : `Убрано из избранного: ${partnerId}`,
      partnerId,
      ts: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, isAdding ? 'favorites:add' : 'favorites:remove', 'partners', partnerId, 'success', { partnerName: partner.name || '' });
  return { ok: true, favorites, isAdding };
}

async function actionUserListSet(db, req, actor, field, action) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const values = Array.isArray(req.body?.values) ? req.body.values.map(String).slice(0, 500) : [];
  await db.collection('users').doc(userId).set({ [field]: values, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(db, req, actor, action, 'users', userId, 'success', { count: values.length });
  return { ok: true, [field]: values };
}

async function actionNewsReaction(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const newsId = safeString(req.body?.newsId, 180);
  const reaction = safeString(req.body?.reaction, 40);
  const previousReaction = safeString(req.body?.previousReaction, 40);
  if (!newsId || !reaction) throw Object.assign(new Error('Не указана реакция.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  const newsRef = db.collection('news').doc(newsId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const reactions = snap.data()?.newsReactions && typeof snap.data().newsReactions === 'object' ? snap.data().newsReactions : {};
    const actualPrevious = reactions[newsId] || previousReaction || '';
    tx.set(userRef, { newsReactions: { ...reactions, [newsId]: reaction }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const patch = { [`reactions.${reaction}`]: FieldValue.increment(1) };
    if (actualPrevious && actualPrevious !== reaction) patch[`reactions.${actualPrevious}`] = FieldValue.increment(-1);
    tx.set(newsRef, patch, { merge: true });
  });
  await audit(db, req, actor, 'news:reaction', 'news', newsId, 'success', { reaction });
  return { ok: true };
}

async function actionNewsSubscriptions(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const subscriptions = req.body?.subscriptions && typeof req.body.subscriptions === 'object' ? req.body.subscriptions : {};
  const clean = {
    categories: Array.isArray(subscriptions.categories) ? subscriptions.categories.map(String).slice(0, 100) : [],
    partners: Array.isArray(subscriptions.partners) ? subscriptions.partners.map(String).slice(0, 300) : [],
    experts: Array.isArray(subscriptions.experts) ? subscriptions.experts.map(String).slice(0, 300) : [],
  };
  await db.collection('users').doc(userId).set({ newsSubscriptions: clean, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(db, req, actor, 'news:subscriptions', 'users', userId);
  return { ok: true, newsSubscriptions: clean };
}

async function actionPublicQrView(db, req, actor) {
  const type = safeString(req.body?.type, 40);
  const id = safeString(req.body?.id, 180);
  const collection = type === 'expert' ? 'experts' : 'partners';
  if (!id || !['partner', 'expert'].includes(type)) throw Object.assign(new Error('Некорректный QR.'), { statusCode: 400 });
  const metric = req.body?.metric === 'view' ? 'viewCount' : 'publicQRScans';
  await db.collection(collection).doc(id).set({ [metric]: FieldValue.increment(1) }, { merge: true });
  await audit(db, req, actor, metric === 'viewCount' ? 'profile:view' : 'publicQr:view', collection, id);
  return { ok: true };
}

async function actionTaskClaim(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const taskId = safeString(req.body?.taskId, 120);
  const reward = Math.max(0, Math.min(1000, Number(req.body?.reward || 0)));
  if (!taskId || !reward) throw Object.assign(new Error('Некорректное задание.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  let completedTasks = [];
  let awarded = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const before = Array.isArray(snap.data()?.completedTasks) ? snap.data().completedTasks.map(String) : [];
    if (before.includes(taskId)) {
      completedTasks = before;
      return;
    }
    completedTasks = [...before, taskId];
    awarded = true;
    const economyReward = getEconomyReward('task_complete', reward);
    tx.set(userRef, { completedTasks, keys: FieldValue.increment(economyReward.keys), reputation: FieldValue.increment(economyReward.reputation), economyVersion: ECONOMY_VERSION, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'task',
      icon: '✅',
      text: `Задание выполнено: +${economyReward.keys} ключей`,
      keys: economyReward.keys,
      reputation: economyReward.reputation,
      taskId,
      economyVersion: ECONOMY_VERSION,
      ts: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, 'task:claim', 'tasks', taskId, awarded ? 'success' : 'noop', { reward });
  return { ok: true, awarded, completedTasks, reward: awarded ? reward : 0 };
}

async function actionPrizeClaim(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const prize = req.body?.prize || {};
  const prizeId = safeString(prize.id, 160);
  const cost = Math.max(0, Number(prize.cost || 0));
  if (!prizeId || !cost) throw Object.assign(new Error('Некорректный приз.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  const prizeRef = db.collection('prizes').doc(prizeId);
  const claimRef = db.collection('prizeClaims').doc();
  await db.runTransaction(async tx => {
    const [userSnap, prizeSnap] = await Promise.all([tx.get(userRef), tx.get(prizeRef)]);
    const keys = Number(userSnap.data()?.keys || 0);
    if (keys < cost) throw Object.assign(new Error('Недостаточно ключей.'), { statusCode: 400 });
    const stock = prizeSnap.data()?.stock;
    if (stock !== null && stock !== undefined && Number(stock) <= 0) throw Object.assign(new Error('Приз уже разобрали.'), { statusCode: 409 });
    tx.set(userRef, { keys: FieldValue.increment(-cost), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef.collection('claims').doc(), {
      prizeId,
      prizeName: safeString(prize.name, 200),
      prizeEmoji: safeString(prize.emoji || '🎁', 20),
      cost,
      claimedAt: FieldValue.serverTimestamp(),
    });
    if (stock !== null && stock !== undefined) tx.set(prizeRef, { stock: FieldValue.increment(-1) }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'prize',
      icon: safeString(prize.emoji || '🎁', 20),
      text: `Приз получен: ${safeString(prize.name, 200)} (−${cost} ключей)`,
      ts: FieldValue.serverTimestamp(),
    });
    tx.set(claimRef, {
      userId,
      userName: safeString(req.body?.userName || 'Участник АПГ', 200),
      prizeId,
      prizeName: safeString(prize.name, 200),
      prizeEmoji: safeString(prize.emoji || '🎁', 20),
      cost,
      status: 'pending',
      claimedAt: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, 'prize:claim', 'prizes', prizeId, 'success', { cost });
  return { ok: true, claimId: claimRef.id };
}

async function actionRaffleEnter(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const prize = req.body?.prize || {};
  const prizeId = safeString(prize.id, 160);
  const ticketCount = Math.max(1, Math.min(100, Number(req.body?.ticketCount || 1)));
  if (!prizeId || !ticketCount) throw Object.assign(new Error('Некорректный розыгрыш.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  const entryRef = db.collection('raffleEntries').doc(`${prizeId}_${userId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (Number(snap.data()?.tickets || 0) < ticketCount) throw Object.assign(new Error('Недостаточно билетов.'), { statusCode: 400 });
    tx.set(userRef, { tickets: FieldValue.increment(-ticketCount), economyVersion: ECONOMY_VERSION, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(entryRef, {
      prizeId,
      userId,
      userName: safeString(req.body?.userName || 'Участник АПГ', 200),
      userPhoto: safeString(req.body?.userPhoto, 1000) || null,
      ticketsCount: FieldValue.increment(ticketCount),
      economyVersion: ECONOMY_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'raffle_enter',
      icon: safeString(prize.emoji || '🎟️', 20),
      text: `Участие в розыгрыше: ${safeString(prize.name, 200)} (−${ticketCount} билетов)`,
      tickets: -ticketCount,
      economyVersion: ECONOMY_VERSION,
      ts: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, 'raffle:enter', 'prizes', prizeId, 'success', { ticketCount });
  return { ok: true };
}

async function actionEconomyExchangeTickets(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const exchange = calculateTicketExchange(req.body?.ticketCount || req.body?.tickets || 1);
  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const keys = Number(snap.data()?.keys || 0);
    if (keys < exchange.keyCost) throw Object.assign(new Error('Недостаточно ключей для обмена.'), { statusCode: 400 });
    tx.set(userRef, {
      keys: FieldValue.increment(-exchange.keyCost),
      tickets: FieldValue.increment(exchange.tickets),
      economyVersion: ECONOMY_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'ticket_exchange',
      icon: '🎟️',
      text: `Обмен: ${exchange.keyCost} ключей → ${exchange.tickets} билетов`,
      keys: -exchange.keyCost,
      tickets: exchange.tickets,
      economyVersion: ECONOMY_VERSION,
      ts: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, 'economy:exchangeTickets', 'users', userId, 'success', exchange);
  return { ok: true, ...exchange };
}

async function actionEventToggle(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const event = req.body?.event || {};
  const eventId = safeString(event.id, 160);
  const register = Boolean(req.body?.register);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  const eventRef = db.collection('events').doc(eventId);
  const regRef = eventRef.collection('registrations').doc(userId);
  let registeredEvents = [];
  await db.runTransaction(async tx => {
    const [userSnap, eventSnap] = await Promise.all([tx.get(userRef), tx.get(eventRef)]);
    const before = Array.isArray(userSnap.data()?.registeredEvents) ? userSnap.data().registeredEvents.map(String) : [];
    const eventData = eventSnap.data() || event;
    if (register) {
      if (eventData.isPrivate && Number(userSnap.data()?.keys || 0) < Number(eventData.minKeys || 0)) throw Object.assign(new Error('Недостаточно ключей для мероприятия.'), { statusCode: 400 });
      if (Number(eventData.maxParticipants || 0) > 0 && Number(eventData.registeredCount || 0) >= Number(eventData.maxParticipants || 0)) throw Object.assign(new Error('Все места уже заняты.'), { statusCode: 409 });
      registeredEvents = before.includes(eventId) ? before : [...before, eventId];
      tx.set(regRef, {
        userId,
        userName: safeString(req.body?.userName || 'Участник АПГ', 200),
        userPhoto: safeString(req.body?.userPhoto, 1000) || null,
        registeredAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (!before.includes(eventId)) tx.set(eventRef, { registeredCount: FieldValue.increment(1) }, { merge: true });
    } else {
      registeredEvents = before.filter(id => id !== eventId);
      tx.delete(regRef);
      if (before.includes(eventId)) tx.set(eventRef, { registeredCount: FieldValue.increment(-1) }, { merge: true });
    }
    tx.set(userRef, { registeredEvents, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await audit(db, req, actor, register ? 'event:register' : 'event:unregister', 'events', eventId);
  return { ok: true, registeredEvents };
}

function workspaceEventProfileType(req) {
  return safeString(req.body?.profileType || req.body?.type, 40) === 'expert' ? 'expert' : 'partner';
}

function workspaceEventNormalizePatch(input = {}) {
  const patch = sanitizeWorkspaceEventPatch(input);
  if (Object.hasOwn(patch, 'socialUrl')) patch.socialUrl = normalizeProfileUrl(patch.socialUrl, '');
  if (Object.hasOwn(patch, 'linkUrl')) patch.linkUrl = normalizeProfileUrl(patch.linkUrl, '');
  if (Object.hasOwn(patch, 'startAt') && patch.startAt) {
    const start = new Date(patch.startAt);
    if (Number.isNaN(start.getTime())) throw Object.assign(new Error('Некорректное время начала мероприятия.'), { statusCode: 400, code: 'EVENT_BAD_START' });
    patch.startAt = start.toISOString();
  }
  if (Object.hasOwn(patch, 'endAt') && patch.endAt) {
    const end = new Date(patch.endAt);
    if (Number.isNaN(end.getTime())) throw Object.assign(new Error('Некорректное время окончания мероприятия.'), { statusCode: 400, code: 'EVENT_BAD_END' });
    patch.endAt = end.toISOString();
  }
  if (patch.startAt && patch.endAt && new Date(patch.endAt).getTime() <= new Date(patch.startAt).getTime()) {
    throw Object.assign(new Error('Конец мероприятия должен быть позже начала.'), { statusCode: 400, code: 'EVENT_BAD_INTERVAL' });
  }
  return patch;
}

async function assertWorkspaceEventAccess(db, actor, eventId, profileType, profileId) {
  const profile = await assertOwnedProfile(db, actor, profileType, profileId);
  const ref = db.collection('events').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Мероприятие не найдено.'), { statusCode: 404, code: 'EVENT_NOT_FOUND' });
  const event = { id: snap.id, ...(snap.data() || {}) };
  if (!workspaceEventBelongsToProfile(event, profile, profileType)) {
    throw Object.assign(new Error('Нет доступа к этому мероприятию.'), { statusCode: 403, code: 'EVENT_FORBIDDEN' });
  }
  return { profile, ref, event };
}

async function workspaceEventConflictsForProfile(db, profile, profileType, event, ignoreId = '') {
  const profileField = profileType === 'expert' ? 'expertId' : 'partnerId';
  const snap = await db.collection('events').where(profileField, '==', profile.id).limit(120).get();
  const events = filterWorkspaceEvents(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })), profile, profileType, { includeDeleted: true });
  return findWorkspaceEventConflicts(events, event, ignoreId).map(item => ({ id: item.id, title: safeString(item.title || 'Мероприятие', 200), startAt: item.startAt || item.eventDate || item.date || '', endAt: item.endAt || '' })).slice(0, 10);
}

async function actionWorkspaceEventCreate(db, req, actor) {
  const profileType = workspaceEventProfileType(req);
  const profileId = safeString(req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, profileType, profileId);
  const idempotencyKey = safeString(req.body?.idempotencyKey, 220).replace(/[^a-z0-9:_-]/gi, '_');
  const ref = idempotencyKey
    ? db.collection('events').doc(`workspace_${safeString(actor.userId, 80).replace(/[^a-z0-9:_-]/gi, '_')}_${idempotencyKey}`.slice(0, 900))
    : db.collection('events').doc();
  const existing = await ref.get();
  if (existing.exists) return { ok: true, event: { id: ref.id, ...(existing.data() || {}) }, deduped: true };
  const patch = workspaceEventNormalizePatch(req.body?.patch || {});
  const event = {
    ...buildWorkspaceEventBase({ profile, type: profileType, actor }),
    ...patch,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    draftSavedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(event, { merge: true });
  await audit(db, req, actor, 'workspace:eventCreate', 'events', ref.id, 'success', { profileType, profileId: profile.id });
  const now = new Date().toISOString();
  return { ok: true, event: { ...event, id: ref.id, createdAt: now, updatedAt: now, draftSavedAt: now } };
}

async function actionWorkspaceEventUpdate(db, req, actor) {
  const eventId = safeString(req.body?.eventId || req.body?.id, 220);
  const profileType = workspaceEventProfileType(req);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400, code: 'EVENT_BAD_ID' });
  const { profile, ref, event } = await assertWorkspaceEventAccess(db, actor, eventId, profileType, req.body?.profileId);
  const patch = workspaceEventNormalizePatch(req.body?.patch || {});
  const status = workspaceEventStatus(event);
  const publicEvent = ['published', 'approved'].includes(status) || event.active === true;
  const next = publicEvent
    ? { pendingWorkspacePatch: patch, moderationStatus: 'pending_review', submissionStatus: 'pending_review', workspacePendingAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
    : { ...patch, updatedAt: FieldValue.serverTimestamp(), draftSavedAt: FieldValue.serverTimestamp() };
  const conflicts = await workspaceEventConflictsForProfile(db, profile, profileType, { ...event, ...patch }, eventId);
  await ref.set(next, { merge: true });
  await audit(db, req, actor, 'workspace:eventUpdate', 'events', eventId, 'success', { profileType, fields: Object.keys(patch), conflicts: conflicts.length, publicEvent });
  const now = new Date().toISOString();
  return { ok: true, event: { ...event, ...patch, id: eventId, updatedAt: now, draftSavedAt: publicEvent ? event.draftSavedAt || null : now, pendingWorkspacePatch: publicEvent ? patch : event.pendingWorkspacePatch || null, moderationStatus: publicEvent ? 'pending_review' : event.moderationStatus || 'draft', submissionStatus: publicEvent ? 'pending_review' : event.submissionStatus || 'draft' }, conflicts, pendingModeration: publicEvent };
}

async function actionWorkspaceEventSubmit(db, req, actor) {
  const eventId = safeString(req.body?.eventId || req.body?.id, 220);
  const profileType = workspaceEventProfileType(req);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400, code: 'EVENT_BAD_ID' });
  const { profile, ref, event } = await assertWorkspaceEventAccess(db, actor, eventId, profileType, req.body?.profileId);
  const candidate = { ...event, ...(event.pendingWorkspacePatch || {}) };
  if (!safeString(candidate.title, 220)) throw Object.assign(new Error('Укажите название мероприятия перед модерацией.'), { statusCode: 400, code: 'EVENT_TITLE_REQUIRED' });
  const conflicts = await workspaceEventConflictsForProfile(db, profile, profileType, candidate, eventId);
  const patch = {
    status: 'pending_review',
    lifecycleStatus: 'moderation',
    contentStatus: 'moderation',
    moderationStatus: 'pending_review',
    submissionStatus: 'pending_review',
    active: false,
    published: false,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, 'workspace:eventSubmit', 'events', eventId, 'success', { profileType, conflicts: conflicts.length });
  return { ok: true, event: { ...event, id: eventId, status: 'pending_review', lifecycleStatus: 'moderation', contentStatus: 'moderation', moderationStatus: 'pending_review', submissionStatus: 'pending_review', active: false, published: false, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, conflicts };
}

async function actionWorkspaceEventLifecycle(db, req, actor, kind) {
  const eventId = safeString(req.body?.eventId || req.body?.id, 220);
  const profileType = workspaceEventProfileType(req);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400, code: 'EVENT_BAD_ID' });
  const { ref, event } = await assertWorkspaceEventAccess(db, actor, eventId, profileType, req.body?.profileId);
  const nowPatch = { updatedAt: FieldValue.serverTimestamp() };
  const patch = kind === 'archive'
    ? { ...nowPatch, status: 'archived', lifecycleStatus: 'archived', contentStatus: 'archived', archived: true, active: false, archivedAt: FieldValue.serverTimestamp(), archivedBy: actor.userId }
    : { ...nowPatch, status: 'deleted', lifecycleStatus: 'deleted', contentStatus: 'deleted', deleted: true, archived: true, active: false, deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.userId };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, `workspace:event${kind === 'archive' ? 'Archive' : 'Delete'}`, 'events', eventId, 'success', { profileType });
  const now = new Date().toISOString();
  const deleted = kind !== 'archive';
  return { ok: true, event: { ...event, id: eventId, status: deleted ? 'deleted' : 'archived', lifecycleStatus: deleted ? 'deleted' : 'archived', contentStatus: deleted ? 'deleted' : 'archived', archived: true, deleted, active: false, updatedAt: now } };
}

async function actionWorkspaceEventDuplicate(db, req, actor) {
  const eventId = safeString(req.body?.eventId || req.body?.id, 220);
  const profileType = workspaceEventProfileType(req);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400, code: 'EVENT_BAD_ID' });
  const { profile, event } = await assertWorkspaceEventAccess(db, actor, eventId, profileType, req.body?.profileId);
  const duplicate = {
    ...buildWorkspaceEventDuplicate(event, profile, profileType, actor),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    draftSavedAt: FieldValue.serverTimestamp(),
    duplicatedFromEventId: eventId,
  };
  const ref = await db.collection('events').add(duplicate);
  await audit(db, req, actor, 'workspace:eventDuplicate', 'events', ref.id, 'success', { profileType, sourceEventId: eventId });
  const now = new Date().toISOString();
  return { ok: true, event: { ...duplicate, id: ref.id, createdAt: now, updatedAt: now, draftSavedAt: now } };
}

async function actionEventPropose(db, req, actor) {
  const authorType = workspaceEventProfileType({ body: { profileType: req.body?.authorType || req.body?.type } });
  const profileId = safeString(req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, authorType, profileId);
  const patch = workspaceEventNormalizePatch(req.body?.event || req.body?.patch || {});
  if (!safeString(patch.title, 220)) throw Object.assign(new Error('Укажите название мероприятия.'), { statusCode: 400, code: 'EVENT_TITLE_REQUIRED' });
  const event = {
    ...buildWorkspaceEventBase({ profile, type: authorType, actor }),
    ...patch,
    status: 'pending_review',
    lifecycleStatus: 'moderation',
    contentStatus: 'moderation',
    moderationStatus: 'pending_review',
    submissionStatus: 'pending_review',
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('events').add(event);
  await audit(db, req, actor, 'event:propose', 'events', ref.id, 'success', { authorType, profileId: profile.id });
  const now = new Date().toISOString();
  return { ok: true, id: ref.id, event: { ...event, id: ref.id, submittedAt: now, createdAt: now, updatedAt: now } };
}

function inferPartnerAiDraft(message = {}, profile = {}) {
  const text = safeString(message.text, MAX_TEXT);
  const rawTypes = Array.isArray(message.types) ? message.types.map(item => safeString(item, 60)).filter(Boolean) : [];
  const title = safeString(message.title, 180) || safeString(text.split(/[.!?\n]/)[0], 120) || 'Черновик партнёра';
  const description = safeString(message.description || text, MAX_TEXT);
  return {
    text,
    types: [...new Set(rawTypes)].filter(type => ['event', 'news', 'promotion', 'push', 'poster', 'task', 'keys'].includes(type)).slice(0, 7),
    title,
    description,
    date: safeString(message.date, 40),
    time: safeString(message.time, 40),
    place: safeString(message.place || profile.address, 300),
    linkUrl: normalizeProfileUrl(message.linkUrl || profile.websiteUrl || profile.socialUrl, ''),
    rewardKeys: Math.max(0, Math.min(1000, Number(message.rewardKeys || 0))),
  };
}

async function actionPartnerAiDraft(db, req, actor) {
  const partnerId = safeString(req.body?.partnerId || req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, 'partner', partnerId);
  const draft = inferPartnerAiDraft(req.body?.draft || req.body?.message || {}, profile);
  if (!draft.text) throw Object.assign(new Error('Опишите идею для AI-помощника.'), { statusCode: 400 });
  if (!draft.types.length) throw Object.assign(new Error('Не выбрано ни одного действия.'), { statusCode: 400 });

  const base = {
    partnerId: profile.id,
    partner: safeString(profile.name, 220),
    partnerName: safeString(profile.name, 220),
    source: 'partner_ai',
    proposalSource: 'partner_ai',
    proposalAuthorType: 'partner',
    proposalAuthorId: actor.userId,
    proposalAuthorUid: actor.uid,
    proposalAuthorName: safeString(actor.user?.displayName || actor.user?.name || actor.user?.email || profile.name || 'Партнёр', 220),
    submittedByUserId: actor.userId,
    submittedByName: safeString(actor.user?.displayName || actor.user?.name || actor.user?.email || profile.name || 'Партнёр', 220),
    submittedProfileId: profile.id,
    submittedProfileName: safeString(profile.name, 220),
    moderationStatus: 'pending_review',
    status: 'pending_review',
    active: false,
    published: false,
    aiInput: draft.text,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    submittedAt: FieldValue.serverTimestamp(),
  };

  const created = [];
  for (const type of draft.types) {
    if (type === 'event') {
      const ref = await db.collection('events').add({
        ...base,
        title: draft.title,
        description: draft.description,
        date: draft.date,
        time: draft.time,
        address: draft.place,
        location: draft.place,
        linkUrl: draft.linkUrl,
        socialUrl: draft.linkUrl,
        emoji: '🎉',
        submissionStatus: 'pending_review',
        registeredCount: 0,
      });
      created.push({ type, id: ref.id, collection: 'events' });
    } else if (type === 'news' || type === 'promotion') {
      const ref = await db.collection('news').add({
        ...base,
        title: type === 'promotion' ? `Акция: ${draft.title}` : draft.title,
        text: draft.description,
        description: draft.description,
        category: type === 'promotion' ? 'promotions' : 'partners',
        contentType: type,
        source: 'partner_ai',
      });
      created.push({ type, id: ref.id, collection: 'news' });
    } else if (type === 'push') {
      const ref = await db.collection('notifications').add({
        ...base,
        title: draft.title,
        body: draft.description,
        text: draft.description,
        type: 'partner_push',
        target: 'moderation',
      });
      created.push({ type, id: ref.id, collection: 'notifications' });
    } else if (type === 'poster') {
      const ref = await db.collection('aiDrafts').add({
        ...base,
        title: draft.title,
        prompt: draft.description,
        draftType: 'poster',
        status: 'pending_review',
      });
      created.push({ type, id: ref.id, collection: 'aiDrafts' });
    } else if (type === 'task' || type === 'keys') {
      const ref = await db.collection('customTasks').add({
        ...base,
        title: type === 'keys' ? `Ключи: ${draft.title}` : draft.title,
        description: draft.description,
        reward: draft.rewardKeys || (type === 'keys' ? 1 : 0),
        rewardKeys: draft.rewardKeys || (type === 'keys' ? 1 : 0),
        taskType: type === 'keys' ? 'partner_keys' : 'partner_task',
      });
      created.push({ type, id: ref.id, collection: 'customTasks' });
    }
  }

  await audit(db, req, actor, 'partner:aiDraft', 'partners', profile.id, 'success', { types: draft.types, created: created.length });
  return { ok: true, created, status: 'pending_review' };
}

async function actionReviewPartner(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const partnerId = safeString(req.body?.partnerId, 160);
  const stars = Math.max(1, Math.min(5, Number(req.body?.stars || 0)));
  const text = safeString(req.body?.text, MAX_TEXT);
  const locationId = safeString(req.body?.locationId, 120);
  const locationTitle = safeString(req.body?.locationTitle, 180);
  if (!partnerId || !stars) throw Object.assign(new Error('Некорректный отзыв.'), { statusCode: 400 });
  await assertPublicProfileAvailable(db, 'partners', partnerId, 'Партнёр');
  const reviewData = {
    userId,
    userName: safeString(req.body?.userName || 'Участник АПГ', 200),
    userPhoto: safeString(req.body?.userPhoto, 1000) || null,
    stars,
    text,
    locationId,
    locationTitle,
    createdAt: FieldValue.serverTimestamp(),
  };
  const partnerRef = db.collection('partners').doc(partnerId);
  const partnerReviewRef = partnerRef.collection('reviews').doc(userId);
  const publicReviewRef = db.collection('reviews').doc(`${partnerId}_${userId}`);
  const existingReview = await partnerReviewRef.get();
  await Promise.all([
    partnerReviewRef.set(reviewData, { merge: true }),
    publicReviewRef.set({ ...reviewData, partnerId, partnerName: safeString(req.body?.partnerName, 200) }, { merge: true }),
  ]);
  if (!existingReview.exists) {
    const reward = getEconomyReward('review');
    const userRef = db.collection('users').doc(userId);
    await Promise.all([
      userRef.set({
        keys: FieldValue.increment(reward.keys),
        reputation: FieldValue.increment(reward.reputation),
        economyVersion: ECONOMY_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      userRef.collection('activity').add({
        type: 'review',
        icon: '⭐',
        text: `Отзыв о партнёре: +${reward.keys} ключа`,
        keys: reward.keys,
        reputation: reward.reputation,
        partnerId,
        economyVersion: ECONOMY_VERSION,
        ts: FieldValue.serverTimestamp(),
      }),
    ]);
  }
  const snap = await partnerRef.collection('reviews').get();
  const list = snap.docs.map(d => d.data() || {});
  const avgRating = list.length ? Math.round(list.reduce((sum, r) => sum + Number(r.stars || 0), 0) / list.length * 10) / 10 : 0;
  await partnerRef.set({ avgRating, reviewCount: list.length }, { merge: true });
  await markBookingReviewPublished(db, {
    bookingId: req.body?.bookingId,
    userId,
    providerType: 'partner',
    providerId: partnerId,
  });
  await audit(db, req, actor, 'review:partner', 'partners', partnerId, 'success', { stars });
  return { ok: true, avgRating, reviewCount: list.length, review: { ...reviewData, id: userId, createdAt: new Date().toISOString() } };
}

async function actionReviewExpert(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const expertId = safeString(req.body?.expertId, 160);
  const rating = Math.max(1, Math.min(5, Number(req.body?.rating || 0)));
  if (!expertId || !rating) throw Object.assign(new Error('Некорректный отзыв.'), { statusCode: 400 });
  await assertPublicProfileAvailable(db, 'experts', expertId, 'Эксперт');
  const reviewId = `${expertId}_${userId}`.replace(/[/#?[\\\]]/g, '_');
  const reviewData = {
    expertId,
    userId,
    userName: safeString(req.body?.userName || 'Участник АПГ', 200),
    userPhoto: safeString(req.body?.userPhoto, 1000) || null,
    rating,
    text: safeString(req.body?.text, MAX_TEXT),
    createdAt: FieldValue.serverTimestamp(),
  };
  const reviewRef = db.collection('expertReviews').doc(reviewId);
  const existingReview = await reviewRef.get();
  await reviewRef.set(reviewData, { merge: true });
  if (!existingReview.exists) {
    const reward = getEconomyReward('review');
    const userRef = db.collection('users').doc(userId);
    await Promise.all([
      userRef.set({
        keys: FieldValue.increment(reward.keys),
        reputation: FieldValue.increment(reward.reputation),
        economyVersion: ECONOMY_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      userRef.collection('activity').add({
        type: 'review',
        icon: '⭐',
        text: `Отзыв об эксперте: +${reward.keys} ключа`,
        keys: reward.keys,
        reputation: reward.reputation,
        expertId,
        economyVersion: ECONOMY_VERSION,
        ts: FieldValue.serverTimestamp(),
      }),
    ]);
  }
  const snap = await db.collection('expertReviews').where('expertId', '==', expertId).get();
  const list = snap.docs.map(d => d.data() || {});
  const avgRating = list.length ? Math.round(list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length * 10) / 10 : 0;
  await db.collection('experts').doc(expertId).set({ avgRating, reviewCount: list.length }, { merge: true });
  await markBookingReviewPublished(db, {
    bookingId: req.body?.bookingId,
    userId,
    providerType: 'expert',
    providerId: expertId,
  });
  await audit(db, req, actor, 'review:expert', 'experts', expertId, 'success', { rating });
  return { ok: true, avgRating, reviewCount: list.length, review: { ...reviewData, id: reviewId, createdAt: new Date().toISOString() } };
}

async function actionOwnerProfileUpdate(db, req, actor, type) {
  const id = safeString(req.body?.id, 160);
  const collection = type === 'expert' ? 'experts' : 'partners';
  if (!id) throw Object.assign(new Error('Не указан профиль.'), { statusCode: 400 });
  const ref = db.collection(collection).doc(id);
  await assertOwnedProfile(db, actor, type, id);
  const allowedFields = type === 'expert'
    ? new Set(['name', 'lastName', 'firstName', 'middleName', 'category', 'categoryLabel', 'primaryCategory', 'secondaryCategories', 'specialization', 'shortDescription', 'description', 'slogan', 'workFormats', 'formats', 'offer', 'tariff', 'contactName', 'phone', 'whatsappUrl', 'email', 'inn', 'city', 'district', 'address', 'hours', 'workingHours', 'websiteUrl', 'bookingUrl', 'bookingEnabled', 'onlineBookingEnabled', 'bookingMode', 'bookingServices', 'bookingSpecialists', 'bookingSchedule', 'bookingSlotTimes', 'bookingSettings', 'vkUrl', 'telegramUrl', 'maxUrl', 'instagramUrl', 'youtubeUrl', 'rutubeUrl', 'tiktokUrl', 'dzenUrl', 'yandexMapsUrl', 'twoGisUrl', 'socialLinks', 'comment', 'photo', 'logoUrl', 'coverPhoto', 'gallery', 'videos', 'services', 'serviceDescription', 'serviceCost', 'directions', 'advantages', 'prices', 'paymentMethods', 'parking', 'delivery', 'booking', 'features', 'faq', 'customerNotes', 'education', 'experience', 'certificates', 'consultationPrice', 'workFormat', 'servicesDraftReady', 'aiProfile'])
    : new Set(['name', 'category', 'categoryLabel', 'shortDescription', 'description', 'slogan', 'offer', 'phone', 'whatsappUrl', 'email', 'city', 'district', 'address', 'hours', 'workingHours', 'websiteUrl', 'bookingUrl', 'bookingEnabled', 'onlineBookingEnabled', 'bookingMode', 'bookingServices', 'bookingSpecialists', 'bookingSchedule', 'bookingSlotTimes', 'bookingSettings', 'vkUrl', 'telegramUrl', 'maxUrl', 'instagramUrl', 'youtubeUrl', 'rutubeUrl', 'tiktokUrl', 'dzenUrl', 'yandexMapsUrl', 'twoGisUrl', 'socialLinks', 'socialUrl', 'logoUrl', 'photo', 'coverPhoto', 'gallery', 'photos', 'videos', 'services', 'serviceDescription', 'directions', 'advantages', 'prices', 'paymentMethods', 'parking', 'delivery', 'booking', 'features', 'faq', 'customerNotes', 'aiProfile']);
  const patch = {};
  Object.entries(req.body?.patch || {}).forEach(([key, value]) => {
    if (!allowedFields.has(key)) return;
    patch[key] = normalizeProfilePatchField(key, value);
  });
  patch.profileUpdatedAt = FieldValue.serverTimestamp();
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, `${type}:profileUpdate`, collection, id, 'success', { fields: Object.keys(patch) });
  return { ok: true, patch: req.body?.patch || {} };
}

function workspaceNewsProfilePayload(profile = {}, role = 'partner') {
  return {
    ownerProfileType: role === 'expert' ? 'expert' : 'partner',
    ownerProfileId: safeString(profile.id, 180),
    profileId: safeString(profile.id, 180),
    submittedProfileId: safeString(profile.id, 180),
    sourceName: safeString(profile.name || profile.title || profile.displayName || 'Workspace', 220),
    author: safeString(profile.name || profile.title || profile.displayName || 'АПГ', 220),
    ...(role === 'expert' ? { expertId: safeString(profile.id, 180), authorExpertId: safeString(profile.id, 180) } : { partnerId: safeString(profile.id, 180), authorPartnerId: safeString(profile.id, 180) }),
  };
}

async function actionWorkspaceNewsList(db, req, actor) {
  const role = safeString(req.body?.role, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, role, profileId);
  const adminAccess = hasRole(actor.user || {}, ROLES.admin) || hasRole(actor.user || {}, ROLES.owner);
  const snap = await db.collection('news').orderBy('updatedAt', 'desc').limit(500).get();
  const rows = snap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(item => adminAccess || workspaceNewsBelongsToProfile(item, profile, role));
  await audit(db, req, actor, 'workspaceNews:list', 'news', profileId, 'success', { role, count: rows.length });
  return { ok: true, news: rows, profile: { id: profile.id, name: profile.name || profile.title || '' } };
}

async function assertWorkspaceNewsAccess(db, req, actor) {
  const id = safeString(req.body?.id || req.body?.newsId, 220);
  if (!id) throw Object.assign(new Error('Не указана новость.'), { statusCode: 400, code: 'NEWS_BAD_ID' });
  const ref = db.collection('news').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Новость не найдена.'), { statusCode: 404, code: 'NEWS_NOT_FOUND' });
  const news = { id: snap.id, ...(snap.data() || {}) };
  const role = safeString(req.body?.role || news.ownerProfileType, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId || news.ownerProfileId || news.profileId || news.partnerId || news.expertId, 180);
  const profile = await assertOwnedProfile(db, actor, role, profileId);
  const adminAccess = hasRole(actor.user || {}, ROLES.admin) || hasRole(actor.user || {}, ROLES.owner);
  if (!adminAccess && !workspaceNewsBelongsToProfile(news, profile, role)) {
    throw Object.assign(new Error('Нет доступа к этой новости.'), { statusCode: 403, code: 'NEWS_FORBIDDEN' });
  }
  return { ref, news, role, profile };
}

async function actionWorkspaceNewsSave(db, req, actor) {
  const role = safeString(req.body?.role, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const patch = sanitizeWorkspaceNewsPatch(req.body?.patch || {});
  if (!patch.title && !patch.text && !patch.fullText) {
    throw Object.assign(new Error('Для публикации нужен хотя бы заголовок или текст.'), { statusCode: 400, code: 'NEWS_EMPTY' });
  }
  const id = safeString(req.body?.id || req.body?.newsId, 220);
  if (!id) {
    const profile = await assertOwnedProfile(db, actor, role, profileId);
    const data = {
      ...workspaceNewsProfilePayload(profile, role),
      ...patch,
      ...buildProfileOnlyNewsPatch(),
      status: 'published',
      lifecycleStatus: 'published',
      contentStatus: 'published',
      active: true,
      publishedAt: FieldValue.serverTimestamp(),
      profilePublishedAt: FieldValue.serverTimestamp(),
      commentsEnabled: patch.commentsEnabled !== false,
      source: patch.source || 'workspace',
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('news').add(data);
    await audit(db, req, actor, 'workspaceNews:create', 'news', ref.id, 'success', { role, profileId: profile.id });
    return { ok: true, id: ref.id, news: { ...data, id: ref.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
  }
  const { ref, news, profile } = await assertWorkspaceNewsAccess(db, req, actor);
  const currentStatus = normalizeContentStatus(news);
  const lifecyclePatch = isApgNewsPublication(news) && currentStatus === 'published' && req.body?.submit !== true
    ? buildLifecyclePatch({ item: news, resource: 'news', nextStatus: 'moderation', actorId: actor.userId, reason: 'Редактирование опубликованной новости из Workspace' })
    : {};
  const data = {
    ...patch,
    ...(isApgNewsPublication(news) ? {} : buildProfileOnlyNewsPatch()),
    ...(isApgNewsPublication(news) ? {} : {
      status: 'published',
      lifecycleStatus: 'published',
      contentStatus: 'published',
      active: true,
      profilePublishedAt: news.profilePublishedAt || FieldValue.serverTimestamp(),
    }),
    ...lifecyclePatch,
    updatedByUserId: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(data, { merge: true });
  await audit(db, req, actor, 'workspaceNews:update', 'news', ref.id, 'success', { fields: Object.keys(patch), profileId: profile.id });
  const responsePatch = {
    ...patch,
    ...(isApgNewsPublication(news) ? {} : buildProfileOnlyNewsPatch()),
    lifecycleStatus: lifecyclePatch.lifecycleStatus || (isApgNewsPublication(news) ? news.lifecycleStatus || '' : 'published'),
    contentStatus: lifecyclePatch.contentStatus || (isApgNewsPublication(news) ? news.contentStatus || '' : 'published'),
    status: lifecyclePatch.contentStatus || (isApgNewsPublication(news) ? patch.status || news.status : 'published'),
    active: lifecyclePatch.active ?? (isApgNewsPublication(news) ? patch.active ?? news.active : true),
  };
  return { ok: true, id: ref.id, patch: responsePatch, news: { ...news, ...responsePatch, id: ref.id, updatedAt: new Date().toISOString() } };
}

async function actionWorkspaceNewsSubmit(db, req, actor) {
  const { ref, news, profile } = await assertWorkspaceNewsAccess(db, req, actor);
  const patch = {
    ...buildApgNewsDistributionPatch(),
    ...buildLifecyclePatch({ item: news, resource: 'news', nextStatus: 'moderation', actorId: actor.userId, reason: safeString(req.body?.reason || 'Отправлено на модерацию из Workspace', 500) }),
    submittedAt: FieldValue.serverTimestamp(),
    submittedByUserId: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, 'workspaceNews:submit', 'news', ref.id, 'success', { profileId: profile.id });
  return { ok: true, id: ref.id, patch: { ...buildApgNewsDistributionPatch(), status: 'moderation', lifecycleStatus: 'moderation', contentStatus: 'moderation', active: false }, news: { ...news, ...buildApgNewsDistributionPatch(), id: ref.id, status: 'moderation', lifecycleStatus: 'moderation', contentStatus: 'moderation', active: false, updatedAt: new Date().toISOString() } };
}

async function actionWorkspaceNewsArchive(db, req, actor) {
  const { ref, news, profile } = await assertWorkspaceNewsAccess(db, req, actor);
  const patch = {
    ...buildLifecyclePatch({ item: news, resource: 'news', nextStatus: 'archived', actorId: actor.userId, reason: safeString(req.body?.reason || 'Архив из Workspace', 500) }),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, 'workspaceNews:archive', 'news', ref.id, 'success', { profileId: profile.id });
  return { ok: true, id: ref.id, patch: { status: 'archived', lifecycleStatus: 'archived', contentStatus: 'archived', active: false, archived: true }, news: { ...news, id: ref.id, status: 'archived', lifecycleStatus: 'archived', contentStatus: 'archived', active: false, archived: true, updatedAt: new Date().toISOString() } };
}

async function actionWorkspaceNewsFromEvent(db, req, actor) {
  const role = safeString(req.body?.role, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const eventId = safeString(req.body?.eventId, 220);
  if (!eventId) throw Object.assign(new Error('Не указано мероприятие.'), { statusCode: 400, code: 'EVENT_BAD_ID' });
  const profile = await assertOwnedProfile(db, actor, role, profileId);
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) throw Object.assign(new Error('Мероприятие не найдено.'), { statusCode: 404, code: 'EVENT_NOT_FOUND' });
  const event = { id: eventSnap.id, ...(eventSnap.data() || {}) };
  const draft = {
    ...workspaceNewsProfilePayload(profile, role),
    ...buildWorkspaceNewsFromEvent(event, profile, role),
    ...buildProfileOnlyNewsPatch(),
    status: 'published',
    lifecycleStatus: 'published',
    contentStatus: 'published',
    active: true,
    publishedAt: FieldValue.serverTimestamp(),
    profilePublishedAt: FieldValue.serverTimestamp(),
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('news').add(draft);
  await audit(db, req, actor, 'workspaceNews:fromEvent', 'news', ref.id, 'success', { eventId, profileId: profile.id });
  return { ok: true, id: ref.id, news: { ...draft, id: ref.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
}

function workspacePromotionCollection(role = 'partner') {
  return role === 'expert' ? 'experts' : 'partners';
}

function workspacePromotionProfilePayload(profile = {}, role = 'partner') {
  const type = role === 'expert' ? 'expert' : 'partner';
  return {
    profileId: safeString(profile.id, 180),
    ownerProfileId: safeString(profile.id, 180),
    ownerProfileType: type,
    profileType: type,
    profileName: safeString(profile.name || profile.title || profile.displayName || '', 220),
  };
}

async function actionWorkspacePromotionList(db, req, actor) {
  const requestedRole = safeString(req.body?.role, 40).toLowerCase();
  const adminAccess = hasRole(actor.user || {}, ROLES.admin) || hasRole(actor.user || {}, ROLES.owner);
  const role = requestedRole === 'admin' && adminAccess ? 'admin' : requestedRole === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const profiles = [];
  if (role === 'admin') {
    const [partnersSnap, expertsSnap] = await Promise.all([
      db.collection('partners').limit(500).get(),
      db.collection('experts').limit(500).get(),
    ]);
    profiles.push(...partnersSnap.docs.map(doc => ({ role: 'partner', data: { id: doc.id, ...(doc.data() || {}) } })));
    profiles.push(...expertsSnap.docs.map(doc => ({ role: 'expert', data: { id: doc.id, ...(doc.data() || {}) } })));
  } else {
    const profile = await assertOwnedProfile(db, actor, role, profileId);
    profiles.push({ role, data: profile });
  }
  const promotions = profiles.map(item => buildWorkspacePromotionFromProfile(item.data, item.role));
  await audit(db, req, actor, 'workspacePromotion:list', role === 'admin' ? 'profiles' : workspacePromotionCollection(role), profileId || 'all', 'success', { role, count: promotions.length });
  return { ok: true, promotions, profile: role === 'admin' ? { id: 'all', name: 'Вся система' } : { id: profiles[0]?.data?.id || '', name: profiles[0]?.data?.name || profiles[0]?.data?.title || '' } };
}

async function actionWorkspacePromotionSave(db, req, actor) {
  const role = safeString(req.body?.role, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, role, profileId);
  const patch = sanitizeWorkspacePromotionPatch(req.body?.patch || {});
  if (!patch.title && !patch.offer && !patch.description) {
    throw Object.assign(new Error('Для акции нужен заголовок, описание или предложение.'), { statusCode: 400, code: 'PROMOTION_EMPTY' });
  }
  const current = buildWorkspacePromotionFromProfile(profile, role);
  const collection = workspacePromotionCollection(role);
  const ref = db.collection(collection).doc(profile.id);
  const submit = req.body?.submit === true;
  const publicAlreadyVisible = current.status === 'published' && Boolean(profile.offer || profile.promo || profile.specialOffer || profile.discount);
  const nowIso = new Date().toISOString();
  const clean = {
    ...workspacePromotionProfilePayload(profile, role),
    ...patch,
    offer: buildPromotionOfferText(patch),
    updatedByUserId: actor.userId,
    updatedAt: nowIso,
  };
  const data = publicAlreadyVisible || submit
    ? {
        promotionPendingPatch: clean,
        promotionStatus: 'moderation',
        promotionLifecycleStatus: 'moderation',
        promotionContentStatus: 'moderation',
        ...(submit ? { promotionSubmittedAt: FieldValue.serverTimestamp() } : {}),
        promotionUpdatedAt: FieldValue.serverTimestamp(),
        promotionUpdatedByUserId: actor.userId,
      }
    : {
        promotionDraft: clean,
        promotionStatus: 'draft',
        promotionLifecycleStatus: 'draft',
        promotionContentStatus: 'draft',
        promotionUpdatedAt: FieldValue.serverTimestamp(),
        promotionUpdatedByUserId: actor.userId,
      };
  await ref.set(data, { merge: true });
  const updatedProfile = { ...profile, ...data, promotionUpdatedAt: nowIso };
  await audit(db, req, actor, submit ? 'workspacePromotion:submit' : 'workspacePromotion:save', collection, profile.id, 'success', { role, fields: Object.keys(patch), publicAlreadyVisible });
  return { ok: true, id: current.id, promotion: buildWorkspacePromotionFromProfile(updatedProfile, role), patch: clean };
}

async function actionWorkspacePromotionSubmit(db, req, actor) {
  return actionWorkspacePromotionSave(db, { ...req, body: { ...(req.body || {}), submit: true, patch: req.body?.patch || req.body?.promotion || {} } }, actor);
}

async function actionWorkspacePromotionArchive(db, req, actor) {
  const role = safeString(req.body?.role, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const profile = await assertOwnedProfile(db, actor, role, profileId);
  const collection = workspacePromotionCollection(role);
  const ref = db.collection(collection).doc(profile.id);
  const patch = {
    offer: '',
    promo: '',
    specialOffer: '',
    discount: '',
    promotionStatus: 'archived',
    promotionLifecycleStatus: 'archived',
    promotionContentStatus: 'archived',
    promotionArchivedAt: FieldValue.serverTimestamp(),
    promotionUpdatedAt: FieldValue.serverTimestamp(),
    promotionUpdatedByUserId: actor.userId,
  };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, 'workspacePromotion:archive', collection, profile.id, 'success', { role });
  return { ok: true, id: `${role}:${profile.id}:main`, promotion: buildWorkspacePromotionFromProfile({ ...profile, ...patch, promotionUpdatedAt: new Date().toISOString() }, role) };
}

function workspaceGiftRole(req, actor) {
  const requested = safeString(req.body?.role, 40).toLowerCase();
  const adminAccess = hasRole(actor.user || {}, ROLES.admin) || hasRole(actor.user || {}, ROLES.owner);
  if (requested === 'admin' && adminAccess) return 'admin';
  return requested === 'expert' ? 'expert' : 'partner';
}

async function workspaceGiftSources(db, role, profile = {}) {
  const [claimsSnap, entriesSnap, partnersSnap, expertsSnap] = await Promise.all([
    db.collection('prizeClaims').orderBy('claimedAt', 'desc').limit(500).get().catch(() => ({ docs: [] })),
    db.collection('raffleEntries').limit(500).get().catch(() => ({ docs: [] })),
    db.collection('partners').limit(role === 'admin' ? 500 : 100).get().catch(() => ({ docs: [] })),
    db.collection('experts').limit(role === 'admin' ? 500 : 100).get().catch(() => ({ docs: [] })),
  ]);
  const claims = claimsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const entries = entriesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const partners = partnersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const experts = expertsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  if (role === 'admin') return { claims, entries, partners, experts };
  const profileField = role === 'expert' ? 'expertId' : 'partnerId';
  const allowedPrizeIds = new Set();
  return {
    claims,
    entries,
    partners,
    experts,
    profileField,
    allowedPrizeIds,
    profileId: profile.id,
  };
}

async function actionWorkspaceGiftList(db, req, actor) {
  const role = workspaceGiftRole(req, actor);
  const profileId = safeString(req.body?.profileId, 180);
  const profile = role === 'admin' ? { id: 'all', name: 'Вся система' } : await assertOwnedProfile(db, actor, role, profileId);
  const profileField = role === 'expert' ? 'expertId' : 'partnerId';
  const prizesSnap = role === 'admin'
    ? await db.collection('prizes').limit(500).get()
    : await db.collection('prizes').where(profileField, '==', profile.id).limit(500).get();
  const prizes = prizesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const sources = await workspaceGiftSources(db, role, profile);
  const prizeIds = new Set(prizes.map(item => item.id));
  const claims = role === 'admin' ? sources.claims : sources.claims.filter(item => prizeIds.has(item.prizeId));
  const entries = role === 'admin' ? sources.entries : sources.entries.filter(item => prizeIds.has(item.prizeId));
  const gifts = prizes.map(item => buildWorkspaceGift(item, { ...sources, claims, entries }));
  await audit(db, req, actor, 'workspaceGift:list', 'prizes', profile.id, 'success', { role, count: gifts.length, claims: claims.length, entries: entries.length });
  return { ok: true, gifts, claims, entries, profile: { id: profile.id, name: profile.name || profile.title || 'Workspace' } };
}

async function assertWorkspaceGiftAccess(db, req, actor) {
  const role = workspaceGiftRole(req, actor);
  const adminAccess = role === 'admin';
  const id = safeString(req.body?.id || req.body?.giftId || req.body?.prizeId, 220);
  const profileId = safeString(req.body?.profileId, 180);
  const profile = adminAccess ? { id: 'all', name: 'Вся система' } : await assertOwnedProfile(db, actor, role, profileId);
  if (!id) return { ref: null, gift: null, role, profile, adminAccess };
  const ref = db.collection('prizes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Подарок не найден.'), { statusCode: 404, code: 'GIFT_NOT_FOUND' });
  const gift = { id: snap.id, ...(snap.data() || {}) };
  if (!adminAccess && !workspaceGiftBelongsToProfile(gift, profile, role)) {
    throw Object.assign(new Error('Нет доступа к этому подарку.'), { statusCode: 403, code: 'GIFT_FORBIDDEN' });
  }
  return { ref, gift, role, profile, adminAccess };
}

function workspaceGiftOwnerPayload(profile = {}, role = 'partner') {
  const type = role === 'expert' ? 'expert' : 'partner';
  return {
    ownerProfileType: type,
    ownerProfileId: safeString(profile.id, 180),
    profileId: safeString(profile.id, 180),
    donorName: safeString(profile.name || profile.title || profile.displayName || '', 220),
    ...(type === 'expert' ? { expertId: safeString(profile.id, 180), partnerId: null } : { partnerId: safeString(profile.id, 180), expertId: null }),
  };
}

async function actionWorkspaceGiftSave(db, req, actor) {
  const { ref, gift, role, profile, adminAccess } = await assertWorkspaceGiftAccess(db, req, actor);
  const patch = sanitizeWorkspaceGiftPatch(req.body?.patch || {});
  if (!patch.name && !patch.title) throw Object.assign(new Error('Укажите название подарка.'), { statusCode: 400, code: 'GIFT_EMPTY' });
  const submit = req.body?.submit === true;
  const isPublished = gift && normalizeContentStatus(gift) === 'published' && gift.active !== false;
  const clean = {
    ...patch,
    updatedByUserId: actor.userId,
    updatedAt: new Date().toISOString(),
  };
  if (!adminAccess) Object.assign(clean, workspaceGiftOwnerPayload(profile, role));
  const data = gift && (isPublished || submit)
    ? {
        pendingWorkspacePatch: clean,
        ...buildLifecyclePatch({ item: gift, resource: 'prizes', nextStatus: 'moderation', actorId: actor.userId, reason: submit ? 'Подарок отправлен на модерацию из Workspace' : 'Редактирование опубликованного подарка из Workspace' }),
        updatedByUserId: actor.userId,
        updatedAt: FieldValue.serverTimestamp(),
      }
    : {
        ...clean,
        ...buildLifecyclePatch({ item: gift || {}, resource: 'prizes', nextStatus: submit ? 'moderation' : (patch.status || 'draft'), actorId: actor.userId, reason: submit ? 'Подарок отправлен на модерацию из Workspace' : 'Черновик подарка из Workspace' }),
        active: submit ? false : clean.active === true && patch.status === 'published',
        createdByUserId: gift?.createdByUserId || actor.userId,
        updatedByUserId: actor.userId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(gift ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };
  const writeRef = ref || db.collection('prizes').doc();
  await writeRef.set(data, { merge: true });
  const sources = await workspaceGiftSources(db, role, profile);
  const resultGift = buildWorkspaceGift({ ...(gift || {}), ...clean, ...data, id: writeRef.id, updatedAt: new Date().toISOString() }, sources);
  await audit(db, req, actor, gift ? 'workspaceGift:update' : 'workspaceGift:create', 'prizes', writeRef.id, 'success', { role, fields: Object.keys(patch), safePendingPatch: Boolean(gift && (isPublished || submit)) });
  return { ok: true, id: writeRef.id, gift: resultGift };
}

async function actionWorkspaceGiftSubmit(db, req, actor) {
  return actionWorkspaceGiftSave(db, { ...req, body: { ...(req.body || {}), submit: true } }, actor);
}

async function actionWorkspaceGiftArchive(db, req, actor) {
  const { ref, gift, role, profile } = await assertWorkspaceGiftAccess(db, req, actor);
  if (!ref || !gift) throw Object.assign(new Error('Подарок не найден.'), { statusCode: 404, code: 'GIFT_NOT_FOUND' });
  const patch = {
    ...buildLifecyclePatch({ item: gift, resource: 'prizes', nextStatus: 'archived', actorId: actor.userId, reason: 'Архив из Workspace' }),
    active: false,
    archived: true,
    updatedByUserId: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, 'workspaceGift:archive', 'prizes', ref.id, 'success', { role, profileId: profile.id });
  return { ok: true, id: ref.id, gift: buildWorkspaceGift({ ...gift, ...patch, id: ref.id, updatedAt: new Date().toISOString() }) };
}

async function actionWorkspaceGiftClaimStatus(db, req, actor) {
  const claimId = safeString(req.body?.claimId, 220);
  const status = safeString(req.body?.status || 'given', 40);
  if (!claimId) throw Object.assign(new Error('Не указана выдача.'), { statusCode: 400, code: 'CLAIM_BAD_ID' });
  const claimRef = db.collection('prizeClaims').doc(claimId);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) throw Object.assign(new Error('Выдача не найдена.'), { statusCode: 404, code: 'CLAIM_NOT_FOUND' });
  const claim = { id: claimSnap.id, ...(claimSnap.data() || {}) };
  await assertWorkspaceGiftAccess(db, { ...req, body: { ...(req.body || {}), id: claim.prizeId } }, actor);
  const patch = {
    status,
    issuedAt: status === 'given' || status === 'issued' ? FieldValue.serverTimestamp() : claim.issuedAt || null,
    issuedByUserId: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await claimRef.set(patch, { merge: true });
  await audit(db, req, actor, 'workspaceGift:claimStatus', 'prizeClaims', claimId, 'success', { prizeId: claim.prizeId, status });
  return { ok: true, claim: { ...claim, status, issuedByUserId: actor.userId, issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
}

async function getWorkspaceAnalyticsComments(db, newsIds = []) {
  const ids = Array.from(new Set(newsIds.map(id => safeString(id, 220)).filter(Boolean))).slice(0, 60);
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results = [];
  for (const chunk of chunks) {
    const snap = await db.collection('newsComments').where('newsId', 'in', chunk).limit(300).get().catch(() => null);
    if (snap?.docs?.length) results.push(...snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })));
  }
  return results;
}

async function actionWorkspaceAnalyticsSnapshot(db, req, actor) {
  const requestedRole = safeString(req.body?.role, 40).toLowerCase();
  const adminAccess = hasRole(actor.user || {}, ROLES.admin) || hasRole(actor.user || {}, ROLES.owner);
  const role = requestedRole === 'admin' && adminAccess ? 'admin' : requestedRole === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId, 180);
  const profile = role === 'admin'
    ? { id: 'all', name: 'Вся система' }
    : await assertOwnedProfile(db, actor, role, profileId);
  const range = buildWorkspaceAnalyticsRange({
    period: safeString(req.body?.period || '30d', 40),
    from: safeString(req.body?.from, 80),
    to: safeString(req.body?.to, 80),
  });
  const profileField = role === 'expert' ? 'expertId' : 'partnerId';
  const profileName = safeString(profile.name || profile.title || profile.displayName, 220);

  const [newsSnap, eventsSnap, bookingsSnap, dialogsSnap, notificationsSnap, scansSnap] = await Promise.all([
    db.collection('news').orderBy('updatedAt', 'desc').limit(500).get(),
    role === 'admin' ? db.collection('events').limit(500).get().catch(() => null) : db.collection('events').where(profileField, '==', profile.id).limit(300).get().catch(() => null),
    role === 'admin' ? db.collection('bookings').limit(500).get().catch(() => null) : db.collection('bookings').where('providerId', '==', profile.id).limit(500).get().catch(() => null),
    role === 'admin' ? db.collection('contextDialogs').limit(500).get().catch(() => null) : db.collection('contextDialogs').where('participantIds', 'array-contains', actor.userId).limit(500).get().catch(() => null),
    role === 'admin' ? db.collection('notifications').limit(500).get().catch(() => null) : db.collection('notifications').where('userId', '==', actor.userId).limit(500).get().catch(() => null),
    role === 'admin' ? db.collection('scans').limit(500).get().catch(() => null) : db.collection('scans').where(profileField, '==', profile.id).limit(500).get().catch(() => null),
  ]);

  const news = newsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const events = eventsSnap?.docs?.map(doc => ({ id: doc.id, ...(doc.data() || {}) })) || [];
  const bookings = bookingsSnap?.docs?.map(doc => ({ id: doc.id, ...(doc.data() || {}) })) || [];
  const dialogs = dialogsSnap?.docs?.map(doc => ({ id: doc.id, ...(doc.data() || {}) })) || [];
  const notifications = notificationsSnap?.docs?.map(doc => ({ id: doc.id, ...(doc.data() || {}) })) || [];
  const scans = scansSnap?.docs?.map(doc => ({ id: doc.id, ...(doc.data() || {}) })) || [];
  const comments = await getWorkspaceAnalyticsComments(db, (role === 'admin' ? news : news.filter(item => workspaceNewsBelongsToProfile(item, profile, role))).map(item => item.id));

  const snapshot = buildWorkspaceAnalyticsSnapshot({
    profile: { ...profile, name: profileName || profile.name || profile.title || '' },
    role,
    range,
    sources: { news, events, bookings, dialogs, notifications, scans, comments },
  });
  const csv = workspaceAnalyticsRowsToCsv(snapshot.exportRows);
  await audit(db, req, actor, 'workspaceAnalytics:snapshot', role === 'admin' ? 'stats' : role === 'expert' ? 'experts' : 'partners', profile.id, 'success', { role, period: range.period, sourceCounts: snapshot.sourceCounts });
  return { ok: true, snapshot, csv };
}

async function actionLokiSettings(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : {};
  await db.collection('users').doc(userId).set({
    lokiSettings: settings,
    lokiSettingsUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'loki:settings', 'users', userId);
  return { ok: true };
}

async function actionLokiAnalytics(db, req, actor) {
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  const safe = {
    query: safeString(payload.query, 500),
    intent: safeString(payload.intent, 120),
    resultCount: Math.max(0, Math.min(50, Number(payload.resultCount || 0))),
    actionType: safeString(payload.actionType, 120),
    panel: safeString(payload.panel, 80),
    ms: Math.max(0, Math.min(60000, Number(payload.ms || 0))),
    success: payload.success !== false,
    source: safeString(payload.source || 'loki', 80),
  };
  await db.collection('lokiAnalytics').add({
    ...safe,
    userId: actor.userId,
    firebaseUid: actor.uid,
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

async function actionBookingCreate(db, req, actor) {
  const providerType = safeString(req.body?.providerType, 40) === 'expert' ? 'expert' : 'partner';
  const providerId = safeString(req.body?.providerId, 160);
  if (!providerId) throw Object.assign(new Error('Не указан профиль для записи.'), { statusCode: 400, code: 'BOOKING_BAD_PROVIDER' });
  const providerCollection = providerType === 'expert' ? 'experts' : 'partners';
  const providerRef = db.collection(providerCollection).doc(providerId);
  const providerSnap = await providerRef.get();
  if (!providerSnap.exists) throw Object.assign(new Error('Профиль для записи не найден.'), { statusCode: 404, code: 'BOOKING_PROVIDER_NOT_FOUND' });
  const provider = { id: providerSnap.id, ...(providerSnap.data() || {}) };
  if (!isOnlineBookingEnabled(provider)) throw Object.assign(new Error('Онлайн-запись у этого профиля пока не включена.'), { statusCode: 400, code: 'BOOKING_DISABLED' });

  const requestedLocationId = safeString(req.body?.locationId || req.body?.location?.id, 120);
  const bookingLocation = providerType === 'partner' ? getLocationById(provider, requestedLocationId) : null;
  const bookingProvider = providerType === 'partner' ? locationToProvider(provider, bookingLocation) : provider;
  const bookingLocationPayload = locationBookingPayload(bookingLocation);
  const bookingProfile = buildBookingProfile(bookingProvider, providerType);
  const servicePayload = req.body?.service && typeof req.body.service === 'object' ? req.body.service : {};
  const specialistPayload = req.body?.specialist && typeof req.body.specialist === 'object' ? req.body.specialist : {};
  const slotPayload = req.body?.slot && typeof req.body.slot === 'object' ? req.body.slot : {};
  const serviceId = safeString(servicePayload.id, 80);
  const service = bookingProfile.services.find(item => item.id === serviceId) || bookingProfile.services[0];
  if (!service) throw Object.assign(new Error('Не выбрана услуга.'), { statusCode: 400, code: 'BOOKING_BAD_SERVICE' });
  const specialistId = safeString(specialistPayload.id || 'default', 80);
  const specialist = bookingProfile.specialists.find(item => item.id === specialistId) || bookingProfile.specialists[0];
  const startAt = safeString(slotPayload.startAt, 80);
  const endAt = safeString(slotPayload.endAt, 80);
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate.getTime() <= Date.now() + 10 * 60 * 1000 || endDate <= startDate) {
    throw Object.assign(new Error('Выбранное время записи недоступно.'), { statusCode: 400, code: 'BOOKING_BAD_SLOT' });
  }
  const dateKey = formatBookingDateKey(startDate);
  const slotKey = `${providerType}_${providerId}_${specialist?.id || 'default'}_${startDate.getTime()}`.replace(/[^a-zA-Z0-9а-яА-ЯёЁ:_-]+/g, '_').slice(0, 420);
  const bookingRef = db.collection('bookings').doc(slotKey);
  const dialogId = buildContextDialogId(actor.userId, 'booking', bookingRef.id);
  const ownerUserIds = uniqueSafeIds([provider.ownerUserIds, provider.ownerIds, provider.ownerId, provider.ownerUserId, provider.userId, provider.managerUserId, provider.createdByUserId].flat());
  let booking = null;

  await db.runTransaction(async tx => {
    const existing = await tx.get(bookingRef);
    if (existing.exists && ![BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.noShow].includes(normalizeBookingStatus(existing.data()?.status))) {
      const existingBooking = normalizeBooking({ id: existing.id, ...(existing.data() || {}) });
      if (existingBooking.userId === actor.userId && existingBooking.serviceId === service.id) {
        booking = existingBooking;
        return;
      }
      throw Object.assign(new Error('Это время уже занято. Выберите другое окно.'), { statusCode: 409, code: 'BOOKING_SLOT_TAKEN' });
    }
    const providerBookings = await tx.get(db.collection('bookings').where('providerId', '==', providerId));
    const conflict = providerBookings.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .find(item => bookingBlocksSlot(item, { providerType, providerId, specialistId: specialist?.id || 'default', startAt, endAt }));
    if (conflict) {
      throw Object.assign(new Error('Это время уже занято. Выберите другой свободный интервал.'), { statusCode: 409, code: 'BOOKING_SLOT_TAKEN' });
    }
    booking = {
      id: bookingRef.id,
      bookingId: bookingRef.id,
      dialogId,
      providerType,
      providerId,
      providerName: bookingProfile.title,
      providerPhone: bookingProfile.phone || null,
      address: bookingProfile.address || null,
      locationId: bookingLocationPayload?.id || null,
      locationTitle: bookingLocationPayload?.title || null,
      locationAddress: bookingLocationPayload?.address || null,
      locationPhone: bookingLocationPayload?.phone || null,
      location: bookingLocationPayload,
      serviceId: service.id,
      serviceTitle: service.title,
      serviceDescription: service.description || null,
      durationMinutes: Number(service.durationMinutes || 60),
      price: service.price || null,
      specialistId: specialist?.id || 'default',
      specialistName: specialist?.name || bookingProfile.title,
      userId: actor.userId,
      userName: actorName(actor),
      userPhoto: safeString(actor.user?.photo || actor.user?.photo_200, 1000) || null,
      ownerUserIds,
      status: BOOKING_STATUSES.pending,
      statusLabel: getBookingStatusLabel(BOOKING_STATUSES.pending),
      statusHistory: [buildBookingHistoryEntry({ fromStatus: '', toStatus: BOOKING_STATUSES.pending, actorId: actor.userId, actorRole: 'user', reason: 'Создана встреча' })],
      dateKey,
      dateLabel: startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }),
      time: safeString(slotPayload.time || startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 20),
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      reminders: buildBookingReminders(startDate.toISOString()),
      comment: safeString(req.body?.comment, 800),
      source: safeString(req.body?.source || 'booking-flow', 80),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(bookingRef, booking, { merge: true });
    tx.set(db.collection('users').doc(actor.userId).collection('bookings').doc(bookingRef.id), booking, { merge: true });
    ownerUserIds.forEach(ownerId => {
      tx.set(db.collection('users').doc(ownerId).collection('bookings').doc(bookingRef.id), { ...booking, ownerView: true }, { merge: true });
    });
  });

  const context = buildBookingDialogContext(booking);
  const participantIds = dialogParticipants(actor, context, ownerUserIds);
  const dialog = {
    id: dialogId,
    type: 'booking',
    objectId: booking.id,
    userId: actor.userId,
    context,
    participantIds,
    ownerUserIds,
    unreadBy: Object.fromEntries(participantIds.filter(id => id !== actor.userId).map(id => [id, 1])),
    typing: {},
    lastMessage: { id: `booking_${booking.id}`, text: `Создана запись: ${booking.serviceTitle}, ${booking.dateLabel} ${booking.time}`, senderId: 'system', senderName: 'АПГ', senderRole: 'system', createdAt: FieldValue.serverTimestamp() },
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(db.collection('contextDialogs').doc(dialogId), dialog, { merge: true });
  participantIds.forEach(participantId => {
    batch.set(db.collection('users').doc(participantId).collection('contextDialogs').doc(dialogId), dialogMirrorPayload(dialog, participantId), { merge: true });
  });
  ownerUserIds.forEach(ownerId => {
    const notificationId = `booking_${safeDialogIdPart(ownerId)}_${safeDialogIdPart(booking.id)}`.slice(0, 900);
    batch.set(db.collection('notifications').doc(notificationId), {
      id: notificationId,
      userId: ownerId,
      category: 'messages',
      type: 'bookingCreated',
      title: `📅 ${booking.providerName}`,
      body: `${booking.userName} записался: ${booking.serviceTitle}, ${booking.dateLabel} ${booking.time}`,
      text: `${booking.userName} записался: ${booking.serviceTitle}`,
      dialogId,
      bookingId: booking.id,
      objectType: 'booking',
      objectId: booking.id,
      deepLink: buildDialogDeepLink(dialogId),
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
  await Promise.all(ownerUserIds.map(ownerId => sendDialogPush(db, ownerId, `booking_${safeDialogIdPart(ownerId)}_${safeDialogIdPart(booking.id)}`.slice(0, 900), `📅 ${booking.providerName}`, `Новая запись: ${booking.serviceTitle}, ${booking.dateLabel} ${booking.time}`, dialogId).catch(error => {
    req.log?.warn?.({ bookingPush: { bookingId: booking.id, ownerId, message: safeString(error?.message, 200) } }, 'booking push failed');
  })));
  await audit(db, req, actor, 'booking:create', 'bookings', booking.id, 'success', { providerType, providerId, locationId: bookingLocationPayload?.id || '', serviceId: service.id, dialogId });
  return { ok: true, booking, dialogId };
}

async function actionBookingManualCreate(db, req, actor) {
  const providerType = safeString(req.body?.providerType, 40) === 'expert' ? 'expert' : 'partner';
  const providerId = safeString(req.body?.providerId, 160);
  if (!providerId) throw Object.assign(new Error('Не указан профиль для встречи.'), { statusCode: 400, code: 'BOOKING_BAD_PROVIDER' });
  const providerCollection = providerType === 'expert' ? 'experts' : 'partners';
  const providerSnap = await db.collection(providerCollection).doc(providerId).get();
  if (!providerSnap.exists) throw Object.assign(new Error('Профиль для встречи не найден.'), { statusCode: 404, code: 'BOOKING_PROVIDER_NOT_FOUND' });
  const provider = { id: providerSnap.id, ...(providerSnap.data() || {}) };
  if (!actorOwnsProfile(provider, actor, providerType) && !hasRole(actor.user || {}, ROLES.owner) && !hasRole(actor.user || {}, ROLES.admin)) {
    throw Object.assign(new Error('Нет доступа к этому профилю.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
  }
  const requestedLocationId = safeString(req.body?.locationId || req.body?.location?.id, 120);
  const bookingLocation = providerType === 'partner' ? getLocationById(provider, requestedLocationId) : null;
  const bookingProvider = providerType === 'partner' ? locationToProvider(provider, bookingLocation) : provider;
  const bookingLocationPayload = locationBookingPayload(bookingLocation);
  const bookingProfile = buildBookingProfile(bookingProvider, providerType);
  const serviceId = safeString(req.body?.serviceId, 80);
  const service = bookingProfile.services.find(item => item.id === serviceId) || bookingProfile.services[0];
  if (!service) throw Object.assign(new Error('Не выбрана услуга.'), { statusCode: 400, code: 'BOOKING_BAD_SERVICE' });
  const specialistId = safeString(req.body?.specialistId || 'default', 80);
  const specialist = bookingProfile.specialists.find(item => item.id === specialistId) || bookingProfile.specialists[0];
  const slot = normalizeSlotFromBody(req.body, { specialistId: specialist?.id || 'default', specialistName: specialist?.name || bookingProfile.title });
  if (!slot) throw Object.assign(new Error('Выберите корректное время встречи.'), { statusCode: 400, code: 'BOOKING_BAD_SLOT' });
  const ownerUserIds = uniqueSafeIds([provider.ownerUserIds, provider.ownerIds, provider.ownerId, provider.ownerUserId, provider.userId, provider.managerUserId, provider.createdByUserId, actor.userId].flat());
  const customer = req.body?.customer && typeof req.body.customer === 'object' ? req.body.customer : {};
  const userId = safeUserId(customer.userId || req.body?.userId) || `manual:${providerType}:${providerId}:${Date.now()}`;
  const bookingRef = db.collection('bookings').doc(`manual_${providerType}_${providerId}_${slot.specialistId || specialist?.id || 'default'}_${new Date(slot.startAt).getTime()}`.replace(/[^a-zA-Z0-9а-яА-ЯёЁ:_-]+/g, '_').slice(0, 420));
  const dialogId = userId.startsWith('manual:') ? '' : buildContextDialogId(userId, 'booking', bookingRef.id);
  let booking = null;
  await db.runTransaction(async tx => {
    const existing = await tx.get(bookingRef);
    if (existing.exists && ![BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.noShow, BOOKING_STATUSES.archived].includes(normalizeBookingStatus(existing.data()?.status))) {
      throw Object.assign(new Error('Это время уже занято. Выберите другое окно.'), { statusCode: 409, code: 'BOOKING_SLOT_TAKEN' });
    }
    await assertBookingSlotFree(tx, db, { providerType, providerId, specialistId: specialist?.id || 'default' }, slot, bookingRef.id);
    booking = {
      id: bookingRef.id,
      bookingId: bookingRef.id,
      dialogId,
      providerType,
      providerId,
      providerName: bookingProfile.title,
      providerPhone: bookingProfile.phone || null,
      address: bookingProfile.address || null,
      locationId: bookingLocationPayload?.id || null,
      locationTitle: bookingLocationPayload?.title || null,
      locationAddress: bookingLocationPayload?.address || null,
      locationPhone: bookingLocationPayload?.phone || null,
      location: bookingLocationPayload,
      serviceId: service.id,
      serviceTitle: service.title,
      serviceDescription: service.description || null,
      durationMinutes: Number(service.durationMinutes || 60),
      price: service.price || null,
      specialistId: slot.specialistId || specialist?.id || 'default',
      specialistName: slot.specialistName || specialist?.name || bookingProfile.title,
      userId,
      userName: safeString(customer.name || customer.userName || req.body?.userName || 'Клиент', 200),
      userPhone: safeString(customer.phone || req.body?.userPhone, 80),
      userTelegram: normalizeProfileUrl(customer.telegram || customer.telegramUrl || '', 'telegram'),
      userWhatsapp: normalizeProfileUrl(customer.whatsapp || customer.whatsappUrl || '', 'whatsapp'),
      userEmail: safeString(customer.email || req.body?.userEmail, 200),
      userPhoto: safeString(customer.photo || '', 1000) || null,
      ownerUserIds,
      status: BOOKING_STATUSES.confirmed,
      statusLabel: getBookingStatusLabel(BOOKING_STATUSES.confirmed),
      statusHistory: [buildBookingHistoryEntry({ fromStatus: '', toStatus: BOOKING_STATUSES.confirmed, actorId: actor.userId, actorRole: 'provider', reason: 'Создано вручную в Workspace' })],
      workspaceHistory: [buildBookingChangeEntry({ type: 'manual_create', actorId: actor.userId, actorRole: 'provider', text: 'Встреча создана вручную' })],
      dateKey: slot.dateKey,
      dateLabel: slot.dateLabel,
      time: slot.time,
      startAt: slot.startAt,
      endAt: slot.endAt,
      reminders: buildBookingReminders(slot.startAt),
      comment: safeString(req.body?.comment, 800),
      internalNotes: sanitizeBookingInternalNotes(req.body?.internalNotes),
      source: safeString(req.body?.source || 'manual', 80),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(bookingRef, booking, { merge: true });
    if (!userId.startsWith('manual:')) tx.set(db.collection('users').doc(userId).collection('bookings').doc(bookingRef.id), booking, { merge: true });
    ownerUserIds.forEach(ownerId => {
      tx.set(db.collection('users').doc(ownerId).collection('bookings').doc(bookingRef.id), { ...booking, ownerView: true }, { merge: true });
    });
  });
  if (dialogId) {
    const context = buildBookingDialogContext(booking);
    const participantIds = uniqueSafeIds([userId, ...ownerUserIds]);
    const dialog = {
      id: dialogId,
      type: 'booking',
      objectId: booking.id,
      userId,
      context,
      participantIds,
      ownerUserIds,
      unreadBy: {},
      typing: {},
      lastMessage: { id: `booking_manual_${booking.id}`, text: `Встреча создана: ${booking.serviceTitle}, ${booking.dateLabel} ${booking.time}`, senderId: 'system', senderName: 'АПГ', senderRole: 'system', createdAt: FieldValue.serverTimestamp() },
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.set(db.collection('contextDialogs').doc(dialogId), dialog, { merge: true });
    participantIds.forEach(participantId => {
      batch.set(db.collection('users').doc(participantId).collection('contextDialogs').doc(dialogId), dialogMirrorPayload(dialog, participantId), { merge: true });
    });
    await batch.commit();
  }
  await audit(db, req, actor, 'booking:manualCreate', 'bookings', booking.id, 'success', { providerType, providerId, source: booking.source, dialogId });
  return { ok: true, booking, dialogId };
}

function bookingActorRole(booking = {}, actor = {}) {
  if (String(booking.userId || '') === String(actor.userId || '')) return 'user';
  if (uniqueSafeIds(booking.ownerUserIds || []).includes(actor.userId) || hasRole(actor.user || {}, ROLES.owner) || hasRole(actor.user || {}, ROLES.admin)) return 'provider';
  return '';
}

async function assertBookingAccess(db, booking, actor, required = 'any') {
  const role = bookingActorRole(booking, actor);
  if (role) return role;
  const collectionName = booking.providerType === 'expert' ? 'experts' : 'partners';
  const providerSnap = booking.providerId ? await db.collection(collectionName).doc(String(booking.providerId)).get().catch(() => null) : null;
  if (providerSnap?.exists && actorOwnsProfile({ id: providerSnap.id, ...(providerSnap.data() || {}) }, actor, booking.providerType)) return 'provider';
  if (required === 'user' || required === 'provider') {
    throw Object.assign(new Error('Нет доступа к этой встрече.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
  }
  return '';
}

function bookingRecipientIds(booking = {}, actor = {}) {
  const ownerIds = uniqueSafeIds(booking.ownerUserIds || []);
  if (String(actor.userId) === String(booking.userId)) return ownerIds;
  return uniqueSafeIds([booking.userId]);
}

async function writeBookingNotification(db, booking, targetUserId, title, body, type = 'bookingUpdated') {
  const notificationId = `booking_${type}_${safeDialogIdPart(targetUserId)}_${safeDialogIdPart(booking.id || booking.bookingId)}`.slice(0, 900);
  await db.collection('notifications').doc(notificationId).set({
    id: notificationId,
    userId: targetUserId,
    targetUserId,
    category: 'messages',
    type,
    title,
    body,
    text: body,
    dialogId: booking.dialogId || null,
    bookingId: booking.id || booking.bookingId,
    objectType: 'booking',
    objectId: booking.id || booking.bookingId,
    deepLink: booking.dialogId ? buildDialogDeepLink(booking.dialogId) : '/profile',
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  if (booking.dialogId) {
    await sendDialogPush(db, targetUserId, notificationId, title, body, booking.dialogId).catch(() => {});
  }
}

async function appendBookingSystemEvent(db, booking, text, actor) {
  if (!booking.dialogId) return;
  const dialogRef = db.collection('contextDialogs').doc(booking.dialogId);
  const messageRef = dialogRef.collection('messages').doc();
  const message = {
    id: messageRef.id,
    dialogId: booking.dialogId,
    type: 'booking',
    objectId: booking.id || booking.bookingId,
    context: buildBookingDialogContext(booking),
    text,
    senderId: 'system',
    senderName: 'АПГ',
    senderRole: 'system',
    status: 'delivered',
    isSystem: true,
    unreadSilent: true,
    createdAt: FieldValue.serverTimestamp(),
  };
  const dialogSnap = await dialogRef.get().catch(() => null);
  const dialog = dialogSnap?.exists ? { id: dialogSnap.id, ...(dialogSnap.data() || {}) } : null;
  const participantIds = uniqueSafeIds(dialog?.participantIds || [booking.userId, ...(booking.ownerUserIds || [])]);
  const batch = db.batch();
  batch.set(messageRef, message, { merge: true });
  participantIds.forEach(participantId => {
    batch.set(db.collection('users').doc(participantId).collection('contextDialogMessages').doc(messageRef.id), message, { merge: true });
  });
  if (dialog) {
    const nextDialog = {
      ...dialog,
      context: buildBookingDialogContext(booking),
      lastMessage: message,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(dialogRef, nextDialog, { merge: true });
    participantIds.forEach(participantId => {
      batch.set(db.collection('users').doc(participantId).collection('contextDialogs').doc(booking.dialogId), dialogMirrorPayload(nextDialog, participantId), { merge: true });
    });
  }
  await batch.commit();
}

function bookingEventText(action, before, after, reason = '') {
  const when = `${after.dateLabel || ''} ${after.time || ''}`.trim();
  if (action === 'confirm') return 'Встреча подтверждена партнером.';
  if (action === 'cancel') return `${after.status === BOOKING_STATUSES.cancelledByProvider ? 'Встреча отменена партнером.' : 'Встреча отменена пользователем.'}${reason ? `\nПричина: ${reason}` : ''}`;
  if (action === 'requestReschedule') return `Запрошен перенос встречи на ${after.pendingReschedule?.dateLabel || when}.`;
  if (action === 'respondReschedule' && after.status === BOOKING_STATUSES.rescheduled) return `Встреча перенесена с ${before.dateLabel || ''} ${before.time || ''} на ${when}.`;
  if (action === 'respondReschedule') return 'Запрос на перенос отклонен.';
  if (action === 'complete') return 'Встреча завершена.';
  if (action === 'noShow') return `Клиент не пришел.${reason ? `\nКомментарий: ${reason}` : ''}`;
  return `Статус встречи изменен: ${getBookingStatusLabel(after.status)}.`;
}

function bookingMomentNotificationText(booking) {
  const journey = booking?.journey || {};
  const bonuses = [];
  if (Number(journey.keysAwarded || 0) > 0) bonuses.push(`+${journey.keysAwarded} ключа`);
  if (journey.stampAwarded) bonuses.push('новый штамп');
  const suffix = bonuses.length ? ` Вас ждут бонусы: ${bonuses.join(' и ')}.` : ' Вас ждёт экран благодарности.';
  return `Спасибо за посещение ${booking.providerName || 'партнёра АПГ'}!${suffix}`;
}

function normalizeSlotFromBody(body = {}, current = {}) {
  const slot = body.slot && typeof body.slot === 'object' ? body.slot : {};
  const startAt = safeString(slot.startAt || body.startAt, 80);
  const endAt = safeString(slot.endAt || body.endAt, 80);
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!startAt || !endAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    dateKey: formatBookingDateKey(start),
    dateLabel: start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }),
    time: safeString(slot.time || start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 20),
    specialistId: safeString(body.specialistId || slot.specialistId || current.specialistId || 'default', 80),
    specialistName: safeString(body.specialistName || slot.specialistName || current.specialistName || '', 160),
  };
}

async function assertBookingSlotFree(tx, db, booking, slot, ignoreBookingId = '') {
  const providerBookings = await tx.get(db.collection('bookings').where('providerId', '==', booking.providerId));
  const conflict = providerBookings.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .find(item => bookingBlocksSlot(item, {
      providerType: booking.providerType,
      providerId: booking.providerId,
      specialistId: slot.specialistId || booking.specialistId || 'default',
      startAt: slot.startAt,
      endAt: slot.endAt,
    }, { ignoreBookingId }));
  if (conflict) {
    throw Object.assign(new Error('Это время уже занято. Выберите другой свободный интервал.'), { statusCode: 409, code: 'BOOKING_SLOT_TAKEN' });
  }
}

async function persistBookingMirrors(db, booking) {
  const batch = db.batch();
  batch.set(db.collection('users').doc(booking.userId).collection('bookings').doc(booking.id), booking, { merge: true });
  uniqueSafeIds(booking.ownerUserIds || []).forEach(ownerId => {
    batch.set(db.collection('users').doc(ownerId).collection('bookings').doc(booking.id), { ...booking, ownerView: true }, { merge: true });
  });
  await batch.commit();
}

function bookingProviderCollection(providerType) {
  return providerType === 'expert' ? 'experts' : 'partners';
}

function bookingVisitRewardAction(providerType) {
  return providerType === 'expert' ? 'expert_visit' : 'partner_visit';
}

function bookingJourneyNextSteps(booking, journey) {
  const steps = [];
  if (journey.reviewPromptAvailable && !journey.reviewPublishedAt) {
    steps.push({ id: 'review', label: 'Оставить отзыв', action: 'openReview' });
  }
  if (booking.providerId) {
    steps.push({ id: 'bookAgain', label: 'Записаться снова', action: 'openProvider' });
  }
  if (booking.dialogId) {
    steps.push({ id: 'dialog', label: 'Открыть диалог', action: 'openDialog' });
  }
  return steps;
}

async function applyBookingCompletionJourney(db, booking) {
  if (booking.status !== BOOKING_STATUSES.completed) return { booking, events: [] };
  const bookingId = safeString(booking.id || booking.bookingId, 180);
  const providerId = safeString(booking.providerId, 180);
  const userId = safeUserId(booking.userId);
  if (!bookingId || !providerId || !userId) return { booking, events: [] };

  const bookingRef = db.collection('bookings').doc(bookingId);
  const userRef = db.collection('users').doc(userId);
  const providerRef = db.collection(bookingProviderCollection(booking.providerType)).doc(providerId);
  const globalRef = db.collection('stats').doc('global');
  const nowIso = new Date().toISOString();
  let nextBooking = booking;
  let journey = null;

  await db.runTransaction(async tx => {
    const [bookingSnap, userSnap, providerSnap] = await Promise.all([
      tx.get(bookingRef),
      tx.get(userRef),
      tx.get(providerRef),
    ]);
    if (!bookingSnap.exists) return;
    const current = normalizeBooking({ id: bookingSnap.id, ...(bookingSnap.data() || {}) });
    const currentJourney = current.journey || {};
    if (currentJourney.rewardedAt) {
      nextBooking = current;
      journey = currentJourney;
      return;
    }

    const user = userSnap.exists ? userSnap.data() || {} : {};
    const provider = providerSnap.exists ? providerSnap.data() || {} : {};
    const previousVisitCounts = user.visitCounts && typeof user.visitCounts === 'object' ? user.visitCounts : {};
    const scannedPartners = user.scannedPartners && typeof user.scannedPartners === 'object' ? user.scannedPartners : {};
    const scannedExperts = user.scannedExperts && typeof user.scannedExperts === 'object' ? user.scannedExperts : {};
    const prevCount = Number(current.providerType === 'expert' ? scannedExperts[providerId] : previousVisitCounts[providerId]) || 0;
    const alreadyAwarded = current.providerType === 'expert' ? prevCount > 0 : Boolean(scannedPartners[providerId]);
    const reward = getEconomyReward(bookingVisitRewardAction(current.providerType));
    const boost = Math.max(1, Math.min(5, Number(provider.keyMultiplier || provider.keysMultiplier || (provider.featured || provider.partnerOfMonth ? 2 : 1)) || 1));
    const configuredKeys = Number(provider.keys || provider.visitKeys || 0);
    const keysAwarded = alreadyAwarded ? 0 : Math.max(0, configuredKeys || Math.round(reward.keys * boost));
    const reputationAwarded = alreadyAwarded ? 0 : Math.max(0, Number(reward.reputation || 0));
    const nextVisitCount = prevCount + 1;
    const stampTarget = Math.max(0, Number(provider.stampTarget || provider.loyaltyStampTarget || 0));
    const stampAwarded = stampTarget > 0 || current.providerType === 'partner';

    journey = {
      ...(currentJourney || {}),
      visitCompletedAt: nowIso,
      rewardedAt: nowIso,
      reviewPromptAvailable: true,
      keysAwarded,
      reputationAwarded,
      stampAwarded,
      rewardSource: 'booking_complete',
      stampProgress: {
        providerId,
        current: nextVisitCount,
        target: stampTarget,
        completed: stampTarget > 0 && nextVisitCount >= stampTarget,
      },
    };
    journey.nextSteps = bookingJourneyNextSteps(current, journey);

    const userPatch = {
      [`visitCounts.${providerId}`]: FieldValue.increment(1),
      economyVersion: ECONOMY_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (current.providerType === 'expert') {
      userPatch[`scannedExperts.${providerId}`] = FieldValue.increment(1);
    } else if (!alreadyAwarded) {
      userPatch[`scannedPartners.${providerId}`] = true;
    }
    if (keysAwarded > 0) userPatch.keys = FieldValue.increment(keysAwarded);
    if (reputationAwarded > 0) userPatch.reputation = FieldValue.increment(reputationAwarded);

    tx.set(userRef, userPatch, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'booking_visit',
      icon: keysAwarded > 0 ? '🔑' : '📅',
      text: keysAwarded > 0
        ? `Встреча завершена: ${current.providerName || provider.name || 'АПГ'} · +${keysAwarded} ключа`
        : `Встреча завершена: ${current.providerName || provider.name || 'АПГ'}`,
      keys: keysAwarded,
      reputation: reputationAwarded,
      partnerId: current.providerType === 'partner' ? providerId : '',
      expertId: current.providerType === 'expert' ? providerId : '',
      bookingId,
      economyVersion: ECONOMY_VERSION,
      meta: { source: 'booking_complete', providerType: current.providerType, providerId },
      ts: FieldValue.serverTimestamp(),
    });
    tx.set(providerRef, {
      totalVisits: FieldValue.increment(1),
      'bookingStats.completedVisits': FieldValue.increment(1),
      'bookingStats.keysAwarded': FieldValue.increment(keysAwarded),
      'bookingStats.stampsAwarded': FieldValue.increment(stampAwarded ? 1 : 0),
      'bookingStats.reviewsRequested': FieldValue.increment(1),
      bookingStatsUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(globalRef, {
      totalBookingVisits: FieldValue.increment(1),
      bookingKeysAwarded: FieldValue.increment(keysAwarded),
    }, { merge: true });
    tx.set(bookingRef, {
      journey,
      reviewPromptAvailable: true,
      keysAwarded,
      reputationAwarded,
      stampAwarded,
      completedVisitAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    nextBooking = normalizeBooking({ ...current, journey, reviewPromptAvailable: true, keysAwarded, reputationAwarded, stampAwarded });
  });

  const events = [];
  if (journey?.stampAwarded) {
    const progress = journey.stampProgress || {};
    events.push(progress.target > 0 ? `Штамп начислен: ${progress.current}/${progress.target}.` : 'Визит добавлен в историю посещений.');
  }
  if (journey?.keysAwarded > 0) events.push(`Начислено ${journey.keysAwarded} ключа за подтвержденный визит.`);
  if (journey?.reviewPromptAvailable && !journey?.reviewPublishedAt) events.push('Теперь можно оставить отзыв о встрече.');
  return { booking: nextBooking, events };
}

async function markBookingReviewPublished(db, { bookingId, userId, providerType, providerId }) {
  const cleanBookingId = safeString(bookingId, 180);
  const cleanUserId = safeUserId(userId);
  const cleanProviderId = safeString(providerId, 180);
  const cleanProviderType = providerType === 'expert' ? 'expert' : 'partner';
  if (!cleanBookingId || !cleanUserId || !cleanProviderId) return null;

  const ref = db.collection('bookings').doc(cleanBookingId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const booking = normalizeBooking({ id: snap.id, ...(snap.data() || {}) });
  if (booking.userId !== cleanUserId || booking.providerType !== cleanProviderType || booking.providerId !== cleanProviderId) return null;
  const journey = {
    ...(booking.journey || {}),
    reviewPromptAvailable: false,
    reviewPublishedAt: new Date().toISOString(),
  };
  journey.nextSteps = bookingJourneyNextSteps(booking, journey);
  const nextBooking = normalizeBooking({ ...booking, journey, reviewPromptAvailable: false });
  await ref.set({
    journey,
    reviewPromptAvailable: false,
    reviewPublishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await persistBookingMirrors(db, nextBooking);
  await appendBookingSystemEvent(db, nextBooking, 'Отзыв опубликован и связан с этой встречей.', { userId: cleanUserId });
  await db.collection(bookingProviderCollection(cleanProviderType)).doc(cleanProviderId).set({
    'bookingStats.reviewsPublished': FieldValue.increment(1),
    bookingStatsUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return nextBooking;
}

async function actionBookingLifecycle(db, req, actor, kind) {
  const bookingId = safeString(req.body?.bookingId || req.body?.id, 260);
  if (!bookingId) throw Object.assign(new Error('Не указана встреча.'), { statusCode: 400, code: 'BOOKING_BAD_ID' });
  const reason = safeString(req.body?.reason || req.body?.comment, 800);
  const ref = db.collection('bookings').doc(bookingId);
  let before = null;
  let booking = null;
  let role = '';
  let notificationType = 'bookingUpdated';
  const preSnap = await ref.get();
  if (!preSnap.exists) throw Object.assign(new Error('Встреча не найдена.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  const preBooking = normalizeBooking({ id: preSnap.id, ...(preSnap.data() || {}) });
  const preRole = await assertBookingAccess(db, preBooking, actor);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error('Встреча не найдена.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    before = normalizeBooking({ id: snap.id, ...(snap.data() || {}) });
    role = preRole || bookingActorRole(before, actor);

    let nextStatus = before.status;
    const changes = {};
    const patch = {};

    if (kind === 'confirm') {
      if (role !== 'provider') throw Object.assign(new Error('Подтвердить встречу может только партнер или эксперт.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
      nextStatus = BOOKING_STATUSES.confirmed;
      notificationType = 'bookingConfirmed';
    } else if (kind === 'cancel') {
      if (role === 'provider' && !reason) throw Object.assign(new Error('Укажите причину отмены.'), { statusCode: 400, code: 'BOOKING_REASON_REQUIRED' });
      nextStatus = role === 'provider' ? BOOKING_STATUSES.cancelledByProvider : BOOKING_STATUSES.cancelledByUser;
      notificationType = 'bookingCancelled';
    } else if (kind === 'requestReschedule') {
      const slot = normalizeSlotFromBody(req.body, before);
      if (!slot || new Date(slot.startAt).getTime() <= Date.now() + 10 * 60 * 1000) throw Object.assign(new Error('Выберите доступный будущий интервал.'), { statusCode: 400, code: 'BOOKING_BAD_SLOT' });
      await assertBookingSlotFree(tx, db, before, slot, before.id);
      nextStatus = BOOKING_STATUSES.rescheduleRequested;
      patch.pendingReschedule = {
        ...slot,
        requestedBy: actor.userId,
        requestedByRole: role || 'user',
        reason,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      changes.pendingReschedule = patch.pendingReschedule;
      notificationType = 'bookingRescheduleRequested';
    } else if (kind === 'respondReschedule') {
      if (role !== 'provider') throw Object.assign(new Error('Ответить на перенос может только партнер или эксперт.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
      const decision = safeString(req.body?.decision || req.body?.response, 40);
      const proposedSlot = normalizeSlotFromBody(req.body, before);
      if (decision === 'reject') {
        nextStatus = BOOKING_STATUSES.confirmed;
        patch.pendingReschedule = null;
        notificationType = 'bookingRescheduleRejected';
      } else {
        const slot = proposedSlot || before.pendingReschedule;
        if (!slot?.startAt || !slot?.endAt) throw Object.assign(new Error('Нет нового интервала для переноса.'), { statusCode: 400, code: 'BOOKING_BAD_SLOT' });
        await assertBookingSlotFree(tx, db, before, slot, before.id);
        nextStatus = BOOKING_STATUSES.rescheduled;
        Object.assign(patch, {
          startAt: slot.startAt,
          endAt: slot.endAt,
          dateKey: slot.dateKey || formatBookingDateKey(slot.startAt),
          dateLabel: slot.dateLabel,
          time: slot.time,
          specialistId: slot.specialistId || before.specialistId,
          specialistName: slot.specialistName || before.specialistName,
          reminders: buildBookingReminders(slot.startAt),
          pendingReschedule: null,
        });
        changes.from = { startAt: before.startAt, endAt: before.endAt, specialistId: before.specialistId };
        changes.to = { startAt: patch.startAt, endAt: patch.endAt, specialistId: patch.specialistId };
        notificationType = 'bookingRescheduled';
      }
    } else if (kind === 'complete') {
      if (role !== 'provider') throw Object.assign(new Error('Завершить встречу может только партнер или эксперт.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
      if (![BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(before.status)) throw Object.assign(new Error('Завершить можно только подтвержденную встречу.'), { statusCode: 400, code: 'BOOKING_BAD_TRANSITION' });
      if (new Date(before.startAt).getTime() > Date.now() + 5 * 60 * 1000) throw Object.assign(new Error('Встречу можно завершить после ее начала.'), { statusCode: 400, code: 'BOOKING_TOO_EARLY' });
      nextStatus = BOOKING_STATUSES.completed;
      patch.reviewPromptAvailable = true;
      notificationType = 'bookingCompleted';
    } else if (kind === 'noShow') {
      if (role !== 'provider') throw Object.assign(new Error('Отметить неявку может только партнер или эксперт.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
      nextStatus = BOOKING_STATUSES.noShow;
      notificationType = 'bookingNoShow';
    }

    if (!canTransitionBookingStatus(before.status, nextStatus)) {
      throw Object.assign(new Error('Недопустимый переход статуса встречи.'), { statusCode: 400, code: 'BOOKING_BAD_TRANSITION' });
    }

    const historyEntry = buildBookingHistoryEntry({
      fromStatus: before.status,
      toStatus: nextStatus,
      actorId: actor.userId,
      actorRole: role || 'user',
      reason,
      changes,
    });
    booking = normalizeBooking({
      ...before,
      ...patch,
      status: nextStatus,
      statusLabel: getBookingStatusLabel(nextStatus),
      statusHistory: [...(Array.isArray(before.statusHistory) ? before.statusHistory : []), historyEntry],
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(ref, booking, { merge: true });
  });

  let journeyResult = { booking, events: [] };
  if (kind === 'complete') {
    journeyResult = await applyBookingCompletionJourney(db, booking);
    booking = journeyResult.booking || booking;
  }

  await persistBookingMirrors(db, booking);
  const text = bookingEventText(kind, before, booking, reason);
  await appendBookingSystemEvent(db, booking, text, actor);
  for (const eventText of journeyResult.events || []) {
    await appendBookingSystemEvent(db, booking, eventText, actor);
  }
  const notificationText = kind === 'complete' ? bookingMomentNotificationText(booking) : text;
  await Promise.all(bookingRecipientIds(booking, actor).map(userId => writeBookingNotification(db, booking, userId, `📅 ${booking.providerName || 'Встреча АПГ'}`, notificationText, notificationType).catch(() => {})));
  await audit(db, req, actor, `booking:${kind}`, 'bookings', booking.id, 'success', { fromStatus: before.status, toStatus: booking.status, dialogId: booking.dialogId || '' });
  return { ok: true, booking, dialogId: booking.dialogId || '' };
}

async function actionBookingWorkspaceUpdate(db, req, actor) {
  const bookingId = safeString(req.body?.bookingId || req.body?.id, 260);
  if (!bookingId) throw Object.assign(new Error('Не указана встреча.'), { statusCode: 400, code: 'BOOKING_BAD_ID' });
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Встреча не найдена.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  const before = normalizeBooking({ id: snap.id, ...(snap.data() || {}) });
  const role = await assertBookingAccess(db, before, actor, 'provider');
  if (role !== 'provider') throw Object.assign(new Error('Изменять CRM-поля может только владелец встречи.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
  const patch = req.body?.patch && typeof req.body.patch === 'object' ? req.body.patch : {};
  const clean = {};
  if (Object.hasOwn(patch, 'internalNotes')) clean.internalNotes = sanitizeBookingInternalNotes(patch.internalNotes);
  if (Object.hasOwn(patch, 'workspaceComment')) clean.workspaceComment = safeString(patch.workspaceComment, 1200);
  if (Object.hasOwn(patch, 'clientTags')) clean.clientTags = Array.isArray(patch.clientTags) ? patch.clientTags.map(item => safeString(item, 80)).filter(Boolean).slice(0, 12) : [];
  if (Object.hasOwn(patch, 'source')) clean.source = safeString(patch.source, 80);
  if (!Object.keys(clean).length) return { ok: true, booking: before };
  const history = Array.isArray(before.workspaceHistory) ? before.workspaceHistory.slice(-49) : [];
  const entry = buildBookingChangeEntry({ type: Object.hasOwn(clean, 'internalNotes') ? 'note' : 'workspace_update', actorId: actor.userId, actorRole: 'provider', text: Object.hasOwn(clean, 'internalNotes') ? 'Внутренние заметки обновлены' : 'CRM-поля обновлены', changes: Object.keys(clean).reduce((acc, key) => ({ ...acc, [key]: true }), {}) });
  const booking = normalizeBooking({
    ...before,
    ...clean,
    workspaceHistory: [...history, entry],
    workspaceUpdatedAt: new Date().toISOString(),
  });
  await ref.set({
    ...clean,
    workspaceHistory: booking.workspaceHistory,
    workspaceUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await persistBookingMirrors(db, booking);
  await audit(db, req, actor, 'booking:workspaceUpdate', 'bookings', booking.id, 'success', { fields: Object.keys(clean) });
  return { ok: true, booking };
}

async function actionBookingArchive(db, req, actor) {
  const bookingId = safeString(req.body?.bookingId || req.body?.id, 260);
  if (!bookingId) throw Object.assign(new Error('Не указана встреча.'), { statusCode: 400, code: 'BOOKING_BAD_ID' });
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Встреча не найдена.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  const before = normalizeBooking({ id: snap.id, ...(snap.data() || {}) });
  const role = await assertBookingAccess(db, before, actor, 'provider');
  if (role !== 'provider') throw Object.assign(new Error('Архивировать встречу может только владелец.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
  const historyEntry = buildBookingHistoryEntry({
    fromStatus: before.status,
    toStatus: BOOKING_STATUSES.archived,
    actorId: actor.userId,
    actorRole: 'provider',
    reason: safeString(req.body?.reason || 'Архивировано в Workspace', 800),
  });
  const workspaceEntry = buildBookingChangeEntry({ type: 'archive', actorId: actor.userId, actorRole: 'provider', text: 'Встреча отправлена в архив' });
  const booking = normalizeBooking({
    ...before,
    status: BOOKING_STATUSES.archived,
    statusLabel: getBookingStatusLabel(BOOKING_STATUSES.archived),
    archived: true,
    workspaceArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: actor.userId,
    statusHistory: [...(Array.isArray(before.statusHistory) ? before.statusHistory : []), historyEntry],
    workspaceHistory: [...(Array.isArray(before.workspaceHistory) ? before.workspaceHistory.slice(-49) : []), workspaceEntry],
  });
  await ref.set({
    status: BOOKING_STATUSES.archived,
    statusLabel: getBookingStatusLabel(BOOKING_STATUSES.archived),
    archived: true,
    workspaceArchived: true,
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: actor.userId,
    statusHistory: booking.statusHistory,
    workspaceHistory: booking.workspaceHistory,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await persistBookingMirrors(db, booking);
  await appendBookingSystemEvent(db, booking, 'Встреча архивирована владельцем.', actor);
  await audit(db, req, actor, 'booking:archive', 'bookings', booking.id, 'success', { fromStatus: before.status });
  return { ok: true, booking };
}

async function actionBookingList(db, req, actor, calendar = false) {
  const providerType = safeString(req.body?.providerType, 40);
  const providerId = safeString(req.body?.providerId, 160);
  let rows = [];
  if (providerId) {
    const snap = await db.collection(providerType === 'expert' ? 'experts' : 'partners').doc(providerId).get();
    const adminAccess = hasRole(actor.user || {}, ROLES.owner) || hasRole(actor.user || {}, ROLES.admin);
    if (!snap.exists || (!adminAccess && !actorOwnsProfile({ id: snap.id, ...(snap.data() || {}) }, actor, providerType))) throw Object.assign(new Error('Нет доступа к календарю.'), { statusCode: 403, code: 'BOOKING_FORBIDDEN' });
    const bookingsSnap = await db.collection('bookings').where('providerId', '==', providerId).get();
    rows = bookingsSnap.docs.map(doc => normalizeBooking({ id: doc.id, ...(doc.data() || {}) }));
  } else {
    const bookingsSnap = await db.collection('users').doc(actor.userId).collection('bookings').get();
    rows = bookingsSnap.docs.map(doc => normalizeBooking({ id: doc.id, ...(doc.data() || {}) }));
  }
  if (!calendar) return { ok: true, bookings: rows };
  const from = req.body?.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = req.body?.to || new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
  const specialistId = safeString(req.body?.specialistId, 80);
  const status = safeString(req.body?.status, 80);
  const items = rows
    .filter(item => !specialistId || String(item.specialistId || '') === specialistId)
    .filter(item => !status || item.status === normalizeBookingStatus(status))
    .filter(item => rangesOverlap(item.startAt, item.endAt, from, to) || (item.startMs >= new Date(from).getTime() && item.startMs < new Date(to).getTime()))
    .sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  return { ok: true, bookings: items, calendar: { from, to, specialistId, status, items } };
}

async function actionBookingMoment(db, req, actor) {
  const bookingId = safeString(req.body?.bookingId || req.body?.id, 180);
  const event = safeString(req.body?.event || req.body?.type, 80);
  const allowed = new Set(['opened', 'review_started', 'review_submitted', 'dialog_clicked', 'rebook_clicked', 'dismissed']);
  if (!bookingId || !allowed.has(event)) throw Object.assign(new Error('Некорректное событие момента после визита.'), { statusCode: 400, code: 'BOOKING_MOMENT_BAD_EVENT' });
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Встреча не найдена.'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  const booking = normalizeBooking({ id: snap.id, ...(snap.data() || {}) });
  await assertBookingAccess(db, booking, actor);

  const momentPatch = {
    [`moment.${event}At`]: FieldValue.serverTimestamp(),
    [`moment.${event}Count`]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const providerRef = db.collection(bookingProviderCollection(booking.providerType)).doc(booking.providerId);
  await Promise.all([
    ref.set(momentPatch, { merge: true }),
    db.collection('bookingMomentAnalytics').add({
      bookingId,
      event,
      userId: actor.userId,
      providerType: booking.providerType,
      providerId: booking.providerId,
      source: safeString(req.body?.source || 'post_visit_moment', 80),
      rating: req.body?.rating == null ? null : Math.max(1, Math.min(5, Number(req.body.rating || 0))),
      createdAt: FieldValue.serverTimestamp(),
    }),
    providerRef.set({
      [`bookingMomentStats.${event}`]: FieldValue.increment(1),
      bookingMomentStatsUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {}),
  ]);
  await audit(db, req, actor, 'booking:moment', 'bookings', bookingId, 'success', { event });
  return { ok: true };
}

async function actionLogCreate(db, req, actor, collection, source) {
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  if (collection === 'errorLogs') {
    return upsertErrorLog(db, payload, {
      source,
      userId: actor?.userId,
      version: req.headers['x-apg-version'],
      userAgent: req.headers['user-agent'],
    }, FieldValue);
  }
  await db.collection(collection).add({
    ...payload,
    userId: payload.userId || actor?.userId || null,
    source: payload.source || source,
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

async function actionGuestSession(db, req, actor) {
  const sid = safeString(req.body?.sid, 220).replace(/[/#?[\\\]]/g, '_');
  if (!sid) throw Object.assign(new Error('Не указана гостевая сессия.'), { statusCode: 400 });
  const patch = {
    firebaseUid: actor?.uid || null,
    date: safeString(req.body?.date || new Date().toISOString().slice(0, 10), 20),
    converted: Boolean(req.body?.converted),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (req.body?.userId) patch.userId = safeUserId(req.body.userId);
  if (!req.body?.known) patch.timestamp = FieldValue.serverTimestamp();
  await db.collection('guestSessions').doc(sid).set(patch, { merge: true });
  await audit(db, req, actor, patch.converted ? 'guest:converted' : 'guest:session', 'guestSessions', sid);
  return { ok: true };
}

function uniqueSafeIds(values = []) {
  return [...new Set(values.map(safeUserId).filter(Boolean))];
}

function actorName(actor = {}) {
  return safeString(
    actor.user?.displayName
    || [actor.user?.firstName || actor.user?.first_name, actor.user?.lastName || actor.user?.last_name].filter(Boolean).join(' ')
    || actor.user?.name
    || actor.user?.email
    || 'Участник АПГ',
    160,
  );
}

function serverDialogContextFromDoc(type, objectId, data, payloadContext = {}) {
  const { ownerUserIds, ownerIds, ownerId, ownerUserId, userId, managerUserId, createdByUserId, ...clientContext } = payloadContext || {};
  const context = buildDialogContext(type, { id: objectId, ...clientContext, ...(data || {}) }, { objectId, source: 'user-action' });
  if (!context) return null;
  return { ...context, ownerUserIds: uniqueSafeIds(context.ownerUserIds || []) };
}

async function resolveDialogContext(db, req) {
  const type = normalizeDialogType(req.body?.type || req.body?.context?.type);
  const meta = CONTEXT_DIALOG_TYPES[type];
  const objectId = safeString(req.body?.objectId || req.body?.context?.objectId || req.body?.context?.[meta?.idField], 220);
  if (!type || !objectId || !meta) {
    throw Object.assign(new Error('Для диалога нужен корректный тип и объект.'), { statusCode: 400, code: 'BAD_DIALOG_CONTEXT' });
  }
  let data = null;
  if (meta.collection && !['bookings', 'reviews', 'orders', 'support'].includes(meta.collection)) {
    const snap = await db.collection(meta.collection).doc(objectId).get().catch(() => null);
    data = snap?.exists ? snap.data() : null;
  }
  const context = serverDialogContextFromDoc(type, objectId, data || {}, req.body?.context || {});
  if (!context) throw Object.assign(new Error('Не удалось сформировать контекст диалога.'), { statusCode: 400, code: 'BAD_DIALOG_CONTEXT' });
  return context;
}

function dialogParticipants(actor, context = {}, existing = []) {
  return uniqueSafeIds([actor.userId, actor.uid, ...(context.ownerUserIds || []), ...(existing || [])]);
}

function dialogMirrorPayload(dialog, participantId) {
  return {
    dialogId: dialog.id,
    type: dialog.type,
    objectId: dialog.objectId,
    context: dialog.context,
    participantIds: dialog.participantIds,
    userId: dialog.userId,
    ownerUserIds: dialog.ownerUserIds || [],
    lastMessage: dialog.lastMessage || null,
    lastMessageAt: dialog.lastMessageAt || null,
    unreadCount: Number(dialog.unreadBy?.[participantId] || 0),
    typing: dialog.typing || {},
    createdAt: dialog.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function initDialogWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT || `mailto:support@${new URL(APP_URL).hostname}`, publicKey, privateKey);
  return true;
}

function normalizeDialogSubscription(input) {
  const endpoint = safeString(input?.endpoint, 2000);
  const p256dh = safeString(input?.keys?.p256dh, 500);
  const auth = safeString(input?.keys?.auth, 300);
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, expirationTime: input.expirationTime || null, keys: { p256dh, auth } };
}

function boolNotificationPref(prefs, key) {
  if (prefs?.onlyCritical) return false;
  if (!key) return true;
  if (!prefs || prefs[key] === undefined) return true;
  return prefs[key] !== false;
}

function isArchivedUser(user = {}) {
  return user.archived === true || user.deleted === true || ['archived', 'deleted', 'blocked', 'banned'].includes(String(user.status || user.accountStatus || '').toLowerCase());
}

function hasBlockedDialog(user = {}, senderId = '') {
  const blocked = [
    ...(Array.isArray(user.blockedUserIds) ? user.blockedUserIds : []),
    ...(Array.isArray(user.blockedUsers) ? user.blockedUsers : []),
  ].map(item => String(item || ''));
  return senderId && blocked.includes(String(senderId));
}

function isDialogActiveForUser(user = {}, dialogId = '') {
  if (String(user.activeContextDialogId || '') !== String(dialogId || '')) return false;
  const value = user.activeContextDialogSeenAt;
  const ms = value?.toMillis ? value.toMillis() : value?.toDate ? value.toDate().getTime() : new Date(value || 0).getTime();
  return Number.isFinite(ms) && Date.now() - ms < 45000;
}

async function getSocialUser(db, userId) {
  const id = cleanSocialId(userId);
  if (!id) return null;
  const snap = await db.collection('users').doc(id).get().catch(() => null);
  if (!snap?.exists) return null;
  return { id, ref: snap.ref, data: snap.data() || {} };
}

async function hasSocialBlock(db, a = '', b = '') {
  const left = cleanSocialId(a);
  const right = cleanSocialId(b);
  if (!left || !right) return true;
  const [leftDoc, rightDoc, leftUser, rightUser] = await Promise.all([
    db.collection('users').doc(left).collection('blockedUsers').doc(right).get().catch(() => null),
    db.collection('users').doc(right).collection('blockedUsers').doc(left).get().catch(() => null),
    db.collection('users').doc(left).get().catch(() => null),
    db.collection('users').doc(right).get().catch(() => null),
  ]);
  const leftData = leftUser?.data?.() || {};
  const rightData = rightUser?.data?.() || {};
  return leftDoc?.exists || rightDoc?.exists || hasBlockedDialog(leftData, right) || hasBlockedDialog(rightData, left);
}

function socialFriends(a = {}, b = {}, aId = '', bId = '') {
  const mergeIds = (value = {}) => [
    ...(Array.isArray(value.friendIds) ? value.friendIds : []),
    ...(Array.isArray(value.friends) ? value.friends : []),
    ...(Array.isArray(value.connectionIds) ? value.connectionIds : []),
    ...(Array.isArray(value.socialConnectionIds) ? value.socialConnectionIds : []),
  ];
  const aFriends = mergeIds(a);
  const bFriends = mergeIds(b);
  return aFriends.map(String).includes(String(bId)) || bFriends.map(String).includes(String(aId));
}

function socialSharedPartner(a = {}, b = {}) {
  const left = new Set([...(Array.isArray(a.visitedPartnerIds) ? a.visitedPartnerIds : []), ...(Array.isArray(a.partnerIds) ? a.partnerIds : [])].map(String));
  const right = new Set([...(Array.isArray(b.visitedPartnerIds) ? b.visitedPartnerIds : []), ...(Array.isArray(b.partnerIds) ? b.partnerIds : [])].map(String));
  return [...left].find(id => right.has(id)) || '';
}

function socialSharedEvent(a = {}, b = {}) {
  const left = new Set([...(Array.isArray(a.registeredEventIds) ? a.registeredEventIds : []), ...(Array.isArray(a.eventIds) ? a.eventIds : [])].map(String));
  const right = new Set([...(Array.isArray(b.registeredEventIds) ? b.registeredEventIds : []), ...(Array.isArray(b.eventIds) ? b.eventIds : [])].map(String));
  return [...left].find(id => right.has(id)) || '';
}

async function findExistingDirectDialog(db, a = '', b = '') {
  const id = socialDirectDialogId(a, b);
  if (!id) return null;
  const snap = await db.collection('contextDialogs').doc(id).get().catch(() => null);
  return snap?.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
}

async function findAcceptedSocialPermission(db, a = '', b = '') {
  const requestId = socialRequestId(a, b);
  if (!requestId) return null;
  const snap = await db.collection('conversationRequests').doc(requestId).get().catch(() => null);
  if (!snap?.exists) return null;
  const data = snap.data() || {};
  const status = normalizeSocialRequestStatus(data.status, Date.now(), data.expiresAt);
  return status === SOCIAL_REQUEST_STATUS.ACCEPTED ? { id: snap.id, ...data, status } : null;
}

async function evaluateServerSocialEligibility(db, actor, recipientId) {
  const senderId = cleanSocialId(actor.userId);
  const targetId = cleanSocialId(recipientId);
  if (!senderId || !targetId) return { ok: false, reason: 'missing_user' };
  if (senderId === targetId) return { ok: false, reason: 'self' };
  const [sender, recipient, existingDialog, acceptedPermission, blocked] = await Promise.all([
    getSocialUser(db, senderId),
    getSocialUser(db, targetId),
    findExistingDirectDialog(db, senderId, targetId),
    findAcceptedSocialPermission(db, senderId, targetId),
    hasSocialBlock(db, senderId, targetId),
  ]);
  if (!recipient) return { ok: false, reason: 'recipient_not_found' };
  if (blocked) return { ok: false, reason: 'blocked', sender, recipient };
  if (existingDialog) return { ok: true, reason: 'existing_conversation', sender, recipient, dialogId: existingDialog.id };
  if (acceptedPermission) return { ok: true, reason: 'manual_permission', sender, recipient, request: acceptedPermission, dialogId: acceptedPermission.dialogId || '' };
  const privacy = normalizeSocialPrivacy(recipient.data.messagingPrivacy || recipient.data.socialMessagingPrivacy);
  if (privacy === SOCIAL_PRIVACY.NOBODY) return { ok: false, reason: 'privacy', privacy, sender, recipient };
  if (socialFriends(sender?.data || {}, recipient.data, senderId, targetId)) return { ok: true, reason: 'friends', privacy, sender, recipient };
  if (privacy === SOCIAL_PRIVACY.FRIENDS_ONLY) return { ok: false, reason: 'privacy', privacy, sender, recipient };
  const eventId = socialSharedEvent(sender?.data || {}, recipient.data);
  if (eventId) return { ok: true, reason: 'shared_event', eventId, privacy, sender, recipient };
  const partnerId = socialSharedPartner(sender?.data || {}, recipient.data);
  if (partnerId) return { ok: true, reason: 'shared_partner', partnerId, privacy, sender, recipient };
  return { ok: false, reason: 'manual_request_available', privacy, sender, recipient };
}

function socialRequestMirror(data = {}, viewerId = '') {
  return {
    id: data.id,
    pairKey: data.pairKey,
    senderId: data.senderId,
    recipientId: data.recipientId,
    status: data.status,
    relationshipReason: data.relationshipReason || 'manual_permission',
    dialogId: data.dialogId || '',
    sender: data.sender || null,
    recipient: data.recipient || null,
    direction: String(data.senderId) === String(viewerId) ? 'outgoing' : 'incoming',
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    updatedAt: data.updatedAt || FieldValue.serverTimestamp(),
    expiresAt: data.expiresAt || null,
    acceptedAt: data.acceptedAt || null,
    declinedAt: data.declinedAt || null,
    cancelledAt: data.cancelledAt || null,
    connection: data.connection === true,
    connectionStatus: data.connectionStatus || '',
    connectionSource: data.connectionSource || '',
    connectionSourceLabel: data.connectionSourceLabel || '',
    connectionSourceId: data.connectionSourceId || '',
    connectionSourceTitle: data.connectionSourceTitle || '',
    connectionSourceDate: data.connectionSourceDate || '',
    shared: data.shared || null,
    history: Array.isArray(data.history) ? data.history.slice(-12) : [],
  };
}

async function mirrorSocialRequest(db, data = {}) {
  const batch = db.batch();
  for (const participantId of [data.senderId, data.recipientId].filter(Boolean)) {
    batch.set(db.collection('users').doc(participantId).collection('socialMessagingRequests').doc(data.id), socialRequestMirror(data, participantId), { merge: true });
  }
  await batch.commit();
}

function connectionMirror(data = {}, viewerId = '') {
  const otherId = String(data.senderId) === String(viewerId) ? data.recipientId : data.senderId;
  const other = String(data.senderId) === String(viewerId) ? data.recipient : data.sender;
  return {
    id: otherId,
    requestId: data.id,
    pairKey: data.pairKey,
    userId: viewerId,
    contactUserId: otherId,
    status: normalizeConnectionStatus(data.connectionStatus || data.status),
    source: data.connectionSource || data.source || 'manual',
    sourceLabel: data.connectionSourceLabel || data.sourceLabel || 'Ручной запрос',
    sourceId: data.connectionSourceId || data.sourceId || '',
    sourceTitle: data.connectionSourceTitle || data.sourceTitle || '',
    sourceDate: data.connectionSourceDate || data.sourceDate || '',
    introducedAt: data.createdAt || FieldValue.serverTimestamp(),
    connectedAt: data.connectedAt || data.acceptedAt || null,
    dialogId: data.dialogId || '',
    contact: other || null,
    shared: data.shared || { events: [], partners: [], contacts: [] },
    history: Array.isArray(data.history) ? data.history.slice(-12) : [],
    updatedAt: data.updatedAt || FieldValue.serverTimestamp(),
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
  };
}

async function mirrorConnection(db, data = {}) {
  const senderId = cleanSocialId(data.senderId);
  const recipientId = cleanSocialId(data.recipientId);
  if (!senderId || !recipientId) return;
  const batch = db.batch();
  batch.set(db.collection('users').doc(senderId).collection('connections').doc(recipientId), connectionMirror(data, senderId), { merge: true });
  batch.set(db.collection('users').doc(recipientId).collection('connections').doc(senderId), connectionMirror(data, recipientId), { merge: true });
  batch.set(db.collection('users').doc(senderId), {
    connectionIds: FieldValue.arrayUnion(recipientId),
    socialConnectionIds: FieldValue.arrayUnion(recipientId),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.collection('users').doc(recipientId), {
    connectionIds: FieldValue.arrayUnion(senderId),
    socialConnectionIds: FieldValue.arrayUnion(senderId),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

function connectionSourceFromRequest(req = {}) {
  return createConnectionContext({
    source: req.body?.source || req.body?.connectionSource || 'manual',
    sourceId: req.body?.sourceId || req.body?.connectionSourceId || '',
    sourceTitle: req.body?.sourceTitle || req.body?.connectionSourceTitle || '',
    sourceDate: req.body?.sourceDate || req.body?.connectionSourceDate || '',
  });
}

function connectionHistoryEntry(type = 'requested', actorId = '', context = {}) {
  return {
    type,
    actorId: cleanSocialId(actorId),
    source: context.source || 'manual',
    sourceLabel: context.sourceLabel || 'Ручной запрос',
    sourceId: context.sourceId || '',
    sourceTitle: context.sourceTitle || '',
    sourceDate: context.sourceDate || '',
    at: new Date().toISOString(),
  };
}

function connectionSnapshot(data = {}, viewerId = '') {
  return {
    id: data.id,
    requestId: data.id,
    status: normalizeConnectionStatus(data.connectionStatus || data.status),
    source: data.connectionSource || 'manual',
    sourceLabel: data.connectionSourceLabel || 'Ручной запрос',
    sourceTitle: data.connectionSourceTitle || '',
    dialogId: data.dialogId || '',
    contact: String(data.senderId) === String(viewerId) ? data.recipient : data.sender,
    shared: data.shared || { events: [], partners: [], contacts: [] },
    history: Array.isArray(data.history) ? data.history.slice(-12) : [],
  };
}

async function writeSocialNotification(db, userId, data = {}) {
  const ref = db.collection('notifications').doc();
  await ref.set({
    userId,
    targetUserId: userId,
    category: 'messages',
    type: data.type || 'socialMessaging',
    title: data.title || 'Социальные сообщения',
    body: data.body || '',
    text: data.body || '',
    requestId: data.requestId || '',
    dialogId: data.dialogId || '',
    deepLink: '/messages',
    url: '/messages',
    actionUrl: '/messages',
    isRead: false,
    priority: 'normal',
    pushStatus: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return ref.id;
}

async function ensureDirectDialogForPair(db, actor, targetId, request = null) {
  const senderId = cleanSocialId(actor.userId);
  const recipientId = cleanSocialId(targetId);
  const dialogId = socialDirectDialogId(senderId, recipientId);
  if (!dialogId) throw Object.assign(new Error('Не удалось создать ID диалога.'), { statusCode: 400, code: 'BAD_DIRECT_DIALOG_ID' });
  const [sender, recipient] = await Promise.all([getSocialUser(db, senderId), getSocialUser(db, recipientId)]);
  const context = {
    type: 'direct',
    objectId: recipientId,
    targetUserId: recipientId,
    category: 'PERSONAL',
    title: recipient?.data?.displayName || recipient?.data?.firstName || 'Личный диалог АПГ',
    subtitle: 'Личный диалог АПГ',
    participantIds: [senderId, recipientId],
    relationshipReason: request?.relationshipReason || 'manual_permission',
    requestId: request?.id || '',
    source: 'social-messaging',
  };
  const ref = db.collection('contextDialogs').doc(dialogId);
  let dialog = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const before = snap.exists ? snap.data() || {} : {};
    dialog = {
      id: dialogId,
      type: 'direct',
      objectId: recipientId,
      userId: before.userId || senderId,
      context,
      participantIds: uniqueSafeIds([senderId, recipientId, ...(before.participantIds || [])]),
      ownerUserIds: [],
      unreadBy: before.unreadBy || {},
      typing: before.typing || {},
      lastMessage: before.lastMessage || null,
      lastMessageAt: before.lastMessageAt || null,
      createdAt: before.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, dialog, { merge: true });
  });
  await mirrorDialog(db, dialog);
  return { dialogId, dialog, sender, recipient };
}

async function assertCanWriteDirectDialog(db, dialog, actor) {
  if (dialog.type !== 'direct') return { ok: true };
  const participants = uniqueSafeIds(dialog.participantIds || []);
  const otherId = participants.find(id => id !== actor.userId && id !== actor.uid);
  if (!participants.includes(actor.userId) || !otherId) {
    await audit(db, null, actor, SOCIAL_EVENTS.WRITE_DENIED, 'contextDialog', dialog.id, 'denied', { reason: 'not_participant' }).catch(() => {});
    throw Object.assign(new Error('Нет доступа к личному диалогу.'), { statusCode: 403, code: 'DIRECT_DIALOG_FORBIDDEN' });
  }
  if (await hasSocialBlock(db, actor.userId, otherId)) {
    await audit(db, null, actor, SOCIAL_EVENTS.WRITE_DENIED, 'contextDialog', dialog.id, 'denied', { reason: 'blocked' }).catch(() => {});
    throw Object.assign(new Error('Сообщение недоступно из-за блокировки.'), { statusCode: 403, code: 'SOCIAL_BLOCKED' });
  }
  const accepted = await findAcceptedSocialPermission(db, actor.userId, otherId);
  const existing = await findExistingDirectDialog(db, actor.userId, otherId);
  if (!accepted && !existing) {
    await audit(db, null, actor, SOCIAL_EVENTS.WRITE_DENIED, 'contextDialog', dialog.id, 'denied', { reason: 'no_permission' }).catch(() => {});
    throw Object.assign(new Error('Нет разрешения на личную переписку.'), { statusCode: 403, code: 'SOCIAL_PERMISSION_REQUIRED' });
  }
  return { ok: true };
}

async function getDialogRecipientState(db, userId, dialogId, senderId) {
  const snap = await db.collection('users').doc(String(userId)).get().catch(() => null);
  if (!snap?.exists) return { userId, user: null, canCreateNotification: false, canPush: false, active: false, reason: 'user_not_found' };
  const user = snap.data() || {};
  const active = isDialogActiveForUser(user, dialogId);
  const blocked = hasBlockedDialog(user, senderId);
  const archived = isArchivedUser(user);
  const pushConsent = user.notificationsEnabled === true || user.notificationConsent === true;
  const providerOk = !user.notificationProvider || user.notificationProvider === 'webpush' || user.notificationProvider === 'vk';
  const prefOk = boolNotificationPref(user.notificationPreferences || {}, 'messages');
  return {
    userId,
    user,
    active,
    canCreateNotification: !active && !blocked && !archived,
    canPush: !active && !blocked && !archived && pushConsent && providerOk && prefOk,
    reason: active ? 'dialog_active' : blocked ? 'blocked_sender' : archived ? 'archived_user' : !pushConsent ? 'notifications_disabled' : !prefOk ? 'messages_disabled' : !providerOk ? 'provider_unsupported' : '',
  };
}

async function findRecentDialogNotification(db, userId, dialogId) {
  const id = `dialog_${safeDialogIdPart(userId)}_${safeDialogIdPart(dialogId)}`.slice(0, 900);
  const ref = db.collection('notifications').doc(id);
  const doc = await ref.get().catch(() => null);
  if (!doc?.exists) return { ref, id, data: null, recentUnread: false };
  const data = doc.data() || {};
  if (data.isRead === true) return { ref, id, data, recentUnread: false };
  const ms = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt || 0).getTime();
  return { ref, id, data, recentUnread: Number.isFinite(ms) && Date.now() - ms <= 10 * 60000 };
}

async function prepareDialogNotification(db, target, dialog, message, preview) {
  if (!target.canCreateNotification) return null;
  const recent = await findRecentDialogNotification(db, target.userId, dialog.id);
  const messageCount = recent?.recentUnread ? Number(recent?.data?.messageCount || 0) + 1 : 1;
  const title = buildDialogNotificationTitle(dialog.context || {});
  const body = buildDialogNotificationBody(dialog.context || {}, { senderRole: message.senderRole, senderName: message.senderName, messageCount });
  const notificationRef = recent?.ref || db.collection('notifications').doc();
  const recentPushMs = recent?.data?.pushSentAt?.toMillis
    ? recent.data.pushSentAt.toMillis()
    : recent?.data?.pushSentAt?.toDate
      ? recent.data.pushSentAt.toDate().getTime()
      : 0;
  return {
    ref: notificationRef,
    id: notificationRef.id,
    userId: target.userId,
    title,
    body,
    shouldPush: target.canPush && (!recent?.recentUnread || Date.now() - recentPushMs > 45000),
    data: {
      userId: target.userId,
      targetUserId: target.userId,
      category: 'messages',
      type: 'contextDialogMessage',
      title,
      body,
      text: body,
      preview,
      dialogId: dialog.id,
      objectType: dialog.type,
      dialogType: dialog.type,
      objectId: dialog.objectId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      deepLink: buildDialogDeepLink(dialog.id),
      url: buildDialogDeepLink(dialog.id),
      actionUrl: buildDialogDeepLink(dialog.id),
      isRead: false,
      messageCount,
      priority: 'normal',
      pushStatus: target.canPush && (!recent?.recentUnread || Date.now() - recentPushMs > 45000) ? 'pending' : 'skipped',
      pushSkipReason: target.canPush ? (recent?.recentUnread ? 'aggregated_recent_push' : '') : target.reason,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: recent?.recentUnread ? recent.data.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    },
  };
}

// зависший push-endpoint не должен ронять запрос dialog:message по 30с лимиту контейнера
const DIALOG_PUSH_TIMEOUT_MS = 10000;

function withDialogPushTimeout(promise, ms = DIALOG_PUSH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('push endpoint timed out'), { statusCode: 0, code: 'push/timeout' })), ms)),
  ]);
}

async function sendDialogPush(db, userId, notificationId, title, body, dialogId) {
  const snap = await db.collection('users').doc(userId).get().catch(() => null);
  if (!snap?.exists) return { sent: 0, failed: 0, skipped: true, reason: 'user_not_found' };
  const user = snap.data() || {};
  if (isArchivedUser(user)) return { sent: 0, failed: 0, skipped: true, reason: 'archived_user' };
  if (isDialogActiveForUser(user, dialogId)) return { sent: 0, failed: 0, skipped: true, reason: 'dialog_active' };
  if (user.notificationsEnabled !== true && user.notificationConsent !== true) return { sent: 0, failed: 0, skipped: true, reason: 'notifications_disabled' };
  if (!boolNotificationPref(user.notificationPreferences || {}, 'messages')) return { sent: 0, failed: 0, skipped: true, reason: 'messages_disabled' };
  const fcmTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens.map(token => safeString(token, 600)).filter(Boolean) : [];
  const webSubscriptions = Array.isArray(user.webPushSubscriptions) ? user.webPushSubscriptions.map(normalizeDialogSubscription).filter(Boolean) : [];
  const url = `${APP_URL}${buildDialogDeepLink(dialogId)}`;
  let sent = 0;
  let failed = 0;
  const errors = [];

  if (fcmTokens.length) {
    try {
      const result = await withDialogPushTimeout(getDbMessaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data: { title, body, url, tag: `dialog-${dialogId}`, notificationId, category: 'messages', type: 'contextDialogMessage', priority: 'normal' },
        webpush: {
          notification: { icon: `${APP_URL}/192.png`, badge: `${APP_URL}/32.png`, tag: `dialog-${dialogId}`, renotify: true },
          fcmOptions: { link: url },
        },
      }));
      sent += result.successCount;
      failed += result.failureCount;
      result.responses.filter(r => !r.success).slice(0, 6).forEach(r => errors.push({ code: r.error?.code || 'fcm/error', message: safeString(r.error?.message, 240) }));
    } catch (e) {
      failed += fcmTokens.length;
      errors.push({ code: 'fcm/error', message: safeString(e?.message, 240) });
    }
  }

  if (webSubscriptions.length && initDialogWebPush()) {
    await Promise.all(webSubscriptions.map(async subscription => {
      try {
        await withDialogPushTimeout(webpush.sendNotification(subscription, JSON.stringify({
          notification: { title, body, icon: `${APP_URL}/192.png`, badge: `${APP_URL}/32.png`, tag: `dialog-${dialogId}`, renotify: true },
          data: { title, body, url, tag: `dialog-${dialogId}`, notificationId, category: 'messages', type: 'contextDialogMessage', priority: 'normal' },
        }), { TTL: 21600, urgency: 'normal' }));
        sent += 1;
      } catch (e) {
        failed += 1;
        errors.push({ code: e.code === 'push/timeout' ? 'webpush/timeout' : e.statusCode ? `webpush/${e.statusCode}` : 'webpush/error', message: safeString(e?.body || e?.message, 240) });
      }
    }));
  }

  const stats = { sent, failed, subscribers: fcmTokens.length + webSubscriptions.length, errors: errors.slice(0, 10) };
  await db.collection('notifications').doc(notificationId).set({
    pushStatus: stats.subscribers ? (failed ? 'partial' : 'sent') : 'skipped',
    pushStats: stats,
    pushSentAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});
  return stats;
}

async function mirrorDialog(db, dialog) {
  const batch = db.batch();
  for (const participantId of dialog.participantIds || []) {
    batch.set(db.collection('users').doc(participantId).collection('contextDialogs').doc(dialog.id), dialogMirrorPayload(dialog, participantId), { merge: true });
  }
  await batch.commit();
}

async function actionDialogOpen(db, req, actor) {
  const context = await resolveDialogContext(db, req);
  if (context.type === 'direct') {
    const eligibility = await evaluateServerSocialEligibility(db, actor, context.targetUserId || context.objectId);
    if (!eligibility.ok && eligibility.reason !== 'existing_conversation') {
      throw Object.assign(new Error('Нет разрешения на личную переписку.'), { statusCode: 403, code: 'SOCIAL_PERMISSION_REQUIRED' });
    }
  }
  const dialogId = context.type === 'direct'
    ? socialDirectDialogId(actor.userId, context.targetUserId || context.objectId)
    : buildContextDialogId(actor.userId, context.type, context.objectId);
  if (!dialogId) throw Object.assign(new Error('Не удалось создать ID диалога.'), { statusCode: 400, code: 'BAD_DIALOG_ID' });
  const ref = db.collection('contextDialogs').doc(dialogId);
  let dialog = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const before = snap.exists ? snap.data() || {} : {};
    const participantIds = context.type === 'direct'
      ? uniqueSafeIds([actor.userId, context.targetUserId || context.objectId, ...(before.participantIds || [])])
      : dialogParticipants(actor, context, before.participantIds || []);
    dialog = {
      id: dialogId,
      type: context.type,
      objectId: context.objectId,
      userId: before.userId || actor.userId,
      context,
      participantIds,
      ownerUserIds: uniqueSafeIds(context.ownerUserIds || []),
      unreadBy: before.unreadBy || {},
      typing: before.typing || {},
      lastMessage: before.lastMessage || null,
      lastMessageAt: before.lastMessageAt || null,
      createdAt: before.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, dialog, { merge: true });
  });
  await mirrorDialog(db, dialog);
  await audit(db, req, actor, 'dialog:open', 'contextDialog', dialogId, 'success', { type: context.type, objectId: context.objectId });
  return { ok: true, dialogId, type: context.type, objectId: context.objectId };
}

async function getDialogForActor(db, dialogId, actor) {
  const ref = db.collection('contextDialogs').doc(dialogId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Диалог не найден.'), { statusCode: 404, code: 'DIALOG_NOT_FOUND' });
  const dialog = { id: snap.id, ...(snap.data() || {}) };
  const storedParticipants = uniqueSafeIds(dialog.participantIds || []);
  const ownerIds = uniqueSafeIds(dialog.ownerUserIds || dialog.context?.ownerUserIds || []);
  const allowed = storedParticipants.includes(actor.userId) || storedParticipants.includes(actor.uid) || ownerIds.includes(actor.userId) || hasRole(actor.user || {}, ROLES.owner) || hasRole(actor.user || {}, ROLES.admin);
  if (!allowed) {
    throw Object.assign(new Error('Нет доступа к диалогу.'), { statusCode: 403, code: 'DIALOG_FORBIDDEN' });
  }
  const participantIds = dialogParticipants(actor, dialog.context || {}, storedParticipants);
  return { ref, dialog, participantIds };
}

async function actionDialogMessage(db, req, actor) {
  const dialogId = safeString(req.body?.dialogId, 260);
  const text = safeString(req.body?.text, MAX_DIALOG_TEXT);
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 8).map(item => ({
    type: safeString(item?.type || 'image', 40),
    url: safeString(item?.url, 1200),
    name: safeString(item?.name, 180),
  })).filter(item => item.url) : [];
  if (!dialogId) throw Object.assign(new Error('Не указан диалог.'), { statusCode: 400 });
  if (!text && !attachments.length) throw Object.assign(new Error('Сообщение пустое.'), { statusCode: 400 });
  const { ref, dialog, participantIds } = await getDialogForActor(db, dialogId, actor);
  await assertCanWriteDirectDialog(db, dialog, actor);
  const senderRole = req.body?.senderRole === 'loki' ? 'loki' : (dialog.ownerUserIds || []).includes(actor.userId) ? 'owner' : 'user';
  const senderId = senderRole === 'loki' ? 'loki' : actor.userId;
  const messageRef = ref.collection('messages').doc();
  const message = {
    id: messageRef.id,
    dialogId,
    type: dialog.type,
    objectId: dialog.objectId,
    context: dialog.context,
    text,
    attachments,
    senderId,
    actorUserId: actor.userId,
    senderName: actorName(actor),
    senderRole,
    status: 'delivered',
    readBy: senderRole === 'loki' ? { loki: true } : { [actor.userId]: true },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const unreadBy = { ...(dialog.unreadBy || {}) };
  const notificationRecipientIds = senderRole === 'loki'
    ? uniqueSafeIds([dialog.userId, actor.userId]).filter(id => participantIds.includes(id))
    : participantIds.filter(id => id !== actor.userId);
  participantIds.forEach(id => {
    if (senderRole !== 'loki' && id === actor.userId) unreadBy[id] = 0;
    else if (notificationRecipientIds.includes(id)) unreadBy[id] = Number(unreadBy[id] || 0) + 1;
  });
  const lastMessage = { id: message.id, text, senderId, senderName: message.senderName, senderRole, createdAt: FieldValue.serverTimestamp() };
  const typing = { ...(dialog.typing || {}), [actor.userId]: false };
  const preview = text || (attachments.length ? 'Новое вложение' : 'Новое сообщение');
  const targets = await Promise.all(notificationRecipientIds.map(id => getDialogRecipientState(db, id, dialogId, actor.userId)));
  const preparedNotifications = (await Promise.all(targets.map(target => prepareDialogNotification(db, target, { ...dialog, id: dialogId }, message, preview)))).filter(Boolean);
  const batch = db.batch();
  batch.set(messageRef, message, { merge: true });
  batch.set(ref, { participantIds, lastMessage, lastMessageAt: FieldValue.serverTimestamp(), unreadBy, typing, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  participantIds.forEach(participantId => {
    batch.set(db.collection('users').doc(participantId).collection('contextDialogMessages').doc(message.id), message, { merge: true });
    batch.set(db.collection('users').doc(participantId).collection('contextDialogs').doc(dialogId), dialogMirrorPayload({ ...dialog, id: dialogId, participantIds, unreadBy, lastMessage, lastMessageAt: FieldValue.serverTimestamp(), typing }, participantId), { merge: true });
  });
  preparedNotifications.forEach(item => batch.set(item.ref, item.data, { merge: true }));
  await batch.commit();
  const pushTargets = preparedNotifications.filter(item => item.shouldPush);
  req.log?.info?.({ dialogPush: {
    stage: 'prepared',
    dialogId,
    recipients: notificationRecipientIds.length,
    notificationsCreated: preparedNotifications.length,
    pushTargets: pushTargets.length,
    skipReasons: targets.filter(t => t.reason).map(t => t.reason),
  } }, 'dialog message notifications prepared');
  await Promise.all(pushTargets.map(async target => {
    try {
      const stats = await sendDialogPush(db, target.userId, target.id, target.title, target.body, dialogId);
      req.log?.info?.({ dialogPush: {
        stage: 'push_result',
        dialogId,
        notificationId: target.id,
        sent: stats.sent ?? 0,
        failed: stats.failed ?? 0,
        subscribers: stats.subscribers ?? 0,
        skipped: stats.skipped === true,
        reason: stats.reason || null,
        errorCodes: (stats.errors || []).map(e => e.code),
      } }, 'dialog push result');
    } catch (error) {
      req.log?.warn?.({ dialogPush: { stage: 'push_error', dialogId, notificationId: target.id, message: safeString(error?.message, 200) } }, 'dialog push failed');
      await db.collection('notifications').doc(target.id).set({
        pushStatus: 'error',
        pushError: safeString(error?.message, 200),
        pushSentAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
  }));
  await audit(db, req, actor, 'dialog:message', 'contextDialog', dialogId, 'success', { senderRole, type: dialog.type, objectId: dialog.objectId });
  return { ok: true, dialogId, messageId: message.id, senderRole };
}

async function actionDialogRead(db, req, actor) {
  const dialogId = safeString(req.body?.dialogId, 260);
  const { ref, dialog, participantIds } = await getDialogForActor(db, dialogId, actor);
  const unreadBy = { ...(dialog.unreadBy || {}), [actor.userId]: 0 };
  const notificationId = `dialog_${safeDialogIdPart(actor.userId)}_${safeDialogIdPart(dialogId)}`.slice(0, 900);
  const notificationRef = db.collection('notifications').doc(notificationId);
  const notificationSnap = await notificationRef.get().catch(() => null);
  const batch = db.batch();
  batch.set(ref, { unreadBy, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.collection('users').doc(actor.userId), {
    activeContextDialogId: dialogId,
    activeContextDialogSeenAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  if (notificationSnap?.exists) batch.set(notificationRef, { isRead: true, readAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await mirrorDialog(db, { ...dialog, id: dialogId, participantIds, unreadBy });
  return { ok: true, dialogId };
}

async function getSocialRequest(db, requestId = '') {
  const id = safeString(requestId, 260);
  if (!id) return null;
  const snap = await db.collection('conversationRequests').doc(id).get().catch(() => null);
  if (!snap?.exists) return null;
  const data = { id: snap.id, ...(snap.data() || {}) };
  data.status = normalizeSocialRequestStatus(data.status, Date.now(), data.expiresAt);
  return data;
}

async function querySocialRequestsForUser(db, userId = '') {
  const uid = cleanSocialId(userId);
  if (!uid) return [];
  const snap = await db.collection('conversationRequests').where('participants', 'array-contains', uid).limit(100).get();
  return snap.docs.map(doc => {
    const data = { id: doc.id, ...doc.data() };
    return { ...data, status: normalizeSocialRequestStatus(data.status, Date.now(), data.expiresAt) };
  }).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function actionSocialListRequests(db, req, actor) {
  const requests = await querySocialRequestsForUser(db, actor.userId);
  const blockedSnap = await db.collection('users').doc(actor.userId).collection('blockedUsers').limit(100).get().catch(() => null);
  const blocked = blockedSnap?.docs?.map(doc => ({ id: doc.id, ...doc.data() })) || [];
  return {
    ok: true,
    requests: requests.map(item => socialRequestMirror(item, actor.userId)),
    blocked,
    privacy: normalizeSocialPrivacy(actor.user?.messagingPrivacy || actor.user?.socialMessagingPrivacy),
  };
}

async function actionSocialCheckEligibility(db, req, actor) {
  const recipientId = cleanSocialId(req.body?.recipientId || req.body?.targetUserId);
  const result = await evaluateServerSocialEligibility(db, actor, recipientId);
  return { ok: true, eligible: result.ok, reason: result.reason, dialogId: result.dialogId || '', privacy: result.privacy || SOCIAL_PRIVACY.ALLOWED_CONNECTIONS };
}

async function actionSocialRequest(db, req, actor) {
  const senderId = cleanSocialId(actor.userId);
  const recipientId = cleanSocialId(req.body?.recipientId || req.body?.targetUserId);
  if (!recipientId || senderId === recipientId) throw Object.assign(new Error('Некорректный получатель.'), { statusCode: 400, code: 'INVALID_RECIPIENT' });
  const eligibility = await evaluateServerSocialEligibility(db, actor, recipientId);
  if (!eligibility.recipient) throw Object.assign(new Error('Получатель не найден.'), { statusCode: 404, code: 'RECIPIENT_NOT_FOUND' });
  if (eligibility.reason === 'blocked') {
    await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_BLOCKED, 'users', recipientId, 'blocked', { reason: 'blocked' });
    throw Object.assign(new Error('Запрос недоступен.'), { statusCode: 403, code: 'SOCIAL_BLOCKED' });
  }
  if (eligibility.reason === 'privacy') throw Object.assign(new Error('Запрос недоступен.'), { statusCode: 403, code: 'SOCIAL_PRIVACY_DENIED' });
  if (eligibility.ok) return { ok: true, eligible: true, reason: eligibility.reason, dialogId: eligibility.dialogId || '' };

  const requestId = socialRequestId(senderId, recipientId);
  const ref = db.collection('conversationRequests').doc(requestId);
  const recent = await db.collection('conversationRequests').where('senderId', '==', senderId).limit(50).get().catch(() => null);
  const recentRequests = recent?.docs?.map(doc => doc.data() || {}) || [];
  const recentCount = recentRequests.filter(item => isRecentSocialRequest(item)).length;
  if (recentCount >= SOCIAL_REQUEST_LIMIT) {
    await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_RATE_LIMITED, 'users', recipientId, 'blocked', { window: '24h', limit: SOCIAL_REQUEST_LIMIT });
    throw Object.assign(new Error('Лимит запросов на сегодня исчерпан.'), { statusCode: 429, code: 'SOCIAL_RATE_LIMITED' });
  }
  const existing = await ref.get();
  if (existing.exists) {
    const data = { id: existing.id, ...(existing.data() || {}) };
    const status = normalizeSocialRequestStatus(data.status, Date.now(), data.expiresAt);
    if (status === SOCIAL_REQUEST_STATUS.PENDING) return { ok: true, request: socialRequestMirror({ ...data, status }, senderId), status };
    if (isDeclineCooldownActive({ ...data, status })) throw Object.assign(new Error('Повторный запрос пока недоступен.'), { statusCode: 429, code: 'SOCIAL_DECLINE_COOLDOWN' });
  }
  const record = createSocialRequestRecord({
    senderId,
    recipientId,
    sender: eligibility.sender?.data || actor.user || {},
    recipient: eligibility.recipient.data,
    relationshipReason: 'manual_permission',
    now: Date.now(),
  });
  await ref.set({ ...record, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }, { merge: true });
  const saved = { ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mirrorSocialRequest(db, saved);
  await writeSocialNotification(db, recipientId, {
    type: 'socialMessageRequest',
    title: `${actorName(actor)} хочет начать с вами общение`,
    body: 'Откройте профиль, чтобы принять или отклонить запрос.',
    requestId,
  }).catch(() => {});
  await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_CREATED, 'conversationRequests', requestId, 'success', { recipientId, relationshipReason: 'manual_permission' });
  return { ok: true, request: socialRequestMirror(saved, senderId), status: SOCIAL_REQUEST_STATUS.PENDING };
}

async function actionSocialResolveRequest(db, req, actor, status) {
  const requestId = safeString(req.body?.requestId, 260);
  const request = await getSocialRequest(db, requestId);
  if (!request) throw Object.assign(new Error('Запрос не найден.'), { statusCode: 404, code: 'REQUEST_NOT_FOUND' });
  if (status === SOCIAL_REQUEST_STATUS.CANCELLED && request.senderId !== actor.userId) throw Object.assign(new Error('Нельзя отменить чужой запрос.'), { statusCode: 403, code: 'REQUEST_FORBIDDEN' });
  if ([SOCIAL_REQUEST_STATUS.ACCEPTED, SOCIAL_REQUEST_STATUS.DECLINED].includes(status) && request.recipientId !== actor.userId) throw Object.assign(new Error('Нельзя отвечать на чужой запрос.'), { statusCode: 403, code: 'REQUEST_FORBIDDEN' });
  if (request.status === status && status !== SOCIAL_REQUEST_STATUS.ACCEPTED) return { ok: true, request: socialRequestMirror(request, actor.userId), status, dialogId: request.dialogId || '' };
  if (request.status !== SOCIAL_REQUEST_STATUS.PENDING && !(request.status === SOCIAL_REQUEST_STATUS.ACCEPTED && status === SOCIAL_REQUEST_STATUS.ACCEPTED)) {
    throw Object.assign(new Error('Запрос уже обработан.'), { statusCode: 409, code: 'REQUEST_ALREADY_RESOLVED' });
  }
  if (await hasSocialBlock(db, request.senderId, request.recipientId)) throw Object.assign(new Error('Действие недоступно из-за блокировки.'), { statusCode: 403, code: 'SOCIAL_BLOCKED' });
  let dialogId = request.dialogId || '';
  if (status === SOCIAL_REQUEST_STATUS.ACCEPTED) {
    const linked = await ensureDirectDialogForPair(db, { ...actor, userId: request.senderId, user: request.sender || {} }, request.recipientId, request);
    dialogId = linked.dialogId;
  }
  const patch = {
    status,
    dialogId,
    resolvedBy: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
    acceptedAt: status === SOCIAL_REQUEST_STATUS.ACCEPTED ? FieldValue.serverTimestamp() : request.acceptedAt || null,
    declinedAt: status === SOCIAL_REQUEST_STATUS.DECLINED ? FieldValue.serverTimestamp() : request.declinedAt || null,
    cancelledAt: status === SOCIAL_REQUEST_STATUS.CANCELLED ? FieldValue.serverTimestamp() : request.cancelledAt || null,
  };
  if (request.connection === true) {
    patch.connectionStatus = status === SOCIAL_REQUEST_STATUS.ACCEPTED
      ? CONNECTION_STATUS.CONNECTED
      : status === SOCIAL_REQUEST_STATUS.DECLINED || status === SOCIAL_REQUEST_STATUS.CANCELLED
        ? CONNECTION_STATUS.DECLINED
        : normalizeConnectionStatus(request.connectionStatus);
    patch.connectedAt = status === SOCIAL_REQUEST_STATUS.ACCEPTED ? FieldValue.serverTimestamp() : request.connectedAt || null;
    patch.history = [
      ...(Array.isArray(request.history) ? request.history.slice(-10) : []),
      connectionHistoryEntry(status === SOCIAL_REQUEST_STATUS.ACCEPTED ? 'connected' : status, actor.userId, {
        source: request.connectionSource,
        sourceLabel: request.connectionSourceLabel,
        sourceId: request.connectionSourceId,
        sourceTitle: request.connectionSourceTitle,
        sourceDate: request.connectionSourceDate,
      }),
    ];
  }
  await db.collection('conversationRequests').doc(request.id).set(patch, { merge: true });
  const mirrored = {
    ...request,
    ...patch,
    updatedAt: new Date().toISOString(),
    acceptedAt: status === SOCIAL_REQUEST_STATUS.ACCEPTED ? new Date().toISOString() : request.acceptedAt || null,
    declinedAt: status === SOCIAL_REQUEST_STATUS.DECLINED ? new Date().toISOString() : request.declinedAt || null,
    cancelledAt: status === SOCIAL_REQUEST_STATUS.CANCELLED ? new Date().toISOString() : request.cancelledAt || null,
    connectedAt: status === SOCIAL_REQUEST_STATUS.ACCEPTED && request.connection === true ? new Date().toISOString() : request.connectedAt || null,
  };
  await mirrorSocialRequest(db, mirrored);
  if (status === SOCIAL_REQUEST_STATUS.ACCEPTED && request.connection === true) await mirrorConnection(db, mirrored);
  if (status === SOCIAL_REQUEST_STATUS.ACCEPTED) {
    await writeSocialNotification(db, request.senderId, {
      type: request.connection === true ? 'connectionAccepted' : 'socialMessageRequestAccepted',
      title: request.connection === true ? 'Знакомство подтверждено' : 'Запрос на общение принят',
      body: request.connection === true ? 'Контакт добавлен, можно перейти к переписке.' : 'Можно перейти к переписке.',
      requestId: request.id,
      dialogId,
    }).catch(() => {});
    await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_ACCEPTED, 'conversationRequests', request.id, 'success', { dialogId });
    await audit(db, req, actor, SOCIAL_EVENTS.DIALOG_LINKED, 'contextDialog', dialogId, 'success', { requestId: request.id });
  } else if (status === SOCIAL_REQUEST_STATUS.DECLINED) {
    await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_DECLINED, 'conversationRequests', request.id, 'success', {});
  }
  return { ok: true, request: socialRequestMirror(mirrored, actor.userId), status, dialogId };
}

async function actionSocialBlock(db, req, actor, block = true) {
  const targetId = cleanSocialId(req.body?.targetUserId || req.body?.recipientId || req.body?.userId);
  if (!targetId || targetId === actor.userId) throw Object.assign(new Error('Некорректный пользователь.'), { statusCode: 400, code: 'INVALID_TARGET' });
  const ref = db.collection('users').doc(actor.userId).collection('blockedUsers').doc(targetId);
  if (block) {
    await Promise.all([
      ref.set({ id: targetId, blockedUserId: targetId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      db.collection('users').doc(actor.userId).set({ blockedUserIds: FieldValue.arrayUnion(targetId), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    await audit(db, req, actor, SOCIAL_EVENTS.REQUEST_BLOCKED, 'users', targetId, 'success', {});
  } else {
    await Promise.all([
      ref.delete().catch(() => {}),
      db.collection('users').doc(actor.userId).set({ blockedUserIds: FieldValue.arrayRemove(targetId), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);
  }
  return { ok: true, blocked: block, targetUserId: targetId };
}

async function actionSocialUpdatePrivacy(db, req, actor) {
  const privacy = normalizeSocialPrivacy(req.body?.privacy || req.body?.messagingPrivacy);
  await db.collection('users').doc(actor.userId).set({ messagingPrivacy: privacy, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(db, req, actor, 'socialMessaging:updatePrivacy', 'users', actor.userId, 'success', { privacy });
  return { ok: true, privacy };
}

async function actionConnectionsCheck(db, req, actor) {
  const targetUserId = cleanSocialId(req.body?.targetUserId || req.body?.recipientId || req.body?.userId);
  const result = await evaluateServerSocialEligibility(db, actor, targetUserId);
  const request = targetUserId ? await getSocialRequest(db, socialRequestId(actor.userId, targetUserId)) : null;
  const target = result.recipient || await getSocialUser(db, targetUserId);
  const shared = buildConnectionSharedContext(actor.user || {}, target?.data || {});
  const connectionStatus = request?.connection === true
    ? normalizeConnectionStatus(request.connectionStatus || request.status)
    : result.ok && result.reason === 'existing_conversation'
      ? CONNECTION_STATUS.CONNECTED
      : CONNECTION_STATUS.PENDING;
  return {
    ok: true,
    eligible: result.ok,
    reason: result.reason,
    dialogId: result.dialogId || request?.dialogId || '',
    status: connectionStatus,
    request: request ? socialRequestMirror(request, actor.userId) : null,
    target: target ? socialPublicUser(target.data, target.id) : null,
    shared,
    action: connectionStatus === CONNECTION_STATUS.CONNECTED || result.ok ? 'message' : request?.status === SOCIAL_REQUEST_STATUS.PENDING ? 'pending' : 'request',
    connectionContext: {
      source: request?.connectionSource || '',
      sourceLabel: request?.connectionSourceLabel || '',
      shared,
    },
  };
}

async function actionConnectionsList(db, req, actor) {
  const [contactsSnap, requests] = await Promise.all([
    db.collection('users').doc(actor.userId).collection('connections').limit(100).get().catch(() => null),
    querySocialRequestsForUser(db, actor.userId).catch(() => []),
  ]);
  const contacts = (contactsSnap?.docs || [])
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => normalizeConnectionStatus(item.status) === CONNECTION_STATUS.CONNECTED)
    .sort((a, b) => new Date(b.connectedAt || b.updatedAt || 0).getTime() - new Date(a.connectedAt || a.updatedAt || 0).getTime());
  const connectionRequests = requests
    .filter(item => item.connection === true)
    .map(item => socialRequestMirror(item, actor.userId));
  return {
    ok: true,
    contacts,
    requests: connectionRequests,
    count: contacts.length,
    lastConnections: contacts.slice(0, 5),
    connectionContext: {
      contactCount: contacts.length,
      pendingIncoming: connectionRequests.filter(item => item.direction === 'incoming' && item.status === SOCIAL_REQUEST_STATUS.PENDING).length,
      pendingOutgoing: connectionRequests.filter(item => item.direction === 'outgoing' && item.status === SOCIAL_REQUEST_STATUS.PENDING).length,
    },
  };
}

async function actionConnectionsRequest(db, req, actor) {
  const senderId = cleanSocialId(actor.userId);
  const recipientId = cleanSocialId(req.body?.recipientId || req.body?.targetUserId || req.body?.userId);
  if (!recipientId || senderId === recipientId) throw Object.assign(new Error('Некорректный получатель.'), { statusCode: 400, code: 'INVALID_RECIPIENT' });
  const eligibility = await evaluateServerSocialEligibility(db, actor, recipientId);
  if (!eligibility.recipient) throw Object.assign(new Error('Получатель не найден.'), { statusCode: 404, code: 'RECIPIENT_NOT_FOUND' });
  if (eligibility.reason === 'blocked') throw Object.assign(new Error('Знакомство недоступно.'), { statusCode: 403, code: 'CONNECTION_BLOCKED' });
  if (eligibility.reason === 'privacy') throw Object.assign(new Error('Пользователь ограничил новые знакомства.'), { statusCode: 403, code: 'CONNECTION_PRIVACY_DENIED' });
  if (eligibility.ok) {
    return {
      ok: true,
      eligible: true,
      reason: eligibility.reason,
      status: CONNECTION_STATUS.CONNECTED,
      dialogId: eligibility.dialogId || '',
      target: socialPublicUser(eligibility.recipient.data, recipientId),
    };
  }

  const requestId = socialRequestId(senderId, recipientId);
  const ref = db.collection('conversationRequests').doc(requestId);
  const recent = await db.collection('conversationRequests').where('senderId', '==', senderId).limit(50).get().catch(() => null);
  const recentCount = (recent?.docs?.map(doc => doc.data() || {}) || []).filter(item => isRecentSocialRequest(item)).length;
  if (recentCount >= SOCIAL_REQUEST_LIMIT) throw Object.assign(new Error('Лимит запросов на сегодня исчерпан.'), { statusCode: 429, code: 'CONNECTION_RATE_LIMITED' });
  const existing = await ref.get();
  if (existing.exists) {
    const data = { id: existing.id, ...(existing.data() || {}) };
    const status = normalizeSocialRequestStatus(data.status, Date.now(), data.expiresAt);
    if (status === SOCIAL_REQUEST_STATUS.PENDING) return { ok: true, status: CONNECTION_STATUS.PENDING, request: socialRequestMirror({ ...data, status, connection: true }, senderId) };
    if (status === SOCIAL_REQUEST_STATUS.ACCEPTED) return { ok: true, status: CONNECTION_STATUS.CONNECTED, dialogId: data.dialogId || '', request: socialRequestMirror({ ...data, status }, senderId) };
    if (isDeclineCooldownActive({ ...data, status })) throw Object.assign(new Error('Повторное знакомство пока недоступно.'), { statusCode: 429, code: 'CONNECTION_DECLINE_COOLDOWN' });
  }

  const context = connectionSourceFromRequest(req);
  const shared = buildConnectionSharedContext(eligibility.sender?.data || actor.user || {}, eligibility.recipient.data);
  const record = {
    ...createSocialRequestRecord({
      senderId,
      recipientId,
      sender: eligibility.sender?.data || actor.user || {},
      recipient: eligibility.recipient.data,
      relationshipReason: 'digital_handshake',
      now: Date.now(),
    }),
    connection: true,
    connectionStatus: CONNECTION_STATUS.PENDING,
    connectionSource: context.source,
    connectionSourceLabel: context.sourceLabel,
    connectionSourceId: context.sourceId,
    connectionSourceTitle: context.sourceTitle,
    connectionSourceDate: context.sourceDate,
    shared,
    history: [connectionHistoryEntry('requested', senderId, context)],
  };
  await ref.set({ ...record, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }, { merge: true });
  const saved = { ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mirrorSocialRequest(db, saved);
  await writeSocialNotification(db, recipientId, {
    type: 'connectionRequest',
    title: `${actorName(actor)} хочет познакомиться`,
    body: context.sourceTitle ? `Источник: ${context.sourceTitle}` : 'Откройте профиль, чтобы принять или отклонить знакомство.',
    requestId,
  }).catch(() => {});
  await audit(db, req, actor, 'connections:request', 'conversationRequests', requestId, 'success', { recipientId, source: context.source });
  return { ok: true, status: CONNECTION_STATUS.PENDING, request: socialRequestMirror(saved, senderId), connection: connectionSnapshot(saved, senderId) };
}

async function actionConnectionsResolve(db, req, actor, status) {
  const result = await actionSocialResolveRequest(db, req, actor, status);
  const request = result.request || null;
  return {
    ...result,
    connectionStatus: status === SOCIAL_REQUEST_STATUS.ACCEPTED ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.DECLINED,
    connection: request ? connectionSnapshot(request, actor.userId) : null,
  };
}

async function actionConnectionsBlock(db, req, actor) {
  const result = await actionSocialBlock(db, req, actor, true);
  const targetId = cleanSocialId(req.body?.targetUserId || req.body?.recipientId || req.body?.userId);
  const requestId = socialRequestId(actor.userId, targetId);
  const request = await getSocialRequest(db, requestId);
  if (request) {
    const patch = {
      connection: request.connection === true,
      connectionStatus: CONNECTION_STATUS.BLOCKED,
      status: request.status,
      updatedAt: FieldValue.serverTimestamp(),
      history: [
        ...(Array.isArray(request.history) ? request.history.slice(-10) : []),
        connectionHistoryEntry('blocked', actor.userId, {
          source: request.connectionSource,
          sourceLabel: request.connectionSourceLabel,
          sourceId: request.connectionSourceId,
          sourceTitle: request.connectionSourceTitle,
          sourceDate: request.connectionSourceDate,
        }),
      ],
    };
    await db.collection('conversationRequests').doc(request.id).set(patch, { merge: true });
    await mirrorSocialRequest(db, { ...request, ...patch, updatedAt: new Date().toISOString() });
  }
  return { ...result, connectionStatus: CONNECTION_STATUS.BLOCKED };
}

async function actionDialogTyping(db, req, actor) {
  const dialogId = safeString(req.body?.dialogId, 260);
  const typing = req.body?.typing === true;
  const { ref, dialog, participantIds } = await getDialogForActor(db, dialogId, actor);
  const nextTyping = { ...(dialog.typing || {}), [actor.userId]: typing };
  await ref.set({ typing: nextTyping, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await mirrorDialog(db, { ...dialog, id: dialogId, participantIds, typing: nextTyping });
  return { ok: true, dialogId, typing };
}

async function actionDialogAiAssist(db, req, actor) {
  const enabled = req.body?.enabled === true;
  await db.collection('users').doc(actor.userId).set({ contextDialogAiAssist: enabled, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, enabled };
}

async function actionDialogWorkspaceUpdate(db, req, actor) {
  const dialogId = safeString(req.body?.dialogId, 260);
  const { dialog } = await getDialogForActor(db, dialogId, actor);
  const ownerIds = uniqueSafeIds(dialog.ownerUserIds || dialog.context?.ownerUserIds || []);
  const isWorkspaceOwner = ownerIds.includes(actor.userId) || hasRole(actor.user || {}, ROLES.owner) || hasRole(actor.user || {}, ROLES.admin);
  if (!isWorkspaceOwner) {
    throw Object.assign(new Error('Нет доступа к рабочим заметкам диалога.'), { statusCode: 403, code: 'DIALOG_WORKSPACE_FORBIDDEN' });
  }
  const patch = req.body?.patch && typeof req.body.patch === 'object' ? req.body.patch : {};
  const privatePatch = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.userId,
  };
  const responsePatch = { updatedBy: actor.userId };
  if (Object.hasOwn(patch, 'notes')) privatePatch.notes = sanitizeDialogWorkspaceNotes(patch.notes);
  if (Object.hasOwn(patch, 'pinned')) privatePatch.pinned = patch.pinned === true;
  if (Object.hasOwn(patch, 'archived')) privatePatch.archived = patch.archived === true;
  if (Object.hasOwn(patch, 'status')) privatePatch.status = safeString(patch.status, 80);
  if (Object.hasOwn(patch, 'notes')) responsePatch.notes = privatePatch.notes;
  if (Object.hasOwn(patch, 'pinned')) responsePatch.pinned = privatePatch.pinned;
  if (Object.hasOwn(patch, 'archived')) responsePatch.archived = privatePatch.archived;
  if (Object.hasOwn(patch, 'status')) responsePatch.status = privatePatch.status;
  const mirrorRef = db.collection('users').doc(actor.userId).collection('contextDialogs').doc(dialogId);
  await mirrorRef.set({
    ...dialogMirrorPayload(dialog, actor.userId),
    workspacePrivate: privatePatch,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'dialog:workspaceUpdate', 'contextDialog', dialogId, 'success', {
    pinned: privatePatch.pinned === true,
    archived: privatePatch.archived === true,
    hasNotes: Boolean(privatePatch.notes),
  });
  return {
    ok: true,
    dialogId,
    workspacePrivate: responsePatch,
  };
}

async function actionPushRegister(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const deviceId = safeString(req.body?.deviceId, 120);
  const subscription = sanitizeWebPushSubscription(req.body?.subscription || {});
  if (!deviceId || !subscription) throw Object.assign(new Error('Не удалось зарегистрировать push-устройство.'), { statusCode: 400, code: 'BAD_PUSH_DEVICE' });
  const userRef = db.collection('users').doc(userId);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() || {} : {};
  const subscriptions = mergePushSubscriptions(user.webPushSubscriptions || [], subscription);
  const devices = user.pushDevices && typeof user.pushDevices === 'object' ? user.pushDevices : {};
  const endpoint = pushEndpointInfo(subscription);
  const device = {
    ...(devices[deviceId] || {}),
    ...safePushDiagnostics(req.body?.diagnostics || {}),
    deviceId,
    subscriptionEndpointHost: endpoint.host,
    subscriptionEndpointLength: endpoint.length,
    subscriptionActive: true,
    lastRegistrationAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const pushDevices = { ...devices, [deviceId]: device };
  const sortedDeviceIds = Object.keys(pushDevices).sort((a, b) => String(pushDevices[b]?.updatedAt || '').localeCompare(String(pushDevices[a]?.updatedAt || ''))).slice(0, 10);
  const trimmedDevices = Object.fromEntries(sortedDeviceIds.map(id => [id, pushDevices[id]]));
  const notificationPreferences = {
    ...(user.notificationPreferences || {}),
    messages: user.notificationPreferences?.messages !== false,
  };
  await userRef.set({
    webPushSubscriptions: subscriptions,
    pushDevices: trimmedDevices,
    lastPushRegistration: { deviceId, at: FieldValue.serverTimestamp(), endpointHost: endpoint.host },
    notificationProvider: 'webpush',
    notificationsEnabled: true,
    notificationConsent: true,
    notificationPreferences,
    webPushUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'push:register', 'users', userId, 'success', { deviceId, endpointHost: endpoint.host, subscriptionCount: subscriptions.length });
  return { ok: true, userId, deviceId, device, subscriptionCount: subscriptions.length, webPushSubscriptions: subscriptions.map(item => pushEndpointInfo(item)) };
}

async function actionPushCleanupSubscriptions(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const deviceId = safeString(req.body?.deviceId, 120);
  const subscription = sanitizeWebPushSubscription(req.body?.subscription || {});
  const userRef = db.collection('users').doc(userId);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() || {} : {};
  const before = Array.isArray(user.webPushSubscriptions) ? user.webPushSubscriptions.length : 0;
  const subscriptions = subscription ? [subscription] : [];
  const devices = user.pushDevices && typeof user.pushDevices === 'object' ? user.pushDevices : {};
  const nextDevices = deviceId && devices[deviceId]
    ? { [deviceId]: { ...devices[deviceId], subscriptionActive: Boolean(subscription), cleanupAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
    : {};
  await userRef.set({
    webPushSubscriptions: subscriptions,
    pushDevices: nextDevices,
    webPushUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'push:cleanupSubscriptions', 'users', userId, 'success', { deviceId, before, after: subscriptions.length });
  return { ok: true, userId, deviceId, keptSubscriptions: subscriptions.length, removedSubscriptions: Math.max(before - subscriptions.length, 0) };
}

async function actionPushTestDevice(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const deviceId = safeString(req.body?.deviceId, 120);
  const subscription = sanitizeWebPushSubscription(req.body?.subscription || {});
  if (!deviceId || !subscription) throw Object.assign(new Error('На этом устройстве нет Web Push подписки.'), { statusCode: 400, code: 'NO_DEVICE_SUBSCRIPTION' });
  const userRef = db.collection('users').doc(userId);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() || {} : {};
  const isRegistered = (user.webPushSubscriptions || []).some(item => item?.endpoint === subscription.endpoint);
  if (!isRegistered) throw Object.assign(new Error('Текущая подписка не сохранена в профиле. Сначала перерегистрируйте устройство.'), { statusCode: 400, code: 'SUBSCRIPTION_NOT_REGISTERED' });
  let sent = 0;
  let failed = 0;
  let reason = '';
  let errorCode = '';
  if (!initDialogWebPush()) {
    reason = 'WEB_PUSH_VAPID_ENV_MISSING';
    failed = 1;
  } else {
    try {
      await withDialogPushTimeout(webpush.sendNotification(subscription, JSON.stringify({
        notification: {
          title: '🧪 APG Push Diagnostics',
          body: 'Тестовый push на это устройство.',
          icon: `${APP_URL}/192.png`,
          badge: `${APP_URL}/32.png`,
          tag: `push-diagnostics-${deviceId}`,
          renotify: true,
        },
        data: {
          title: 'APG Push Diagnostics',
          body: 'Тестовый push на это устройство.',
          url: `${APP_URL}/health`,
          tag: `push-diagnostics-${deviceId}`,
          category: 'messages',
          type: 'pushDiagnostics',
          priority: 'normal',
        },
      }), { TTL: 300, urgency: 'high' }));
      sent = 1;
    } catch (e) {
      failed = 1;
      errorCode = e.code === 'push/timeout' ? 'webpush/timeout' : e.statusCode ? `webpush/${e.statusCode}` : 'webpush/error';
      reason = safeString(e?.body || e?.message || errorCode, 240);
    }
  }
  const devices = user.pushDevices && typeof user.pushDevices === 'object' ? user.pushDevices : {};
  const current = devices[deviceId] || { deviceId };
  await userRef.set({
    pushDevices: {
      ...devices,
      [deviceId]: {
        ...current,
        lastPushStatus: sent ? 'sent' : 'failed',
        lastSuccessfulPushAt: sent ? new Date().toISOString() : current.lastSuccessfulPushAt || null,
        lastPushError: failed ? { code: errorCode || reason, at: new Date().toISOString() } : null,
        updatedAt: new Date().toISOString(),
      },
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, actor, 'push:testDevice', 'users', userId, sent ? 'success' : 'error', { deviceId, sent, failed, errorCode });
  return { ok: sent === 1, userId, deviceId, sent, failed, reason, errorCode };
}

async function routeAction(db, req, actor) {
  const action = safeString(req.body?.action, 80);
  if (action === 'auth:linkUser') return actionAuthLink(db, req, actor);
  if (action === 'identity:diagnostics') return actionIdentityDiagnostics(db, req, actor);
  if (action === 'profile:sync') return actionProfileSync(db, req, actor);
  if (action === 'profile:update') return actionProfilePatch(db, req, actor);
  if (action === 'profile:acceptConsent') return actionProfileAcceptConsent(db, req, actor);
  if (action === 'profile:consentStatus') return actionProfileConsentStatus(db, req, actor);
  if (action === 'profile:forceAcceptConsent') return actionProfileForceAcceptConsent(db, req, actor);
  if (action === 'profile:delete') return actionProfileDelete(db, req, actor);
  if (action === 'push:register') return actionPushRegister(db, req, actor);
  if (action === 'push:cleanupSubscriptions') return actionPushCleanupSubscriptions(db, req, actor);
  if (action === 'push:testDevice') return actionPushTestDevice(db, req, actor);
  if (action === 'favorites:toggle') return actionFavoritesToggle(db, req, actor);
  if (action === 'news:saved') return actionUserListSet(db, req, actor, 'savedNews', action);
  if (action === 'news:readLater') return actionUserListSet(db, req, actor, 'readLaterNews', action);
  if (action === 'news:reaction') return actionNewsReaction(db, req, actor);
  if (action === 'news:subscriptions') return actionNewsSubscriptions(db, req, actor);
  if (action === 'publicQr:view') return actionPublicQrView(db, req, actor);
  if (action === 'task:claim') return actionTaskClaim(db, req, actor);
  if (action === 'prize:claim') return actionPrizeClaim(db, req, actor);
  if (action === 'raffle:enter') return actionRaffleEnter(db, req, actor);
  if (action === 'economy:exchangeTickets') return actionEconomyExchangeTickets(db, req, actor);
  if (action === 'event:toggle') return actionEventToggle(db, req, actor);
  if (action === 'event:propose') return actionEventPropose(db, req, actor);
  if (action === 'workspace:eventCreate') return actionWorkspaceEventCreate(db, req, actor);
  if (action === 'workspace:eventUpdate') return actionWorkspaceEventUpdate(db, req, actor);
  if (action === 'workspace:eventSubmit') return actionWorkspaceEventSubmit(db, req, actor);
  if (action === 'workspace:eventArchive') return actionWorkspaceEventLifecycle(db, req, actor, 'archive');
  if (action === 'workspace:eventDelete') return actionWorkspaceEventLifecycle(db, req, actor, 'delete');
  if (action === 'workspace:eventDuplicate') return actionWorkspaceEventDuplicate(db, req, actor);
  if (action === 'workspaceNews:list') return actionWorkspaceNewsList(db, req, actor);
  if (action === 'workspaceNews:save') return actionWorkspaceNewsSave(db, req, actor);
  if (action === 'workspaceNews:submit') return actionWorkspaceNewsSubmit(db, req, actor);
  if (action === 'workspaceNews:archive') return actionWorkspaceNewsArchive(db, req, actor);
  if (action === 'workspaceNews:fromEvent') return actionWorkspaceNewsFromEvent(db, req, actor);
  if (action === 'workspacePromotion:list') return actionWorkspacePromotionList(db, req, actor);
  if (action === 'workspacePromotion:save') return actionWorkspacePromotionSave(db, req, actor);
  if (action === 'workspacePromotion:submit') return actionWorkspacePromotionSubmit(db, req, actor);
  if (action === 'workspacePromotion:archive') return actionWorkspacePromotionArchive(db, req, actor);
  if (action === 'workspaceGift:list') return actionWorkspaceGiftList(db, req, actor);
  if (action === 'workspaceGift:save') return actionWorkspaceGiftSave(db, req, actor);
  if (action === 'workspaceGift:submit') return actionWorkspaceGiftSubmit(db, req, actor);
  if (action === 'workspaceGift:archive') return actionWorkspaceGiftArchive(db, req, actor);
  if (action === 'workspaceGift:claimStatus') return actionWorkspaceGiftClaimStatus(db, req, actor);
  if (action === 'workspaceAnalytics:snapshot') return actionWorkspaceAnalyticsSnapshot(db, req, actor);
  if (action === 'partner:aiDraft') return actionPartnerAiDraft(db, req, actor);
  if (action === 'review:partner') return actionReviewPartner(db, req, actor);
  if (action === 'review:expert') return actionReviewExpert(db, req, actor);
  if (action === 'partner:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'partner');
  if (action === 'expert:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'expert');
  if (action === 'booking:create') return actionBookingCreate(db, req, actor);
  if (action === 'booking:manualCreate') return actionBookingManualCreate(db, req, actor);
  if (action === 'booking:confirm') return actionBookingLifecycle(db, req, actor, 'confirm');
  if (action === 'booking:cancel') return actionBookingLifecycle(db, req, actor, 'cancel');
  if (action === 'booking:requestReschedule') return actionBookingLifecycle(db, req, actor, 'requestReschedule');
  if (action === 'booking:respondReschedule') return actionBookingLifecycle(db, req, actor, 'respondReschedule');
  if (action === 'booking:complete') return actionBookingLifecycle(db, req, actor, 'complete');
  if (action === 'booking:noShow') return actionBookingLifecycle(db, req, actor, 'noShow');
  if (action === 'booking:workspaceUpdate') return actionBookingWorkspaceUpdate(db, req, actor);
  if (action === 'booking:archive') return actionBookingArchive(db, req, actor);
  if (action === 'booking:list') return actionBookingList(db, req, actor, false);
  if (action === 'booking:calendar') return actionBookingList(db, req, actor, true);
  if (action === 'booking:moment') return actionBookingMoment(db, req, actor);
  if (action === 'loki:settings') return actionLokiSettings(db, req, actor);
  if (action === 'loki:analytics') return actionLokiAnalytics(db, req, actor);
  if (action === 'socialMessaging:request') return actionSocialRequest(db, req, actor);
  if (action === 'socialMessaging:accept') return actionSocialResolveRequest(db, req, actor, SOCIAL_REQUEST_STATUS.ACCEPTED);
  if (action === 'socialMessaging:decline') return actionSocialResolveRequest(db, req, actor, SOCIAL_REQUEST_STATUS.DECLINED);
  if (action === 'socialMessaging:cancel') return actionSocialResolveRequest(db, req, actor, SOCIAL_REQUEST_STATUS.CANCELLED);
  if (action === 'socialMessaging:block') return actionSocialBlock(db, req, actor, true);
  if (action === 'socialMessaging:unblock') return actionSocialBlock(db, req, actor, false);
  if (action === 'socialMessaging:updatePrivacy') return actionSocialUpdatePrivacy(db, req, actor);
  if (action === 'socialMessaging:listRequests') return actionSocialListRequests(db, req, actor);
  if (action === 'socialMessaging:checkEligibility') return actionSocialCheckEligibility(db, req, actor);
  if (action === 'connections:check') return actionConnectionsCheck(db, req, actor);
  if (action === 'connections:list') return actionConnectionsList(db, req, actor);
  if (action === 'connections:request') return actionConnectionsRequest(db, req, actor);
  if (action === 'connections:accept') return actionConnectionsResolve(db, req, actor, SOCIAL_REQUEST_STATUS.ACCEPTED);
  if (action === 'connections:decline') return actionConnectionsResolve(db, req, actor, SOCIAL_REQUEST_STATUS.DECLINED);
  if (action === 'connections:block') return actionConnectionsBlock(db, req, actor);
  if (action === 'dialog:open') return actionDialogOpen(db, req, actor);
  if (action === 'dialog:message') return actionDialogMessage(db, req, actor);
  if (action === 'dialog:read') return actionDialogRead(db, req, actor);
  if (action === 'dialog:typing') return actionDialogTyping(db, req, actor);
  if (action === 'dialog:aiAssist') return actionDialogAiAssist(db, req, actor);
  if (action === 'dialog:workspaceUpdate') return actionDialogWorkspaceUpdate(db, req, actor);
  if (action === 'log:error') return actionLogCreate(db, req, actor, 'errorLogs', 'api.user-actions');
  if (action === 'log:diagnostic') return actionLogCreate(db, req, actor, 'diagnostics', 'api.user-actions');
  if (action === 'guest:session') return actionGuestSession(db, req, actor);
  throw Object.assign(new Error('Неизвестное пользовательское действие.'), { statusCode: 400 });
}

export default async function userActionsRoutes(fastify) {
  fastify.post('/api/user-actions', async (req, reply) => {
    const db = getDb();
    let actor = null;
    try {
      actor = await requireActor(req);
      return await routeAction(db, req, actor);
    } catch (error) {
      if (safeString(req.body?.action, 80) === 'profile:sync') {
        const context = referralContextFromBody(req.body || {}, { referralCode: req.body?.referrerId || '' });
        if (req.body?.referrerId || context.referralFlowId) {
          recordReferralEventAsync(db, {
            ...context,
            referrerId: req.body?.referrerId || context.referralCode,
            referredUserId: req.body?.userId || actor?.userId || '',
            type: REFERRAL_EVENT_TYPES.FAILED,
            status: 'error',
            source: 'profile-sync',
            metadata: { message: String(error?.message || error).slice(0, 500) },
          });
        }
      }
      await audit(db, req, actor, safeString(req.body?.action || 'unknown'), 'unknown', req.body?.id || req.body?.userId || '', 'error', { message: String(error?.message || error).slice(0, 500) });
      return reply.code(error.statusCode || 500).send({ ok: false, code: error.code || 'USER_ACTION_ERROR', error: error.message || 'Не удалось выполнить действие.' });
    }
  });
}
