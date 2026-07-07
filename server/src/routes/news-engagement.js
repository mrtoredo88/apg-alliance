import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';

function safeId(value, fallback = '') {
  return String(value || fallback).trim().slice(0, 180);
}

function safeUser(user = {}) {
  return {
    id: safeId(user.id || user.userId || 'guest'),
    role: safeId(user.role),
    name: safeId(user.name || user.first_name || user.email || 'Участник АПГ', 'Участник АПГ'),
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function logEngagementError(db, request, error, extra = {}) {
  try {
    await db.collection('errorLogs').add({
      source: 'server.news-engagement',
      message: String(error?.message || error).slice(0, 500),
      stack: String(error?.stack || '').slice(0, 3000),
      extra,
      userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
      url: String(request.url || '').slice(0, 300),
      timestamp: FieldValue.serverTimestamp(),
      resolved: false,
    });
  } catch {}
}

async function trackView(db, body) {
  const newsId = safeId(body.newsId);
  const user = safeUser(body.user);
  if (!newsId) throw new Error('newsId is required');
  const day = todayKey();
  const viewerId = user.id || safeId(body.viewerId, 'guest');
  const viewId = `${newsId}_${viewerId}_${day}`.replace(/[\/#?[\\\]]/g, '_');
  const viewRef = db.collection('newsViewEvents').doc(viewId);
  const newsRef = db.collection('news').doc(newsId);
  const progress = Math.max(0, Math.min(1, Number(body.progress || 0)));
  const readTimeMs = Math.max(0, Math.min(1000 * 60 * 60, Number(body.readTimeMs || 0)));

  await db.runTransaction(async tx => {
    const snap = await tx.get(viewRef);
    const firstView = !snap.exists;
    tx.set(viewRef, {
      newsId,
      userId: viewerId,
      day,
      source: safeId(body.source || 'article'),
      progress: Math.max(progress, Number(snap.data()?.progress || 0)),
      readTimeMs: FieldValue.increment(readTimeMs),
      completed: Boolean(body.completed) || Boolean(snap.data()?.completed),
      updatedAt: FieldValue.serverTimestamp(),
      ...(firstView ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });
    if (firstView) {
      tx.set(newsRef, {
        views: FieldValue.increment(1),
        'stats.views': FieldValue.increment(1),
        [`dailyViews.${day}`]: FieldValue.increment(1),
        lastViewedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  return { ok: true };
}

async function trackRead(db, body) {
  const newsId = safeId(body.newsId);
  const user = safeUser(body.user);
  if (!newsId) throw new Error('newsId is required');
  const progress = Math.max(0, Math.min(1, Number(body.progress || 0)));
  await db.collection('newsReadEvents').add({
    newsId,
    userId: user.id,
    progress,
    readTimeMs: Math.max(0, Math.min(1000 * 60 * 60, Number(body.readTimeMs || 0))),
    completed: Boolean(body.completed),
    stopPercent: Math.round(progress * 100),
    source: safeId(body.source || 'article'),
    createdAt: FieldValue.serverTimestamp(),
  });
  if (body.completed) {
    await db.collection('news').doc(newsId).set({
      'analytics.completedReads': FieldValue.increment(1),
      'analytics.lastCompletedAt': FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  return { ok: true };
}

async function trackShare(db, body) {
  const newsId = safeId(body.newsId);
  const user = safeUser(body.user);
  if (!newsId) throw new Error('newsId is required');
  await Promise.all([
    db.collection('newsShareEvents').add({
      newsId,
      userId: user.id,
      channel: safeId(body.channel || 'unknown'),
      createdAt: FieldValue.serverTimestamp(),
    }),
    db.collection('news').doc(newsId).set({
      shares: FieldValue.increment(1),
      'stats.reposts': FieldValue.increment(1),
      'analytics.lastSharedAt': FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);
  return { ok: true };
}

async function trackFeedback(db, body) {
  const newsId = safeId(body.newsId);
  const user = safeUser(body.user);
  if (!newsId || !user.id || user.id.startsWith('guest_')) throw new Error('Авторизуйтесь, чтобы оставить оценку.');
  const helpful = Boolean(body.helpful);
  const feedbackId = `${newsId}_${user.id}`.replace(/[\/#?[\\\]]/g, '_');
  const ref = db.collection('newsFeedback').doc(feedbackId);
  const newsRef = db.collection('news').doc(newsId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const previous = snap.exists ? snap.data()?.helpful : null;
    tx.set(ref, {
      newsId,
      userId: user.id,
      helpful,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    const patch = {};
    if (previous !== helpful) {
      patch[`feedback.${helpful ? 'yes' : 'no'}`] = FieldValue.increment(1);
      if (previous !== null && previous !== undefined) patch[`feedback.${previous ? 'yes' : 'no'}`] = FieldValue.increment(-1);
    }
    if (Object.keys(patch).length) tx.set(newsRef, patch, { merge: true });
  });
  return { ok: true };
}

export default async function newsEngagementRoutes(fastify) {
  fastify.post('/api/news-engagement', async (request, reply) => {
    const db = getDb();
    try {
      const action = safeId(request.body?.action);
      if (action === 'view') return trackView(db, request.body);
      if (action === 'read') return trackRead(db, request.body);
      if (action === 'share') return trackShare(db, request.body);
      if (action === 'feedback') return trackFeedback(db, request.body);
      return reply.code(400).send({ ok: false, error: 'Unknown action' });
    } catch (error) {
      await logEngagementError(db, request, error, { action: request.body?.action || null, newsId: request.body?.newsId || null });
      return reply.code(500).send({ ok: false, error: 'Не удалось сохранить активность новости.' });
    }
  });
}
