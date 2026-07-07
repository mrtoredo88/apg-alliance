import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';

const GROUP_ID = 229980067;
const API_VERSION = '5.199';

function pickBestPhoto(sizes = []) {
  const best = [...sizes]
    .filter(s => s?.url)
    .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0];
  return best?.url ?? null;
}

function normalizePhoto(photo) {
  const url = pickBestPhoto(photo?.sizes);
  if (!url) return null;
  return {
    type: 'photo',
    id: photo.id ? `${photo.owner_id}_${photo.id}` : url,
    url,
    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
    text: photo.text || '',
  };
}

function normalizeVideo(video) {
  if (!video?.id || !video?.owner_id) return null;
  const thumbnailUrl = pickBestPhoto(video.image || video.first_frame || []) || '/video-placeholder-vk.svg';
  const ownerId = video.owner_id;
  const videoId = video.id;
  return {
    type: 'video',
    platform: 'vk',
    id: `${ownerId}_${videoId}`,
    videoId: `${ownerId}_${videoId}`,
    title: video.title || 'VK Видео',
    duration: Number(video.duration) || 0,
    thumbnailUrl,
    embedUrl: video.player || `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hd=2`,
    url: `https://vk.com/video${ownerId}_${videoId}`,
  };
}

function normalizeLink(link) {
  if (!link?.url) return null;
  return {
    type: 'link',
    url: link.url,
    title: link.title || link.caption || link.url,
    description: link.description || '',
    imageUrl: pickBestPhoto(link.photo?.sizes),
  };
}

function normalizeDoc(doc) {
  if (!doc?.url) return null;
  return {
    type: 'doc',
    url: doc.url,
    title: doc.title || 'Документ',
    ext: doc.ext || '',
    size: Number(doc.size) || 0,
  };
}

function normalizeAttachment(attachment) {
  if (!attachment?.type) return null;
  if (attachment.type === 'photo') return normalizePhoto(attachment.photo);
  if (attachment.type === 'video') return normalizeVideo(attachment.video);
  if (attachment.type === 'link') return normalizeLink(attachment.link);
  if (attachment.type === 'doc') return normalizeDoc(attachment.doc);
  return {
    type: attachment.type,
    title: attachment[attachment.type]?.title || attachment.type,
    url: attachment[attachment.type]?.url || '',
  };
}

