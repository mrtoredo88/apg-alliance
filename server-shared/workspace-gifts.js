import { CONTENT_STATUS_LABELS, normalizeContentStatus } from './content-lifecycle.js';

export const WORKSPACE_GIFT_TYPES = [
  { id: 'purchase', label: 'Подарок за ключи' },
  { id: 'reward', label: 'Бонус' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'discount', label: 'Скидка' },
  { id: 'service', label: 'Услуга' },
  { id: 'merch', label: 'Мерч' },
  { id: 'bundle', label: 'Подарочный набор' },
  { id: 'digital', label: 'Электронный подарок' },
  { id: 'raffle', label: 'Розыгрыш' },
  { id: 'closed_event', label: 'Закрытое мероприятие' },
  { id: 'exclusive', label: 'Эксклюзив' },
];

export const WORKSPACE_GIFT_FIELDS = [
  'name',
  'title',
  'description',
  'coverPhoto',
  'imageUrl',
  'gallery',
  'type',
  'opportunityType',
  'conditions',
  'rules',
  'restrictions',
  'cost',
  'ticketCost',
  'limit',
  'stock',
  'quantity',
  'remaining',
  'startAt',
  'endAt',
  'raffleDate',
  'emoji',
  'color',
  'themeColor',
  'tags',
  'buttonLabel',
  'buttonUrl',
  'ctaButtons',
  'links',
  'seoTitle',
  'seoDescription',
  'partnerId',
  'expertId',
  'eventId',
  'promotionId',
  'newsId',
  'taskId',
  'qrValue',
  'qrCode',
  'active',
  'status',
];

const ARRAY_FIELDS = new Set(['gallery', 'tags', 'ctaButtons', 'links']);
const NUMBER_FIELDS = new Set(['cost', 'ticketCost', 'limit', 'stock', 'quantity', 'remaining']);

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function num(value, max = 100000000) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function normalizeGiftOpportunityType(type = 'purchase') {
  const clean = text(type || 'purchase', 80);
  if (clean === 'closed_event') return 'closed_event';
  if (clean === 'raffle') return 'raffle';
  if (clean === 'certificate') return 'certificate';
  if (clean === 'discount') return 'discount';
  if (clean === 'exclusive') return 'exclusive';
  return 'reward';
}

export function workspaceGiftStatus(item = {}) {
  const status = normalizeContentStatus(item);
  if (status === 'deleted' || status === 'trash') return 'archived';
  if (status === 'pending_review') return 'moderation';
  return status;
}

export function workspaceGiftStatusLabel(item = {}) {
  return CONTENT_STATUS_LABELS[workspaceGiftStatus(item)] || {
    revision: 'Замечания',
    rejected: 'Отклонено',
    moderation: 'На модерации',
  }[workspaceGiftStatus(item)] || 'Черновик';
}

export function workspaceGiftBelongsToProfile(item = {}, profile = {}, role = 'partner') {
  if (!item || !profile?.id) return false;
  const id = String(profile.id);
  if (role === 'expert') return [item.expertId, item.ownerProfileId, item.profileId, item.donorExpertId].some(value => String(value || '') === id);
  return [item.partnerId, item.ownerProfileId, item.profileId, item.donorPartnerId].some(value => String(value || '') === id);
}

export function sanitizeWorkspaceGiftPatch(patch = {}) {
  const clean = {};
  for (const field of WORKSPACE_GIFT_FIELDS) {
    if (!Object.hasOwn(patch, field)) continue;
    const value = patch[field];
    if (ARRAY_FIELDS.has(field)) clean[field] = Array.isArray(value) ? value.slice(0, field === 'tags' ? 24 : 40) : [];
    else if (NUMBER_FIELDS.has(field)) clean[field] = value === '' || value === null ? null : num(value);
    else if (field === 'active') clean[field] = value !== false;
    else if (field === 'description' || field === 'conditions' || field === 'rules' || field === 'restrictions') clean[field] = text(value, 4000);
    else if (field === 'status') {
      const status = text(value, 40);
      if (['draft', 'moderation', 'published', 'revision', 'archived', 'rejected'].includes(status)) clean[field] = status;
    } else clean[field] = text(value, 1200);
  }
  clean.type = text(clean.type || clean.opportunityType || 'purchase', 80);
  clean.opportunityType = text(clean.opportunityType || normalizeGiftOpportunityType(clean.type), 80);
  if (!clean.name && clean.title) clean.name = clean.title;
  if (!clean.title && clean.name) clean.title = clean.name;
  return clean;
}

