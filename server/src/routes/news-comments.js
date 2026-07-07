import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';
import { requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const MAX_TEXT = 900;

function cleanText(value) {
  return String(value || '').replace(/\s+\n/g, '\n').trim().slice(0, MAX_TEXT);
}

function safeUser(user = {}) {
  const id = String(user.id || user.userId || '').trim();
  return {
    id,
    name: String(user.name || user.first_name || user.email || 'Участник АПГ').trim().slice(0, 90),
    avatar: String(user.avatar || user.photo_100 || user.photo || '').trim().slice(0, 500),
    role: String(user.role || '').trim(),
  };
}

function serializeComment(doc) {
  const data = doc.data() || {};
  const toIso = value => value?.toDate ? value.toDate().toISOString() : value || null;
  return {
    id: doc.id,
    newsId: data.newsId || '',
    parentId: data.parentId || null,
    userId: data.userId || '',
    userName: data.userName || 'Участник АПГ',
    userAvatar: data.userAvatar || '',
    authorRole: data.authorRole || data.userRole || '',
    text: data.text || '',
    likes: Number(data.likes || 0),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    hidden: Boolean(data.hidden),
    status: data.status || (data.hidden ? 'hidden' : 'visible'),
    isPinned: Boolean(data.isPinned),
    isUseful: Boolean(data.isUseful),
    moderation: data.moderation || null,
    ai: data.ai || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

async function logCommentError(db, request, error, extra = {}) {
  try {
    await db.collection('errorLogs').add({
      source: 'server.news-comments',
      message: String(error?.message || error).slice(0, 500),
      stack: String(error?.stack || '').slice(0, 3000),
      extra,
      userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
      url: String(request.url || '').slice(0, 300),
      timestamp: FieldValue.serverTimestamp(),
      resolved: false,
    });
  } catch {
    return null;
  }
}

async function listComments(db, newsId) {
  const snap = await db.collection('newsComments').where('newsId', '==', newsId).get();
  return snap.docs
    .map(serializeComment)
    .filter(comment => !comment.hidden)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function listAdminComments(db) {
  const snap = await db.collection('newsComments').orderBy('createdAt', 'desc').limit(300).get();
  return snap.docs.map(serializeComment);
}

async function updateNewsCommentCount(db, newsId, delta) {
  if (!newsId || !delta) return;
  try {
    await db.collection('news').doc(String(newsId)).set({
      comments: FieldValue.increment(delta),
      'stats.comments': FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    await db.collection('errorLogs').add({
      source: 'server.news-comments.counter',
      message: String(error?.message || error).slice(0, 500),
      newsId: String(newsId),
      delta,
      timestamp: FieldValue.serverTimestamp(),
      resolved: false,
    }).catch(() => null);
  }
}

async function isUserBlocked(db, userId) {
  if (!userId) return false;
  const snap = await db.collection('newsCommentBlocks').doc(String(userId)).get();
  return snap.exists && snap.data()?.active !== false;
}

export default async function newsCommentsRoutes(fastify) {
  fastify.get('/api/news-comments', async (request, reply) => {
    const db = getDb();
    try {
      const newsId = String(request.query?.newsId || '').trim();
      if (!newsId && request.query?.admin === '1') {
        await requireAdminPermission(request, 'comments:*');
        const comments = await listAdminComments(db);
        return { ok: true, comments };
      }
      if (!newsId) return reply.code(400).send({ ok: false, error: 'newsId is required' });
      const comments = await listComments(db, newsId);
      return { ok: true, comments };
    } catch (error) {
      await logCommentError(db, request, error, { method: 'GET', newsId: request.query?.newsId || null });
      return reply.code(500).send({ ok: false, error: 'Не удалось загрузить комментарии.' });
    }
  });

  fastify.post('/api/news-comments', async (request, reply) => {
    const db = getDb();
    try {
      const action = String(request.body?.action || '').trim();
      const user = safeUser(request.body?.user);
      const requireModerator = async () => requireAdminPermission(request, 'comments:*');

      if (action === 'create') {
        const newsId = String(request.body?.newsId || '').trim();
        const text = cleanText(request.body?.text);
        const parentId = request.body?.parentId ? String(request.body.parentId).trim() : null;
        if (!newsId || !text || !user.id || user.id.startsWith('guest_')) {
          return reply.code(400).send({ ok: false, error: 'Недостаточно данных для комментария.' });
        }
        if (await isUserBlocked(db, user.id)) {
          return reply.code(403).send({ ok: false, error: 'Комментарии для этого аккаунта временно ограничены.' });
        }
        const ref = await db.collection('newsComments').add({
          newsId,
          parentId,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          authorRole: user.role,
          text,
          likes: 0,
          likedBy: [],
          hidden: false,
          status: 'visible',
          isPinned: false,
          isUseful: false,
          moderation: {},
          ai: { summaryEligible: true, topics: [], sentiment: null },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await updateNewsCommentCount(db, newsId, 1);
        const created = await ref.get();
        return { ok: true, comment: serializeComment(created) };
      }

      const commentId = String(request.body?.commentId || '').trim();
      if (!commentId) return reply.code(400).send({ ok: false, error: 'commentId is required' });

      const ref = db.collection('newsComments').doc(commentId);
      const snap = await ref.get();
      if (!snap.exists) return reply.code(404).send({ ok: false, error: 'Комментарий не найден.' });
      const data = snap.data() || {};
      const isOwner = user.id && String(data.userId) === user.id;

      if (action === 'like') {
        if (!user.id || user.id.startsWith('guest_')) {
          return reply.code(401).send({ ok: false, error: 'Авторизуйтесь, чтобы поставить реакцию.' });
        }
        const likedBy = Array.isArray(data.likedBy) ? data.likedBy.map(String) : [];
        if (likedBy.includes(user.id)) return { ok: true, alreadyLiked: true, likes: Number(data.likes || 0) };
        await ref.update({
          likes: FieldValue.increment(1),
          likedBy: FieldValue.arrayUnion(user.id),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true, likes: Number(data.likes || 0) + 1, likedBy: [...likedBy, user.id] };
      }

      if (action === 'update') {
        const text = cleanText(request.body?.text);
        if (!text) return reply.code(400).send({ ok: false, error: 'Комментарий пустой.' });
        let actor = null;
        if (!isOwner) actor = await requireModerator();
        await ref.update({ text, updatedAt: FieldValue.serverTimestamp() });
        if (actor) await writeAuditLog(db, request, actor, 'comment:update', 'newsComment', commentId, { label: `Изменён комментарий ${commentId}`, newsId: data.newsId });
        const updated = await ref.get();
        return { ok: true, comment: serializeComment(updated) };
      }

      if (action === 'delete') {
        let actor = null;
        if (!isOwner) actor = await requireModerator();
        await ref.update({
          hidden: true,
          status: 'hidden',
          hiddenAt: FieldValue.serverTimestamp(),
          moderation: {
            ...(data.moderation || {}),
            hiddenBy: user.id,
            hiddenAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (!data.hidden) await updateNewsCommentCount(db, data.newsId, -1);
        if (actor) await writeAuditLog(db, request, actor, 'comment:delete', 'newsComment', commentId, { label: `Скрыт комментарий ${commentId}`, newsId: data.newsId });
        return { ok: true };
      }

      if (action === 'togglePin') {
        const actor = await requireModerator();
        await ref.update({
          isPinned: !data.isPinned,
          moderation: {
            ...(data.moderation || {}),
            pinnedBy: user.id,
            pinnedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        await writeAuditLog(db, request, actor, 'comment:pin', 'newsComment', commentId, { label: `${data.isPinned ? 'Откреплён' : 'Закреплён'} комментарий ${commentId}`, newsId: data.newsId });
        const updated = await ref.get();
        return { ok: true, comment: serializeComment(updated) };
      }

      if (action === 'toggleUseful') {
        const actor = await requireModerator();
        await ref.update({
          isUseful: !data.isUseful,
          moderation: {
            ...(data.moderation || {}),
            usefulBy: user.id,
            usefulAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        await writeAuditLog(db, request, actor, 'comment:useful', 'newsComment', commentId, { label: `${data.isUseful ? 'Снята польза' : 'Отмечен полезным'} комментарий ${commentId}`, newsId: data.newsId });
        const updated = await ref.get();
        return { ok: true, comment: serializeComment(updated) };
      }

      if (action === 'blockUser') {
        const actor = await requireModerator();
        const blockedUserId = String(data.userId || '').trim();
        if (!blockedUserId) return reply.code(400).send({ ok: false, error: 'Пользователь комментария не найден.' });
        await db.collection('newsCommentBlocks').doc(blockedUserId).set({
          userId: blockedUserId,
          active: true,
          reason: 'moderation',
          blockedBy: user.id,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await ref.update({
          hidden: true,
          status: 'hidden',
          moderation: {
            ...(data.moderation || {}),
            blockedBy: user.id,
            blockedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (!data.hidden) await updateNewsCommentCount(db, data.newsId, -1);
        await writeAuditLog(db, request, actor, 'comment:block-user', 'user', blockedUserId, { label: `Заблокирован автор комментария ${commentId}`, commentId, newsId: data.newsId });
        return { ok: true };
      }

      return reply.code(400).send({ ok: false, error: 'Unknown action' });
    } catch (error) {
      await logCommentError(db, request, error, {
        method: 'POST',
        action: request.body?.action || null,
        newsId: request.body?.newsId || null,
        commentId: request.body?.commentId || null,
      });
      return reply.code(500).send({ ok: false, error: 'Комментарий не размещён. Попробуйте ещё раз.' });
    }
  });
}
