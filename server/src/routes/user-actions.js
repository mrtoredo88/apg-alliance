import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getDbAuth } from '../lib/firebase.js';

const MAX_TEXT = 4000;

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function safeUserId(value) {
  return safeString(value, 180);
}

function jsonError(res, status, message, code = 'USER_ACTION_ERROR') {
  return res.status(status).json({ ok: false, code, error: message });
}

function getBearerToken(req) {
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
  const decoded = await getDbAuth().verifyIdToken(token);
  return resolveActor(getDb(), decoded);
}

function assertOwn(actor, userId) {
  const target = safeUserId(userId);
  if (!target || target.startsWith('guest_')) throw Object.assign(new Error('Действие доступно только авторизованному пользователю.'), { statusCode: 401 });
  if (actor.userId !== target && actor.uid !== target) throw Object.assign(new Error('Нельзя менять данные другого пользователя.'), { statusCode: 403 });
  return target;
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
  let userDoc = {};

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const before = snap.data() || {};
      const patch = { ...profile, lastSeen: FieldValue.serverTimestamp() };
      if (before.lastBonusDate !== todayKey) {
        patch.keys = FieldValue.increment(1);
        patch.lastBonusDate = todayKey;
        dailyBonusAwarded = true;
      }
      tx.set(ref, patch, { merge: true });
      userDoc = { ...before, ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== null)), lastBonusDate: patch.lastBonusDate || before.lastBonusDate, keys: Number(before.keys || 0) + (dailyBonusAwarded ? 1 : 0) };
      return;
    }

    created = true;
    const isValidRef = refId && refId !== userId;
    const base = {
      keys: isValidRef ? 2 : 0,
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
      referredBy: isValidRef ? refId : null,
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
    tx.set(ref, base, { merge: true });
    tx.set(db.collection('stats').doc('global'), { userCount: FieldValue.increment(1) }, { merge: true });
    userDoc = { ...base, keys: base.keys };
  });

  await audit(db, req, actor, created ? 'profile:create' : 'profile:sync', 'users', userId, 'success', { dailyBonusAwarded });
  return { ok: true, userId, created, dailyBonusAwarded, user: userDoc };
}

async function actionProfilePatch(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const allowed = new Set(['onboardingDone', 'consents', 'consentAcceptedAt', 'consentDocsVersion', 'consentLegalVersion', 'legalVersion', 'notificationConsent', 'notificationsRequestedAt', 'notificationsEnabled', 'notificationProvider', 'displayName', 'firstName', 'lastName', 'photo', 'joinedGroup']);
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
  if (!Object.keys(patch).length) throw Object.assign(new Error('Нет данных для сохранения.'), { statusCode: 400 });
  patch.updatedAt = FieldValue.serverTimestamp();
  await db.collection('users').doc(userId).set(patch, { merge: true });
  await audit(db, req, actor, 'profile:update', 'users', userId, 'success', { fields: Object.keys(patch) });
  return { ok: true, userId, patch: req.body?.patch || {} };
}

async function actionProfileDelete(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  await db.collection('users').doc(userId).delete();
  await audit(db, req, actor, 'profile:delete', 'users', userId);
  return { ok: true };
}

async function actionFavoritesToggle(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const partnerId = safeString(req.body?.partnerId, 160);
  if (!partnerId) throw Object.assign(new Error('Не указан партнёр.'), { statusCode: 400 });
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
  await audit(db, req, actor, isAdding ? 'favorites:add' : 'favorites:remove', 'partners', partnerId);
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

async function actionReviewPartner(db, req, actor) {
  const userId = assertOwn(actor, req.body?.userId || actor.userId);
  const partnerId = safeString(req.body?.partnerId, 160);
  const stars = Math.max(1, Math.min(5, Number(req.body?.stars || 0)));
  const text = safeString(req.body?.text, MAX_TEXT);
  if (!partnerId || !stars) throw Object.assign(new Error('Некорректный отзыв.'), { statusCode: 400 });
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
  const actorEmail = safeString(actor.user?.email || actor.user?.linkedEmail, 200).toLowerCase();
  const allowed = data.ownerId === actor.userId
    || String(data.vkOwnerId || '') === actor.userId
    || (actorEmail && safeString(data.ownerEmail, 200).toLowerCase() === actorEmail);
  if (!allowed) throw Object.assign(new Error('Нет доступа к этому профилю.'), { statusCode: 403 });
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
  if (action === 'review:partner') return actionReviewPartner(db, req, actor);
  if (action === 'review:expert') return actionReviewExpert(db, req, actor);
  if (action === 'partner:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'partner');
  if (action === 'expert:profileUpdate') return actionOwnerProfileUpdate(db, req, actor, 'expert');
  if (action === 'loki:settings') return actionLokiSettings(db, req, actor);
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
      await audit(db, req, actor, safeString(req.body?.action || 'unknown'), 'unknown', req.body?.id || req.body?.userId || '', 'error', { message: String(error?.message || error).slice(0, 500) });
      return reply.code(error.statusCode || 500).send({ ok: false, code: error.code || 'USER_ACTION_ERROR', error: error.message || 'Не удалось выполнить действие.' });
    }
  });
}
