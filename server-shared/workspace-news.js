import { CONTENT_STATUS_LABELS, normalizeContentStatus } from './content-lifecycle.js';

export const WORKSPACE_NEWS_FIELDS = [
  'title',
  'subtitle',
  'summary',
  'text',
  'fullText',
  'author',
  'sourceName',
  'source',
  'expiresAt',
  'tags',
  'emoji',
  'imageUrl',
  'coverPhoto',
  'photos',
  'photoItems',
  'gallery',
  'videos',
  'links',
  'socialLinks',
  'contentBlocks',
  'faq',
  'ctaButtons',
  'docs',
  'linkUrl',
  'linkLabel',
  'priority',
  'category',
  'publicationType',
  'timelineType',
  'distributionMode',
  'visibility',
  'publishScope',
  'apgPublication',
  'profileOnly',
  'active',
  'status',
  'publishedAt',
  'scheduledAt',
  'pinned',
  'isPinned',
  'commentsEnabled',
  'seoTitle',
  'seoDescription',
  'adminComment',
];

const ARRAY_FIELDS = new Set(['tags', 'photos', 'photoItems', 'gallery', 'videos', 'links', 'socialLinks', 'contentBlocks', 'faq', 'ctaButtons', 'docs']);
const APG_DISTRIBUTION_VALUES = new Set(['apg', 'city', 'public', 'global', 'apg_news']);
const PROFILE_DISTRIBUTION_VALUES = new Set(['profile', 'profile_only', 'timeline', 'card', 'local']);

