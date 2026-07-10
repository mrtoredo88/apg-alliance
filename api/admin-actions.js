import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';
import { adminError, requireAdminPermission, writeAuditLog } from './_admin-security.js';
import { APP_URL } from './config.js';

const NEWS_FIELDS = new Set(['title', 'subtitle', 'summary', 'text', 'fullText', 'author', 'sourceName', 'source', 'expiresAt', 'tags', 'emoji', 'imageUrl', 'coverPhoto', 'photos', 'photoItems', 'gallery', 'videos', 'links', 'socialLinks', 'contentBlocks', 'faq', 'ctaButtons', 'docs', 'linkUrl', 'linkLabel', 'priority', 'category', 'active', 'status', 'publishedAt', 'pinned', 'isPinned', 'commentsEnabled', 'linksCheckedAt']);
const RESOURCE_CONFIG = {
  partners: { collection: 'partners', scope: 'partners', label: 'партнёр' },
  experts: { collection: 'experts', scope: 'experts', label: 'эксперт' },
  events: { collection: 'events', scope: 'events', label: 'событие' },
  banners: { collection: 'banners', scope: 'banners', label: 'баннер' },
  prizes: { collection: 'prizes', scope: 'prizes', label: 'приз' },
  notifications: { collection: 'notifications', scope: 'notifications', label: 'уведомление' },
  customTasks: { collection: 'customTasks', scope: 'tasks', label: 'задание' },
  users: { collection: 'users', scope: 'users', label: 'пользователь' },
  prizeClaims: { collection: 'prizeClaims', scope: 'claims', label: 'выдача приза' },
  errorLogs: { collection: 'errorLogs', scope: 'errors', label: 'ошибка' },
  adminActivity: { collection: 'adminActivity', scope: 'audit', label: 'действие админки' },
  scans: { collection: 'scans', scope: 'maintenance', label: 'скан' },
  expertScans: { collection: 'expertScans', scope: 'maintenance', label: 'скан эксперта' },
  raffleEntries: { collection: 'raffleEntries', scope: 'maintenance', label: 'участие в розыгрыше' },
  expertReviews: { collection: 'expertReviews', scope: 'maintenance', label: 'отзыв эксперта' },
  guestSessions: { collection: 'guestSessions', scope: 'stats', label: 'гостевая сессия' },
  lokiKnowledge: { collection: 'lokiKnowledge', scope: 'settings', label: 'знание Локи' },
  lokiAnalytics: { collection: 'lokiAnalytics', scope: 'stats', label: 'аналитика Локи' },
  aiImportRequests: { collection: 'aiImportRequests', scope: 'ai', label: 'заявка ИИ-импорта' },
  publicFormLinks: { collection: 'publicFormLinks', scope: 'ai', label: 'публичная ссылка заявки' },
  config: { collection: 'config', scope: 'settings', label: 'настройка' },
  stats: { collection: 'stats', scope: 'stats', label: 'статистика' },
};

const LIST_CONFIG = {
  users: { orderBy: null, limit: 1000 },
  prizeClaims: { orderBy: ['claimedAt', 'desc'], limit: 200 },
  banners: { orderBy: ['priority', 'asc'], limit: 200 },
  errorLogs: { orderBy: ['timestamp', 'desc'], limit: 200 },
  adminActivity: { orderBy: ['createdAt', 'desc'], limit: 200 },
  scans: { orderBy: ['scannedAt', 'desc'], limit: 500 },
  expertScans: { orderBy: ['scannedAt', 'desc'], limit: 500 },
  expertReviews: { orderBy: ['createdAt', 'desc'], limit: 300 },
  raffleEntries: { orderBy: ['createdAt', 'desc'], limit: 500 },
  guestSessions: { orderBy: ['createdAt', 'desc'], limit: 500 },
  lokiKnowledge: { orderBy: ['priority', 'desc'], limit: 300 },
  lokiAnalytics: { orderBy: ['createdAt', 'desc'], limit: 500 },
  aiImportRequests: { orderBy: ['createdAt', 'desc'], limit: 300 },
  publicFormLinks: { orderBy: ['createdAt', 'desc'], limit: 300 },
};

const LEGAL_ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin']);
const LEGAL_PRIVATE_FIELDS = new Set(['legalProfile', 'legalDocuments', 'legalCheck', 'legalMissingFields', 'counterparty', 'crm', 'legalAdminComments']);
const PARTNER_STATUS_LABELS = {
  new_request: 'Новая заявка',
  draft: 'Черновик',
  admin_review: 'Проверка администрацией',
  created: 'Создано',
  email_specified: 'Email указан',
  invitation_sent: 'Приглашение отправлено',
  registration_completed: 'Регистрация завершена',
  cabinet_linked: 'Кабинет привязан',
  card_setup: 'Карточка оформляется',
  ready_to_publish: 'Готово к публикации',
  published: 'Опубликовано',
  verified_partner: 'Проверенный партнёр',
  card_active: 'Карточка активна',
  conflict: 'Требует проверки',
};
const PARTNER_PUBLICATION_MIN_PERCENT = 80;

function canAccessLegalData(actor) {
  return LEGAL_ADMIN_ROLES.has(String(actor?.role || '').toLowerCase());
}

function stripLegalData(row) {
  const next = { ...row };
  LEGAL_PRIVATE_FIELDS.forEach(key => { delete next[key]; });
  next.legalRestricted = true;
  return next;
}

function assertLegalPatchAllowed(resource, patch, actor) {
  if (resource !== 'aiImportRequests' || canAccessLegalData(actor)) return;
  if (!Object.keys(patch || {}).some(key => LEGAL_PRIVATE_FIELDS.has(key))) return;
  const error = new Error('Недостаточно прав для работы с юридическими данными.');
  error.statusCode = 403;
  error.code = 'LEGAL_DATA_FORBIDDEN';
  throw error;
}

function cleanPatch(input = {}) {
  const patch = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (NEWS_FIELDS.has(key)) patch[key] = value;
  });
  return patch;
}

function cleanEntityPatch(input = {}) {
  const patch = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(key)) return;
    if (value === undefined) return;
    patch[key] = value;
  });
  return patch;
}

function withServerTimestamps(patch, fields = []) {
  const next = { ...patch };
  fields.forEach(field => {
    if (field) next[field] = FieldValue.serverTimestamp();
  });
  return next;
}

function serializeAdminValue(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeAdminValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeAdminValue(item)]));
  }
  return value;
}

function referralUserName(user = {}) {
  return String(user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.linkedEmail || user.id || '').trim() || 'Без имени';
}

function referralTelegram(user = {}) {
  const linked = user.linkedTelegram || {};
  return linked.username ? `@${String(linked.username).replace(/^@/, '')}` : (linked.tgId || user.telegramId || user.tgId || (String(user.id || '').startsWith('tg_') ? user.id : ''));
}

