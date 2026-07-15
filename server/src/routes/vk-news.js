import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';
import { getVkCommunityScreenName, normalizeVkCommunityUrl } from '../../../server-shared/vk-community.js';

const GROUP_ID = 229980067;
const API_VERSION = '5.199';
const COMMUNITY_FEED_TTL_MS = 10 * 60 * 1000;
const communityFeedCache = new Map();

function pickBestPhotoSize(sizes = []) {
  return [...sizes]
    .filter(s => s?.url)
    .sort((a, b) => {
      const areaA = (Number(a.width) || 0) * (Number(a.height) || 0);
      const areaB = (Number(b.width) || 0) * (Number(b.height) || 0);
      return areaB - areaA || (Number(b.width) || 0) - (Number(a.width) || 0);
    })[0] ?? null;
}

function pickBestPhoto(sizes = []) {
  return pickBestPhotoSize(sizes)?.url ?? null;
}

function normalizePhoto(photo) {
  const best = pickBestPhotoSize(photo?.sizes);
  const url = best?.url ?? null;
  if (!url) return null;
  return {
    type: 'photo',
    id: photo.id ? `${photo.owner_id}_${photo.id}` : url,
    url,
    width: Number(best.width || photo.width) || null,
    height: Number(best.height || photo.height) || null,
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

function getPostOwnerId(post) {
  return Number(post.owner_id || -GROUP_ID);
}

function buildWallUrl(ownerId, postId) {
  return `https://vk.com/wall${ownerId}_${postId}`;
}

function mapPost(post, options = {}) {
  const attachments = (post.attachments || []).map(normalizeAttachment).filter(Boolean);
  const photoItems = attachments.filter(a => a.type === 'photo');
  const photos = photoItems.map(a => a.url);
  const videos = attachments.filter(a => a.type === 'video');
  const links = attachments.filter(a => a.type === 'link');
  const docs = attachments.filter(a => a.type === 'doc');
  const text = String(post.text || '').trim();
  const ownerId = options.ownerId || getPostOwnerId(post);
  const postUrl = buildWallUrl(ownerId, post.id);
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
    photoItems,
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
    commentsEnabled: true,
    allowComments: true,
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

function mapCommunityPost(post, ownerId) {
  const item = mapPost(post, { ownerId });
  return {
    ...item,
    id: `vk_feed_${ownerId}_${post.id}`,
    source: 'vk-community',
    sourceName: 'ВКонтакте',
    linkLabel: 'Открыть публикацию',
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

function cachedCommunityFeed(screenName) {
  const cached = communityFeedCache.get(screenName);
  if (!cached) return null;
  if (Date.now() - cached.ts <= COMMUNITY_FEED_TTL_MS) return { ...cached, fresh: true };
  return { ...cached, fresh: false };
}

function saveCommunityFeedCache(screenName, payload) {
  communityFeedCache.set(screenName, { ...payload, ts: Date.now() });
  if (communityFeedCache.size > 120) {
    const oldest = [...communityFeedCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]?.[0];
    if (oldest) communityFeedCache.delete(oldest);
  }
}

async function resolveCommunityOwnerId(screenName, token) {
  if (/^-?\d+$/.test(screenName)) return Number(screenName);
  if (/^club\d+$/i.test(screenName)) return -Number(screenName.replace(/\D/g, ''));
  if (/^public\d+$/i.test(screenName)) return -Number(screenName.replace(/\D/g, ''));
  if (/^id\d+$/i.test(screenName)) return Number(screenName.replace(/\D/g, ''));

  const url = new URL('https://api.vk.com/method/utils.resolveScreenName');
  url.searchParams.set('screen_name', screenName);
  url.searchParams.set('access_token', token);
  url.searchParams.set('v', API_VERSION);
  const response = await fetch(url.toString());
  const data = await response.json();
  if (data.error) {
    const error = new Error(data.error.error_msg || 'VK resolve failed');
    error.code = data.error.error_code;
    throw error;
  }
  const object = data.response;
  if (!object?.object_id || !object?.type) {
    const error = new Error('community_not_found');
    error.code = 'community_not_found';
    throw error;
  }
  if (object.type === 'group' || object.type === 'page') return -Number(object.object_id);
  if (object.type === 'user') return Number(object.object_id);
  const error = new Error('unsupported_vk_object');
  error.code = 'unsupported_vk_object';
  throw error;
}

async function loadCommunityFeed({ screenName, count, token, request }) {
  const ownerId = await resolveCommunityOwnerId(screenName, token);
  const apiUrl = new URL('https://api.vk.com/method/wall.get');
  apiUrl.searchParams.set('owner_id', String(ownerId));
  apiUrl.searchParams.set('count', String(count));
  apiUrl.searchParams.set('filter', 'owner');
  apiUrl.searchParams.set('extended', '0');
  apiUrl.searchParams.set('access_token', token);
  apiUrl.searchParams.set('v', API_VERSION);

  const response = await fetch(apiUrl.toString());
  const data = await response.json();
  if (data.error) {
    const error = new Error(data.error.error_msg || 'VK wall failed');
    error.code = data.error.error_code;
    throw error;
  }
  const posts = (data.response?.items ?? [])
    .filter(p => !p.marked_as_ads && (p.text?.trim() || p.attachments?.length))
    .map(post => mapCommunityPost(post, ownerId));
  const payload = {
    posts,
    cached: false,
    source: 'vk-community',
    community: normalizeVkCommunityUrl(screenName),
    screenName,
    ownerId,
    syncedAt: Date.now(),
  };
  saveCommunityFeedCache(screenName, payload);
  logVkNews(request, 'info', { event: 'community_feed_live_ok', screenName, ownerId, postsCount: posts.length });
  return payload;
}

export default async function vkNewsRoutes(fastify) {
  fastify.get('/api/community-feed', async (request, reply) => {
    reply.header('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

    const count = Math.min(5, Math.max(1, Number(request.query.count) || 3));
    const screenName = getVkCommunityScreenName(request.query.community || request.query.url || request.query.screenName || '');
    if (!screenName) {
      reply.code(400);
      return { posts: [], ok: false, error: 'invalid_vk_community', reason: 'Некорректная ссылка на сообщество VK.' };
    }

    const cached = cachedCommunityFeed(screenName);
    if (cached?.fresh) {
      return { ...cached, cached: true, stale: false, ttlMs: COMMUNITY_FEED_TTL_MS };
    }

    const { token, source: tokenSource } = getVkToken();
    logVkNews(request, 'info', { event: 'community_feed_start', tokenFound: Boolean(token), tokenSource, screenName, count });
    if (!token) {
      if (cached) return { ...cached, cached: true, stale: true, unavailable: true, reason: 'token_missing' };
      return { posts: [], cached: false, unavailable: true, reason: 'token_missing' };
    }

    try {
      return await loadCommunityFeed({ screenName, count, token, request });
    } catch (e) {
      logVkNews(request, 'warn', { event: 'community_feed_failed', screenName, reason: e.message, code: e.code || null });
      if (cached) return { ...cached, cached: true, stale: true, unavailable: true, reason: e.message, code: e.code || null };
      return { posts: [], cached: false, unavailable: true, reason: e.message, code: e.code || null };
    }
  });

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
