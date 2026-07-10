import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';
import { requireAdminPermission, writeAuditLog } from './_admin-security.js';
import { ECONOMY_VERSION, getEconomyReward } from '../server-shared/economy-engine.js';

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

function cleanNewsIds(...values) {
  return values
    .flatMap(value => Array.isArray(value) ? value : String(value ?? '').split(','))
    .map(value => String(value ?? '').trim())
    .filter((value, index, arr) => value && value !== 'undefined' && value !== 'null' && arr.indexOf(value) === index)
    .slice(0, 10);
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
      source: 'api.news-comments',
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

async function listComments(db, newsId, legacyIds = []) {
  const ids = cleanNewsIds(newsId, legacyIds);
  const docsById = new Map();
  for (const id of ids) {
    const snap = await db.collection('newsComments').where('newsId', '==', id).get();
    snap.docs.forEach(doc => docsById.set(doc.id, doc));
  }
  return [...docsById.values()]
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
      source: 'api.news-comments.counter',
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

export default async function handler(req, res) {
  const db = getAdminDb();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-Auth,X-APG-Auth');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const newsId = String(req.query.newsId || '').trim();
      if (!newsId && req.query.admin === '1') {
        await requireAdminPermission(req, 'comments:*');
        const comments = await listAdminComments(db);
        return res.status(200).json({ ok: true, comments });
      }
      if (!newsId) return res.status(400).json({ ok: false, error: 'newsId is required' });
      const legacyIds = cleanNewsIds(req.query.legacyIds || req.query.aliases || req.query.legacyNewsIds);
      const comments = await listComments(db, newsId, legacyIds);
      return res.status(200).json({ ok: true, newsId, legacyIds, comments });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const action = String(req.body?.action || '').trim();
    const user = safeUser(req.body?.user);
    const requireModerator = async () => requireAdminPermission(req, 'comments:*');

    if (action === 'create') {
      const newsId = String(req.body?.newsId || '').trim();
      const text = cleanText(req.body?.text);
      const parentId = req.body?.parentId ? String(req.body.parentId).trim() : null;
      if (!newsId || !text || !user.id || user.id.startsWith('guest_')) {
        return res.status(400).json({ ok: false, error: 'Недостаточно данных для комментария.' });
      }
      if (await isUserBlocked(db, user.id)) {
        return res.status(403).json({ ok: false, error: 'Комментарии для этого аккаунта временно ограничены.' });
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
      const reward = getEconomyReward('comment');
      await db.collection('users').doc(user.id).set({
        keys: FieldValue.increment(reward.keys),
        reputation: FieldValue.increment(reward.reputation),
        economyVersion: ECONOMY_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await db.collection('users').doc(user.id).collection('activity').add({
        type: 'comment',
        icon: '💬',
        text: `Комментарий: +${reward.keys} ключа`,
        keys: reward.keys,
        reputation: reward.reputation,
        newsId,
        commentId: ref.id,
        economyVersion: ECONOMY_VERSION,
        ts: FieldValue.serverTimestamp(),
      });
      const created = await ref.get();
      return res.status(200).json({ ok: true, comment: serializeComment(created) });
    }

    const commentId = String(req.body?.commentId || '').trim();
    if (!commentId) return res.status(400).json({ ok: false, error: 'commentId is required' });

    const ref = db.collection('newsComments').doc(commentId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Комментарий не найден.' });
    const data = snap.data() || {};
    const isOwner = user.id && String(data.userId) === user.id;

    if (action === 'like') {
      if (!user.id || user.id.startsWith('guest_')) {
        return res.status(401).json({ ok: false, error: 'Авторизуйтесь, чтобы поставить реакцию.' });
      }
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy.map(String) : [];
      if (likedBy.includes(user.id)) {
        return res.status(200).json({ ok: true, alreadyLiked: true, likes: Number(data.likes || 0) });
      }
      await ref.update({
        likes: FieldValue.increment(1),
        likedBy: FieldValue.arrayUnion(user.id),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true, likes: Number(data.likes || 0) + 1, likedBy: [...likedBy, user.id] });
    }

    if (action === 'update') {
      const text = cleanText(req.body?.text);
      if (!text) return res.status(400).json({ ok: false, error: 'Комментарий пустой.' });
      let actor = null;
      if (!isOwner) actor = await requireModerator();
      await ref.update({ text, updatedAt: FieldValue.serverTimestamp() });
      if (actor) await writeAuditLog(db, req, actor, 'comment:update', 'newsComment', commentId, { label: `Изменён комментарий ${commentId}`, newsId: data.newsId });
      const updated = await ref.get();
      return res.status(200).json({ ok: true, comment: serializeComment(updated) });
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
      if (actor) await writeAuditLog(db, req, actor, 'comment:delete', 'newsComment', commentId, { label: `Скрыт комментарий ${commentId}`, newsId: data.newsId });
      return res.status(200).json({ ok: true });
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
      await writeAuditLog(db, req, actor, 'comment:pin', 'newsComment', commentId, { label: `${data.isPinned ? 'Откреплён' : 'Закреплён'} комментарий ${commentId}`, newsId: data.newsId });
      const updated = await ref.get();
      return res.status(200).json({ ok: true, comment: serializeComment(updated) });
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
      await writeAuditLog(db, req, actor, 'comment:useful', 'newsComment', commentId, { label: `${data.isUseful ? 'Снята польза' : 'Отмечен полезным'} комментарий ${commentId}`, newsId: data.newsId });
      const updated = await ref.get();
      return res.status(200).json({ ok: true, comment: serializeComment(updated) });
    }

    if (action === 'blockUser') {
      const actor = await requireModerator();
      const blockedUserId = String(data.userId || '').trim();
      if (!blockedUserId) return res.status(400).json({ ok: false, error: 'Пользователь комментария не найден.' });
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
      await writeAuditLog(db, req, actor, 'comment:block-user', 'user', blockedUserId, { label: `Заблокирован автор комментария ${commentId}`, commentId, newsId: data.newsId });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    await logCommentError(db, req, error, {
      method: req.method,
      action: req.body?.action || null,
      newsId: req.body?.newsId || req.query?.newsId || null,
      commentId: req.body?.commentId || null,
    });
    return res.status(500).json({ ok: false, error: 'Комментарий не размещён. Попробуйте ещё раз.' });
  }
}