function referralEmail(user = {}) {
  return user.email || user.linkedEmail || (String(user.id || '').startsWith('email:') ? String(user.id).slice(6) : '');
}

function referralRegistered(user = {}) {
  return Boolean(user.registeredAt || user.createdAt || user.lastSeen) && !String(user.id || '').startsWith('guest_');
}

function buildReferralRow(invitedId, invited = {}, referrerId = '', referrer = null) {
  const effectiveReferrerId = String(referrerId || invited.referredBy || invited.referralBonusGrantedTo || '').trim();
  const referrerRewardedUsers = Array.isArray(referrer?.referralRewardedUsers) ? referrer.referralRewardedUsers.map(String) : [];
  const registrationComplete = referralRegistered({ ...invited, id: invitedId });
  const linked = Boolean(effectiveReferrerId && invited.referredBy === effectiveReferrerId);
  const granted = invited.referralBonusGranted === true || referrerRewardedUsers.includes(invitedId);
  let status = 'pending_registration';
  let reason = '';
  if (!registrationComplete) reason = 'Пользователь ещё не завершил регистрацию.';
  else if (!effectiveReferrerId) { status = 'link_missing'; reason = 'Нет referrerId: серверной записи приглашения не было, восстановить цепочку автоматически нельзя.'; }
  else if (!referrer) { status = 'error'; reason = 'Пригласивший пользователь не найден.'; }
  else if (invited.referredBy && invited.referredBy !== effectiveReferrerId) { status = 'error'; reason = 'У приглашённого указан другой пригласивший.'; }
  else if (!linked) { status = 'link_missing'; reason = 'Регистрация завершена, но referredBy не установлен.'; }
  else if (!granted) { status = 'grant_error'; reason = 'Связь есть, но referralBonusGranted/referralRewardedUsers не подтверждают начисление.'; }
  else { status = 'granted'; reason = 'Начисление подтверждено.'; }
  return {
    id: `${effectiveReferrerId || 'missing'}__${invitedId}`,
    referrer: referrer ? { id: effectiveReferrerId, name: referralUserName({ ...referrer, id: effectiveReferrerId }), telegram: referralTelegram({ ...referrer, id: effectiveReferrerId }), email: referralEmail({ ...referrer, id: effectiveReferrerId }), keys: Number(referrer.keys || 0), referralCount: Number(referrer.referralCount || 0) } : { id: effectiveReferrerId, name: effectiveReferrerId || 'Не указан', telegram: '', email: '', keys: 0, referralCount: 0 },
    invited: { id: invitedId, name: referralUserName({ ...invited, id: invitedId }), telegram: referralTelegram({ ...invited, id: invitedId }), email: referralEmail({ ...invited, id: invitedId }), keys: Number(invited.keys || 0) },
    registrationComplete,
    linked,
    granted,
    keysGranted: granted ? 2 : 0,
    status,
    reason,
    registeredAt: serializeAdminValue(invited.registeredAt || invited.createdAt || null),
    referralBonusGrantedAt: serializeAdminValue(invited.referralBonusGrantedAt || null),
    referralBackfilledAt: serializeAdminValue(invited.referralBackfilledAt || null),
  };
}

async function buildReferralAudit(db) {
  const usersSnap = await db.collection('users').limit(1500).get();
  const users = new Map(usersSnap.docs.map(doc => [doc.id, { id: doc.id, ...(doc.data() || {}) }]));
  const rows = new Map();
  users.forEach((user, userId) => {
    if (user.referredBy || user.referralBonusGranted || user.referralBonusGrantedTo) {
      const referrerId = String(user.referredBy || user.referralBonusGrantedTo || '').trim();
      rows.set(`${referrerId || 'missing'}__${userId}`, buildReferralRow(userId, user, referrerId, users.get(referrerId) || null));
    }
  });
  users.forEach((referrer, referrerId) => {
    (Array.isArray(referrer.referralRewardedUsers) ? referrer.referralRewardedUsers : []).forEach(rawInvitedId => {
      const invitedId = String(rawInvitedId || '').trim();
      if (!invitedId || rows.has(`${referrerId}__${invitedId}`)) return;
      rows.set(`${referrerId}__${invitedId}`, buildReferralRow(invitedId, users.get(invitedId) || {}, referrerId, referrer));
    });
  });
  const list = [...rows.values()].sort((a, b) => String(b.registeredAt || '').localeCompare(String(a.registeredAt || '')));
  return {
    rows: list,
    summary: {
      total: list.length,
      pendingRegistration: list.filter(row => row.status === 'pending_registration').length,
      registrationComplete: list.filter(row => row.registrationComplete).length,
      linkMissing: list.filter(row => row.status === 'link_missing').length,
      grantErrors: list.filter(row => row.status === 'grant_error' || row.status === 'error').length,
      granted: list.filter(row => row.status === 'granted').length,
    },
    generatedAt: new Date().toISOString(),
    temporaryInvitationStorage: 'client_url_localStorage_only',
  };
}

