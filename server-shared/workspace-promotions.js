import { CONTENT_STATUS_LABELS, normalizeContentStatus } from './content-lifecycle.js';

export const WORKSPACE_PROMOTION_TYPES = [
  { id: 'discount', label: 'Скидка' },
  { id: 'coupon', label: 'Купон' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'bonus', label: 'Бонус' },
  { id: 'gift', label: 'Подарок' },
  { id: 'bundle', label: 'Комплект' },
  { id: 'special_offer', label: 'Спецпредложение' },
];

export const WORKSPACE_PROMOTION_FIELDS = [
  'title',
  'description',
  'offer',
  'coverPhoto',
  'imageUrl',
  'gallery',
  'category',
  'promotionType',
  'discountPercent',
  'discountFixed',
  'gift',
  'conditions',
  'restrictions',
  'startAt',
  'endAt',
  'limit',
  'quantity',
  'remaining',
  'cost',
  'price',
  'currency',
  'buttonLabel',
  'buttonUrl',
  'ctaButtons',
  'links',
  'themeColor',
  'tags',
  'seoTitle',
  'seoDescription',
  'eventId',
  'newsId',
  'serviceId',
  'profileId',
  'status',
];

const ARRAY_FIELDS = new Set(['gallery', 'ctaButtons', 'links', 'tags']);
const NUMBER_FIELDS = new Set(['discountPercent', 'discountFixed', 'limit', 'quantity', 'remaining', 'cost', 'price']);

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function number(value, max = 100000000) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(max, num));
}

export function workspacePromotionStatus(item = {}) {
  const raw = normalizeContentStatus({
    status: item.promotionStatus || item.status,
    moderationStatus: item.promotionModerationStatus || item.moderationStatus,
    lifecycleStatus: item.promotionLifecycleStatus || item.lifecycleStatus,
    contentStatus: item.promotionContentStatus || item.contentStatus,
    archived: item.archived,
    active: item.active,
  });
  if (raw === 'deleted' || raw === 'trash') return 'archived';
  if (raw === 'pending_review') return 'moderation';
  if (raw && raw !== 'published') return raw;
  if (item.offer || item.promo || item.discount || item.specialOffer || item.promotion?.offer) return 'published';
  return item.promotionDraft || item.promotionPendingPatch ? 'draft' : 'draft';
}

export function workspacePromotionStatusLabel(item = {}) {
  const status = workspacePromotionStatus(item);
  return CONTENT_STATUS_LABELS[status] || {
    revision: 'На доработку',
    rejected: 'Отклонено',
    moderation: 'На модерации',
    archived: 'Архив',
  }[status] || 'Черновик';
}

export function sanitizeWorkspacePromotionPatch(patch = {}) {
  const clean = {};
  for (const field of WORKSPACE_PROMOTION_FIELDS) {
    if (!Object.hasOwn(patch, field)) continue;
    const value = patch[field];
    if (ARRAY_FIELDS.has(field)) clean[field] = Array.isArray(value) ? value.slice(0, field === 'tags' ? 24 : 40) : [];
    else if (NUMBER_FIELDS.has(field)) clean[field] = number(value, field === 'discountPercent' ? 100 : 100000000);
    else if (field === 'description' || field === 'conditions' || field === 'restrictions') clean[field] = text(value, 4000);
    else if (field === 'status') {
      const status = text(value, 40);
      if (['draft', 'moderation', 'published', 'revision', 'archived', 'rejected'].includes(status)) clean[field] = status;
    } else clean[field] = text(value, 1200);
  }
  if (!clean.offer) clean.offer = buildPromotionOfferText(clean);
  return clean;
}

export function buildPromotionOfferText(patch = {}) {
  return text(patch.offer || [patch.title, patch.description].filter(Boolean).join(' — '), 1200);
}

export function buildWorkspacePromotionStats(profile = {}) {
  const stats = object(profile.promotionStats || profile.offerStats || profile.stats);
  const views = number(stats.views ?? profile.offerViews ?? profile.promotionViews ?? 0);
  const claimed = number(stats.claimed ?? profile.offerClaimed ?? profile.offerClaimedCount ?? profile.promotionClaimed ?? 0);
  const used = number(stats.used ?? profile.offerUsed ?? profile.promotionUsed ?? 0);
  const conversion = views ? Math.round((used / views) * 1000) / 10 : 0;
  return {
    views,
    claimed,
    used,
    conversion,
    sources: object(stats.sources || profile.promotionSources),
    lastClaimedAt: stats.lastClaimedAt || profile.lastOfferClaimedAt || profile.promotionLastClaimedAt || '',
  };
}

