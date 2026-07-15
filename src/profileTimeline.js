import { workspaceNewsBelongsToProfile } from '../server-shared/workspace-news.js';
import { getNewsImage, getNewsText, getNewsTitle } from './newsUtils.js';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function firstText(...values) {
  return values.map(value => String(value ?? '').trim()).find(Boolean) || '';
}

function profileDate(profile = {}) {
  return toMillis(profile.profileUpdatedAt || profile.updatedAt || profile.createdAt || profile.publishedAt) || Date.now();
}

function isPublic(item = {}) {
  const status = String(item.lifecycleStatus || item.contentStatus || item.status || '').toLowerCase();
  if (item.deleted || item.archived || ['deleted', 'trash', 'archived'].includes(status)) return false;
  if (item.active === false && !['published', 'completed'].includes(status)) return false;
  if (['draft', 'moderation', 'pending', 'scheduled'].includes(status)) return false;
  return true;
}

function sameProfile(item = {}, profile = {}, role = 'partner') {
  if (!profile?.id) return false;
  if (workspaceNewsBelongsToProfile(item, profile, role)) return true;
  const id = String(profile.id);
  const keys = role === 'expert'
    ? [item.expertId, item.authorExpertId, item.profileId, item.ownerProfileId, item.submittedProfileId]
    : [item.partnerId, item.authorPartnerId, item.profileId, item.ownerProfileId, item.submittedProfileId];
  return keys.some(value => String(value || '') === id);
}

function timelineId(type, id, index = 0) {
  return `${type}:${id || index}`;
}

function publicationKind(item = {}) {
  const type = String(item.publicationType || item.timelineType || '').trim();
  if (type) return type;
  const category = String(item.category || '').toLowerCase();
  if (category === 'events') return 'Анонс';
  if (category === 'offers' || category === 'partners') return 'Новость';
  if (Array.isArray(item.videos) && item.videos.length) return 'Видео';
  if (Array.isArray(item.gallery) && item.gallery.length) return 'Фото';
  return 'Новость';
}

function buildNewsItems({ news = [], profile, role }) {
  return (Array.isArray(news) ? news : [])
    .filter(item => sameProfile(item, profile, role) && isPublic(item))
    .map((item, index) => ({
      id: timelineId('news', item.id, index),
      type: 'publication',
      label: publicationKind(item),
      title: getNewsTitle(item) || 'Публикация',
      text: firstText(item.summary, item.subtitle, getNewsText(item)),
      image: getNewsImage(item),
      date: item.publishedAt || item.updatedAt || item.createdAt,
      ts: toMillis(item.publishedAt || item.updatedAt || item.createdAt),
      author: item.author || item.sourceName || profile?.name || profile?.title || '',
      source: 'news',
      entity: item,
      action: 'openNews',
    }));
}

function buildEventItems({ events = [], profile, role }) {
  return (Array.isArray(events) ? events : [])
    .filter(item => sameProfile(item, profile, role) && isPublic(item))
    .map((item, index) => ({
      id: timelineId('event', item.id, index),
      type: 'event',
      label: 'Мероприятие',
      title: item.title || item.name || 'Мероприятие',
      text: firstText(item.shortDescription, item.description, item.address, item.location),
      image: item.coverPhoto || item.imageUrl || item.photo || '',
      date: item.publishedAt || item.startAt || item.eventDate || item.date || item.createdAt,
      ts: toMillis(item.publishedAt || item.startAt || item.eventDate || item.date || item.createdAt),
      author: profile?.name || profile?.title || '',
      source: 'events',
      entity: item,
      action: 'openEvent',
    }));
}

function buildOfferItems({ profile = {} }) {
  const offer = firstText(profile.offer, profile.promotionTitle, profile.promo, profile.discount);
  if (!offer) return [];
  return [{
    id: timelineId('offer', profile.id || profile.name),
    type: 'offer',
    label: 'Акция',
    title: 'Добавлена акция',
    text: offer,
    image: profile.coverPhoto || profile.logoUrl || profile.photo || '',
    date: profile.offerUpdatedAt || profile.promotionUpdatedAt || profile.profileUpdatedAt || profile.updatedAt,
    ts: toMillis(profile.offerUpdatedAt || profile.promotionUpdatedAt || profile.profileUpdatedAt || profile.updatedAt) || profileDate(profile),
    author: profile.name || profile.title || '',
    source: 'profile',
    entity: profile,
    action: 'openOffer',
  }];
}