async function grantReferralCompensation(db, req, actor) {
  const referrerId = String(req.body?.referrerId || '').trim();
  const invitedUserId = String(req.body?.invitedUserId || req.body?.newUserId || '').trim();
  const reason = String(req.body?.reason || 'admin_referral_compensation').trim().slice(0, 500);
  if (!referrerId || !invitedUserId || referrerId === invitedUserId) throw Object.assign(new Error('Укажите корректных пригласившего и приглашённого.'), { statusCode: 400 });
  await requireAdminPermission(req, 'users:update');
  const referrerRef = db.collection('users').doc(referrerId);
  const invitedRef = db.collection('users').doc(invitedUserId);
  const result = await db.runTransaction(async tx => {
    const [referrerSnap, invitedSnap] = await Promise.all([tx.get(referrerRef), tx.get(invitedRef)]);
    if (!referrerSnap.exists) throw Object.assign(new Error('Пригласивший пользователь не найден.'), { statusCode: 404 });
    if (!invitedSnap.exists) throw Object.assign(new Error('Приглашённый пользователь не найден.'), { statusCode: 404 });
    const invited = invitedSnap.data() || {};
    if (invited.referredBy && invited.referredBy !== referrerId) throw Object.assign(new Error('У приглашённого уже указан другой пригласивший.'), { statusCode: 409 });
    if (invited.referralBonusGranted === true) return { ok: true, alreadyGranted: true, referrerId, invitedUserId };
    tx.set(invitedRef, {
      referredBy: referrerId,
      referralBonusGranted: true,
      referralBonusGrantedTo: referrerId,
      referralBonusGrantedAt: FieldValue.serverTimestamp(),
      referralCompensatedAt: FieldValue.serverTimestamp(),
      referralCompensationReason: reason,
      keys: invited.referredBy ? FieldValue.increment(0) : FieldValue.increment(2),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(referrerRef, { keys: FieldValue.increment(2), referralCount: FieldValue.increment(1), referralRewardedUsers: FieldValue.arrayUnion(invitedUserId), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.collection('referralCompensations').doc(`${referrerId}__${invitedUserId}`), {
      referrerId, invitedUserId, reason, keysToReferrer: 2, keysToInvited: invited.referredBy ? 0 : 2, actorUid: actor.uid, actorUserId: actor.userId, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, alreadyGranted: false, referrerId, invitedUserId };
  });
  await writeAuditLog(db, req, actor, 'referrals:grant', 'users', invitedUserId, { label: `Реферальная компенсация: ${referrerId} -> ${invitedUserId}`, reason, alreadyGranted: result.alreadyGranted });
  return result;
}

async function handleReferralAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  await requireAdminPermission(req, 'users:read');
  if (action === 'referrals:audit' || action === 'referrals:check' || action === 'referrals:recalculate') {
    const audit = await buildReferralAudit(db);
    await writeAuditLog(db, req, actor, action, 'users', 'referrals', { label: 'Проверка реферальной системы', summary: audit.summary });
    return { ok: true, ...audit };
  }
  if (action === 'referrals:grant') return grantReferralCompensation(db, req, actor);
  throw Object.assign(new Error('Неизвестное действие реферальной системы.'), { statusCode: 400 });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function partnerEvent(actor, type, label, extra = {}) {
  return {
    type,
    label,
    at: new Date().toISOString(),
    actorUid: actor?.uid || 'system',
    actorId: actor?.userId || actor?.uid || 'system',
    actorName: actor?.name || 'АПГ',
    ...extra,
  };
}

function buildPartnerReadiness(partner = {}) {
  const photosCount = [partner.logoUrl, partner.coverPhoto, ...(Array.isArray(partner.gallery) ? partner.gallery : [])].filter(Boolean).length;
  const checks = [
    { key: 'logo', label: 'Добавить логотип', ok: Boolean(partner.logoUrl), action: 'edit_media' },
    { key: 'cover', label: 'Добавить обложку', ok: Boolean(partner.coverPhoto), action: 'edit_media' },
    { key: 'photos', label: 'Загрузить минимум три фотографии', ok: photosCount >= 3, action: 'edit_media' },
    { key: 'description', label: 'Заполнить описание компании', ok: String(partner.description || '').trim().length >= 80, action: 'edit_description' },
    { key: 'shortDescription', label: 'Добавить короткое описание', ok: Boolean(String(partner.shortDescription || partner.offer || '').trim()), action: 'edit_description' },
    { key: 'category', label: 'Выбрать категорию', ok: Boolean(partner.category && partner.category !== 'other'), action: 'edit_category' },
    { key: 'address', label: 'Указать адрес', ok: Boolean(String(partner.address || '').trim()), action: 'edit_contacts' },
    { key: 'phone', label: 'Указать телефон', ok: Boolean(String(partner.phone || '').trim()), action: 'edit_contacts' },
    { key: 'hours', label: 'Настроить график работы', ok: Boolean(String(partner.hours || '').trim()), action: 'edit_contacts' },
    { key: 'links', label: 'Добавить хотя бы одну соцсеть или сайт', ok: Boolean(partner.websiteUrl || partner.vkGroupUrl || partner.socialUrl || partner.telegramCommunityUrl), action: 'edit_links' },
    { key: 'offer', label: 'Добавить первую акцию', ok: Boolean(String(partner.offer || '').trim()), action: 'edit_offer' },
    { key: 'coordinates', label: 'Поставить координаты на карте', ok: partner.latitude != null && partner.longitude != null, action: 'edit_map' },
    { key: 'publicationConsent', label: 'Подтвердить согласие на публикацию', ok: Boolean(partner.publicationConsentAccepted), action: 'edit_publication' },
  ];
  const missing = checks.filter(item => !item.ok).map(({ key, label, action }) => ({ key, label, action }));
  const percent = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const launchMissing = [
    ...(!partner.ownerId ? [{ key: 'owner', label: 'Подключить владельца', action: 'invite_owner', severity: 'warning' }] : []),
    ...missing,
    ...(!partner.firstNewsCreatedAt ? [{ key: 'news', label: 'Создать приветственную новость', action: 'create_news', severity: 'info' }] : []),
  ];
  return {
    percent,
    checks: checks.map(({ key, label, ok, action }) => ({ key, label, ok, action })),
    missing,
    recommendations: launchMissing.map(item => ({ ...item, severity: item.severity || (item.key === 'publicationConsent' ? 'warning' : 'info') })),
    readyForReview: percent >= PARTNER_PUBLICATION_MIN_PERCENT,
    readyForPublish: percent >= PARTNER_PUBLICATION_MIN_PERCENT && Boolean(partner.publicationConsentAccepted),
    minPercent: PARTNER_PUBLICATION_MIN_PERCENT,
    photosCount,
  };
}

function buildPartnerPublicationWizard(partner = {}, readiness = buildPartnerReadiness(partner)) {
  const launchActions = buildPartnerLaunchActions(partner);
  const published = Boolean(partner.catalogPublished || partner.lifecycleStatus === 'published' || partner.active === true);
  const launchDone = launchActions.filter(item => item.done).length;
  const steps = [
    { key: 'card', label: 'Карточка создана', done: Boolean(partner.id || partner.name) },
    { key: 'owner', label: 'Владелец подключён', done: Boolean(partner.ownerId || partner.partnerCabinetEnabled) },
    { key: 'readiness', label: `Карточка готова минимум на ${readiness.minPercent}%`, done: readiness.readyForPublish },
    { key: 'publish', label: 'Партнёр опубликован', done: published },
    { key: 'launch', label: 'Стартовые действия запущены', done: published && launchDone >= 2 },
  ];
  const doneCount = steps.filter(item => item.done).length;
  return {
    title: 'Подключение партнёра',
    currentStep: Math.min(doneCount + (doneCount < steps.length ? 1 : 0), steps.length),
    totalSteps: steps.length,
    percent: Math.round((doneCount / steps.length) * 100),
    steps,
  };
}

function partnerLifecycleStatus(partner, readiness) {
  if (partner.catalogPublished || partner.lifecycleStatus === 'published' || partner.active === true) {
    if (partner.verifiedPartner) return 'verified_partner';
    return 'published';
  }
  if (readiness?.readyForPublish) return 'ready_to_publish';
  if (partner.ownerId) return 'card_setup';
  if (partner.connectionStatus === 'cabinet_linked' || partner.connectionStatus === 'registration_completed') return 'cabinet_linked';
  if (partner.connectionStatus === 'invitation_sent') return 'invitation_sent';
  if (partner.connectionStatus === 'email_specified' || partner.ownerEmail) return 'email_specified';
  if (partner.status === 'draft' || partner.active === false) return 'draft';
  return 'admin_review';
}

function buildPartnerLaunchActions(partner = {}) {
  return [
    { key: 'welcome_news', label: 'Создать приветственную новость', action: 'create_news', done: Boolean(partner.firstNewsCreatedAt) },
    { key: 'offer', label: 'Добавить первую акцию', action: 'edit_offer', done: Boolean(String(partner.offer || '').trim()) },
    { key: 'prize', label: 'Добавить подарок', action: 'create_prize', done: Boolean(partner.firstPrizeCreatedAt) },
    { key: 'event', label: 'Добавить мероприятие', action: 'create_event', done: Boolean(partner.firstEventCreatedAt) },
    { key: 'push', label: 'Отправить Push пользователям', action: 'send_push', done: Boolean(partner.firstPushSentAt) },
    { key: 'new_partners', label: 'Разместить в разделе “Новые партнёры”', action: 'new_partners', done: Boolean(partner.newPartnerUntil) },
    { key: 'share', label: 'Поделиться карточкой', action: 'share_partner', done: Boolean(partner.firstShareAt) },
    { key: 'review', label: 'Пригласить оставить первый отзыв', action: 'invite_review', done: Boolean(partner.firstReviewInviteAt) },
  ];
}

async function createPartnerWelcomeNewsDraft(db, req, actor, partner) {
  if (partner.firstNewsCreatedAt || partner.firstNewsId) return { created: false, id: partner.firstNewsId || '' };
  const title = `В АПГ появился новый партнёр: ${partner.name}`;
  const text = [
    `В каталоге АПГ появился новый партнёр — ${partner.name}.`,
    '',
    partner.description || 'Скоро расскажем подробнее о предложениях и возможностях партнёра.',
    '',
    partner.offer ? `Специальное предложение для участников АПГ: ${partner.offer}` : '',
  ].filter(Boolean).join('\n');
  const data = {
    title,
    text,
    summary: partner.offer || `Новый партнёр АПГ: ${partner.name}`,
    sourceName: partner.name,
    source: 'partner_launch',
    partnerId: partner.id,
    category: partner.category || 'partners',
    imageUrl: partner.coverPhoto || partner.logoUrl || '',
    coverPhoto: partner.coverPhoto || partner.logoUrl || '',
    active: false,
    status: 'draft',
    commentsEnabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('news').add(data);
  await writeHistory(db, actor, ref.id, 'create', null, data);
  await writeAuditLog(db, req, actor, 'create', 'news', ref.id, { label: `Авточерновик новости партнёра: ${partner.name}` });
  return { created: true, id: ref.id };
}

async function findUserByEmail(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const indexSnap = await db.collection('emailIndex').doc(normalized).get().catch(() => null);
  const candidates = [];
  if (indexSnap?.exists && indexSnap.data()?.userId) candidates.push(String(indexSnap.data().userId));
  candidates.push(`email:${normalized}`);
  for (const id of [...new Set(candidates)]) {
    const snap = await db.collection('users').doc(id).get().catch(() => null);
    if (snap?.exists) return { id: snap.id, ...serializeAdminValue(snap.data() || {}) };
  }
  const byEmail = await db.collection('users').where('email', '==', normalized).limit(1).get().catch(() => null);
  if (byEmail && !byEmail.empty) return { id: byEmail.docs[0].id, ...serializeAdminValue(byEmail.docs[0].data() || {}) };
  const byLinkedEmail = await db.collection('users').where('linkedEmail', '==', normalized).limit(1).get().catch(() => null);
  if (byLinkedEmail && !byLinkedEmail.empty) return { id: byLinkedEmail.docs[0].id, ...serializeAdminValue(byLinkedEmail.docs[0].data() || {}) };
  return null;
}

async function findPartnerConflicts(db, partnerId, email, userId = '') {
  const conflicts = [];
  if (userId) {
    const ownerSnap = await db.collection('partners').where('ownerId', '==', userId).limit(5).get().catch(() => null);
    ownerSnap?.docs?.forEach(doc => {
      if (doc.id !== partnerId) conflicts.push({ partnerId: doc.id, field: 'ownerId', name: doc.data()?.name || '' });
    });
    const ownersSnap = await db.collection('partners').where('ownerUserIds', 'array-contains', userId).limit(5).get().catch(() => null);
    ownersSnap?.docs?.forEach(doc => {
      if (doc.id !== partnerId) conflicts.push({ partnerId: doc.id, field: 'ownerUserIds', name: doc.data()?.name || '' });
    });
  }
  if (email) {
    for (const field of ['ownerEmail', 'connectionEmail']) {
      const snap = await db.collection('partners').where(field, '==', email).limit(5).get().catch(() => null);
      snap?.docs?.forEach(doc => {
        if (doc.id !== partnerId) conflicts.push({ partnerId: doc.id, field, name: doc.data()?.name || '' });
      });
    }
    const emailsSnap = await db.collection('partners').where('ownerEmails', 'array-contains', email).limit(5).get().catch(() => null);
    emailsSnap?.docs?.forEach(doc => {
      if (doc.id !== partnerId) conflicts.push({ partnerId: doc.id, field: 'ownerEmails', name: doc.data()?.name || '' });
    });
  }
  return conflicts.filter((item, index, arr) => arr.findIndex(x => x.partnerId === item.partnerId && x.field === item.field) === index);
}

async function updatePartnerOnboarding(db, req, actor, partnerId, patch, event) {
  const ref = db.collection('partners').doc(partnerId);
  const payload = { ...patch, updatedAt: FieldValue.serverTimestamp() };
  if (event) payload.partnerConnectionEvents = FieldValue.arrayUnion(event);
  await ref.set(payload, { merge: true });
  if (event) {
    await db.collection('partnerConnectionEvents').add({
      partnerId,
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await writeAuditLog(db, req, actor, 'partners:onboarding', 'partners', partnerId, { label: event?.label || 'Обновлён сценарий подключения партнёра', status: patch.connectionStatus || null });
}

function publicUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || user.linkedEmail || '',
    name: user.name || user.displayName || user.firstName || user.email || '',
    role: user.role || 'user',
  };
}

function createInviteLink(token) {
  return `${APP_URL}/?partner_invite=${encodeURIComponent(token)}`;
}

async function sendPartnerInviteEmail(email, partner, inviteLink) {
  if (!process.env.YANDEX_EMAIL || !process.env.YANDEX_EMAIL_PASS) {
    return { sent: false, status: 'email_not_configured' };
  }
  const transport = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: { user: process.env.YANDEX_EMAIL, pass: process.env.YANDEX_EMAIL_PASS },
  });
  await transport.sendMail({
    from: `"АПГ" <${process.env.YANDEX_EMAIL}>`,
    to: email,
    subject: 'Для вас подготовлен кабинет партнёра в АПГ',
    text: [
      `Для вас подготовлен кабинет партнёра в АПГ${partner?.name ? `: ${partner.name}` : ''}.`,
      '',
      'Завершите регистрацию по ссылке, чтобы получить доступ к управлению своей карточкой, публикации новостей, мероприятий и просмотру статистики.',
      '',
      inviteLink,
    ].join('\n'),
  });
  return { sent: true, status: 'sent' };
}

async function handlePartnerOnboardingAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const id = String(req.body?.partnerId || req.body?.id || '').trim();
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();
  if (!id) {
    const error = new Error('Не указан партнёр.');
    error.statusCode = 400;
    throw error;
  }
  await requireAdminPermission(req, action === 'partner:onboarding-check' ? 'partners:read' : 'partners:update');
  const ref = db.collection('partners').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error('Партнёр не найден.');
    error.statusCode = 404;
    throw error;
  }
  const partner = { id, ...(snap.data() || {}) };
  const email = normalizeEmail(req.body?.email || partner.ownerEmail || partner.connectionEmail);
  const readiness = buildPartnerReadiness(partner);

  if (action === 'partner:onboarding-check') {
    if (!email) {
      const lifecycleStatus = partnerLifecycleStatus(partner, readiness);
      const wizard = buildPartnerPublicationWizard(partner, readiness);
      const patch = {
        connectionStatus: 'created',
        connectionStatusLabel: PARTNER_STATUS_LABELS.created,
        lifecycleStatus,
        lifecycleStatusLabel: PARTNER_STATUS_LABELS[lifecycleStatus],
        partnerOnboarding: { readiness, recommendations: readiness.recommendations, launchActions: buildPartnerLaunchActions(partner), wizard, lastCheckedAt: new Date().toISOString(), emailRequired: true },
      };
      await updatePartnerOnboarding(db, req, actor, id, patch, partnerEvent(actor, 'partner_created', 'Карточка создана, email владельца не указан'));
      return { ok: true, partnerId: id, email: '', userFound: false, connectionStatus: 'created', lifecycleStatus, readiness, recommendations: readiness.recommendations, launchActions: buildPartnerLaunchActions(partner), wizard };
    }
    if (!isValidEmail(email)) {
      const error = new Error('Укажите корректный email владельца.');
      error.statusCode = 400;
      error.code = 'INVALID_OWNER_EMAIL';
      throw error;
    }
    const user = await findUserByEmail(db, email);
    const conflicts = await findPartnerConflicts(db, id, email, user?.id || '');
    const status = conflicts.length ? 'conflict' : (partner.ownerId && user?.id && partner.ownerId === user.id ? 'cabinet_linked' : 'email_specified');
    const lifecycleStatus = partnerLifecycleStatus({ ...partner, connectionStatus: status }, readiness);
    const wizard = buildPartnerPublicationWizard({ ...partner, connectionStatus: status }, readiness);
    const token = partner.partnerInvite?.token || randomBytes(18).toString('hex');
    const inviteLink = createInviteLink(token);
    const patch = {
      ownerEmail: email,
      connectionEmail: email,
      connectionStatus: status,
      connectionStatusLabel: PARTNER_STATUS_LABELS[status],
      lifecycleStatus,
      lifecycleStatusLabel: PARTNER_STATUS_LABELS[lifecycleStatus],
      partnerInvite: { ...(partner.partnerInvite || {}), token, link: inviteLink, status: partner.partnerInvite?.status || 'prepared', updatedAt: new Date().toISOString() },
      partnerOnboarding: {
        readiness,
        recommendations: readiness.recommendations,
        launchActions: buildPartnerLaunchActions(partner),
        wizard,
        lastCheckedAt: new Date().toISOString(),
        userCheck: { userFound: Boolean(user), userId: user?.id || null, conflicts },
      },
    };
    await updatePartnerOnboarding(db, req, actor, id, patch, partnerEvent(actor, 'email_added', `Email владельца указан: ${email}`, { email, userFound: Boolean(user), conflictsCount: conflicts.length }));
    return { ok: true, partnerId: id, email, userFound: Boolean(user), user: publicUserSummary(user), conflicts, connectionStatus: status, lifecycleStatus, inviteLink, readiness, recommendations: readiness.recommendations, launchActions: buildPartnerLaunchActions(partner), wizard };
  }

  if (action === 'partner:bind-owner') {
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const user = await findUserByEmail(db, email);
      if (!user?.id) {
        const error = new Error('Пользователь с этим email ещё не зарегистрирован.');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      const conflicts = await findPartnerConflicts(db, id, email, user.id);
      if (conflicts.length && !req.body?.confirmConflict) {
        const error = new Error('Этот пользователь или email уже привязан к другой карточке.');
        error.statusCode = 409;
        error.code = 'PARTNER_OWNER_CONFLICT';
        error.conflicts = conflicts;
        throw error;
      }
      const nextPartner = { ...partner, ownerId: user.id, ownerEmail: email, connectionEmail: email };
      const nextReadiness = buildPartnerReadiness(nextPartner);
      const lifecycleStatus = partnerLifecycleStatus({ ...nextPartner, connectionStatus: 'cabinet_linked' }, nextReadiness);
      const wizard = buildPartnerPublicationWizard({ ...nextPartner, connectionStatus: 'cabinet_linked' }, nextReadiness);
      await updatePartnerOnboarding(db, req, actor, id, {
        ownerId: user.id,
        ownerEmail: email,
        ownerUserIds: FieldValue.arrayUnion(user.id),
        ownerEmails: FieldValue.arrayUnion(email),
        connectionEmail: email,
        partnerCabinetEnabled: true,
        connectionStatus: nextReadiness.percent >= 100 ? 'card_active' : 'cabinet_linked',
        connectionStatusLabel: nextReadiness.percent >= 100 ? PARTNER_STATUS_LABELS.card_active : PARTNER_STATUS_LABELS.cabinet_linked,
        lifecycleStatus,
        lifecycleStatusLabel: PARTNER_STATUS_LABELS[lifecycleStatus],
        partnerOnboarding: { readiness: nextReadiness, recommendations: nextReadiness.recommendations, launchActions: buildPartnerLaunchActions(nextPartner), wizard, lastCheckedAt: new Date().toISOString(), linkedUserId: user.id },
      }, partnerEvent(actor, 'cabinet_linked', `Кабинет партнёра привязан к пользователю ${email}`, { email, userId: user.id }));
      await db.collection('users').doc(user.id).set({
        partnerId: id,
        partnerCabinetIds: FieldValue.arrayUnion(id),
        partnerCabinetEnabled: true,
        linkedPartnerAt: FieldValue.serverTimestamp(),
        role: user.role && user.role !== 'user' ? user.role : 'partner',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: true, partnerId: id, user: publicUserSummary(user), connectionStatus: nextReadiness.percent >= 100 ? 'card_active' : 'cabinet_linked', lifecycleStatus, readiness: nextReadiness, launchActions: buildPartnerLaunchActions(nextPartner), wizard };
    });
  }

  if (action === 'partner:send-invite') {
    return runIdempotent(db, actor, idempotencyKey, async () => {
      if (!email || !isValidEmail(email)) {
        const error = new Error('Укажите корректный email для приглашения.');
        error.statusCode = 400;
        error.code = 'INVALID_OWNER_EMAIL';
        throw error;
      }
      const token = partner.partnerInvite?.token || randomBytes(18).toString('hex');
      const inviteLink = createInviteLink(token);
      await db.collection('partnerInvites').doc(token).set({
        token,
        partnerId: id,
        email,
        status: 'sent',
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      let delivery = { sent: false, status: 'not_attempted' };
      try {
        delivery = await sendPartnerInviteEmail(email, partner, inviteLink);
      } catch (error) {
        delivery = { sent: false, status: 'email_failed', error: String(error?.message || error).slice(0, 400) };
      }
      await updatePartnerOnboarding(db, req, actor, id, {
        ownerEmail: email,
        ownerEmails: FieldValue.arrayUnion(email),
        connectionEmail: email,
        connectionStatus: 'invitation_sent',
        connectionStatusLabel: PARTNER_STATUS_LABELS.invitation_sent,
        lifecycleStatus: 'invitation_sent',
        lifecycleStatusLabel: PARTNER_STATUS_LABELS.invitation_sent,
        partnerInvite: { token, link: inviteLink, status: delivery.status, sentAt: new Date().toISOString(), delivery },
      }, partnerEvent(actor, 'invitation_sent', `Приглашение партнёру отправлено: ${email}`, { email, deliveryStatus: delivery.status }));
      return { ok: true, partnerId: id, email, inviteLink, delivery, connectionStatus: 'invitation_sent' };
    });
  }

  if (action === 'partner:publish-catalog') {
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const latestSnap = await ref.get();
      const latest = { id, ...(latestSnap.data() || {}) };
      const latestReadiness = buildPartnerReadiness(latest);
      if (!latestReadiness.readyForPublish) {
        const error = new Error(`Карточка готова на ${latestReadiness.percent}%. Для публикации нужно минимум ${PARTNER_PUBLICATION_MIN_PERCENT}% и согласие на публикацию.`);
        error.statusCode = 400;
        error.code = 'PARTNER_NOT_READY_TO_PUBLISH';
        error.readiness = latestReadiness;
        throw error;
      }
      const now = new Date();
      const newPartnerUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const welcomeNews = await createPartnerWelcomeNewsDraft(db, req, actor, { ...latest, id });
      const publishedPartner = { ...latest, id, newPartnerUntil, firstNewsCreatedAt: latest.firstNewsCreatedAt || (welcomeNews.id ? now.toISOString() : null), firstNewsId: latest.firstNewsId || welcomeNews.id || '' };
      const launchActions = buildPartnerLaunchActions(publishedPartner);
      const wizard = buildPartnerPublicationWizard({ ...publishedPartner, catalogPublished: true, active: true, lifecycleStatus: 'published' }, latestReadiness);
      await updatePartnerOnboarding(db, req, actor, id, {
        active: true,
        catalogPublished: true,
        searchable: true,
        mapVisible: true,
        lokiVisible: true,
        status: 'published',
        lifecycleStatus: 'published',
        lifecycleStatusLabel: PARTNER_STATUS_LABELS.published,
        connectionStatus: latest.ownerId ? 'card_active' : (latest.connectionStatus || 'created'),
        connectionStatusLabel: latest.ownerId ? PARTNER_STATUS_LABELS.card_active : (PARTNER_STATUS_LABELS[latest.connectionStatus] || PARTNER_STATUS_LABELS.created),
        publishedAt: FieldValue.serverTimestamp(),
        firstPublishedAt: latest.firstPublishedAt || FieldValue.serverTimestamp(),
        firstNewsCreatedAt: latest.firstNewsCreatedAt || (welcomeNews.id ? FieldValue.serverTimestamp() : null),
        firstNewsId: latest.firstNewsId || welcomeNews.id || '',
        newPartnerUntil,
        partnerOnboarding: {
          ...(latest.partnerOnboarding || {}),
          readiness: latestReadiness,
          recommendations: latestReadiness.recommendations,
          launchActions,
          wizard,
          lastPublishedAt: now.toISOString(),
        },
      }, partnerEvent(actor, 'catalog_published', 'Партнёр опубликован в каталоге', { readinessPercent: latestReadiness.percent, newPartnerUntil, welcomeNewsId: welcomeNews.id || '' }));
      return {
        ok: true,
        partnerId: id,
        connectionStatus: latest.ownerId ? 'card_active' : (latest.connectionStatus || 'created'),
        lifecycleStatus: 'published',
        readiness: latestReadiness,
        launchActions,
        wizard,
        newPartnerUntil,
        welcomeNews,
      };
    });
  }

  if (action === 'partner:mark-verified') {
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const latestSnap = await ref.get();
      const latest = { id, ...(latestSnap.data() || {}) };
      if (!latest.catalogPublished && latest.active !== true) {
        const error = new Error('Сначала опубликуйте партнёра в каталоге.');
        error.statusCode = 400;
        error.code = 'PARTNER_NOT_PUBLISHED';
        throw error;
      }
      const latestReadiness = buildPartnerReadiness(latest);
      if (!latest.ownerId || !latest.phone || !latest.publicationConsentAccepted) {
        const error = new Error('Для статуса проверенного партнёра нужны владелец, контакты и согласие на публикацию.');
        error.statusCode = 400;
        error.code = 'PARTNER_VERIFICATION_REQUIREMENTS';
        throw error;
      }
      const nextPartner = { ...latest, verifiedPartner: true, verified: true, lifecycleStatus: 'verified_partner' };
      const wizard = buildPartnerPublicationWizard(nextPartner, latestReadiness);
      const launchActions = buildPartnerLaunchActions(nextPartner);
      await updatePartnerOnboarding(db, req, actor, id, {
        verifiedPartner: true,
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: actor.uid,
        lifecycleStatus: 'verified_partner',
        lifecycleStatusLabel: PARTNER_STATUS_LABELS.verified_partner,
        partnerOnboarding: {
          ...(latest.partnerOnboarding || {}),
          readiness: latestReadiness,
          recommendations: latestReadiness.recommendations,
          launchActions,
          wizard,
          verifiedAt: new Date().toISOString(),
        },
      }, partnerEvent(actor, 'verified_partner', 'Партнёру присвоен статус “Проверенный партнёр АПГ”', { readinessPercent: latestReadiness.percent }));
      return { ok: true, partnerId: id, lifecycleStatus: 'verified_partner', readiness: latestReadiness, launchActions, wizard };
    });
  }

  if (action === 'partner:remind-later') {
    const lifecycleStatus = partnerLifecycleStatus(partner, readiness);
    await updatePartnerOnboarding(db, req, actor, id, {
      connectionStatus: email ? 'email_specified' : 'created',
      connectionStatusLabel: email ? PARTNER_STATUS_LABELS.email_specified : PARTNER_STATUS_LABELS.created,
      lifecycleStatus,
      lifecycleStatusLabel: PARTNER_STATUS_LABELS[lifecycleStatus],
      partnerOnboarding: { ...(partner.partnerOnboarding || {}), reminderDeferredAt: new Date().toISOString(), readiness, launchActions: buildPartnerLaunchActions(partner), wizard: buildPartnerPublicationWizard(partner, readiness) },
    }, partnerEvent(actor, 'remind_later', 'Подключение владельца отложено', { email }));
    return { ok: true, partnerId: id, connectionStatus: email ? 'email_specified' : 'created' };
  }

  const error = new Error('Неизвестное действие подключения партнёра.');
  error.statusCode = 400;
  throw error;
}

