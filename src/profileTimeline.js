import { workspaceNewsBelongsToProfile } from '../server-shared/workspace-news.js';
import { getNewsImage, getNewsText, getNewsTitle } from './newsUtils.js';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function getProfileFeedTimestamp(...values) {
  for (const value of values) {
    const ts = toMillis(value);
    if (ts) return ts;
  }
  return 0;
}

function withFeedTimestamp(item, ...values) {
  const feedTimestamp = getProfileFeedTimestamp(...values, item?.feedTimestamp, item?.ts, item?.date);
  return { ...item, feedTimestamp, ts: item?.ts || feedTimestamp };
}

function firstText(...values) {
  return values.map(value => String(value ?? '').trim()).find(Boolean) || '';
}

function profileDate(profile = {}) {
  return toMillis(profile.profileUpdatedAt || profile.updatedAt || profile.createdAt || profile.publishedAt) || Date.now();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function hasBookingChannels(profile = {}) {
  const fields = [
    profile.bookingEnabled,
    profile.bookingOpen,
    profile.bookingUrl,
    profile.bookingLink,
    profile.vkUrl,
    profile.phone,
    profile.telegramUrl,
    profile.services,
    profile.serviceCatalog,
    profile.canBook,
  ];
  return fields.some(field => {
    if (typeof field === 'boolean') return Boolean(field);
    if (Array.isArray(field)) return Boolean(field.length);
    return Boolean(normalizeText(field));
  });
}

function nearestFuture(events = []) {
  const now = Date.now();
  let best = null;
  for (const event of Array.isArray(events) ? events : []) {
    const ts = toMillis(event.startAt || event.eventDate || event.date || event.startsAt || event.start || event.from);
    if (!ts) continue;
    if (ts < now) continue;
    if (!best || ts < best.ts) {
      best = { event, ts };
    }
  }
  return best;
}

function timeToLabel(ms, nowValue = Date.now()) {
  const now = Math.max(1, Number(nowValue) || Date.now());
  const delta = Number(ms) - now;
  if (!Number.isFinite(delta)) return '';
  if (delta <= 0) return 'сейчас';
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;
  if (delta < hour) return `через ${Math.max(1, Math.floor(delta / minute))} мин`;
  if (delta < day) return `через ${Math.floor(delta / hour)} ч`;
  const days = Math.floor(delta / day);
  return `через ${days} дн`;
}

function profileOfferExpiration(profile = {}) {
  return toMillis(
    profile.offerExpiresAt
    || profile.offerEndAt
    || profile.offerUntil
    || profile.promotionExpiresAt
    || profile.promoUntil
  );
}

function isActiveOffer(profile = {}) {
  const offerText = normalizeText(profile.offer || profile.promotionTitle || profile.promo || profile.discount);
  if (!offerText) return false;
  const endsAt = profileOfferExpiration(profile);
  if (!endsAt) return true;
  return endsAt >= Date.now();
}

function buildOfferUrgency(offerEndsAt, nowValue) {
  const now = Number(nowValue) || Date.now();
  if (!offerEndsAt) return 100;
  const delta = Number(offerEndsAt) - now;
  if (!Number.isFinite(delta)) return 100;
  if (delta <= 0) return 0;
  const day = 24 * 60 * 60 * 1000;
  if (delta <= day) return 130;
  if (delta <= 3 * day) return 125;
  if (delta <= 7 * day) return 118;
  return 100;
}

function getProfileEventText(item = {}, profile = {}, role = 'partner') {
  if (!item || !sameProfile(item, profile, role) || !isPublic(item)) return '';
  const title = String(item.title || item.name || 'Мероприятие');
  const text = firstText(item.shortDescription, item.description, item.address, item.location);
  return text ? `${title}: ${text}` : title;
}

function asHistoryEvent({label, ts, item}) {
  return ts ? { id: `history:${item?.id || String(ts)}:${label}`, title: label, ts, date: new Date(ts).toISOString() } : null;
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

export const TIMELINE_FILTERS = [
  { id: 'feed', label: 'Лента' },
];

export const TIMELINE_SOURCE_META = {
  publication: { label: 'Новость', source: 'news' },
  event: { label: 'Мероприятие', source: 'events' },
  offer: { label: 'Акция', source: 'profile' },
  video: { label: 'Видео', source: 'profile' },
  photo: { label: 'Фото', source: 'profile' },
  review: { label: 'Отзыв', source: 'reviews' },
  vk: { label: 'VK', source: 'vk' },
};

function isPinnedRecord(item = {}, profile = {}) {
  const pinnedIds = [
    profile.pinnedTimelineId,
    profile.pinnedPostId,
    profile.pinnedNewsId,
    profile.pinnedPublicationId,
  ].map(value => String(value || '')).filter(Boolean);
  const itemIds = [
    item.id,
    item.newsId,
    item.eventId,
    item.publicationId,
    item.url,
  ].map(value => String(value || '')).filter(Boolean);
  return Boolean(item.pinned || item.isPinned || item.timelinePinned || item.pinToProfile || itemIds.some(id => pinnedIds.includes(id)));
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
    .map((item, index) => withFeedTimestamp({
      id: timelineId('news', item.id, index),
      type: 'publication',
      label: publicationKind(item),
      title: getNewsTitle(item) || 'Публикация',
      text: firstText(item.summary, item.subtitle, getNewsText(item)),
      image: getNewsImage(item),
      date: item.publishDate || item.publishedAt || item.createdAt || item.created || item.date || item.updatedAt,
      author: item.author || item.sourceName || profile?.name || profile?.title || '',
        source: 'news',
        entity: item,
        action: 'openNews',
        pinned: isPinnedRecord(item, profile),
      },
      item.publishDate,
      item.publishedAt,
      item.createdAt,
      item.created,
      item.date,
      item.updatedAt,
    ));
}

function buildEventItems({ events = [], profile, role }) {
  return (Array.isArray(events) ? events : [])
    .filter(item => sameProfile(item, profile, role) && isPublic(item))
    .map((item, index) => withFeedTimestamp({
      id: timelineId('event', item.id, index),
      type: 'event',
      label: 'Мероприятие',
      title: item.title || item.name || 'Мероприятие',
      text: firstText(item.shortDescription, item.description, item.address, item.location),
      image: item.coverPhoto || item.imageUrl || item.photo || '',
      date: item.publishDate || item.publishedAt || item.createdAt || item.created || item.date || item.startAt || item.eventDate || item.updatedAt,
      author: profile?.name || profile?.title || '',
        source: 'events',
        entity: item,
        action: 'openEvent',
        pinned: isPinnedRecord(item, profile),
      },
      item.publishDate,
      item.publishedAt,
      item.createdAt,
      item.created,
      item.date,
      item.startAt,
      item.eventDate,
      item.updatedAt,
    ));
}

function buildOfferItems({ profile = {} }) {
  const offer = firstText(profile.offer, profile.promotionTitle, profile.promo, profile.discount);
  if (!isActiveOffer(profile)) return [];
  return [withFeedTimestamp({
    id: timelineId('offer', profile.id || profile.name),
    type: 'offer',
    label: 'Акция',
    title: 'Добавлена акция',
    text: offer,
    image: profile.coverPhoto || profile.logoUrl || profile.photo || '',
    date: profile.offerUpdatedAt || profile.promotionUpdatedAt || profile.profileUpdatedAt || profile.updatedAt,
    author: profile.name || profile.title || '',
      source: 'profile',
      entity: profile,
      action: 'openOffer',
      pinned: Boolean(profile.offerPinned || profile.pinnedOffer || profile.pinnedTimelineType === 'offer'),
    },
    profile.offerUpdatedAt,
    profile.promotionUpdatedAt,
    profile.profileUpdatedAt,
    profile.updatedAt,
    profileDate(profile),
  )];
}

function buildVideoItems({ profile = {} }) {
  return (Array.isArray(profile.videos) ? profile.videos : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => toMillis(b.createdAt || b.updatedAt || profile.profileUpdatedAt || profile.updatedAt) - toMillis(a.createdAt || a.updatedAt || profile.profileUpdatedAt || profile.updatedAt))
    .slice(0, 4)
    .map((video, index) => withFeedTimestamp({
    id: timelineId('video', video.id || video.url || video.videoId, index),
    type: 'video',
    label: 'Видео',
    title: video.title || 'Добавлено видео',
    text: video.description || video.url || '',
    image: video.thumbnailUrl || profile.coverPhoto || profile.logoUrl || profile.photo || '',
    date: video.createdAt || video.updatedAt || profile.profileUpdatedAt || profile.updatedAt,
    author: profile.name || profile.title || '',
      source: 'profile',
      entity: video,
      action: 'openVideo',
      pinned: isPinnedRecord(video, profile) || (profile.pinnedTimelineType === 'video' && index === 0),
    },
    video.createdAt,
    video.updatedAt,
    profile.profileUpdatedAt,
    profile.updatedAt,
    profileDate(profile) - index,
  ));
}

function buildPhotoItems({ profile = {} }) {
  const gallery = Array.isArray(profile.gallery) ? profile.gallery : Array.isArray(profile.photos) ? profile.photos : [];
  if (!gallery.length) return [];
  return [withFeedTimestamp({
    id: timelineId('photos', profile.id || profile.name),
    type: 'photo',
    label: 'Фото',
    title: gallery.length > 1 ? 'Обновлена галерея' : 'Добавлено фото',
    text: `${gallery.length} фото в карточке`,
    image: typeof gallery[0] === 'string' ? gallery[0] : gallery[0]?.url || '',
    date: profile.galleryUpdatedAt || profile.profileUpdatedAt || profile.updatedAt,
    author: profile.name || profile.title || '',

    source: 'profile',
    entity: { gallery },
    action: 'openPhotos',
    pinned: Boolean(profile.galleryPinned || profile.photosPinned || profile.pinnedTimelineType === 'photo'),
  },
  profile.galleryUpdatedAt,
  profile.profileUpdatedAt,
  profile.updatedAt,
  profileDate(profile) - 1000,
  )];
}

function buildReviewItems({ reviews = [], profile = {} }) {
  return (Array.isArray(reviews) ? reviews : [])
    .slice()
    .sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt))
    .slice(0, 5)
    .map((review, index) => withFeedTimestamp({
    id: timelineId('review', review.id || review.userId, index),
    type: 'review',
    label: 'Отзыв',
    title: review.userName ? `Отзыв от ${review.userName}` : 'Новый отзыв',
    text: firstText(review.text, review.comment, review.stars || review.rating ? `Оценка: ${review.stars || review.rating}/5` : ''),
    image: review.userPhoto || '',
    date: review.createdAt || review.updatedAt,
    author: review.userName || 'Участник АПГ',
      source: 'reviews',
      entity: review,
      action: 'openReviews',
      pinned: isPinnedRecord(review, profile),
    },
    review.createdAt,
    review.updatedAt,
    profileDate(profile) - 2000 - index,
  ));
}