function extractTags(text = '') {
  return [...new Set(String(text).match(/#[\p{L}\p{N}_-]+/gu) || [])].map(tag => tag.slice(1).toLowerCase());
}

function buildTitle(text = '', attachments = []) {
  const firstLine = String(text).split('\n').map(v => v.trim()).find(Boolean);
  if (firstLine) return firstLine.slice(0, 120);
  const link = attachments.find(a => a.type === 'link' && a.title);
  if (link) return link.title.slice(0, 120);
  const video = attachments.find(a => a.type === 'video' && a.title);
  if (video) return video.title.slice(0, 120);
  return 'Новость АПГ';
}

function mapPost(post) {
  const attachments = (post.attachments || []).map(normalizeAttachment).filter(Boolean);
  const photos = attachments.filter(a => a.type === 'photo').map(a => a.url);
  const videos = attachments.filter(a => a.type === 'video');
  const links = attachments.filter(a => a.type === 'link');
  const docs = attachments.filter(a => a.type === 'doc');
  const text = String(post.text || '').trim();
  const postUrl = `https://vk.com/wall-${GROUP_ID}_${post.id}`;
  const isPinned = Boolean(post.is_pinned);

  return {
    id: `vk_${post.id}`,
    externalId: String(post.id),
    source: 'vk',
    sourceName: 'ВКонтакте',
    category: 'apg',
    title: buildTitle(text, attachments),
    text,
    fullText: text,
    imageUrl: photos[0] || links.find(a => a.imageUrl)?.imageUrl || videos[0]?.thumbnailUrl || '',
    coverPhoto: photos[0] || '',
    photos,
    gallery: photos,
    videos,
    links,
    docs,
    attachments,
    tags: extractTags(text),
    emoji: photos.length ? null : '📢',
    createdAt: post.date * 1000,
    publishedAt: post.date * 1000,
    linkUrl: postUrl,
    vkUrl: postUrl,
    postUrl,
    linkLabel: 'Открыть оригинал в ВКонтакте',
    isPinned,
    pinned: isPinned,
    priority: isPinned ? 10 : 0,
    stats: {
      likes: Number(post.likes?.count) || 0,
      comments: Number(post.comments?.count) || 0,
      reposts: Number(post.reposts?.count) || 0,
      views: Number(post.views?.count) || 0,
    },
    views: Number(post.views?.count) || 0,
    syncedAt: Date.now(),
  };
}

async function readCachedPosts(limit = 30, request = null) {
  try {
    const snap = await getDb().collection('news').where('source', '==', 'vk').limit(limit).get();
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (Number(b.publishedAt) || Number(b.createdAt) || 0) - (Number(a.publishedAt) || Number(a.createdAt) || 0));
  } catch (e) {
    if (request) logVkNews(request, 'warn', { event: 'cache_read_failed', reason: e.message });
    return [];
  }
}

function getVkToken() {
  if (process.env.VK_SERVICE_TOKEN) return { token: process.env.VK_SERVICE_TOKEN, source: 'VK_SERVICE_TOKEN' };
  if (process.env.VK_USER_TOKEN) return { token: process.env.VK_USER_TOKEN, source: 'VK_USER_TOKEN' };
  if (process.env.VK_GROUP_TOKEN) return { token: process.env.VK_GROUP_TOKEN, source: 'VK_GROUP_TOKEN' };
  return { token: '', source: 'none' };
}

function logVkNews(request, level, payload) {
  const data = { scope: 'vk-news', ...payload };
  if (level === 'warn') {
    request.log.warn(data);
    return;
  }
  request.log.info(data);
}

async function cachePosts(posts, request = null) {
  if (!posts.length) return;
  try {
    const db = getDb();
    const batch = db.batch();
    posts.forEach(post => {
      batch.set(db.collection('news').doc(post.id), {
        ...post,
        updatedAt: FieldValue.serverTimestamp(),
        deleted: false,
      }, { merge: true });
    });
    batch.set(db.collection('config').doc('vkNewsSync'), {
      source: 'vk',
      groupId: GROUP_ID,
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncTs: Date.now(),
      postsCount: posts.length,
      enabled: true,
      lastError: null,
    }, { merge: true });
    await batch.commit();
    if (request) logVkNews(request, 'info', { event: 'cache_write_ok', postsCount: posts.length });
  } catch (e) {
    if (request) logVkNews(request, 'warn', { event: 'cache_write_failed', reason: e.message });
  }
}

export default async function vkNewsRoutes(fastify) {
  fastify.get('/api/vk-news', async (request, reply) => {
    if (request.query.health !== undefined) {
      reply.header('Cache-Control', 'no-store');
      return { ok: true, ts: Date.now() };
    }

    reply.header('Cache-Control', 's-maxage=180, stale-while-revalidate=900');

    const count = Math.min(50, Math.max(1, Number(request.query.count) || 20));
    const { token, source: tokenSource } = getVkToken();
    logVkNews(request, 'info', { event: 'request_start', tokenFound: Boolean(token), tokenSource, count });
    if (!token) {
      const cached = await readCachedPosts(count, request);
      logVkNews(request, 'warn', { event: 'token_missing', source: 'cache', postsCount: cached.length });
      return { posts: cached, cached: true, unavailable: true, reason: 'token_missing' };
    }

    try {
      const apiUrl = new URL('https://api.vk.com/method/wall.get');
      apiUrl.searchParams.set('owner_id', String(-GROUP_ID));
      apiUrl.searchParams.set('count', String(count));
      apiUrl.searchParams.set('filter', 'owner');
      apiUrl.searchParams.set('extended', '0');
      apiUrl.searchParams.set('access_token', token);
      apiUrl.searchParams.set('v', API_VERSION);

      const response = await fetch(apiUrl.toString());
      const data = await response.json();

      if (data.error) {
        const cached = await readCachedPosts(count, request);
        logVkNews(request, 'warn', {
          event: 'vk_api_error',
          source: 'cache',
          tokenSource,
          code: data.error.error_code,
          reason: data.error.error_msg,
          postsCount: cached.length,
        });
        return {
          posts: cached,
          cached: true,
          unavailable: true,
          reason: data.error.error_msg,
          code: data.error.error_code,
        };
      }

      const posts = (data.response?.items ?? [])
        .filter(p => !p.marked_as_ads && (p.text?.trim() || p.attachments?.length))
        .map(mapPost);

      cachePosts(posts, request);
      logVkNews(request, 'info', { event: 'vk_live_ok', source: 'live_vk', tokenSource, postsCount: posts.length });
      return {
        posts,
        cached: false,
        source: 'vk',
        groupId: GROUP_ID,
        syncedAt: Date.now(),
      };
    } catch (e) {
      const cached = await readCachedPosts(count, request);
      logVkNews(request, 'warn', { event: 'vk_request_failed', source: 'cache', tokenSource, reason: e.message, postsCount: cached.length });
      return { posts: cached, cached: true, unavailable: true, reason: e.message };
    }
  });
}