export function buildWorkspacePromotionFromProfile(profile = {}, role = 'partner') {
  const type = role === 'expert' ? 'expert' : 'partner';
  const status = workspacePromotionStatus(profile);
  const draft = object(profile.promotionDraft);
  const pending = object(profile.promotionPendingPatch);
  const published = object(profile.promotion);
  const editable = status === 'moderation' && Object.keys(pending).length ? pending : status === 'draft' && Object.keys(draft).length ? draft : published;
  const title = text(editable.title || profile.offerTitle || profile.promoTitle || profile.name || profile.title || 'Акция', 220);
  const offer = text(editable.offer || profile.offer || profile.promo || profile.discount || profile.specialOffer || buildPromotionOfferText(editable), 1200);
  const description = text(editable.description || profile.offerDescription || profile.description || profile.shortDescription, 4000);
  const stats = buildWorkspacePromotionStats(profile);
  return {
    id: `${type}:${profile.id || 'profile'}:main`,
    profileId: text(profile.id, 180),
    profileType: type,
    ownerProfileType: type,
    ownerProfileId: text(profile.id, 180),
    profileName: text(profile.name || profile.title || profile.displayName, 220),
    title,
    description,
    offer,
    coverPhoto: text(editable.coverPhoto || editable.imageUrl || profile.coverPhoto || profile.logoUrl || profile.photo, 1200),
    imageUrl: text(editable.imageUrl || editable.coverPhoto || profile.coverPhoto || profile.logoUrl || profile.photo, 1200),
    gallery: Array.isArray(editable.gallery) ? editable.gallery : Array.isArray(profile.gallery) ? profile.gallery : [],
    category: text(editable.category || profile.category || profile.primaryCategory || '', 160),
    promotionType: text(editable.promotionType || profile.promotionType || 'special_offer', 80),
    discountPercent: number(editable.discountPercent || profile.discountPercent || 0, 100),
    discountFixed: number(editable.discountFixed || profile.discountFixed || 0),
    gift: text(editable.gift || profile.gift, 800),
    conditions: text(editable.conditions || profile.offerConditions, 4000),
    restrictions: text(editable.restrictions || profile.offerRestrictions, 4000),
    startAt: text(editable.startAt || profile.offerStartAt || '', 120),
    endAt: text(editable.endAt || profile.offerUntil || profile.offerEndAt || '', 120),
    limit: number(editable.limit || profile.offerLimit || 0),
    quantity: number(editable.quantity || profile.offerQuantity || 0),
    remaining: number(editable.remaining ?? profile.offerRemaining ?? editable.quantity ?? 0),
    cost: number(editable.cost || editable.price || profile.offerCost || 0),
    price: number(editable.price || editable.cost || profile.offerPrice || 0),
    currency: text(editable.currency || profile.currency || 'RUB', 20),
    buttonLabel: text(editable.buttonLabel || profile.offerButtonLabel || 'Открыть', 80),
    buttonUrl: text(editable.buttonUrl || profile.offerButtonUrl || profile.websiteUrl || '', 1200),
    ctaButtons: Array.isArray(editable.ctaButtons) ? editable.ctaButtons : [],
    links: Array.isArray(editable.links) ? editable.links : [],
    themeColor: text(editable.themeColor || profile.themeColor || '', 40),
    tags: Array.isArray(editable.tags) ? editable.tags : [],
    seoTitle: text(editable.seoTitle || profile.offerSeoTitle || '', 220),
    seoDescription: text(editable.seoDescription || profile.offerSeoDescription || '', 500),
    eventId: text(editable.eventId || profile.offerEventId || '', 180),
    newsId: text(editable.newsId || profile.offerNewsId || '', 180),
    serviceId: text(editable.serviceId || profile.offerServiceId || '', 180),
    status,
    promotionStatus: status,
    promotionLifecycleStatus: profile.promotionLifecycleStatus || status,
    promotionContentStatus: profile.promotionContentStatus || status,
    active: status === 'published',
    stats,
    views: stats.views,
    claimed: stats.claimed,
    used: stats.used,
    conversion: stats.conversion,
    updatedAt: profile.promotionUpdatedAt || profile.profileUpdatedAt || profile.updatedAt || profile.createdAt || '',
    createdAt: profile.createdAt || '',
  };
}

export function buildWorkspacePromotionSearchText(item = {}) {
  return [
    item.id,
    item.title,
    item.description,
    item.offer,
    item.profileName,
    item.category,
    item.promotionType,
    item.conditions,
    item.restrictions,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(value => text(value, 1000).toLowerCase()).filter(Boolean).join(' ');
}

export function buildWorkspacePromotionKpis(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const status = workspacePromotionStatus(item);
    acc.total += 1;
    acc[status] = (acc[status] || 0) + 1;
    const stats = item.stats || {};
    acc.views += number(stats.views ?? item.views ?? 0);
    acc.claimed += number(stats.claimed ?? item.claimed ?? 0);
    acc.used += number(stats.used ?? item.used ?? 0);
    return acc;
  }, { total: 0, draft: 0, moderation: 0, published: 0, archived: 0, revision: 0, rejected: 0, views: 0, claimed: 0, used: 0 });
}

export function filterWorkspacePromotions(items = [], { query = '', status = 'active', category = 'all', period = 'all', view = 'cards' } = {}) {
  const q = text(query, 300).toLowerCase();
  const now = Date.now();
  const dayMs = 86400000;
  return (Array.isArray(items) ? items : []).filter(item => {
    const itemStatus = workspacePromotionStatus(item);
    if (status !== 'all') {
      if (status === 'active') {
        if (itemStatus === 'archived' || itemStatus === 'rejected') return false;
      } else if (status !== itemStatus) return false;
    }
    if (category !== 'all' && String(item.category || '') !== category) return false;
    if (period !== 'all') {
      const raw = item.endAt || item.startAt || item.updatedAt || item.createdAt;
      const ms = raw?.toMillis ? raw.toMillis() : raw?.toDate ? raw.toDate().getTime() : new Date(raw || 0).getTime();
      if (!Number.isFinite(ms) || ms <= 0) return false;
      if (period === 'today' && new Date(ms).toDateString() !== new Date(now).toDateString()) return false;
      if (period === 'week' && Math.abs(now - ms) > 7 * dayMs) return false;
      if (period === 'month' && Math.abs(now - ms) > 31 * dayMs) return false;
    }
    if (view === 'calendar' && !item.startAt && !item.endAt) return false;
    return !q || buildWorkspacePromotionSearchText(item).includes(q);
  });
}