export function buildProfileTimeline({ profile = {}, role = 'partner', news = [], events = [], reviews = [], vkPosts = [] } = {}) {
  const vkItems = (Array.isArray(vkPosts) ? vkPosts : []).map((post, index) => withFeedTimestamp({
    id: timelineId('vk', post.id || post.url, index),
    type: 'vk',
    label: 'VK',
    title: post.title || 'Публикация сообщества',
    text: firstText(post.text, post.summary),
    image: post.image || post.photo || '',
    date: post.publishDate || post.publishedAt || post.createdAt || post.created || post.date || post.updatedAt,
    author: profile.name || profile.title || '',
      source: 'vk',
      entity: post,
      action: 'openExternal',
      url: post.url,
      pinned: isPinnedRecord(post, profile),
    },
    post.publishDate,
    post.publishedAt,
    post.createdAt,
    post.created,
    post.date,
    post.updatedAt,
    Date.now() - index,
  ));

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
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.feedTimestamp || 0) - (a.feedTimestamp || 0))
    .slice(0, 24);
}

export function buildProfileNowPriority({ profile = {}, role = 'partner', news = [], events = [], reviews = [], vkPosts = [], nowValue = Date.now() } = {}) {
  const now = Number(nowValue) || Date.now();
  const normalizedNow = isFinite(now) ? now : Date.now();
  const offerText = normalizeText(profile.offer || profile.promotionTitle || profile.promo || profile.discount);
  const offerEndsAt = profileOfferExpiration(profile);
  const eventsNow = nearestFuture(events);
  const latestNews = Array.isArray(news) ? news
    .filter(item => sameProfile(item, profile, role) && isPublic(item))
    .sort((a, b) => toMillis(b.publishedAt || b.updatedAt || b.createdAt) - toMillis(a.publishedAt || a.updatedAt || a.createdAt))[0] : null;
  const latestReview = Array.isArray(reviews) ? [...reviews]
    .sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt))[0] : null;
  const latestVk = Array.isArray(vkPosts) ? [...vkPosts]
    .sort((a, b) => toMillis(b.date || b.publishedAt || b.createdAt) - toMillis(a.date || a.publishedAt || a.createdAt))[0] : null;
  const hasGallery = (Array.isArray(profile.gallery) && profile.gallery.length > 0)
    || (Array.isArray(profile.photos) && profile.photos.length > 0);
  const galleryTs = toMillis(profile.galleryUpdatedAt || profile.galleryDate || profile.updatedAt || profile.profileUpdatedAt);
  const latestVideo = (Array.isArray(profile.videos) ? profile.videos : [])
    .slice()
    .sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt))[0];

  const candidates = [];
  if (offerText && isActiveOffer(profile)) {
    const offerUrgency = buildOfferUrgency(offerEndsAt, normalizedNow);
    candidates.push({
      id: 'important-offer',
      type: 'offer',
      title: 'Акция активна',
      value: offerText,
      details: offerEndsAt ? `до ${new Date(offerEndsAt).toLocaleDateString('ru-RU')}` : 'действует',
      action: 'openOffer',
      onOpen: null,
      ts: offerEndsAt || normalizedNow,
      priority: offerUrgency,
    });
  }
  if (eventsNow) {
    const ts = eventsNow.ts;
    const urgencyFromEvent = Math.max(80, 100 - Math.floor((ts - normalizedNow) / (60 * 60 * 1000)));
    candidates.push({
      id: 'important-event',
      type: 'event',
      title: 'Ближайшее мероприятие',
      value: getProfileEventText(eventsNow.event, profile, role) || 'Мероприятие',
      details: `событие ${timeToLabel(ts, normalizedNow)}`,
      action: 'openEvent',
      onOpen: eventsNow.event,
      ts,
      priority: urgencyFromEvent,
    });
  }
  if (hasBookingChannels(profile)) {
    candidates.push({
      id: 'important-booking',
      type: 'booking',
      title: 'Свободная запись',
      value: 'Возможно записаться онлайн',
      details: 'доступна запись',
      action: 'openBooking',
      ts: normalizedNow + 1,
      priority: 75,
    });
  }
  if (latestNews) {
    const ts = toMillis(latestNews.publishedAt || latestNews.updatedAt || latestNews.createdAt);
    if (ts >= normalizedNow - 14 * 24 * 60 * 60 * 1000) {
      const recencyPenalty = Math.floor((normalizedNow - ts) / (24 * 60 * 60 * 1000));
      candidates.push({
        id: 'important-news',
        type: 'publication',
        title: 'Новая публикация',
        value: latestNews.title || getNewsTitle(latestNews),
        details: timeToLabel(ts, normalizedNow),
        action: 'openNews',
        onOpen: latestNews,
        ts,
        priority: Math.max(48, 68 - recencyPenalty),
      });
    }
  }
  if (latestVideo) {
    const ts = toMillis(latestVideo.createdAt || latestVideo.updatedAt);
    if (ts >= normalizedNow - 21 * 24 * 60 * 60 * 1000) {
      const recencyPenalty = Math.floor((normalizedNow - ts) / (24 * 60 * 60 * 1000));
      candidates.push({
        id: 'important-video',
        type: 'video',
        title: 'Новое видео',
        value: latestVideo.title || 'Новое видео',
        details: timeToLabel(ts, normalizedNow),
        action: 'openVideo',
        onOpen: latestVideo,
        ts,
        priority: Math.max(46, 64 - recencyPenalty),
      });
    }
  }
  if (latestReview) {
    const ts = toMillis(latestReview.createdAt || latestReview.updatedAt);
    if (ts >= normalizedNow - 21 * 24 * 60 * 60 * 1000) {
      const recencyPenalty = Math.floor((normalizedNow - ts) / (24 * 60 * 60 * 1000));
      candidates.push({
        id: 'important-review',
        type: 'review',
        title: 'Новый отзыв',
        value: latestReview.userName ? `оценка ${latestReview.stars || latestReview.rating || '?'} / 5` : 'Новый отзыв',
        details: timeToLabel(ts, normalizedNow),
        action: 'openReviews',
        ts,
        priority: Math.max(44, 60 - recencyPenalty),
      });
    }
  }
  if (hasGallery) {
    candidates.push({
      id: 'important-photo',
      type: 'photo',
      title: 'Новая галерея',
      value: `Фотоматериалы: ${(Array.isArray(profile.gallery) ? profile.gallery.length : 0) || (Array.isArray(profile.photos) ? profile.photos.length : 0)} шт.`,
      details: galleryTs ? timeToLabel(galleryTs, normalizedNow) : 'обновлена',
      action: 'openPhotos',
      ts: galleryTs || normalizedNow,
      priority: 58,
    });
  }
  if (latestVk) {
    const ts = toMillis(latestVk.date || latestVk.publishedAt || latestVk.createdAt);
    if (ts >= normalizedNow - 21 * 24 * 60 * 60 * 1000) {
      candidates.push({
        id: 'important-vk',
        type: 'vk',
        title: 'Публикация в VK',
        value: normalizeText(latestVk.title || latestVk.text),
        details: timeToLabel(ts, normalizedNow),
        action: 'openExternal',
        url: latestVk.url,
        ts,
        priority: 50,
      });
    }
  }

  return candidates
    .filter(item => item.value)
    .sort((a, b) => {
      const urgencyDelta = Number(b.priority) - Number(a.priority);
      if (urgencyDelta !== 0) return urgencyDelta;
      return (b.ts || 0) - (a.ts || 0);
    });
}