export function buildWorkspaceGiftStats(gift = {}, claims = [], entries = []) {
  const stats = object(gift.stats || gift.giftStats || gift.prizeStats);
  const claimRows = claims.filter(claim => String(claim.prizeId || '') === String(gift.id || ''));
  const entryRows = entries.filter(entry => String(entry.prizeId || '') === String(gift.id || ''));
  const issued = claimRows.filter(claim => ['given', 'issued', 'completed'].includes(String(claim.status || '').toLowerCase())).length;
  const received = claimRows.length;
  const views = num(stats.views ?? gift.views ?? gift.viewCount ?? 0);
  const entriesCount = entryRows.reduce((sum, entry) => sum + num(entry.ticketsCount || entry.tickets || 0), 0);
  const stock = gift.stock === null || gift.stock === undefined ? null : num(gift.stock);
  const remaining = stock === null ? num(gift.remaining ?? gift.quantity ?? 0) : stock;
  const conversion = views ? Math.round((received / views) * 1000) / 10 : 0;
  return {
    views,
    received,
    issued,
    remaining,
    entries: entryRows.length,
    tickets: entriesCount,
    conversion,
    sources: object(stats.sources),
    lastClaimedAt: claimRows[0]?.claimedAt || stats.lastClaimedAt || '',
  };
}

export function buildWorkspaceGift(item = {}, { claims = [], entries = [], partners = [], experts = [] } = {}) {
  const pending = object(item.pendingWorkspacePatch);
  const status = workspaceGiftStatus(item);
  const editable = status === 'moderation' && Object.keys(pending).length ? pending : item;
  const type = text(editable.type || editable.opportunityType || item.type || 'purchase', 80);
  const stats = buildWorkspaceGiftStats({ ...item, id: item.id }, claims, entries);
  const partner = partners.find(row => String(row.id || '') === String(item.partnerId || editable.partnerId || ''));
  const expert = experts.find(row => String(row.id || '') === String(item.expertId || editable.expertId || ''));
  return {
    id: text(item.id, 180),
    name: text(editable.name || editable.title || item.name || item.title || 'Подарок АПГ', 220),
    title: text(editable.title || editable.name || item.title || item.name || 'Подарок АПГ', 220),
    description: text(editable.description || item.description, 4000),
    coverPhoto: text(editable.coverPhoto || editable.imageUrl || item.coverPhoto || item.imageUrl || '', 1200),
    imageUrl: text(editable.imageUrl || editable.coverPhoto || item.imageUrl || item.coverPhoto || '', 1200),
    gallery: Array.isArray(editable.gallery) ? editable.gallery : Array.isArray(item.gallery) ? item.gallery : [],
    type,
    opportunityType: text(editable.opportunityType || item.opportunityType || normalizeGiftOpportunityType(type), 80),
    conditions: text(editable.conditions || editable.rules || item.conditions || item.rules || '', 4000),
    restrictions: text(editable.restrictions || item.restrictions || '', 4000),
    cost: num(editable.cost ?? item.cost ?? 0),
    ticketCost: num(editable.ticketCost ?? item.ticketCost ?? 0),
    stock: editable.stock === null || item.stock === null ? null : num(editable.stock ?? item.stock ?? 0),
    quantity: num(editable.quantity ?? item.quantity ?? editable.stock ?? item.stock ?? 0),
    remaining: stats.remaining,
    limit: num(editable.limit ?? item.limit ?? 0),
    startAt: text(editable.startAt || item.startAt || '', 120),
    endAt: text(editable.endAt || item.endAt || '', 120),
    raffleDate: editable.raffleDate || item.raffleDate || '',
    emoji: text(editable.emoji || item.emoji || '🎁', 20),
    color: text(editable.color || editable.themeColor || item.color || item.themeColor || '', 40),
    themeColor: text(editable.themeColor || editable.color || item.themeColor || item.color || '', 40),
    tags: Array.isArray(editable.tags) ? editable.tags : Array.isArray(item.tags) ? item.tags : [],
    buttonLabel: text(editable.buttonLabel || item.buttonLabel || 'Подробнее', 80),
    buttonUrl: text(editable.buttonUrl || item.buttonUrl || '', 1200),
    ctaButtons: Array.isArray(editable.ctaButtons) ? editable.ctaButtons : [],
    links: Array.isArray(editable.links) ? editable.links : [],
    seoTitle: text(editable.seoTitle || item.seoTitle || '', 220),
    seoDescription: text(editable.seoDescription || item.seoDescription || '', 500),
    partnerId: text(editable.partnerId ?? item.partnerId ?? '', 180),
    expertId: text(editable.expertId ?? item.expertId ?? '', 180),
    eventId: text(editable.eventId ?? item.eventId ?? '', 180),
    promotionId: text(editable.promotionId ?? item.promotionId ?? '', 180),
    newsId: text(editable.newsId ?? item.newsId ?? '', 180),
    taskId: text(editable.taskId ?? item.taskId ?? '', 180),
    qrValue: text(editable.qrValue ?? item.qrValue ?? '', 500),
    qrCode: text(editable.qrCode ?? item.qrCode ?? '', 500),
    donorName: text(item.donorName || partner?.name || expert?.name || '', 220),
    status,
    lifecycleStatus: item.lifecycleStatus || item.contentStatus || item.status || status,
    contentStatus: item.contentStatus || item.lifecycleStatus || item.status || status,
    active: status === 'published' && item.active !== false,
    stats,
    views: stats.views,
    received: stats.received,
    issued: stats.issued,
    conversion: stats.conversion,
    updatedAt: item.updatedAt || item.profileUpdatedAt || item.createdAt || '',
    createdAt: item.createdAt || '',
  };
}