async function handleEntityList(db, req, actor) {
  const resource = String(req.body?.resource || '').trim();
  const config = RESOURCE_CONFIG[resource];
  const listConfig = LIST_CONFIG[resource];
  if (!config || !listConfig) {
    const error = new Error('Неизвестный административный список.');
    error.statusCode = 400;
    throw error;
  }
  const reader = await requireAdminPermission(req, `${config.scope}:read`);
  let ref = db.collection(config.collection);
  if (listConfig.orderBy) ref = ref.orderBy(listConfig.orderBy[0], listConfig.orderBy[1]);
  const max = Math.min(Number(req.body?.limit || listConfig.limit || 200), listConfig.limit || 200, 1000);
  if (max > 0) ref = ref.limit(max);
  const snap = await ref.get();
  const rows = snap.docs.map(doc => ({ id: doc.id, ...serializeAdminValue(doc.data() || {}) }));
  return {
    ok: true,
    resource,
    rows: resource === 'aiImportRequests' && !canAccessLegalData(actor || reader) ? rows.map(stripLegalData) : rows,
    count: snap.size,
  };
}

async function writeHistory(db, actor, newsId, action, before, after) {
  await db.collection('newsChangeHistory').add({
    newsId,
    action,
    before: before || null,
    after: after || null,
    actorId: actor.userId,
    actorUid: actor.uid,
    actorName: actor.name,
    role: actor.role,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function runIdempotent(db, actor, key, fn) {
  if (!key) return fn();
  const ref = db.collection('adminIdempotency').doc(`${actor.uid}_${key}`);
  const snap = await ref.get();
  if (snap.exists) return { ...(snap.data()?.response || { ok: true }), idempotent: true };
  const result = await fn();
  await ref.set({
    actorUid: actor.uid,
    key,
    response: result,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }, { merge: true });
  return result;
}

async function handleNewsAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const id = String(req.body?.id || req.body?.targetId || '').trim();
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();

  if (action === 'news:create') {
    await requireAdminPermission(req, 'news:create');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = cleanPatch(req.body?.patch);
      if (!patch.title || !patch.text) {
        const error = new Error('Для новости нужны заголовок и текст.');
        error.statusCode = 400;
        throw error;
      }
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection('news').add(data);
      await writeHistory(db, actor, ref.id, 'create', null, data);
      await writeAuditLog(db, req, actor, 'create', 'news', ref.id, { label: `Создана новость: ${patch.title}` });
      return { ok: true, id: ref.id };
    });
  }

  if (!id) {
    const error = new Error('Не указан id новости.');
    error.statusCode = 400;
    throw error;
  }

  const ref = db.collection('news').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error('Новость не найдена.');
    error.statusCode = 404;
    throw error;
  }
  const before = snap.data() || {};

  if (action === 'news:update' || action === 'news:autosave') {
    await requireAdminPermission(req, 'news:update');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { ...cleanPatch(req.body?.patch), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, action === 'news:autosave' ? 'autosave' : 'quick-update', before, patch);
      await writeAuditLog(db, req, actor, action, 'news', id, { label: `${action === 'news:autosave' ? 'Автосохранена' : 'Изменена'} новость: ${patch.title || before.title || id}`, fields: Object.keys(patch) });
      return { ok: true, id, patch };
    });
  }

  if (action === 'news:publish') {
    await requireAdminPermission(req, 'news:publish');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: true, status: 'published', publishedAt: before.publishedAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'publish', before, patch);
      await writeAuditLog(db, req, actor, 'publish', 'news', id, { label: `Опубликована новость: ${before.title || id}` });
      return { ok: true, id, patch: { active: true, status: 'published' } };
    });
  }

  if (action === 'news:pin') {
    await requireAdminPermission(req, 'news:pin');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const next = !(before.pinned || before.isPinned);
      const patch = { pinned: next, isPinned: next, priority: next ? Math.max(Number(before.priority || 0), 9) : Number(before.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, next ? 'pin' : 'unpin', before, patch);
      await writeAuditLog(db, req, actor, next ? 'pin' : 'unpin', 'news', id, { label: `${next ? 'Закреплена' : 'Откреплена'} новость: ${before.title || id}` });
      return { ok: true, id, patch: { pinned: next, isPinned: next, priority: patch.priority } };
    });
  }

  if (action === 'news:delete') {
    await requireAdminPermission(req, 'news:delete');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: false, status: 'deleted', deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'soft-delete', before, patch);
      await writeAuditLog(db, req, actor, 'delete', 'news', id, { label: `Удалена новость: ${before.title || id}`, softDelete: true });
      return { ok: true, id, patch: { active: false, status: 'deleted' }, previous: { ...before, id } };
    });
  }

  if (action === 'news:restore') {
    await requireAdminPermission(req, 'news:restore');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const previous = req.body?.previous || {};
      const patch = {
        active: previous.active !== false,
        status: previous.status && previous.status !== 'deleted' ? previous.status : (previous.active === false ? 'draft' : 'published'),
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'restore', before, patch);
      await writeAuditLog(db, req, actor, 'restore', 'news', id, { label: `Восстановлена новость: ${before.title || previous.title || id}` });
      return { ok: true, id, patch: { active: patch.active, status: patch.status, deletedAt: null } };
    });
  }

  if (action === 'news:reorder') {
    await requireAdminPermission(req, 'news:reorder');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { priority: Number(req.body?.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'drag-reorder', before, patch);
      await writeAuditLog(db, req, actor, 'drag-reorder', 'news', id, { label: `Изменён порядок новости: ${before.title || id}`, targetId: req.body?.targetId || null });
      return { ok: true, id, patch: { priority: patch.priority } };
    });
  }

  const error = new Error('Неизвестное административное действие.');
  error.statusCode = 400;
  throw error;
}