export function buildProfileHistory({ profile = {}, role = 'partner', news = [], events = [], reviews = [], vkPosts = [] } = {}) {
  const eventsList = [];
  const profileCreated = toMillis(profile.createdAt || profile.publishedAt);
  if (profileCreated) {
    eventsList.push(asHistoryEvent({
      label: `Становление ${role === 'expert' ? 'эксперта' : 'партнёром АПГ'}`,
      ts: profileCreated,
      item: { id: `created-${profile.id || profile.name}` },
    }));
  }

  if (profile.offer || profile.promotionTitle || profile.discount || profile.promo) {
    const ts = toMillis(profile.offerUpdatedAt || profile.promotionUpdatedAt || profile.profileUpdatedAt || profile.updatedAt);
    eventsList.push(asHistoryEvent({
      label: 'Появилась акция',
      ts,
      item: { id: `offer-${profile.id || profile.name}` },
    }));
  }

  const sortedNews = Array.isArray(news)
    ? news.filter(item => sameProfile(item, profile, role) && isPublic(item))
        .sort((a, b) => toMillis(b.publishedAt || b.updatedAt || b.createdAt) - toMillis(a.publishedAt || a.updatedAt || a.createdAt))
    : [];
  if (sortedNews.length) {
    const firstNews = sortedNews[sortedNews.length - 1];
    eventsList.push(asHistoryEvent({
      label: `Появилась первая публикация: ${getNewsTitle(firstNews) || 'публикация'}`,
      ts: toMillis(firstNews.publishedAt || firstNews.updatedAt || firstNews.createdAt),
      item: { id: firstNews.id },
    }));
  }

  const sortedEvents = Array.isArray(events)
    ? events.filter(item => sameProfile(item, profile, role) && isPublic(item))
        .sort((a, b) => toMillis(b.publishedAt || b.updatedAt || b.eventDate || b.date || b.createdAt) - toMillis(a.publishedAt || a.updatedAt || a.eventDate || a.date || a.createdAt))
    : [];
  if (sortedEvents.length) {
    const firstEvent = sortedEvents[sortedEvents.length - 1];
    eventsList.push(asHistoryEvent({
      label: `Появилось первое мероприятие: ${firstEvent.title || firstEvent.name || 'мероприятие'}`,
      ts: toMillis(firstEvent.publishedAt || firstEvent.startAt || firstEvent.eventDate || firstEvent.date || firstEvent.createdAt),
      item: { id: firstEvent.id },
    }));
  }

  const sortedReviews = Array.isArray(reviews)
    ? [...reviews].sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt))
    : [];
  if (sortedReviews.length) {
    const firstReview = sortedReviews[sortedReviews.length - 1];
    eventsList.push(asHistoryEvent({
      label: `Получен первый отзыв от ${firstReview.userName || 'участника'}`,
      ts: toMillis(firstReview.createdAt || firstReview.updatedAt),
      item: { id: firstReview.id },
    }));
  }

  if ((Array.isArray(profile.videos) && profile.videos.length) || (Array.isArray(vkPosts) && vkPosts.length)) {
    const source = Array.isArray(profile.videos) && profile.videos.length ? profile.videos : vkPosts;
    const firstVideo = source[0];
    const ts = toMillis(firstVideo.createdAt || firstVideo.updatedAt || firstVideo.date || firstVideo.publishedAt || profile.profileUpdatedAt);
    eventsList.push(asHistoryEvent({
      label: `Опубликовано первое видео: ${firstVideo.title || 'видео'}`,
      ts,
      item: { id: firstVideo.id || firstVideo.url || 'video' },
    }));
  }

  return eventsList.filter(Boolean)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 12);
}

