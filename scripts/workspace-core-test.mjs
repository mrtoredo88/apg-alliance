import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildWorkspaceLayout,
  createWorkspaceCache,
  getWorkspaceMode,
  getWorkspaceNavigation,
  makeVirtualWindow,
  USER_MODE_NAV_ITEMS,
  WORKSPACE_BREAKPOINTS,
  WORKSPACE_MODES,
  WORKSPACE_NAV_ITEMS,
  WORKSPACE_REGIONS,
} from '../src/workspace/WorkspaceCore.js';
import { buildWorkspaceDayPlan } from '../src/intelligence/WorkspaceDayPlanner.js';
import {
  buildWorkspaceEventDuplicate,
  filterWorkspaceEvents,
  findWorkspaceEventConflicts,
  isWorkspaceEventPast,
  workspaceEventBelongsToProfile,
  workspaceEventStatus,
  workspaceEventStatusLabel,
} from '../server-shared/workspace-events.js';
import {
  buildWorkspaceNewsFromEvent,
  buildWorkspaceNewsKpis,
  filterWorkspaceNews,
  sanitizeWorkspaceNewsPatch,
  workspaceNewsBelongsToProfile,
  workspaceNewsStatus,
  workspaceNewsStatusLabel,
} from '../server-shared/workspace-news.js';
import {
  buildWorkspaceAnalyticsRange,
  buildWorkspaceLocationAnalytics,
  buildWorkspaceAnalyticsSnapshot,
  filterWorkspaceAnalyticsSources,
  workspaceAnalyticsRowsToCsv,
} from '../server-shared/workspace-analytics.js';
import {
  buildWorkspacePromotionFromProfile,
  buildWorkspacePromotionKpis,
  filterWorkspacePromotions,
  sanitizeWorkspacePromotionPatch,
  workspacePromotionStatus,
  workspacePromotionStatusLabel,
} from '../server-shared/workspace-promotions.js';
import {
  buildWorkspaceGift,
  buildWorkspaceGiftKpis,
  filterWorkspaceGifts,
  sanitizeWorkspaceGiftPatch,
  workspaceGiftBelongsToProfile,
  workspaceGiftStatus,
  workspaceGiftStatusLabel,
} from '../server-shared/workspace-gifts.js';

assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.mobile), WORKSPACE_MODES.mobile);
assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.tablet), WORKSPACE_MODES.tablet);
assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.desktop), WORKSPACE_MODES.desktop);

const mobile = buildWorkspaceLayout({ width: 390 });
assert.equal(mobile.mode, WORKSPACE_MODES.mobile);
assert.equal(mobile.regions[WORKSPACE_REGIONS.bottomBar].visible, true);
assert.equal(mobile.regions[WORKSPACE_REGIONS.leftSidebar].visible, false);
assert.equal(mobile.contextPresentation, 'overlay');

const tablet = buildWorkspaceLayout({ width: 820 });
assert.equal(tablet.mode, WORKSPACE_MODES.tablet);
assert.equal(tablet.regions[WORKSPACE_REGIONS.bottomBar].visible, true);
assert.equal(tablet.regions[WORKSPACE_REGIONS.leftSidebar].visible, false);

const desktop = buildWorkspaceLayout({ width: 1280, contextOpen: true, pinnedContext: true });
assert.equal(desktop.mode, WORKSPACE_MODES.desktop);
assert.equal(desktop.regions[WORKSPACE_REGIONS.leftSidebar].visible, true);
assert.equal(desktop.regions[WORKSPACE_REGIONS.bottomBar].visible, false);
assert.equal(desktop.regions[WORKSPACE_REGIONS.rightSidebar].visible, true);
assert.equal(desktop.regions[WORKSPACE_REGIONS.statusBar].visible, true);
assert.equal(desktop.contextPresentation, 'docked');

const mobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'user' });
assert.equal(mobileNav.placement, 'bottom');
assert.deepEqual(mobileNav.primary.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);

const superAdminMobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'super_admin' });
assert.equal(superAdminMobileNav.role, 'super_admin');
assert.deepEqual(superAdminMobileNav.primary.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);
assert.deepEqual(superAdminMobileNav.primary.map(item => item.panelId), ['home', 'offers', null, 'experts', 'profile']);

const unknownMobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'unknown-role' });
assert.equal(unknownMobileNav.role, 'user');
assert.deepEqual(unknownMobileNav.unknownRoles, ['unknown-role']);
assert.deepEqual(USER_MODE_NAV_ITEMS.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);

const desktopPartnerNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.desktop, role: 'partner' });
assert.equal(desktopPartnerNav.placement, 'sidebar');
assert.ok(desktopPartnerNav.primary.some(item => item.id === 'business-hub'));
assert.ok(desktopPartnerNav.primary.some(item => item.id === 'messages' && item.label === 'Люди' && item.panelId === 'dialogs'));

const navIds = WORKSPACE_NAV_ITEMS.map(item => item.id);
assert.equal(navIds.length, new Set(navIds).size);

const desktopWorkspaceSource = readFileSync(new URL('../src/workspace/DesktopWorkspace.jsx', import.meta.url), 'utf8');
const workspaceLinksSource = readFileSync(new URL('../src/workspace/WorkspaceLinks.jsx', import.meta.url), 'utf8');
const workspaceEventsSource = readFileSync(new URL('../src/workspace/WorkspaceEventsManager.jsx', import.meta.url), 'utf8');
const workspaceMeetingsSource = readFileSync(new URL('../src/workspace/WorkspaceMeetingsCRM.jsx', import.meta.url), 'utf8');
const workspaceDialogsSource = readFileSync(new URL('../src/workspace/WorkspaceDialogsCRM.jsx', import.meta.url), 'utf8');
const workspaceNewsSource = readFileSync(new URL('../src/workspace/WorkspaceNewsCenter.jsx', import.meta.url), 'utf8');
const workspacePromotionsSource = readFileSync(new URL('../src/workspace/WorkspacePromotionsCenter.jsx', import.meta.url), 'utf8');
const workspaceGiftsSource = readFileSync(new URL('../src/workspace/WorkspaceGiftsCenter.jsx', import.meta.url), 'utf8');
const workspaceAnalyticsSource = readFileSync(new URL('../src/workspace/WorkspaceAnalyticsCenter.jsx', import.meta.url), 'utf8');
const navBlock = desktopWorkspaceSource.match(/const NAV_ITEMS = \[([\s\S]*?)\];/)?.[1] || '';
const desktopWorkspaceNavIds = [...navBlock.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
assert.deepEqual(desktopWorkspaceNavIds.slice(0, 5), ['dashboard', 'profile', 'events', 'booking', 'dialogs']);
assert.ok(desktopWorkspaceSource.includes("if (activeSection === 'profile')"));
assert.ok(desktopWorkspaceSource.includes('<DigitalShowcaseBuilder'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceEventsManager'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceMeetingsCRM'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceDialogsCRM'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceNewsCenter'));
assert.ok(desktopWorkspaceSource.includes('<WorkspacePromotionsCenter'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceGiftsCenter'));
assert.ok(desktopWorkspaceSource.includes('<WorkspaceAnalyticsCenter'));
assert.ok(desktopWorkspaceSource.includes('Центр рабочего дня'));
assert.ok(desktopWorkspaceSource.includes('Лента активности'));
assert.ok(desktopWorkspaceSource.includes('Быстрые действия'));
assert.ok(!desktopWorkspaceSource.includes('Что изменилось'));
assert.ok(workspaceLinksSource.includes('buildWorkspaceRelatedLinks'));
assert.ok(workspaceLinksSource.includes('openWorkspaceLink'));
assert.ok(workspaceLinksSource.includes('apg.workspace.linkIntent'));
assert.ok([desktopWorkspaceSource, workspaceEventsSource, workspaceMeetingsSource, workspaceDialogsSource, workspaceNewsSource, workspacePromotionsSource, workspaceGiftsSource].every(source => source.includes('WorkspaceRelatedLinks')));
assert.ok([workspaceEventsSource, workspaceMeetingsSource, workspaceDialogsSource, workspaceNewsSource, workspacePromotionsSource, workspaceGiftsSource, workspaceAnalyticsSource].every(source => source.includes('readWorkspaceLinkIntent') || source.includes('openWorkspaceLink')));
assert.ok(workspaceAnalyticsSource.includes('onClick={() => openWorkspaceLink'));

const partnerProfile = { id: 'partner-1', name: 'Coffee House' };
const expertProfile = { id: 'expert-1', name: 'Анна Эксперт' };
const workspaceEvents = [
  { id: 'own-draft', partnerId: 'partner-1', title: 'Черновик', status: 'draft', startAt: '2026-07-20T10:00:00.000Z', endAt: '2026-07-20T11:00:00.000Z', registeredCount: 4, views: 12 },
  { id: 'own-conflict', partnerId: 'partner-1', title: 'Конфликт', status: 'published', startAt: '2026-07-20T10:30:00.000Z', endAt: '2026-07-20T12:00:00.000Z' },
  { id: 'own-archived', partnerId: 'partner-1', title: 'Архив', status: 'archived', archived: true },
  { id: 'expert-event', expertId: 'expert-1', submittedProfileId: 'expert-1', proposalAuthorType: 'expert', title: 'Лекция', moderationStatus: 'pending_review', startAt: '2026-07-21T10:00:00.000Z' },
  { id: 'foreign', partnerId: 'partner-2', title: 'Чужое', status: 'published' },
];
const partnerEvents = filterWorkspaceEvents(workspaceEvents, partnerProfile, 'partner');
assert.deepEqual(partnerEvents.map(item => item.id), ['own-draft', 'own-conflict']);
const partnerEventsWithArchive = filterWorkspaceEvents(workspaceEvents, partnerProfile, 'partner', { includeDeleted: true });
assert.deepEqual(partnerEventsWithArchive.map(item => item.id), ['own-draft', 'own-conflict', 'own-archived']);
const expertEvents = filterWorkspaceEvents(workspaceEvents, expertProfile, 'expert');
assert.deepEqual(expertEvents.map(item => item.id), ['expert-event']);
assert.equal(workspaceEventBelongsToProfile(workspaceEvents[4], partnerProfile, 'partner'), false);
assert.equal(workspaceEventStatus(workspaceEvents[3]), 'pending_review');
assert.equal(workspaceEventStatusLabel(workspaceEvents[3]), 'На модерации');
assert.equal(isWorkspaceEventPast({ startAt: '2026-07-01T10:00:00.000Z', endAt: '2026-07-01T11:00:00.000Z' }, Date.parse('2026-07-14T10:00:00.000Z')), true);
assert.equal(findWorkspaceEventConflicts(partnerEventsWithArchive, workspaceEvents[0], 'own-draft').map(item => item.id).join(','), 'own-conflict');
const duplicate = buildWorkspaceEventDuplicate(workspaceEvents[0], partnerProfile, 'partner', { userId: 'owner-1' });
assert.equal(duplicate.status, 'draft');
assert.equal(duplicate.partnerId, 'partner-1');
assert.equal(duplicate.registeredCount, 0);
assert.equal(duplicate.views, 0);
assert.equal(duplicate.startAt, '');
assert.equal(Object.hasOwn(duplicate, 'id'), false);

const workspaceNews = [
  { id: 'n1', partnerId: 'partner-1', title: 'Акция Coffee House', text: 'Скидка на кофе', status: 'draft', active: false, stats: { views: 4, comments: 1, clicks: 2, likes: 3 }, category: 'offers', updatedAt: '2026-07-14T10:00:00.000Z' },
  { id: 'n2', partnerId: 'partner-1', title: 'Опубликовано', status: 'published', active: true, stats: { views: 10 }, category: 'partners', publishedAt: '2026-07-13T10:00:00.000Z' },
  { id: 'n3', expertId: 'expert-1', title: 'Экспертная заметка', lifecycleStatus: 'moderation', text: 'Советы', category: 'experts' },
  { id: 'n4', partnerId: 'partner-2', title: 'Чужая новость', status: 'published', active: true },
];
assert.equal(workspaceNewsBelongsToProfile(workspaceNews[0], partnerProfile, 'partner'), true);
assert.equal(workspaceNewsBelongsToProfile(workspaceNews[3], partnerProfile, 'partner'), false);
assert.equal(workspaceNewsBelongsToProfile(workspaceNews[2], expertProfile, 'expert'), true);
assert.equal(workspaceNewsStatus(workspaceNews[2]), 'moderation');
assert.equal(workspaceNewsStatusLabel(workspaceNews[0]), 'Черновик');
const newsKpis = buildWorkspaceNewsKpis(workspaceNews.filter(item => workspaceNewsBelongsToProfile(item, partnerProfile, 'partner')));
assert.equal(newsKpis.total, 2);
assert.equal(newsKpis.draft, 1);
assert.equal(newsKpis.published, 1);
assert.equal(newsKpis.views, 14);
assert.equal(newsKpis.comments, 1);
assert.equal(newsKpis.clicks, 2);
assert.deepEqual(filterWorkspaceNews(workspaceNews, { status: 'draft' }).map(item => item.id), ['n1']);
assert.deepEqual(filterWorkspaceNews(workspaceNews, { category: 'offers', query: 'кофе' }).map(item => item.id), ['n1']);
assert.deepEqual(sanitizeWorkspaceNewsPatch({ title: ' Тест ', unknown: 'x', tags: ['a'], priority: 101 }), { title: 'Тест', tags: ['a'], priority: 99 });
const newsFromEvent = buildWorkspaceNewsFromEvent(workspaceEvents[0], partnerProfile, 'partner');
assert.equal(newsFromEvent.partnerId, 'partner-1');
assert.equal(newsFromEvent.eventId, 'own-draft');
assert.equal(newsFromEvent.category, 'events');

const promotionProfiles = [
  { id: 'partner-1', name: 'Coffee House', offer: 'Кофе + десерт', category: 'Еда', promotionStats: { views: 100, claimed: 12, used: 8 }, offerUntil: '2026-07-31T00:00:00.000Z' },
  { id: 'partner-2', name: 'Studio', promotionDraft: { title: 'Маникюр -20%', description: 'Будни до 16:00', category: 'Красота', promotionType: 'discount' }, promotionStatus: 'draft', promotionStats: { views: 5 } },
  { id: 'expert-1', name: 'Анна', promotionPendingPatch: { title: 'Консультация', description: 'Первая встреча' }, promotionStatus: 'moderation' },
];
const workspacePromotions = [
  buildWorkspacePromotionFromProfile(promotionProfiles[0], 'partner'),
  buildWorkspacePromotionFromProfile(promotionProfiles[1], 'partner'),
  buildWorkspacePromotionFromProfile(promotionProfiles[2], 'expert'),
];
assert.equal(workspacePromotions[0].status, 'published');
assert.equal(workspacePromotions[0].offer, 'Кофе + десерт');
assert.equal(workspacePromotions[1].status, 'draft');
assert.equal(workspacePromotions[2].profileType, 'expert');
assert.equal(workspacePromotionStatus(workspacePromotions[2]), 'moderation');
assert.equal(workspacePromotionStatusLabel(workspacePromotions[0]), 'Опубликовано');
const promotionKpis = buildWorkspacePromotionKpis(workspacePromotions);
assert.equal(promotionKpis.total, 3);
assert.equal(promotionKpis.published, 1);
assert.equal(promotionKpis.draft, 1);
assert.equal(promotionKpis.moderation, 1);
assert.equal(promotionKpis.views, 105);
assert.equal(promotionKpis.claimed, 12);
assert.equal(promotionKpis.used, 8);
assert.deepEqual(filterWorkspacePromotions(workspacePromotions, { query: 'кофе' }).map(item => item.profileId), ['partner-1']);
assert.deepEqual(filterWorkspacePromotions(workspacePromotions, { status: 'draft' }).map(item => item.profileId), ['partner-2']);
assert.deepEqual(sanitizeWorkspacePromotionPatch({ title: ' Скидка ', unknown: 'x', discountPercent: 250, tags: ['vip'] }), { title: 'Скидка', discountPercent: 100, tags: ['vip'], offer: 'Скидка' });

const workspaceGiftClaims = [
  { id: 'c1', prizeId: 'gift-1', userId: 'u1', userName: 'Иван', status: 'pending', claimedAt: '2026-07-14T10:00:00.000Z' },
  { id: 'c2', prizeId: 'gift-1', userId: 'u2', userName: 'Мария', status: 'given', claimedAt: '2026-07-14T11:00:00.000Z' },
  { id: 'c3', prizeId: 'gift-2', userId: 'u3', userName: 'Анна', status: 'given' },
];
const workspaceGiftEntries = [
  { id: 'r1', prizeId: 'gift-2', userId: 'u1', ticketsCount: 2 },
  { id: 'r2', prizeId: 'gift-2', userId: 'u2', ticketsCount: 3 },
];
const workspaceGifts = [
  buildWorkspaceGift({ id: 'gift-1', partnerId: 'partner-1', name: 'Кофе', type: 'purchase', cost: 5, stock: 4, status: 'published', active: true, stats: { views: 20 } }, { claims: workspaceGiftClaims, entries: workspaceGiftEntries, partners: [{ id: 'partner-1', name: 'Coffee House' }] }),
  buildWorkspaceGift({ id: 'gift-2', expertId: 'expert-1', name: 'Консультация', type: 'raffle', ticketCost: 1, stock: 1, lifecycleStatus: 'moderation', raffleDate: '2026-07-31T10:00:00.000Z', stats: { views: 10 } }, { claims: workspaceGiftClaims, entries: workspaceGiftEntries, experts: [{ id: 'expert-1', name: 'Анна Эксперт' }] }),
];
assert.equal(workspaceGiftBelongsToProfile(workspaceGifts[0], partnerProfile, 'partner'), true);
assert.equal(workspaceGiftBelongsToProfile(workspaceGifts[1], partnerProfile, 'partner'), false);
assert.equal(workspaceGiftBelongsToProfile(workspaceGifts[1], expertProfile, 'expert'), true);
assert.equal(workspaceGiftStatus(workspaceGifts[1]), 'moderation');
assert.equal(workspaceGiftStatusLabel(workspaceGifts[0]), 'Опубликовано');
assert.equal(workspaceGifts[0].received, 2);
assert.equal(workspaceGifts[0].issued, 1);
assert.equal(workspaceGifts[1].stats.tickets, 5);
const giftKpis = buildWorkspaceGiftKpis(workspaceGifts);
assert.equal(giftKpis.total, 2);
assert.equal(giftKpis.published, 1);
assert.equal(giftKpis.moderation, 1);
assert.equal(giftKpis.received, 3);
assert.equal(giftKpis.issued, 2);
assert.equal(giftKpis.remaining, 5);
assert.deepEqual(filterWorkspaceGifts(workspaceGifts, { query: 'кофе' }).map(item => item.id), ['gift-1']);
assert.deepEqual(filterWorkspaceGifts(workspaceGifts, { type: 'raffle' }).map(item => item.id), ['gift-2']);
assert.deepEqual(sanitizeWorkspaceGiftPatch({ name: ' Подарок ', type: 'raffle', cost: -5, tags: ['vip'], unknown: 'x' }), { name: 'Подарок', cost: 0, tags: ['vip'], type: 'raffle', opportunityType: 'raffle', title: 'Подарок' });

const analyticsRange = buildWorkspaceAnalyticsRange({ period: '30d', now: '2026-07-14T12:00:00.000Z' });
assert.equal(analyticsRange.period, '30d');
assert.ok(new Date(analyticsRange.to).getTime() - new Date(analyticsRange.from).getTime() >= 29 * 24 * 60 * 60 * 1000);
const analyticsSources = {
  news: [
    { id: 'n1', partnerId: 'partner-1', title: 'Лучшая новость', status: 'published', stats: { views: 100, clicks: 12, comments: 3 }, publishedAt: '2026-07-13T10:00:00.000Z' },
    { id: 'n2', partnerId: 'partner-2', title: 'Чужая', status: 'published', stats: { views: 999 }, publishedAt: '2026-07-13T10:00:00.000Z' },
  ],
  events: [
    { id: 'e1', partnerId: 'partner-1', title: 'Нетворкинг', status: 'published', views: 40, registeredCount: 6, visitsCount: 4, startAt: '2026-07-14T10:00:00.000Z' },
    { id: 'e2', partnerId: 'partner-2', title: 'Чужое', views: 400, startAt: '2026-07-14T10:00:00.000Z' },
  ],
  bookings: [
    { id: 'b1', providerType: 'partner', providerId: 'partner-1', userId: 'u1', status: 'completed', startAt: '2026-07-14T12:00:00.000Z', createdAt: '2026-07-13T12:00:00.000Z' },
    { id: 'b2', providerType: 'partner', providerId: 'partner-1', userId: 'u1', status: 'confirmed', startAt: '2026-07-14T13:00:00.000Z', createdAt: '2026-07-14T12:00:00.000Z' },
    { id: 'b3', providerType: 'expert', providerId: 'expert-1', userId: 'u9', status: 'completed', startAt: '2026-07-14T12:00:00.000Z', createdAt: '2026-07-13T12:00:00.000Z' },
  ],
  dialogs: [
    { id: 'd1', objectId: 'partner-1', context: { title: 'Coffee House' }, unreadBy: { owner: 2 }, lastMessageAt: '2026-07-14T11:00:00.000Z', createdAt: '2026-07-14T10:00:00.000Z' },
  ],
  comments: [
    { id: 'c1', newsId: 'n1', text: 'Комментарий', createdAt: '2026-07-14T11:00:00.000Z' },
  ],
  notifications: [
    { id: 'nt1', objectId: 'partner-1', source: 'push', createdAt: '2026-07-14T11:00:00.000Z' },
  ],
  scans: [
    { id: 's1', partnerId: 'partner-1', createdAt: '2026-07-14T11:00:00.000Z' },
  ],
};
const filteredAnalytics = filterWorkspaceAnalyticsSources(analyticsSources, partnerProfile, 'partner', analyticsRange);
assert.deepEqual(filteredAnalytics.news.map(item => item.id), ['n1']);
assert.deepEqual(filteredAnalytics.events.map(item => item.id), ['e1']);
assert.deepEqual(filteredAnalytics.bookings.map(item => item.id), ['b1', 'b2']);
const analyticsSnapshot = buildWorkspaceAnalyticsSnapshot({
  profile: {
    ...partnerProfile,
    stats: { profileViews: 30, websiteClicks: 2, routeClicks: 3 },
    locations: [
      { id: 'center', title: 'Центр', address: 'Корпус 1', isMain: true },
      { id: 'north', title: 'Север', address: 'Корпус 2' },
    ],
    locationStats: { center: { views: 4, routeClicks: 1 }, north: { views: 7, phoneClicks: 2 } },
  },
  role: 'partner',
  range: analyticsRange,
  sources: analyticsSources,
});
assert.equal(analyticsSnapshot.dataPolicy, 'real-system-data-only');
assert.equal(analyticsSnapshot.kpis.newsViews, 100);
assert.equal(analyticsSnapshot.kpis.eventViews, 40);
assert.equal(analyticsSnapshot.kpis.completedBookings, 1);
assert.equal(analyticsSnapshot.kpis.repeatedBookings, 1);
assert.ok(analyticsSnapshot.funnel.some(item => item.id === 'completed'));
assert.ok(analyticsSnapshot.news.top[0].id === 'n1');
assert.ok(analyticsSnapshot.recommendations.every(item => item.confidence === 'real-data'));
assert.ok(analyticsSnapshot.lokiContext.kpis);
assert.equal(analyticsSnapshot.locations.length, 2);
assert.equal(analyticsSnapshot.locations.find(item => item.id === 'center').bookings, 2);
assert.equal(buildWorkspaceLocationAnalytics({ id: 'single', address: 'Корпус 1' }, {}).length, 0);
const analyticsCsv = workspaceAnalyticsRowsToCsv(analyticsSnapshot.exportRows);
assert.ok(analyticsCsv.includes('"KPI";"newsViews";"100"'));
assert.ok(analyticsCsv.includes('"Филиалы";"Центр: bookings";"2"'));
const adminAnalyticsSnapshot = buildWorkspaceAnalyticsSnapshot({
  profile: { id: 'all', name: 'Вся система' },
  role: 'admin',
  range: analyticsRange,
  sources: analyticsSources,
});
assert.equal(adminAnalyticsSnapshot.sourceCounts.news, 2);
assert.equal(adminAnalyticsSnapshot.kpis.newsViews, 1099);

const cache = createWorkspaceCache({ ttl: 1000, max: 1 });
cache.set('a', 1);
assert.equal(cache.get('a'), 1);
cache.set('b', 2);
assert.equal(cache.get('a'), undefined);
assert.equal(cache.get('b'), 2);

const virtual = makeVirtualWindow({ total: 1000, scrollTop: 720, itemHeight: 72, viewportHeight: 360, overscan: 2 });
assert.equal(virtual.start, 8);
assert.equal(virtual.end, 17);
assert.equal(virtual.count, 9);
assert.equal(virtual.offsetTop, 576);

const dayPlan = buildWorkspaceDayPlan({
  now: '2026-07-13T08:00:00.000Z',
  user: { firstName: 'Виталий' },
  analytics: {
    views: { news: 12 },
    clicks: { route: 4 },
    registrations: 2,
    qrScans: { started: 3, success: 2, errors: 0 },
    comments: 1,
    publications: 0,
  },
  activityTimeline: [{ id: 'a1', type: 'news.opened' }, { id: 'a2', type: 'event.registered' }],
  recommendations: { feed: [{ id: 'r1', title: 'Coffee Time', explanation: 'частая активность' }] },
  userState: { referralCount: 0 },
  appState: {
    unreadCount: 7,
    news: [{ id: 'n1', title: 'Старая новость', publishedAt: '2026-06-25T10:00:00.000Z' }],
    events: [{ id: 'e1', title: 'Завтрашний нетворкинг', eventDate: '2026-07-14T10:00:00.000Z' }],
    partners: [{ id: 'p1', name: 'Партнёр', pendingReviews: 3 }],
    notifications: [{ id: 'm1' }, { id: 'm2' }],
  },
});
assert.equal(dayPlan.version, 1);
assert.ok(dayPlan.tasks.some(item => item.id === 'notifications-critical'));
assert.ok(dayPlan.tasks.some(item => item.id === 'reviews-critical'));
assert.ok(dayPlan.tasks.some(item => item.id === 'content-stale'));
assert.ok(dayPlan.summary.criticalProblems >= 2);
assert.ok(dayPlan.attention.every(item => item.reason));
assert.ok(dayPlan.opportunities.length > 0);
assert.ok(dayPlan.miniAnalytics.some(item => item.label === 'QR'));

console.log('Workspace Core smoke test passed');