async function handleEntityAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const resource = String(req.body?.resource || '').trim();
  if (action === 'entity:list') return handleEntityList(db, req, actor);
  const config = RESOURCE_CONFIG[resource];
  if (!config) {
    const error = new Error('Неизвестный административный ресурс.');
    error.statusCode = 400;
    throw error;
  }

  const verb = action.split(':')[1] || '';
  const id = String(req.body?.id || req.body?.targetId || '').trim();
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();

  if (action === 'entity:create') {
    await requireAdminPermission(req, `${config.scope}:create`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      assertLegalPatchAllowed(resource, patch, actor);
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection(config.collection).add(data);
      await writeAuditLog(db, req, actor, `${config.scope}:create`, config.collection, ref.id, { label: `Создан ${config.label}: ${patch.name || patch.title || ref.id}` });
      return { ok: true, resource, id: ref.id, patch: data };
    });
  }

  if (!id) {
    const error = new Error('Не указан id административного объекта.');
    error.statusCode = 400;
    throw error;
  }

  const ref = db.collection(config.collection).doc(id);

  if (action === 'entity:update') {
    await requireAdminPermission(req, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const increments = req.body?.increments || {};
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      assertLegalPatchAllowed(resource, patch, actor);
      Object.entries(increments).forEach(([key, value]) => {
        patch[key] = FieldValue.increment(Number(value) || 0);
      });
      patch.updatedAt = FieldValue.serverTimestamp();
      await ref.set(patch, { merge: true });
      await writeAuditLog(db, req, actor, `${config.scope}:update`, config.collection, id, { label: `Обновлён ${config.label}: ${patch.name || patch.title || id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch: cleanEntityPatch(req.body?.patch), increments };
    });
  }

  if (action === 'entity:delete') {
    await requireAdminPermission(req, `${config.scope}:delete`);
    if ((resource === 'partners' || resource === 'experts') && String(actor?.role || '').toLowerCase() !== 'owner') {
      const error = new Error('Окончательное удаление партнёров и экспертов доступно только owner. Используйте архив.');
      error.statusCode = 403;
      throw error;
    }
    return runIdempotent(db, actor, idempotencyKey, async () => {
      await ref.delete();
      await writeAuditLog(db, req, actor, `${config.scope}:delete`, config.collection, id, { label: `Удалён ${config.label}: ${id}` });
      return { ok: true, resource, id };
    });
  }

  if (action === 'entity:set') {
    await requireAdminPermission(req, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      assertLegalPatchAllowed(resource, patch, actor);
      await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAuditLog(db, req, actor, `${config.scope}:set`, config.collection, id, { label: `Сохранён ${config.label}: ${id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch };
    });
  }

  const error = new Error(`Неизвестное действие ${verb || action}.`);
  error.statusCode = 400;
  throw error;
}