function buildVideoItems({ profile = {} }) {
  return (Array.isArray(profile.videos) ? profile.videos : []).filter(Boolean).slice(0, 4).map((video, index) => ({
    id: timelineId('video', video.id || video.url || video.videoId, index),
    type: 'video',
    label: 'Видео',
    title: video.title || 'Добавлено видео',
    text: video.description || video.url || '',
    image: video.thumbnailUrl || profile.coverPhoto || profile.logoUrl || profile.photo || '',
    date: video.createdAt || video.updatedAt || profile.profileUpdatedAt || profile.updatedAt,
    ts: toMillis(video.createdAt || video.updatedAt || profile.profileUpdatedAt || profile.updatedAt) || profileDate(profile) - index,
    author: profile.name || profile.title || '',
    source: 'profile',
    entity: video,
    action: 'openVideo',
  }));
}

function buildPhotoItems({ profile = {} }) {
  const gallery = Array.isArray(profile.gallery) ? profile.gallery : Array.isArray(profile.photos) ? profile.photos : [];
  if (!gallery.length) return [];
  return [{
    id: timelineId('photos', profile.id || profile.name),
    type: 'photo',
    label: 'Фото',
    title: gallery.length > 1 ? 'Обновлена галерея' : 'Добавлено фото',
    text: `${gallery.length} фото в карточке`,
    image: typeof gallery[0] === 'string' ? gallery[0] : gallery[0]?.url || '',
    date: profile.galleryUpdatedAt || profile.profileUpdatedAt || profile.updatedAt,
    ts: toMillis(profile.galleryUpdatedAt || profile.profileUpdatedAt || profile.updatedAt) || profileDate(profile) - 1000,
    author: profile.name || profile.title || '',
    source: 'profile',
    entity: { gallery },
    action: 'openPhotos',
  }];
}

function buildReviewItems({ reviews = [], profile = {} }) {
  return (Array.isArray(reviews) ? reviews : []).slice(0, 5).map((review, index) => ({
    id: timelineId('review', review.id || review.userId, index),
    type: 'review',
    label: 'Отзыв',
    title: review.userName ? `Отзыв от ${review.userName}` : 'Новый отзыв',
    text: firstText(review.text, review.comment, review.stars || review.rating ? `Оценка: ${review.stars || review.rating}/5` : ''),
    image: review.userPhoto || '',
    date: review.createdAt || review.updatedAt,
    ts: toMillis(review.createdAt || review.updatedAt) || profileDate(profile) - 2000 - index,
    author: review.userName || 'Участник АПГ',
    source: 'reviews',
    entity: review,
    action: 'openReviews',
  }));
}

export function buildProfileTimeline({ profile = {}, role = 'partner', news = [], events = [], reviews = [], vkPosts = [] } = {}) {
  const vkItems = (Array.isArray(vkPosts) ? vkPosts : []).map((post, index) => ({
    id: timelineId('vk', post.id || post.url, index),
    type: 'vk',
    label: 'VK',
    title: post.title || 'Публикация сообщества',
    text: firstText(post.text, post.summary),
    image: post.image || post.photo || '',
    date: post.date || post.publishedAt || post.createdAt,
    ts: toMillis(post.date || post.publishedAt || post.createdAt) || Date.now() - index,
    author: profile.name || profile.title || '',
    source: 'vk',
    entity: post,
    action: 'openExternal',
    url: post.url,
  }));

  return [
    ...buildNewsItems({ news, profile, role }),
    ...buildEventItems({ events, profile, role }),
    ...buildOfferItems({ profile }),
    ...buildVideoItems({ profile }),
    ...buildPhotoItems({ profile }),
    ...buildReviewItems({ reviews, profile }),
    ...vkItems,
  ]
    .filter(item => item.title || item.text || item.image)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 16);
}

export function getProfileTimelineSourceTypes(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map(item => item.type).filter(Boolean)));
}
