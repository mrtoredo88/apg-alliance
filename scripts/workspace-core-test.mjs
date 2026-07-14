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

const navIds = WORKSPACE_NAV_ITEMS.map(item => item.id);
assert.equal(navIds.length, new Set(navIds).size);

const desktopWorkspaceSource = readFileSync(new URL('../src/workspace/DesktopWorkspace.jsx', import.meta.url), 'utf8');
const navBlock = desktopWorkspaceSource.match(/const NAV_ITEMS = \[([\s\S]*?)\];/)?.[1] || '';
const desktopWorkspaceNavIds = [...navBlock.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
assert.deepEqual(desktopWorkspaceNavIds.slice(0, 5), ['dashboard', 'profile', 'events', 'booking', 'dialogs']);
assert.ok(desktopWorkspaceSource.includes("if (activeSection === 'profile')"));
assert.ok(desktopWorkspaceSource.includes('<DigitalShowcaseBuilder'));

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
