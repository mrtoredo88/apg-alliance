import { CAPABILITIES, getUserRoles, hasCapability, isRoleWithinRolloutStage } from '../roleEngine.js';

export const BUSINESS_HUB_FLAG = {
  off: 'off',
  owner: 'owner',
  admin: 'admin',
  partner: 'partner',
  expert: 'expert',
  all: 'all',
};

const FLAG_ORDER = [
  BUSINESS_HUB_FLAG.off,
  BUSINESS_HUB_FLAG.owner,
  BUSINESS_HUB_FLAG.admin,
  BUSINESS_HUB_FLAG.partner,
  BUSINESS_HUB_FLAG.expert,
  BUSINESS_HUB_FLAG.all,
];

const text = value => String(value || '').trim();
const lower = value => text(value).toLowerCase();
const array = value => Array.isArray(value) ? value.filter(Boolean) : [];

export function normalizeBusinessHubFlag(value, fallback = BUSINESS_HUB_FLAG.owner) {
  const normalized = lower(value);
  return FLAG_ORDER.includes(normalized) ? normalized : fallback;
}

export function getBusinessHubFlag(storage = globalThis.localStorage) {
  try {
    return normalizeBusinessHubFlag(storage?.getItem?.('apg_business_hub_flag'), BUSINESS_HUB_FLAG.owner);
  } catch {
    return BUSINESS_HUB_FLAG.owner;
  }
}

export function canUseBusinessHub({ user, partner, expert, flag } = {}) {
  const resolvedFlag = normalizeBusinessHubFlag(flag, BUSINESS_HUB_FLAG.owner);
  const identity = {
    ...(user || {}),
    partnerId: user?.partnerId || partner?.id,
    expertId: user?.expertId || expert?.id,
  };
  if (resolvedFlag === BUSINESS_HUB_FLAG.off) return false;
  return hasCapability(identity, CAPABILITIES.canUseBusinessHub) && isRoleWithinRolloutStage(identity, resolvedFlag);
}

export function getBusinessProfile({ user, partner, expert, preferredRole } = {}) {
  if (preferredRole === 'expert' && expert?.id) return { kind: 'expert', label: 'Эксперт', profile: expert };
  if (preferredRole === 'partner' && partner?.id) return { kind: 'partner', label: 'Партнёр', profile: partner };
  if (partner?.id) return { kind: 'partner', label: 'Партнёр', profile: partner };
  if (expert?.id) return { kind: 'expert', label: 'Эксперт', profile: expert };
  const roles = getUserRoles({
    ...(user || {}),
    partnerId: user?.partnerId || partner?.id,
    expertId: user?.expertId || expert?.id,
  });
  return { kind: roles.includes('expert') ? 'expert' : 'partner', label: roles.includes('expert') ? 'Эксперт' : 'Партнёр', profile: null };
}

export function matchesBusinessProfile(item, profile) {
  if (!item || !profile?.id) return false;
  const ids = new Set([
    profile.id,
    profile.ownerId,
    profile.userId,
    profile.canonicalUserId,
  ].map(text).filter(Boolean));
  const candidates = [
    item.partnerId,
    item.expertId,
    item.profileId,
    item.businessId,
    item.ownerId,
    item.userId,
    item.authorId,
    item.canonicalUserId,
  ].map(text).filter(Boolean);
  if (candidates.some(id => ids.has(id))) return true;

  const profileName = lower(profile.name || profile.title || profile.companyName);
  if (!profileName) return false;
  const haystack = [
    item.partner,
    item.expert,
    item.organizer,
    item.authorName,
    item.sourceName,
    item.title,
    item.name,
  ].map(lower).join(' ');
  return Boolean(haystack && haystack.includes(profileName));
}

export function filterBusinessItems(items = [], profile) {
  const source = array(items);
  if (!profile?.id) return [];
  return source.filter(item => matchesBusinessProfile(item, profile));
}