export function buildWorkspaceGiftKpis(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const status = workspaceGiftStatus(item);
    acc.total += 1;
    acc[status] = (acc[status] || 0) + 1;
    acc.views += num(item.views || item.stats?.views || 0);
    acc.received += num(item.received || item.stats?.received || 0);
    acc.issued += num(item.issued || item.stats?.issued || 0);
    acc.remaining += item.stock === null ? num(item.remaining || 0) : num(item.stock ?? item.remaining ?? 0);
    return acc;
  }, { total: 0, published: 0, draft: 0, moderation: 0, archived: 0, revision: 0, rejected: 0, views: 0, received: 0, issued: 0, remaining: 0 });
}

export function buildWorkspaceGiftSearchText(item = {}) {
  return [
    item.id,
    item.name,
    item.title,
    item.description,
    item.conditions,
    item.restrictions,
    item.type,
    item.opportunityType,
    item.donorName,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(value => text(value, 1000).toLowerCase()).filter(Boolean).join(' ');
}

export function filterWorkspaceGifts(items = [], { query = '', status = 'active', type = 'all', period = 'all', view = 'cards' } = {}) {
  const q = text(query, 300).toLowerCase();
  const now = Date.now();
  const dayMs = 86400000;
  return (Array.isArray(items) ? items : []).filter(item => {
    const itemStatus = workspaceGiftStatus(item);
    if (status !== 'all') {
      if (status === 'active') {
        if (itemStatus === 'archived' || itemStatus === 'rejected') return false;
      } else if (status !== itemStatus) return false;
    }
    if (type !== 'all' && String(item.type || item.opportunityType || '') !== type) return false;
    if (period !== 'all') {
      const raw = item.endAt || item.raffleDate || item.updatedAt || item.createdAt;
      const ms = raw?.toMillis ? raw.toMillis() : raw?.toDate ? raw.toDate().getTime() : new Date(raw || 0).getTime();
      if (!Number.isFinite(ms) || ms <= 0) return false;
      if (period === 'today' && new Date(ms).toDateString() !== new Date(now).toDateString()) return false;
      if (period === 'week' && Math.abs(now - ms) > 7 * dayMs) return false;
      if (period === 'month' && Math.abs(now - ms) > 31 * dayMs) return false;
    }
    if (view === 'calendar' && !item.endAt && !item.raffleDate) return false;
    return !q || buildWorkspaceGiftSearchText(item).includes(q);
  });
}