async function notifyEventAuthor(db, event, type, title, text) {
  const userId = String(event.submittedByUserId || event.proposalAuthorId || '').trim();
  if (!userId) return;
  await db.collection('notifications').add({
    title,
    text,
    category: 'events',
    type,
    priority: type === 'error' ? 'high' : 'normal',
    targetType: 'user',
    targetValue: userId,
    userId,
    eventId: event.id,
    source: 'event_moderation',
    status: 'published',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleEventModerationAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const id = String(req.body?.id || req.body?.eventId || '').trim();
  const comment = String(req.body?.comment || req.body?.reason || '').trim().slice(0, 1000);
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();
  if (!id) {
    const error = new Error('Не указано событие.');
    error.statusCode = 400;
    throw error;
  }
  await requireAdminPermission(req, 'events:update');
  const ref = db.collection('events').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error('Событие не найдено.');
    error.statusCode = 404;
    throw error;
  }
  const before = { id, ...(snap.data() || {}) };

  return runIdempotent(db, actor, idempotencyKey, async () => {
    let patch;
    let notify;
    if (action === 'event:approve') {
      patch = {
        active: true,
        status: 'published',
        submissionStatus: 'approved',
        moderationStatus: 'approved',
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: actor.uid,
        moderationComment: comment || '',
        publishedAt: before.publishedAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      notify = ['success', 'Мероприятие одобрено', `Ваше предложение «${before.title || 'мероприятие'}» опубликовано в АПГ.`];
    } else if (action === 'event:request_changes') {
      patch = {
        active: false,
        status: 'revision_requested',
        submissionStatus: 'revision_requested',
        moderationStatus: 'revision_requested',
        revisionComment: comment || 'Администратор попросил уточнить детали мероприятия.',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
      notify = ['important', 'Мероприятие отправлено на доработку', comment || 'Администратор попросил уточнить детали мероприятия.'];
    } else if (action === 'event:reject') {
      if (!comment) {
        const error = new Error('Укажите причину отклонения.');
        error.statusCode = 400;
        throw error;
      }
      patch = {
        active: false,
        status: 'rejected',
        submissionStatus: 'rejected',
        moderationStatus: 'rejected',
        rejectionReason: comment,
        rejectedAt: FieldValue.serverTimestamp(),
        rejectedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
      notify = ['error', 'Мероприятие отклонено', comment];
    } else {
      const error = new Error('Неизвестное действие модерации события.');
      error.statusCode = 400;
      throw error;
    }

    await ref.set(patch, { merge: true });
    await notifyEventAuthor(db, before, notify[0], notify[1], notify[2]);
    await writeAuditLog(db, req, actor, action, 'events', id, { label: `${notify[1]}: ${before.title || id}`, comment });
    return { ok: true, id, patch: serializeAdminValue(patch) };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-Auth,X-APG-Auth,X-Idempotency-Key,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const db = getAdminDb();
  try {
    const actor = await requireAdminPermission(req, 'system:read');
    const action = String(req.body?.action || '');
    const result = action.startsWith('entity:')
      ? await handleEntityAction(db, req, actor)
      : action.startsWith('event:')
        ? await handleEventModerationAction(db, req, actor)
      : action.startsWith('referrals:')
        ? await handleReferralAction(db, req, actor)
      : action.startsWith('partner:')
        ? await handlePartnerOnboardingAction(db, req, actor)
        : await handleNewsAction(db, req, actor);
    return res.status(200).json(result);
  } catch (error) {
    try {
      await writeAuditLog(db, req, { uid: 'unknown', userId: 'unknown', role: 'unknown' }, String(req.body?.action || 'admin-action'), 'unknown', req.body?.id || '', { error: String(error?.message || error) }, 'error');
    } catch {}
    return adminError(res, error);
  }
}