export function getBusinessMetric(profile, keys = []) {
  for (const key of keys) {
    const value = profile?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

export function getBusinessPromotions(profile) {
  const explicit = [
    ...array(profile?.promotions),
    ...array(profile?.offers),
    ...array(profile?.specialOffers),
  ].map(value => typeof value === 'string' ? { title: value } : value);
  const single = [
    profile?.offer,
    profile?.gift,
    profile?.specialOffer,
    profile?.discount,
    profile?.promo,
    profile?.promoCode,
  ].filter(Boolean).map(value => typeof value === 'string' ? { title: value } : value);
  return [...explicit, ...single].filter(Boolean);
}

export function getBusinessReviews(profile) {
  return [
    ...array(profile?.reviews),
    ...array(profile?.recentReviews),
    ...array(profile?.comments),
  ];
}

export function getBusinessProfileCompletion(profile) {
  if (!profile?.id) {
    return {
      value: 0,
      label: 'Профиль не подключён',
      missing: ['Подключить профиль'],
      done: 0,
      total: 0,
    };
  }

  const gallery = array(profile.photos).length || array(profile.gallery).length || array(profile.media).length;
  const checks = [
    ['Название', profile.name || profile.title || profile.companyName],
    ['Описание', profile.description || profile.shortDescription || profile.about],
    ['Категория', profile.category || profile.categoryId || profile.categoryLabel || array(profile.categories).length],
    ['Контакты', profile.phone || profile.telegram || profile.telegramUrl || profile.vk || profile.vkUrl || profile.website || profile.websiteUrl],
    ['Медиа', profile.photo || profile.avatar || profile.logo || profile.logoUrl || profile.cover || profile.coverPhoto || gallery],
    ['Адрес или формат работы', profile.address || profile.location || profile.workFormat || array(profile.workFormats).length],
    ['Время работы', profile.hours || profile.workingHours || profile.schedule],
    ['Акция', getBusinessPromotions(profile).length],
  ];
  const done = checks.filter(([, value]) => Boolean(value)).length;
  const total = checks.length;
  return {
    value: Math.round(done / total * 100),
    label: `${done} из ${total} пунктов`,
    missing: checks.filter(([, value]) => !value).map(([label]) => label),
    done,
    total,
  };
}

export function buildBusinessHubModel({ user, partner, expert, preferredRole, partners = [], experts = [], news = [], events = [], notifications = [] } = {}) {
  const business = getBusinessProfile({ user, partner, expert, preferredRole });
  const profile = business.profile;
  const relatedNews = filterBusinessItems(news, profile);
  const relatedEvents = filterBusinessItems(events, profile);
  const promotions = getBusinessPromotions(profile);
  const reviews = getBusinessReviews(profile);
  const completion = getBusinessProfileCompletion(profile);
  const stats = {
    views: getBusinessMetric(profile, ['views', 'viewCount', 'profileViews', 'cardViews']),
    calls: getBusinessMetric(profile, ['calls', 'callCount', 'phoneClicks']),
    website: getBusinessMetric(profile, ['websiteClicks', 'siteClicks', 'websiteTransitions']),
    socials: getBusinessMetric(profile, ['socialClicks', 'telegramClicks', 'vkClicks', 'messengerClicks']),
    favorites: getBusinessMetric(profile, ['favorites', 'favoriteCount', 'favoritesCount']),
    routes: getBusinessMetric(profile, ['routeClicks', 'mapClicks', 'routeBuilds']),
    qr: getBusinessMetric(profile, ['qrScans', 'scanCount', 'publicQRScans']),
    reviews: Number(profile?.reviewCount || reviews.length || 0),
  };
  const tasks = [];
  if (!profile?.id) tasks.push('Подключить профиль бизнеса или эксперта');
  completion.missing.slice(0, 4).forEach(item => tasks.push(`Заполнить: ${item}`));
  if (!relatedNews.length) tasks.push('Подготовить первую новость');
  if (!relatedEvents.length) tasks.push('Добавить ближайшее мероприятие');
  if (!promotions.length) tasks.push('Создать акцию для пользователей АПГ');

  return {
    business,
    profile,
    completion,
    relatedNews,
    relatedEvents,
    promotions,
    reviews,
    notifications: array(notifications),
    stats,
    totals: {
      partners: array(partners).length,
      experts: array(experts).length,
      news: relatedNews.length,
      events: relatedEvents.length,
      promotions: promotions.length,
      reviews: Number(profile?.reviewCount || reviews.length || 0),
    },
    tasks: tasks.slice(0, 6),
  };
}