function text(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

export function workspaceNewsStatus(item = {}) {
  const status = normalizeContentStatus(item);
  if (status === 'deleted' || status === 'trash') return 'archived';
  return status;
}

export function workspaceNewsStatusLabel(item = {}) {
  return CONTENT_STATUS_LABELS[workspaceNewsStatus(item)] || 'Статус';
}

export function workspaceNewsBelongsToProfile(item = {}, profile = {}, role = 'partner') {
  if (!item || !profile?.id) return false;
  const profileId = String(profile.id);
  if (role === 'expert') {
    return [item.expertId, item.authorExpertId, item.profileId, item.ownerProfileId, item.submittedProfileId].some(value => String(value || '') === profileId)
      || (Array.isArray(item.expertIds) && item.expertIds.map(String).includes(profileId));
  }
  return [item.partnerId, item.authorPartnerId, item.profileId, item.ownerProfileId, item.submittedProfileId].some(value => String(value || '') === profileId)
    || (Array.isArray(item.partnerIds) && item.partnerIds.map(String).includes(profileId));
}

export function normalizeWorkspaceNewsDistribution(item = {}) {
  const explicit = [
    item.distributionMode,
    item.visibility,
    item.publishScope,
    item.audience,
  ].map(value => text(value, 80).toLowerCase()).find(Boolean);
  if (item.profileOnly === true || PROFILE_DISTRIBUTION_VALUES.has(explicit)) return 'profile';
  if (item.apgPublication === true || item.publishToApg === true || APG_DISTRIBUTION_VALUES.has(explicit)) return 'apg';
  if (item.submittedAt || item.submittedByUserId || item.moderationRequestedAt) return 'apg';
  const moderation = text(item.moderationStatus, 80).toLowerCase();
  if (['pending_review', 'approved', 'published_to_apg'].includes(moderation)) return 'apg';
  if ((item.ownerProfileId || item.profileId || item.submittedProfileId) && text(item.source, 80).toLowerCase() === 'workspace') return 'profile';
  return 'apg';
}

export function isProfileOnlyNews(item = {}) {
  return normalizeWorkspaceNewsDistribution(item) === 'profile';
}

export function isApgNewsPublication(item = {}) {
  return normalizeWorkspaceNewsDistribution(item) === 'apg';
}

export function buildProfileOnlyNewsPatch() {
  return {
    distributionMode: 'profile',
    visibility: 'profile',
    publishScope: 'profile',
    apgPublication: false,
    profileOnly: true,
  };
}

export function buildApgNewsDistributionPatch() {
  return {
    distributionMode: 'apg',
    visibility: 'public',
    publishScope: 'apg',
    apgPublication: true,
    profileOnly: false,
  };
}

export function sanitizeWorkspaceNewsPatch(patch = {}) {
  const clean = {};
  for (const field of WORKSPACE_NEWS_FIELDS) {
    if (!Object.hasOwn(patch, field)) continue;
    const value = patch[field];
    if (ARRAY_FIELDS.has(field)) clean[field] = Array.isArray(value) ? value.slice(0, field === 'tags' ? 24 : 40) : [];
    else if (field === 'priority') clean[field] = Math.max(0, Math.min(99, Number(value || 0)));
    else if (field === 'active' || field === 'pinned' || field === 'isPinned' || field === 'commentsEnabled' || field === 'apgPublication' || field === 'profileOnly') clean[field] = value !== false;
    else if (field === 'text' || field === 'fullText') clean[field] = text(value, 20000);
    else if (field === 'summary' || field === 'subtitle' || field === 'seoDescription') clean[field] = text(value, 1000);
    else if (field === 'publicationType' || field === 'timelineType') clean[field] = text(value, 80);
    else clean[field] = text(value, 1200);
  }
  return clean;
}

export function buildWorkspaceNewsSearchText(item = {}) {
  return [
    item.id,
    item.title,
    item.subtitle,
    item.summary,
    item.text,
    item.fullText,
    item.category,
    item.author,
    item.source,
    item.sourceName,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(value => text(value, 1000).toLowerCase()).filter(Boolean).join(' ');
}

export function buildWorkspaceNewsKpis(items = []) {
  const lifecycle = (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const status = workspaceNewsStatus(item);
    acc.total += 1;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { total: 0, draft: 0, moderation: 0, scheduled: 0, published: 0, archived: 0 });
  const stats = items.reduce((acc, item) => {
    const s = item.stats || {};
    acc.views += Number(s.views ?? item.views ?? item.viewCount ?? 0) || 0;
    acc.comments += Number(s.comments ?? item.comments ?? 0) || 0;
    acc.clicks += Number(s.clicks ?? item.clicks ?? item.linkClicks ?? 0) || 0;
    acc.likes += Number(s.likes ?? item.likes ?? 0) || 0;
    return acc;
  }, { views: 0, comments: 0, clicks: 0, likes: 0 });
  return {
    total: lifecycle.total,
    draft: lifecycle.draft,
    moderation: lifecycle.moderation,
    published: lifecycle.published,
    scheduled: lifecycle.scheduled,
    archived: lifecycle.archived,
    ...stats,
  };
}

export function filterWorkspaceNews(items = [], { query = '', status = 'active', category = 'all', period = 'all', view = 'cards' } = {}) {
  const q = text(query, 300).toLowerCase();
  const now = Date.now();
  const dayMs = 86400000;
  return items.filter(item => {
    const itemStatus = workspaceNewsStatus(item);
    if (status !== 'all') {
      if (status === 'active') {
        if (itemStatus === 'archived') return false;
      } else if (status !== itemStatus) return false;
    }
    if (category !== 'all' && String(item.category || '') !== category) return false;
    if (period !== 'all') {
      const raw = item.scheduledAt || item.publishedAt || item.updatedAt || item.createdAt;
      const ms = raw?.toMillis ? raw.toMillis() : raw?.toDate ? raw.toDate().getTime() : new Date(raw || 0).getTime();
      if (!Number.isFinite(ms) || ms <= 0) return false;
      if (period === 'today' && new Date(ms).toDateString() !== new Date(now).toDateString()) return false;
      if (period === 'week' && Math.abs(now - ms) > 7 * dayMs) return false;
      if (period === 'month' && Math.abs(now - ms) > 31 * dayMs) return false;
    }
    if (view === 'calendar' && !item.scheduledAt && !item.publishedAt) return false;
    return !q || buildWorkspaceNewsSearchText(item).includes(q);
  });
}

export function buildWorkspaceNewsFromEvent(event = {}, profile = {}, role = 'partner') {
  const title = text(event.title || event.name || 'Новость по мероприятию', 220);
  const eventDate = text(event.startAt || event.eventDate || event.date, 120);
  const place = text(event.address || event.location || event.place || event.venue, 220);
  const body = [
    event.description || event.fullDescription || '',
    eventDate ? `Дата: ${eventDate}` : '',
    place ? `Место: ${place}` : '',
  ].filter(Boolean).join('\n\n');
  return {
    title,
    subtitle: eventDate ? `Мероприятие ${eventDate}` : 'Мероприятие АПГ',
    summary: text(event.description || event.shortDescription || '', 500),
    text: body || title,
    category: 'events',
    publicationType: 'Анонс',
    timelineType: 'event-announcement',
    coverPhoto: text(event.coverPhoto || event.imageUrl || event.photo || '', 1200),
    imageUrl: text(event.coverPhoto || event.imageUrl || event.photo || '', 1200),
    gallery: Array.isArray(event.gallery) ? event.gallery : [],
    photos: Array.isArray(event.photos) ? event.photos : [],
    videos: Array.isArray(event.videos) ? event.videos : [],
    links: Array.isArray(event.links) ? event.links : [],
    eventId: text(event.id, 160),
    source: 'workspace-event',
    sourceName: text(profile.name || profile.title || 'Workspace', 200),
    status: 'draft',
    active: false,
    ...buildProfileOnlyNewsPatch(),
    commentsEnabled: true,
    [role === 'expert' ? 'expertId' : 'partnerId']: text(profile.id, 160),
  };
}
