import { normalizeContentStatus, toLifecycleMillis } from './content-lifecycle.js';

export const WORKSPACE_EVENT_STATUS_LABELS = {
  draft: 'Черновик',
  moderation: 'На модерации',
  pending_review: 'На модерации',
  revision_requested: 'Нужны правки',
  approved: 'Одобрено',
  published: 'Опубликовано',
  rejected: 'Отклонено',
  completed: 'Завершено',
  archived: 'Архив',
  deleted: 'Удалено',
  trash: 'Удалено',
};

export const WORKSPACE_EVENT_EDIT_FIELDS = [
  'title',
  'date',
  'time',
  'partner',
  'emoji',
  'description',
  'socialUrl',
  'address',
  'deadline',
  'isPrivate',
  'minKeys',
  'maxParticipants',
  'eventDate',
  'isExpertEvent',
  'priceClub',
  'pricePublic',
  'linkLabel',
  'linkUrl',
  'priority',
  'category',
  'coverPhoto',
  'gallery',
  'startAt',
  'endAt',
  'location',
  'priceType',
  'price',
  'currency',
  'priceIsFrom',
  'moderationComment',
  'workspaceComment',
];

export function workspaceEventStatus(event = {}) {
  const raw = String(event.submissionStatus || event.moderationStatus || event.lifecycleStatus || event.contentStatus || event.status || '').trim().toLowerCase();
  const normalized = raw === 'pending' || raw === 'review' ? 'pending_review' : raw;
  if (normalized === 'active') return 'published';
  if (normalized === 'moderation') return 'moderation';
  if (WORKSPACE_EVENT_STATUS_LABELS[normalized]) return normalized;
  return normalizeContentStatus(event);
}

export function workspaceEventStatusLabel(event = {}) {
  const status = workspaceEventStatus(event);
  return WORKSPACE_EVENT_STATUS_LABELS[status] || 'Черновик';
}

export function workspaceEventProfileId(event = {}, type = 'partner') {
  if (type === 'expert') return String(event.expertId || event.submittedProfileId || event.organizerExpertId || '');
  return String(event.partnerId || event.submittedProfileId || event.organizerPartnerId || '');
}

export function workspaceEventBelongsToProfile(event = {}, profile = {}, type = 'partner') {
  const profileId = String(profile?.id || '');
  if (!profileId) return false;
  if (workspaceEventProfileId(event, type) === profileId) return true;
  const profileName = String(profile?.name || profile?.title || '').trim().toLowerCase();
  const submittedName = String(event.submittedProfileName || event.partner || event.partnerName || event.expertName || event.expert || '').trim().toLowerCase();
  return Boolean(profileName && submittedName && profileName === submittedName && String(event.proposalAuthorType || type) === type);
}

export function filterWorkspaceEvents(events = [], profile = {}, type = 'partner', options = {}) {
  const includeDeleted = options.includeDeleted === true;
  return (Array.isArray(events) ? events : [])
    .filter(event => workspaceEventBelongsToProfile(event, profile, type))
    .filter(event => includeDeleted || !['archived', 'deleted', 'trash'].includes(workspaceEventStatus(event)) && event.archived !== true && event.deleted !== true);
}

export function workspaceEventInterval(event = {}) {
  const startMs = toLifecycleMillis(event.startAt || event.eventDate || event.date);
  if (!startMs) return null;
  const endMs = toLifecycleMillis(event.endAt);
  const end = endMs && endMs > startMs ? endMs : startMs + 60 * 60 * 1000;
  return { start: startMs, end };
}

export function workspaceEventsOverlap(a = {}, b = {}) {
  const ai = workspaceEventInterval(a);
  const bi = workspaceEventInterval(b);
  if (!ai || !bi) return false;
  return ai.start < bi.end && bi.start < ai.end;
}

export function findWorkspaceEventConflicts(events = [], draft = {}, ignoreId = '') {
  const current = workspaceEventInterval(draft);
  if (!current) return [];
  const ignored = String(ignoreId || draft.id || '');
  return (Array.isArray(events) ? events : []).filter(event => {
    if (String(event.id || '') === ignored) return false;
    const status = workspaceEventStatus(event);
    if (['archived', 'deleted', 'trash', 'rejected'].includes(status) || event.deleted === true || event.archived === true) return false;
    return workspaceEventsOverlap(event, draft);
  });
}

export function isWorkspaceEventPast(event = {}, now = Date.now()) {
  const interval = workspaceEventInterval(event);
  if (!interval) return false;
  return interval.end < now;
}

export function buildWorkspaceEventBase({ profile = {}, type = 'partner', actor = {} } = {}) {
  const profileName = String(profile.name || profile.title || '').trim();
  return {
    title: 'Новое мероприятие',
    emoji: '🎉',
    description: '',
    partner: type === 'partner' ? profileName : '',
    partnerName: type === 'partner' ? profileName : '',
    partnerId: type === 'partner' ? String(profile.id || '') : null,
    expertId: type === 'expert' ? String(profile.id || '') : null,
    expertName: type === 'expert' ? profileName : '',
    isExpertEvent: type === 'expert',
    submittedProfileId: String(profile.id || ''),
    submittedProfileName: profileName,
    proposalAuthorType: type,
    proposalAuthorId: String(actor.userId || ''),
    proposalAuthorUid: String(actor.uid || ''),
    status: 'draft',
    lifecycleStatus: 'draft',
    contentStatus: 'draft',
    moderationStatus: 'draft',
    submissionStatus: 'draft',
    active: false,
    published: false,
    priceType: 'free',
    price: 0,
    currency: '₽',
    registeredCount: 0,
    views: 0,
    opensCount: 0,
    savesCount: 0,
    source: 'workspace',
  };
}

export function sanitizeWorkspaceEventPatch(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const patch = {};
  WORKSPACE_EVENT_EDIT_FIELDS.forEach(key => {
    if (!Object.hasOwn(source, key)) return;
    const value = source[key];
    if (['isPrivate', 'isExpertEvent', 'priceIsFrom'].includes(key)) patch[key] = Boolean(value);
    else if (['minKeys', 'maxParticipants', 'priority', 'price'].includes(key)) patch[key] = Math.max(0, Number(value) || 0);
    else if (key === 'gallery') patch[key] = Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12) : [];
    else if (value == null) patch[key] = '';
    else patch[key] = String(value).trim().slice(0, key === 'description' ? 4000 : 1000);
  });
  if (patch.priceType && !['free', 'paid'].includes(patch.priceType)) patch.priceType = 'free';
  if (patch.priceType === 'free') {
    patch.price = 0;
    patch.priceIsFrom = false;
  }
  if (patch.currency === '') patch.currency = '₽';
  return patch;
}

export function buildWorkspaceEventDuplicate(source = {}, profile = {}, type = 'partner', actor = {}) {
  const base = buildWorkspaceEventBase({ profile, type, actor });
  const patch = sanitizeWorkspaceEventPatch(source);
  delete patch.moderationComment;
  return {
    ...base,
    ...patch,
    title: patch.title ? `${patch.title} — копия` : 'Похожее мероприятие',
    date: '',
    time: '',
    eventDate: '',
    startAt: '',
    endAt: '',
    deadline: '',
    registeredCount: 0,
    registrationsCount: 0,
    views: 0,
    opensCount: 0,
    savesCount: 0,
  };
}
