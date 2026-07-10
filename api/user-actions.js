import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './_firebase-admin.js';

const MAX_TEXT = 4000;

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function safeUserId(value) {
  return safeString(value, 180);
}

function canUseReferral(referrerId, userId) {
  return !!referrerId && referrerId !== userId && !referrerId.startsWith('guest_') && !userId.startsWith('guest_');
}

function jsonError(res, status, message, code = 'USER_ACTION_ERROR') {
  return res.status(status).json({ ok: false, code, error: message });
}

function getBearerToken(req) {
  const direct = String(req.headers['x-firebase-auth'] || req.headers['X-Firebase-Auth'] || req.headers['x-apg-auth'] || req.headers['X-APG-Auth'] || '').trim();
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

async function resolveActor(db, decoded) {
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
  const decoded = await getAdminAuth().verifyIdToken(token);
  return resolveActor(getAdminDb(), decoded);
}

function assertOwn(actor, userId) {
  const target = safeUserId(userId);
  if (!target || target.startsWith('guest_')) throw Object.assign(new Error('Действие доступно только авторизованному пользователю.'), { statusCode: 401 });
  if (actor.userId !== target && actor.uid !== target) throw Object.assign(new Error('Нельзя менять данные другого пользователя.'), { statusCode: 403 });
  return target;
}

function assertOwner(actor) {
  const role = String(actor?.user?.role || actor?.user?.userRole || '').toLowerCase();
  if (role !== 'owner') throw Object.assign(new Error('Действие доступно только Owner.'), { statusCode: 403, code: 'OWNER_REQUIRED' });
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
    userAgent: safeString(req.headers['user-agent'], 300),
    appVersion: safeString(req.headers['x-apg-version'], 80),
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
    source: safeString(req.body?.source || 'user-actions', 80),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await audit(db, req, { ...actor, userId }, 'auth:linkUser', 'auth_map', actor.uid);
  return { ok: true, userId };
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
  const refId = safeUserId(req.body?.referrerId);
  const consent = req.body?.consent || null;
  const ref = db.collection('users').doc(userId);
  let created = false;
  let dailyBonusAwarded = false;
  let referralBonusAwarded = false;
  let userDoc = {};
  let consentStatus = null;

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const isValidRef = canUseReferral(refId, userId);
    if (snap.exists) {
      const before = snap.data() || {};
      const currentReferrer = safeUserId(before.referredBy);
      const canAttachReferral = isValidRef && !currentReferrer && before.referralBonusGranted !== true;
      const canGrantExistingReferral = isValidRef && (canAttachReferral || currentReferrer === refId) && before.referralBonusGranted !== true;
      const referrerRef = canGrantExistingReferral ? db.collection('users').doc(refId) : null;
      const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;
      const patch = { ...profile, lastSeen: FieldValue.serverTimestamp() };
      let keyIncrement = 0;
      consentStatus = getConsentStatus(before);
      const consentMigration = buildConsentMigrationPatch(consentStatus);
      if (consentMigration) Object.assign(patch, consentMigration);
      if (before.lastBonusDate !== todayKey) {
        keyIncrement += 1;
        patch.lastBonusDate = todayKey;
        dailyBonusAwarded = true;
      }
      if (referrerSnap?.exists) {
        referralBonusAwarded = true;
        keyIncrement += canAttachReferral ? 2 : 0;
        patch.referredBy = refId;
        patch.referralBonusGranted = true;
        patch.referralBonusGrantedTo = refId;
        patch.referralBonusGrantedAt = FieldValue.serverTimestamp();
        tx.set(referrerRef, {
          keys: FieldValue.increment(2),
          referralCount: FieldValue.increment(1),
          referralRewardedUsers: FieldValue.arrayUnion(userId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (keyIncrement > 0) patch.keys = FieldValue.increment(keyIncrement);
      tx.set(ref, patch, { merge: true });
      userDoc = {
        ...before,
        ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== null)),
        ...(referralBonusAwarded ? {
          referredBy: refId,
          referralBonusGranted: true,
          referralBonusGrantedTo: refId,
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
      };
      return;
    }

    created = true;
    const referrerRef = isValidRef ? db.collection('users').doc(refId) : null;
    const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;
    const shouldGrantReferral = !!referrerSnap?.exists;
    referralBonusAwarded = shouldGrantReferral;
    const base = {
      keys: shouldGrantReferral ? 2 : 0,
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
      referredBy: shouldGrantReferral ? refId : null,
      referralBonusGranted: shouldGrantReferral,
      referralBonusGrantedTo: shouldGrantReferral ? refId : null,
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
    if (shouldGrantReferral) {
      tx.set(referrerRef, {
        keys: FieldValue.increment(2),
        referralCount: FieldValue.increment(1),
        referralRewardedUsers: FieldValue.arrayUnion(userId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    tx.set(db.collection('stats').doc('global'), { userCount: FieldValue.increment(1) }, { merge: true });
    userDoc = { ...base, keys: base.keys };
  });

  consentStatus = getConsentStatus(userDoc);
  await audit(db, req, actor, created ? 'profile:create' : 'profile:sync', 'users', userId, 'success', { dailyBonusAwarded, referralBonusAwarded, consentRequired: consentStatus.consentRequired, consentReason: consentStatus.reason, consentFormatVersion: consentStatus.formatVersion });
  return { ok: true, userId, created, dailyBonusAwarded, referralBonusAwarded, profileReady: true, consentRequired: consentStatus.consentRequired, consentReason: consentStatus.reason, consentFormatVersion: consentStatus.formatVersion, consentAcceptedAt: consentStatus.acceptedAt || null, user: userDoc };
}

async function actionProfilePatch(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const allowed = new Set(['onboardingDone', 'consents', 'consentAcceptedAt', 'consentDocsVersion', 'consentLegalVersion', 'legalVersion', 'notificationConsent', 'notificationsRequestedAt', 'notificationsEnabled', 'notificationProvider', 'notificationPreferences', 'displayName', 'firstName', 'lastName', 'photo', 'joinedGroup', 'webPushUpdatedAt', 'interestProfile']);
  const patch = {};
  Object.entries(req.body?.patch || {}).forEach(([key, value]) => {
    if (allowed.has(key)) patch[key] = value;
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

function actorOwnsProfile(data, actor) {
  const actorIds = [actor.userId, actor.uid].map(item => safeString(item, 220)).filter(Boolean);
  const actorEmail = safeString(actor.user?.email || actor.user?.linkedEmail, 200).toLowerCase();
  const ownerUserIds = safeStringList(data.ownerUserIds);
  const ownerEmails = safeStringList(data.ownerEmails).map(item => item.toLowerCase());
  return actorIds.some(id => data.ownerId === id || String(data.vkOwnerId || '') === id || ownerUserIds.includes(id))
    || (actorEmail && (
      safeString(data.ownerEmail || data.connectionEmail, 200).toLowerCase() === actorEmail
      || ownerEmails.includes(actorEmail)
    ));
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
    tx.set(userRef, { completedTasks, keys: FieldValue.increment(reward), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'task',
      icon: '✅',
      text: `Задание выполнено: +${reward} ключей`,
      keys: reward,
      taskId,
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
  const cost = ticketCount * Math.max(0, Number(prize.ticketCost || 0));
  if (!prizeId || !cost) throw Object.assign(new Error('Некорректный розыгрыш.'), { statusCode: 400 });
  const userRef = db.collection('users').doc(userId);
  const entryRef = db.collection('raffleEntries').doc(`${prizeId}_${userId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (Number(snap.data()?.keys || 0) < cost) throw Object.assign(new Error('Недостаточно ключей.'), { statusCode: 400 });
    tx.set(userRef, { keys: FieldValue.increment(-cost), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(entryRef, {
      prizeId,
      userId,
      userName: safeString(req.body?.userName || 'Участник АПГ', 200),
      userPhoto: safeString(req.body?.userPhoto, 1000) || null,
      ticketsCount: FieldValue.increment(ticketCount),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef.collection('activity').doc(), {
      type: 'raffle_enter',
      icon: safeString(prize.emoji || '🎟️', 20),
      text: `Участие в розыгрыше: ${safeString(prize.name, 200)} (−${cost} ключей)`,
      ts: FieldValue.serverTimestamp(),
    });
  });
  await audit(db, req, actor, 'raffle:enter', 'prizes', prizeId, 'success', { ticketCount, cost });
  return { ok: true };
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

function cleanEventProposal(input = {}) {
  const title = safeString(input.title, 180);
  const date = safeString(input.date, 40);
  const time = safeString(input.time, 40);
  const place = safeString(input.place || input.location || input.address, 300);
  const description = safeString(input.description, MAX_TEXT);
  if (!title) throw Object.assign(new Error('Укажите название мероприятия.'), { statusCode: 400 });
  if (!date) throw Object.assign(new Error('Укажите дату мероприятия.'), { statusCode: 400 });
  return {
    title,
    date,
    time,
    partner: safeString(input.partner, 220),
    description,
    address: place,
    location: place,
    coverPhoto: safeString(input.coverPhoto || input.imageUrl || input.photo, 1000),
    maxParticipants: Math.max(0, Math.min(5000, Number(input.maxParticipants || 0))),
    pricePublic: safeString(input.price || input.cost, 120),
    priceClub: safeString(input.priceClub, 120),
    linkUrl: safeString(input.linkUrl || input.link, 1000),
    socialUrl: safeString(input.linkUrl || input.link, 1000),
    comment: safeString(input.comment, 1000),
  };
}

async function assertOwnedProfile(db, actor, type, id) {
  const profileId = safeString(id, 180);
  const collection = type === 'expert' ? 'experts' : 'partners';
  if (!profileId) throw Object.assign(new Error('Не указан профиль автора.'), { statusCode: 400 });
  const snap = await db.collection(collection).doc(profileId).get();
  if (!snap.exists) throw Object.assign(new Error('Профиль автора не найден.'), { statusCode: 404 });
  const data = snap.data() || {};
  if (data.archived === true) throw Object.assign(new Error('Архивный профиль не может создавать предложения.'), { statusCode: 403 });
  if (!actorOwnsProfile(data, actor)) throw Object.assign(new Error('Нет доступа к этому профилю.'), { statusCode: 403 });
  return { id: profileId, ...data };
}

async function actionEventPropose(db, req, actor) {
  const authorType = safeString(req.body?.authorType || req.body?.type, 40) === 'expert' ? 'expert' : 'partner';
  const profileId = safeString(req.body?.profileId || req.body?.partnerId || req.body?.expertId, 180);
  const profile = await assertOwnedProfile(db, actor, authorType, profileId);
  const proposal = cleanEventProposal(req.body?.event || req.body?.proposal || {});
  const ref = await db.collection('events').add({
    ...proposal,
    emoji: authorType === 'expert' ? '🎓' : '🎉',
    active: false,
    status: 'pending_review',
    submissionStatus: 'pending_review',
    moderationStatus: 'pending_review',
    proposalSource: authorType,
    proposalAuthorType: authorType,
    proposalAuthorId: actor.userId,
    proposalAuthorUid: actor.uid,
    proposalAuthorName: safeString(actor.user?.displayName || actor.user?.name || actor.user?.email || profile.name || 'Автор предложения', 220),
    submittedByUserId: actor.userId,
    submittedByName: safeString(actor.user?.displayName || actor.user?.name || actor.user?.email || profile.name || 'Автор предложения', 220),
    submittedAt: FieldValue.serverTimestamp(),
    submittedProfileId: profile.id,
    submittedProfileName: safeString(profile.name, 220),
    submissionComment: proposal.comment,
    partnerId: authorType === 'partner' ? profile.id : null,
    partner: authorType === 'partner' ? safeString(profile.name, 220) : proposal.partner,
    expertId: authorType === 'expert' ? profile.id : null,
    expert: authorType === 'expert' ? safeString(profile.name, 220) : '',
    isExpertEvent: authorType === 'expert',
    registeredCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await audit(db, req, actor, 'event:propose', 'events', ref.id, 'success', { authorType, profileId: profile.id });
  return { ok: true, id: ref.id, event: { id: ref.id, ...proposal, status: 'pending_review', submissionStatus: 'pending_review', active: false, proposalAuthorType: authorType, submittedProfileId: profile.id, submittedProfileName: profile.name || '' } };
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
    linkUrl: safeString(message.linkUrl || profile.websiteUrl || profile.socialUrl, 1000),
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
  if (!partnerId || !stars) throw Object.assign(new Error('Некорректный отзыв.'), { statusCode: 400 });
  await assertPublicProfileAvailable(db, 'partners', partnerId, 'Партнёр');
  const reviewData = {
    userId,
    userName: safeString(req.body?.userName || 'Участник АПГ', 200),
    userPhoto: safeString(req.body?.userPhoto, 1000) || null,
    stars,
    text,
    createdAt: FieldValue.serverTimestamp(),
  };
  const partnerRef = db.collection('partners').doc(partnerId);
  await Promise.all([
    partnerRef.collection('reviews').doc(userId).set(reviewData, { merge: true }),
    db.collection('reviews').doc(`${partnerId}_${userId}`).set({ ...reviewData, partnerId, partnerName: safeString(req.body?.partnerName, 200) }, { merge: true }),
  ]);
  const snap = await partnerRef.collection('reviews').get();
  const list = snap.docs.map(d => d.data() || {});
  const avgRating = list.length ? Math.round(list.reduce((sum, r) => sum + Number(r.stars || 0), 0) / list.length * 10) / 10 : 0;
  await partnerRef.set({ avgRating, reviewCount: list.length }, { merge: true });
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
  await db.collection('expertReviews').doc(reviewId).set(reviewData, { merge: true });
  const snap = await db.collection('expertReviews').where('expertId', '==', expertId).get();
  const list = snap.docs.map(d => d.data() || {});
  const avgRating = list.length ? Math.round(list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length * 10) / 10 : 0;
  await db.collection('experts').doc(expertId).set({ avgRating, reviewCount: list.length }, { merge: true });
  await audit(db, req, actor, 'review:expert', 'experts', expertId, 'success', { rating });
  return { ok: true, avgRating, reviewCount: list.length, review: { ...reviewData, id: reviewId, createdAt: new Date().toISOString() } };
}

async function actionOwnerProfileUpdate(db, req, actor, type) {
  const id = safeString(req.body?.id, 160);
  const collection = type === 'expert' ? 'experts' : 'partners';
  if (!id) throw Object.assign(new Error('Не указан профиль.'), { statusCode: 400 });
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Профиль не найден.'), { statusCode: 404 });
  const data = snap.data() || {};
  if (!actorOwnsProfile(data, actor)) throw Object.assign(new Error('Нет доступа к этому профилю.'), { statusCode: 403 });
  const allowedFields = type === 'expert'
    ? new Set(['description', 'offer', 'phone', 'bookingUrl', 'websiteUrl', 'vkUrl', 'telegramUrl', 'maxUrl', 'photo'])
    : new Set(['description', 'offer', 'phone', 'hours', 'socialUrl', 'logoUrl']);
  const patch = {};
  Object.entries(req.body?.patch || {}).forEach(([key, value]) => {
    if (allowedFields.has(key)) patch[key] = typeof value === 'string' ? safeString(value, 4000) : value;
  });
  patch.profileUpdatedAt = FieldValue.serverTimestamp();
  await ref.set(patch, { merge: true });
  await audit(db, req, actor, `${type}:profileUpdate`, collection, id, 'success', { fields: Object.keys(patch) });
  return { ok: true, patch: req.body?.patch || {} };
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

async function actionLogCreate(db, req, actor, collection, source) {
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
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

async function routeAction(db, req, actor) {
  const action = safeString(req.body?.action, 80);
  if (action === 'auth:linkUser') return actionAuthLink(db, req, actor);
  if (action === 'profile:sync') return actionProfileSync(db, req, actor);
  if (action === 'profile:update') return actionProfilePatch(db, req, actor);
  if (action === 'profile:acceptConsent') return actionProfileAcceptConsent(db, req, actor);
  if (action === 'profile:consentStatus') return actionProfileConsentStatus(db, req, actor);
  if (action === 'profile:forceAcceptConsent') return actionProfileForceAcceptConsent(db, req, actor);
  if (action === 'profile:delete') return actionProfileDelete(db, req, actor);
  if (action === 'favorites:toggle') return actionFavoritesToggle(db, req, actor);
  if (action === 'news:saved') return actionUserListSet(db, req, actor, 'savedNews', action);
  if (action === 'news:readLater') return actionUserListSet(db, req, actor, 'readLaterNews', action);
  if (action === 'news:reaction') return actionNewsReaction(db, req, actor);
  if (action === 'news:subscriptions') return actionNewsSubscriptions(db, req, actor);
  if (action === 'publicQr:view') return actionPublicQrView(db, req, actor);
  if (action === 'task:claim') return actionTaskClaim(db, req, actor);
  if (action === 'prize:claim') return actionPrizeClaim(db, req, actor);
  if (action === 'raffle:enter') return actionRaffleEnter(db, req, actor);
  if (action === 'event:toggle') return actionEventToggle(db, req, actor);
  if (action === 'event:propose') return actionEventPropose(db, req, actor);
  if (action === 'partner:aiDraft') return actionPartnerAiDraft(db, req, actor);
  if (action === 'review:partner') return actionReviewPartner(db, req, actor);
  if (action === 'review:expert') return actionReviewExpert(db, req, actor);
  if (action === 'partner:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'partner');
  if (action === 'expert:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'expert');
  if (action === 'loki:settings') return actionLokiSettings(db, req, actor);
  if (action === 'loki:analytics') return actionLokiAnalytics(db, req, actor);
  if (action === 'log:error') return actionLogCreate(db, req, actor, 'errorLogs', 'api.user-actions');
  if (action === 'log:diagnostic') return actionLogCreate(db, req, actor, 'diagnostics', 'api.user-actions');
  if (action === 'guest:session') return actionGuestSession(db, req, actor);
  throw Object.assign(new Error('Неизвестное пользовательское действие.'), { statusCode: 400 });
}

export default async function handler(req, res) {
  const db = getAdminDb();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-Auth,X-APG-Auth,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  let actor = null;
  try {
    actor = await requireActor(req);
    const result = await routeAction(db, req, actor);
    return res.status(200).json(result);
  } catch (error) {
    await audit(db, req, actor, safeString(req.body?.action || 'unknown'), 'unknown', req.body?.id || req.body?.userId || '', 'error', { message: String(error?.message || error).slice(0, 500) });
    return jsonError(res, error.statusCode || 500, error.message || 'Не удалось выполнить действие.', error.code || 'USER_ACTION_ERROR');
  }
}