export function buildProfileSmartSummary({
  news = [],
  events = [],
  reviews = [],
  nowValue = Date.now(),
} = {}) {
  const now = Number(nowValue) || Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const countInRange = (list = []) => (
    Array.isArray(list)
      ? list.filter(item => isPublic(item) && toMillis(item.publishedAt || item.updatedAt || item.createdAt || item.date || item.startAt || item.eventDate) >= monthAgo).length
      : 0
  );
  const reviewsInRange = (list = []) => (
    Array.isArray(list) ? list.filter(item => toMillis(item.createdAt || item.updatedAt) >= monthAgo).length : 0
  );
  return {
    publications: countInRange(news),
    events: countInRange(events),
    reviews: reviewsInRange(reviews),
  };
}

export function getProfileTimelineSourceTypes(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map(item => item.type).filter(Boolean)));
}

export function filterProfileTimelineItems(items = [], filterId = 'all') {
  const list = Array.isArray(items) ? items : [];
  if (!filterId || filterId === 'all' || filterId === 'feed') return list;
  return list.filter(item => item.type === filterId);
}

export function getTimelinePeriodLabel(value, nowValue = Date.now()) {
  const ms = toMillis(value);
  if (!ms) return 'Раньше';
  const date = new Date(ms);
  const now = new Date(nowValue);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day >= startOfToday) return 'Сегодня';
  if (day >= startOfYesterday) return 'Вчера';
  const startOfWeek = startOfToday - ((now.getDay() + 6) % 7) * 24 * 60 * 60 * 1000;
  if (day >= startOfWeek) return 'Эта неделя';
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (day >= startOfMonth) return 'Этот месяц';
  return 'Раньше';
}

export function groupProfileTimelineItems(items = [], nowValue = Date.now()) {
  const groups = [];
  const pinned = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.pinned) {
      pinned.push(item);
      continue;
    }
    const label = getTimelinePeriodLabel(item?.date || item?.ts, nowValue);
    let group = groups.find(entry => entry.label === label);
    if (!group) {
      group = { id: `period-${groups.length}-${label}`, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  const byNewest = (a, b) => (b.feedTimestamp || b.ts || 0) - (a.feedTimestamp || a.ts || 0);
  const sortedGroups = groups.map(group => ({ ...group, items: group.items.slice().sort(byNewest) }));
  return pinned.length ? [{ id: 'pinned', label: 'Закреплено', items: pinned.slice().sort(byNewest) }, ...sortedGroups] : sortedGroups;
}
